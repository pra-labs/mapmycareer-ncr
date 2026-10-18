#!/usr/bin/env python3
import unittest
from unittest.mock import patch, MagicMock
import urllib.error

from utils.robots_check import RobotsTxtValidator, pattern_to_regex, is_url_crawl_allowed


class TestRobotsCheck(unittest.TestCase):
    def test_regex_conversion_basic(self):
        reg = pattern_to_regex("/jobs/")
        self.assertTrue(reg.match("/jobs/"))
        self.assertTrue(reg.match("/jobs/123"))
        self.assertFalse(reg.match("/job"))

    def test_regex_conversion_wildcard(self):
        reg = pattern_to_regex("/api/*/posting")
        self.assertTrue(reg.match("/api/v1/posting"))
        self.assertTrue(reg.match("/api/test/sub/posting/xyz"))
        self.assertFalse(reg.match("/api/posting"))

    def test_regex_conversion_end_anchor(self):
        reg = pattern_to_regex("/*.json$")
        self.assertTrue(reg.match("/jobs.json"))
        self.assertFalse(reg.match("/jobs.json.bak"))
        self.assertFalse(reg.match("/jobs.json/"))

    def test_allow_vs_disallow_precedence(self):
        # Longest match wins
        robots_txt = """
        User-agent: *
        Disallow: /careers/
        Allow: /careers/openings/
        """
        val = RobotsTxtValidator(robots_txt)
        self.assertFalse(val.is_allowed("https://example.com/careers/lead-engineer"))
        self.assertTrue(val.is_allowed("https://example.com/careers/openings/123"))

    def test_equal_length_allow_precedence(self):
        # When lengths are equal, Allow takes precedence over Disallow in RFC 9309
        robots_txt = """
        User-agent: *
        Disallow: /p/
        Allow: /p/
        """
        val = RobotsTxtValidator(robots_txt)
        self.assertTrue(val.is_allowed("https://example.com/p/item"))

    def test_disallow_longer_than_allow(self):
        robots_txt = """
        User-agent: *
        Allow: /careers
        Disallow: /careers/private
        """
        val = RobotsTxtValidator(robots_txt)
        self.assertTrue(val.is_allowed("https://example.com/careers/public-job"))
        self.assertFalse(val.is_allowed("https://example.com/careers/private/hidden"))

    def test_empty_disallow_means_allow_all(self):
        robots_txt = """
        User-agent: *
        Disallow:
        """
        val = RobotsTxtValidator(robots_txt)
        self.assertTrue(val.is_allowed("https://example.com/anything"))

    def test_user_agent_targeting(self):
        robots_txt = """
        User-agent: SpecificBot
        Disallow: /secret/

        User-agent: *
        Disallow: /
        """
        val = RobotsTxtValidator(robots_txt)
        # SpecificBot matches its own block
        self.assertTrue(val.is_allowed("https://example.com/public", user_agent="SpecificBot/1.0"))
        self.assertFalse(val.is_allowed("https://example.com/secret/key", user_agent="SpecificBot/1.0"))
        # Generic bot matches * block
        self.assertFalse(val.is_allowed("https://example.com/public", user_agent="OtherBot/2.0"))

    def test_default_allow_on_404(self):
        val = RobotsTxtValidator(robots_content=None, status_code=404)
        self.assertTrue(val.is_allowed("https://example.com/careers/job1"))

    def test_disallow_on_500(self):
        val = RobotsTxtValidator(robots_content=None, status_code=500)
        self.assertFalse(val.is_allowed("https://example.com/careers/job1"))

    @patch("urllib.request.urlopen")
    def test_network_fetch_allowed(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = b"User-agent: *\nDisallow: /admin/\nAllow: /"
        mock_response.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response

        allowed = is_url_crawl_allowed("https://target.com/jobs/dev")
        self.assertTrue(allowed)

        disallowed = is_url_crawl_allowed("https://target.com/admin/settings")
        self.assertFalse(disallowed)

    @patch("urllib.request.urlopen")
    def test_network_fetch_404_defaults_to_allow(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError("https://target.com/robots.txt", 404, "Not Found", None, None)
        self.assertTrue(is_url_crawl_allowed("https://target.com/jobs/dev"))


if __name__ == "__main__":
    unittest.main()
