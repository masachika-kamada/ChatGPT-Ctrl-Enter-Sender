import argparse
import json
import re
import socket
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_CONFIGS_PATH = REPO_ROOT / "constants" / "site-configs.js"
USER_AGENT = "Mozilla/5.0 (compatible; ChatGPT-Ctrl-Enter-Sender-Site-Monitor/1.0)"
TIMEOUT_SECONDS = 20
ATTEMPTS = 2

ALLOWED_EXTERNAL_REDIRECTS = {
    "notebook.google.com": {"accounts.google.com"},
}


@dataclass
class ProbeResult:
    status: int
    final_url: str
    redirect_hosts: list[str]


@dataclass
class CheckResult:
    hostname: str
    healthy: bool
    detail: str


def extract_hostnames(source):
    return re.findall(r'hostname:\s*"([^"]+)"', source)


def normalized_hostname(url):
    return (urlparse(url).hostname or "").lower().rstrip(".")


def display_url(url):
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


class RecordingRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        super().__init__()
        self.redirect_hosts = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        hostname = normalized_hostname(newurl)
        if hostname:
            self.redirect_hosts.append(hostname)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def probe(hostname):
    handler = RecordingRedirectHandler()
    opener = urllib.request.build_opener(handler)
    request = urllib.request.Request(
        f"https://{hostname}/",
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
    )

    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            return ProbeResult(response.status, response.geturl(), handler.redirect_hosts)
    except urllib.error.HTTPError as error:
        # 401/403/404 still prove that the configured host is serving traffic.
        return ProbeResult(error.code, error.geturl(), handler.redirect_hosts)


def classify(hostname, result):
    allowed = {hostname, *ALLOWED_EXTERNAL_REDIRECTS.get(hostname, set())}
    unexpected = []
    for redirected_hostname in result.redirect_hosts:
        if redirected_hostname not in allowed and redirected_hostname not in unexpected:
            unexpected.append(redirected_hostname)

    if unexpected:
        hosts = ", ".join(f"`{host}`" for host in unexpected)
        return CheckResult(hostname, False, f"redirected through unexpected host(s): {hosts}")

    return CheckResult(
        hostname,
        True,
        f"HTTP {result.status}; final URL `{display_url(result.final_url)}`",
    )


def check_hostname(hostname, probe_func=probe):
    errors = []
    for _ in range(ATTEMPTS):
        try:
            return classify(hostname, probe_func(hostname))
        except (OSError, socket.timeout, urllib.error.URLError) as error:
            errors.append(str(error))

    return CheckResult(hostname, False, f"unreachable after {ATTEMPTS} attempts: {errors[-1]}")


def render_report(results):
    failures = [result for result in results if not result.healthy]
    summary = (
        "The daily URL check found a configured host that may have moved or become unreachable."
        if failures
        else "All configured hosts passed the daily URL check."
    )
    lines = [
        "## Supported site URL monitor",
        "",
        summary,
        "HTTP 401/403/404 responses are treated as reachable; unexpected cross-host redirects are not.",
        "",
        "| Configured host | Result | Detail |",
        "| --- | --- | --- |",
    ]
    for result in results:
        state = "FAIL" if not result.healthy else "OK"
        lines.append(f"| `{result.hostname}` | {state} | {result.detail} |")

    lines.extend([
        "",
        f"Failures: **{len(failures)}** / {len(results)}",
        "",
        "Please verify the destination in a browser before changing extension permissions or selectors.",
    ])
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check supported site hostnames for moves and reachability")
    parser.add_argument("--output", type=Path, help="Write a Markdown report to this path")
    args = parser.parse_args(argv)

    hostnames = extract_hostnames(SITE_CONFIGS_PATH.read_text(encoding="utf-8"))
    if not hostnames:
        print("No supported hostnames found", file=sys.stderr)
        return 2

    results = [check_hostname(hostname) for hostname in hostnames]
    report = render_report(results)
    if args.output:
        args.output.write_text(report, encoding="utf-8")

    failures = [result for result in results if not result.healthy]
    print(json.dumps({"checked": len(results), "failures": len(failures)}))
    for result in failures:
        print(f"FAIL {result.hostname}: {result.detail}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
