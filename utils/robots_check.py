#!/usr/bin/env python3
"""
robots_check.py - RFC 9309 compliant robots.txt validator and crawler permission checker.

Evaluates whether crawling a URL is permitted according to robots.txt rules (RFC 9309).
Key specifications:
- Default User-Agent: MapMyCareerBot/1.0
- Longest match rule wins between Allow and Disallow.
- If match lengths are equal, Allow takes precedence over Disallow.
- Supports '*' (any character sequence) and '$' (end-of-path pattern anchor).
- Fallback / 404 / connection failure defaults to Allow (status 4xx/unreachable generally allows).
- Status 5xx indicates temporary server error (RFC 9309 disallows crawling on 5xx or treat as unreachable).
- Handles user-agent grouping and matching: specific token exact match vs wildcard '*'.
"""

import argparse
import fnmatch
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

DEFAULT_USER_AGENT = "MapMyCareerBot/1.0"
DEFAULT_TIMEOUT = 10


def pattern_to_regex(pattern: str) -> re.Pattern:
    """
    Convert an RFC 9309 robots.txt path pattern to a compiled regex.
    Wildcards:
      '*' matches 0 or more characters.
      '$' at the end anchors to the end of the URL path (or query).
    Path patterns match prefixes by default if no '$' is present at the end.
    """
    if not pattern:
        return re.compile(r"^")

    # Handle end anchor
    anchored_end = pattern.endswith("$")
    if anchored_end:
        pattern = pattern[:-1]

    parts = pattern.split("*")
    escaped_parts = [re.escape(p) for p in parts]
    regex_str = "^" + ".*".join(escaped_parts)
    if anchored_end:
        regex_str += "$"

    return re.compile(regex_str)


def parse_robots_txt(content: str) -> Dict[str, List[Tuple[str, str, int]]]:
    """
    Parses robots.txt content into a mapping of user-agent (lowercased) -> list of rules:
    (rule_type: 'allow'|'disallow', pattern: str, match_len: int)
    """
    agent_rules: Dict[str, List[Tuple[str, str, int]]] = {}
    current_agents: List[str] = []

    for raw_line in content.splitlines():
        # Remove comments and whitespace
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue

        if ":" not in line:
            continue

        key, val = line.split(":", 1)
        key = key.strip().lower()
        val = val.strip()

        if key == "user-agent":
            # If previous group had rules, start a new block; otherwise accumulate agents
            # RFC 9309 allows multiple consecutive User-Agent headers for the same record group
            if current_agents and any(agent in agent_rules and agent_rules[agent] for agent in current_agents):
                current_agents = []
            agent = val.lower()
            if agent:
                current_agents.append(agent)
                if agent not in agent_rules:
                    agent_rules[agent] = []
        elif key in ("allow", "disallow"):
            if not current_agents:
                continue
            rule_type = key
            pattern = val
            # Disallow with empty value means allow all
            if rule_type == "disallow" and not pattern:
                rule_type = "allow"
                pattern = "/"

            for agent in current_agents:
                agent_rules[agent].append((rule_type, pattern, len(pattern)))

    return agent_rules


class RobotsTxtValidator:
    def __init__(self, robots_content: Optional[str] = None, status_code: int = 200):
        self.status_code = status_code
        self.is_reachable = (robots_content is not None)
        self.rules = parse_robots_txt(robots_content or "") if robots_content else {}

    @classmethod
    def from_url(cls, base_url: str, user_agent: str = DEFAULT_USER_AGENT, timeout: int = DEFAULT_TIMEOUT) -> "RobotsTxtValidator":
        parsed = urllib.parse.urlparse(base_url)
        if not parsed.scheme or not parsed.netloc:
            # Not a valid absolute URL
            return cls(robots_content=None, status_code=404)

        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        req = urllib.request.Request(robots_url, headers={"User-Agent": user_agent})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read().decode("utf-8", errors="replace")
                return cls(robots_content=content, status_code=response.status)
        except urllib.error.HTTPError as e:
            # 404 or 4xx -> default allow according to RFC 9309 section 2.3.1.2
            # 5xx -> temporary server error, RFC 9309 specifies disallowed while 5xx persists
            if 400 <= e.code < 500:
                return cls(robots_content=None, status_code=e.code)
            else:
                return cls(robots_content=None, status_code=e.code)
        except Exception:
            # Network failure / DNS failure / timeout -> fail-open (allow) or treat as 404
            return cls(robots_content=None, status_code=404)

    def is_allowed(self, target_url: str, user_agent: str = DEFAULT_USER_AGENT) -> bool:
        # RFC 9309 Section 2.3.1.2 & 2.3.1.3:
        # 4xx: robots.txt is assumed not to exist -> allow all
        # 5xx: temporary error -> disallow
        if 500 <= self.status_code < 600:
            return False

        if not self.is_reachable or 400 <= self.status_code < 500:
            return True

        parsed = urllib.parse.urlparse(target_url)
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        # Match user-agent: RFC 9309 section 2.2.1:
        # 1. Match specific token (case-insensitive substring or exact token)
        # 2. Wildcard '*' fallback
        ua_token = user_agent.split("/")[0].strip().lower()
        candidate_rules: List[Tuple[str, str, int]] = []

        if ua_token in self.rules:
            candidate_rules = self.rules[ua_token]
        else:
            # Check if any rule key matches our ua_token prefix or full ua
            for k in self.rules:
                if k != "*" and k in ua_token:
                    candidate_rules = self.rules[k]
                    break

        if not candidate_rules and "*" in self.rules:
            candidate_rules = self.rules["*"]

        if not candidate_rules:
            return True

        # RFC 9309 Section 2.2.2:
        # The most specific (longest) match wins.
        # If lengths are equal, Allow takes precedence over Disallow.
        best_rule: Optional[Tuple[str, str, int]] = None

        for rule_type, pattern, plen in candidate_rules:
            regex = pattern_to_regex(pattern)
            if regex.match(path):
                if best_rule is None:
                    best_rule = (rule_type, pattern, plen)
                else:
                    best_type, best_pat, best_len = best_rule
                    if plen > best_len:
                        best_rule = (rule_type, pattern, plen)
                    elif plen == best_len:
                        # Allow overrides Disallow on tie
                        if rule_type == "allow":
                            best_rule = (rule_type, pattern, plen)

        if best_rule is None:
            return True

        return best_rule[0] == "allow"


def is_url_crawl_allowed(url: str, user_agent: str = DEFAULT_USER_AGENT, timeout: int = DEFAULT_TIMEOUT) -> bool:
    """Convenience function to check if a single URL can be crawled."""
    validator = RobotsTxtValidator.from_url(url, user_agent=user_agent, timeout=timeout)
    return validator.is_allowed(url, user_agent=user_agent)


def main():
    parser = argparse.ArgumentParser(description="Check if crawling a URL is permitted under RFC 9309 robots.txt rules.")
    parser.add_argument("url", help="Target URL to check")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help=f"User agent string (default: {DEFAULT_USER_AGENT})")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help=f"Timeout in seconds for fetching robots.txt (default: {DEFAULT_TIMEOUT})")

    args = parser.parse_args()

    allowed = is_url_crawl_allowed(args.url, user_agent=args.user_agent, timeout=args.timeout)
    if allowed:
        print(f"ALLOWED: {args.url}")
        sys.exit(0)
    else:
        print(f"DISALLOWED: {args.url}")
        sys.exit(1)


if __name__ == "__main__":
    main()
