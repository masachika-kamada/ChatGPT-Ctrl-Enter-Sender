import unittest
import urllib.error

from tools.check_site_urls import CheckResult, ProbeResult, check_hostname, classify, display_url, extract_hostnames, render_report


class SiteUrlMonitorTests(unittest.TestCase):
    def test_extracts_hostnames_from_site_configs(self):
        source = '''
          { hostname: "chatgpt.com", matchPatterns: ["https://chatgpt.com/*"] },
          { hostname: "duck.ai", matchPatterns: ["https://duck.ai/*"], optional: true },
        '''
        self.assertEqual(extract_hostnames(source), ["chatgpt.com", "duck.ai"])

    def test_same_host_redirect_is_healthy_even_with_forbidden_status(self):
        result = ProbeResult(403, "https://poe.com/login", ["poe.com"])
        classified = classify("poe.com", result)
        self.assertTrue(classified.healthy)

    def test_not_found_status_is_unhealthy(self):
        result = ProbeResult(404, "https://old.example/", [])
        classified = classify("old.example", result)
        self.assertFalse(classified.healthy)
        self.assertIn("HTTP 404", classified.detail)

    def test_unexpected_redirect_host_is_reported(self):
        result = ProbeResult(200, "https://new.example/", ["new.example"])
        classified = classify("old.example", result)
        self.assertFalse(classified.healthy)
        self.assertIn("new.example", classified.detail)

    def test_notebook_google_login_redirect_is_allowed(self):
        result = ProbeResult(
            200,
            "https://accounts.google.com/signin",
            ["accounts.google.com"],
        )
        classified = classify("notebook.google.com", result)
        self.assertTrue(classified.healthy)

    def test_display_url_omits_query_and_fragment(self):
        self.assertEqual(
            display_url("https://accounts.google.com/signin?token=example#step"),
            "https://accounts.google.com/signin",
        )

    def test_network_failure_is_retried(self):
        attempts = 0
        delays = []

        def failing_probe(_hostname):
            nonlocal attempts
            attempts += 1
            raise urllib.error.URLError("temporary failure")

        result = check_hostname("example.com", failing_probe, delays.append)
        self.assertEqual(attempts, 3)
        self.assertEqual(delays, [5, 15])
        self.assertFalse(result.healthy)
        self.assertIn("after 3 attempts", result.detail)
        self.assertIn("URLError: <urlopen error temporary failure>", result.detail)

    def test_empty_network_error_includes_exception_type(self):
        def failing_probe(_hostname):
            raise TimeoutError()

        result = check_hostname("example.com", failing_probe, lambda _delay: None)
        self.assertTrue(result.detail.endswith(": TimeoutError"))

    def test_report_includes_failure_count(self):
        report = render_report([
            CheckResult("ok.example", True, "HTTP 200"),
            CheckResult("moved.example", False, "unexpected redirect"),
        ])
        self.assertIn("Failures: **1** / 2", report)
        self.assertIn("`moved.example` | FAIL", report)


if __name__ == "__main__":
    unittest.main()
