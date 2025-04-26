import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def extract_domain(url):
    """
    Normalize a URL or hostname to its domain part.
    Examples:
      https://example.com/path/abc -> example.com
      example.com/path -> example.com
      example.com -> example.com
    """
    url = url.strip()
    url = re.sub(r'^https?://', "", url)
    url = url.rstrip("/*")
    url = url.rstrip("/")
    return url.split("/")[0]


def extract_urls_from_section(text):
    """
    Extract all URLs starting with https:// from the given text.
    """
    urls = re.findall(r'https://[^\s<>\)]+', text)
    return [extract_domain(u) for u in urls]


def extract_section(text, section_titles):
    """
    Extract the section content following any of the given section titles.
    """
    for title in section_titles:
        if title in text:
            section = text.split(title, 1)[1]
            # Stop at the next section (## ...) or end of file
            section = re.split(r'\n## |\Z', section, maxsplit=1)[0]
            return section
    return ""


def main():
    # 1. Load manifest.json and extract domains from matches and host_permissions
    with open(f"{REPO_ROOT}/manifest.json", encoding="utf-8") as f:
        manifest = json.load(f)
    matches = []
    for cs in manifest["content_scripts"]:
        matches.extend(cs["matches"])
    host_permissions = manifest["host_permissions"]
    domains_matches = [extract_domain(u) for u in matches]
    domains_host_permissions = [extract_domain(u) for u in host_permissions]

    # 2. Load all README files and extract domains from the Features/機能/功能 section
    readme_files = [
        (f"{REPO_ROOT}/README.md", ["## Features"]),
        (f"{REPO_ROOT}/README_JA.md", ["## 機能"]),
        (f"{REPO_ROOT}/README_CH.md", ["## 功能"]),
    ]
    domains_from_readmes = set()
    for fname, section_titles in readme_files:
        if not Path(fname).exists():
            continue
        with open(fname, encoding="utf-8") as f:
            text = f.read()
        section = extract_section(text, section_titles)
        urls = extract_urls_from_section(section)
        domains_from_readmes.update(urls)

    # 3. Load supported-site.js and extract domains
    with open(f"{REPO_ROOT}/constants/supported-sites.js", encoding="utf-8") as f:
        js = f.read()
    supported_sites = re.findall(r'"([^"]+)"', js)
    domains_supported_sites = [extract_domain(u) for u in supported_sites]

    # 4. Compare sets
    def diff(a, b):
        return sorted(set(a) - set(b))

    print("--- manifest.json matches vs host_permissions ---")
    print("In matches but not in host_permissions:", diff(domains_matches, domains_host_permissions))
    print("In host_permissions but not in matches:", diff(domains_host_permissions, domains_matches))

    print("\n--- host_permissions vs all README files ---")
    print("In host_permissions but not in any README:", diff(domains_host_permissions, domains_from_readmes))
    print("In any README but not in host_permissions:", diff(domains_from_readmes, domains_host_permissions))

    print("\n--- host_permissions vs supported-site.js ---")
    print("In host_permissions but not in supported-site.js:", diff(domains_host_permissions, domains_supported_sites))
    print("In supported-site.js but not in host_permissions:", diff(domains_supported_sites, domains_host_permissions))

    # Exit with error if there are any differences
    if any([
        diff(domains_matches, domains_host_permissions),
        diff(domains_host_permissions, domains_matches),
        diff(domains_host_permissions, domains_from_readmes),
        diff(domains_from_readmes, domains_host_permissions),
        diff(domains_host_permissions, domains_supported_sites),
        diff(domains_supported_sites, domains_host_permissions)
    ]):
        sys.exit(1)


if __name__ == "__main__":
    main()
