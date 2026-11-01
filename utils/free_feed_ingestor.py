#!/usr/bin/env python3
"""
free_feed_ingestor.py - Ingests remote tech jobs from free, non-AI public feeds (RemoteOK / freehire).

Filters specifically for tech roles matching India/Remote:
- Software Engineer / Developer
- Frontend Engineer
- Backend Engineer
- Fullstack Engineer
- DevOps / Cloud / SRE Engineer
- Data Engineer

Normalizes data into the standard MapMyCareer job schema and allows merging
cleanly into data/sample_jobs.json (and optionally web/public/data/jobs.json)
without duplicate IDs or duplicate apply URLs.
"""

import html
import json
import logging
import os
import random
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# Try local or package import for robots checking
try:
    from utils.robots_check import is_url_crawl_allowed
except ImportError:
    try:
        from robots_check import is_url_crawl_allowed
    except ImportError:
        is_url_crawl_allowed = None

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("free_feed_ingestor")

# Standard City Tech Hubs consistent with job_ingestion_engine.py
CITY_HUBS = {
    "Bengaluru": {"default_hub": "Outer Ring Road / Whitefield, Bengaluru", "lat": 12.9288, "lon": 77.6833},
    "Hyderabad": {"default_hub": "HITEC City / Gachibowli, Hyderabad", "lat": 17.4435, "lon": 78.3489},
    "Gurugram": {"default_hub": "DLF Cyber City, Gurugram", "lat": 28.4942, "lon": 77.0898},
    "Noida": {"default_hub": "Sector 62 / Sector 125, Noida", "lat": 28.6234, "lon": 77.3689},
    "Delhi": {"default_hub": "Aerocity Worldmark, New Delhi", "lat": 28.5502, "lon": 77.1215},
    "Pune": {"default_hub": "Hinjawadi Infotech Park, Pune", "lat": 18.5912, "lon": 73.7389},
    "Mumbai": {"default_hub": "BKC / Powai, Mumbai", "lat": 19.1558, "lon": 72.8552},
    "Chennai": {"default_hub": "OMR Tech Corridor, Chennai", "lat": 12.9648, "lon": 80.2458},
    "Kolkata": {"default_hub": "Salt Lake Sector V, Kolkata", "lat": 22.5726, "lon": 88.3639},
    "Ahmedabad": {"default_hub": "GIFT City, Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    "Kochi": {"default_hub": "Infopark, Kochi", "lat": 10.0150, "lon": 76.3620},
    "Thiruvananthapuram": {"default_hub": "Technopark, Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366},
    "Coimbatore": {"default_hub": "Tidel Park, Coimbatore", "lat": 11.0168, "lon": 76.9558},
    "Chandigarh": {"default_hub": "IT Park, Chandigarh", "lat": 30.7333, "lon": 76.7794}
}

COMPANY_CANONICAL_NAMES = {
    "openai": "OpenAI",
    "mongodb": "MongoDB",
    "gitlab": "GitLab",
    "fivetran": "Fivetran",
    "hashicorp": "HashiCorp",
    "thoughtspot": "ThoughtSpot",
    "postman": "Postman",
    "atlassian": "Atlassian",
    "cloudflare": "Cloudflare",
    "databricks": "Databricks",
    "snowflake": "Snowflake",
    "zscaler": "Zscaler",
    "supabase": "Supabase",
    "perplexity": "Perplexity AI",
    "hotstar": "Disney+ Hotstar",
    "mux": "Mux",
    "gemini": "Google Gemini",
    "coinbase": "Coinbase",
    "robinhood": "Robinhood",
    "datadog": "Datadog",
    "scaleai": "Scale AI",
    "pagerduty": "PagerDuty",
    "duolingo": "Duolingo",
    "launchdarkly": "LaunchDarkly",
    "cockroachlabs": "Cockroach Labs",
    "circleci": "CircleCI",
    "posthog": "PostHog",
    "midjourney": "Midjourney",
    "elevenlabs": "ElevenLabs",
    "langchain": "LangChain",
    "runway": "Runway",
    "synthesia": "Synthesia",
    "duckduckgo": "DuckDuckGo",
}

# Regex and keyword matchers for targeted tech roles
TARGET_TECH_PATTERNS = [
    r'\bsoftware\s+engineer\b',
    r'\bsoftware\s+developer\b',
    r'\bfront[\s\-]?end\b',
    r'\bback[\s\-]?end\b',
    r'\bfull[\s\-]?stack\b',
    r'\bdevops\b',
    r'\bdata\s+engineer\b',
    r'\bcloud\s+engineer\b',
    r'\bsite\s+reliability\s+engineer\b',
    r'\bsre\b',
    r'\bplatform\s+engineer\b',
]

FOREIGN_TITLE_PATTERNS = [
    r'\(m/w/d\)', r'\(all genders\)', r'\(m/f/d\)', r'werkstudent', r'gmbh',
    r'entwickler', r'berater', r'spezialist', r'techniker', r'leiter', r'praktikant',
    r'\bdesarrollador\b'
]

# Strict non-India/regional exclusions
REGIONAL_EXCLUSIONS = [
    r'\bus\s+only\b', r'\busa\s+only\b', r'\bu\.s\.\s+only\b', r'\bus\s*/\s*canada\b',
    r'\bnorth\s+america\b', r'\blatam\b', r'\buk\s+only\b', r'\bcanada\s+only\b',
    r'\bgermany\s+only\b', r'\baustralia\s+only\b', r'\beurope\s+only\b', r'\bemea\s+only\b',
    r'\bremote\s*-\s*us\b', r'\bremote\s*\(\s*us\s*\)', r'\bus\s+remote\b'
]


def clean_text(val: Optional[str]) -> str:
    """Unescapes HTML entities, fixes mojibake if present, and trims whitespace."""
    if not val:
        return ""
    text = html.unescape(val)
    # Check if text has typical double-encoded UTF-8 mojibake (e.g. â€™)
    if "â" in text or "Ã" in text:
        for enc in ("cp1252", "latin1"):
            try:
                text = text.encode(enc).decode("utf-8")
                break
            except Exception:
                pass
    return text.strip()


def is_valid_title(title: str) -> bool:
    """Checks whether the title is valid English and free of non-target foreign patterns."""
    if not title:
        return False
    for pat in FOREIGN_TITLE_PATTERNS:
        if re.search(pat, title, re.IGNORECASE):
            return False
    return True


def is_target_tech_role(title: str, tags: Optional[List[str]] = None) -> bool:
    """Verifies that the job matches core tech roles (SWE, Frontend, Backend, Fullstack, DevOps, Data Engineer)."""
    title_lower = title.lower()
    for pat in TARGET_TECH_PATTERNS:
        if re.search(pat, title_lower):
            return True

    # Check tags as secondary signal
    if tags:
        tag_str = " ".join([clean_text(t).lower() for t in tags])
        for pat in TARGET_TECH_PATTERNS:
            if re.search(pat, tag_str):
                return True
    return False


def is_india_or_worldwide_remote(location: str, title: str) -> bool:
    """
    Determines if a remote position is open to India / Worldwide.
    Rejects positions strictly restricted to other specific non-India regions (e.g. US Only, LATAM).
    """
    loc_lower = (location or "").lower()
    title_lower = (title or "").lower()

    for pat in REGIONAL_EXCLUSIONS:
        if re.search(pat, loc_lower) or re.search(pat, title_lower):
            return False

    return True


def detect_experience(title: str) -> Tuple[str, str, str]:
    """Detects YOE, experience level, and level code from job title."""
    t = title.lower()
    if any(k in t for k in ["lead", "principal", "staff", "architect", "director", "head"]):
        return "8+ yrs", "Lead", "L4"
    if any(k in t for k in ["senior", "sr"]):
        return "5-8 yrs", "Senior", "L3"
    if any(k in t for k in ["intern", "junior", "entry"]):
        return "0-2 yrs", "Entry", "L1"
    return "2-5 yrs", "Mid", "L2"


def get_salary_by_level(exp: str) -> Tuple[str, int, int]:
    """Returns standardized Indian salary range and LPA bounds."""
    if exp == "Entry":
        return "₹8 - 16 LPA", 8, 16
    elif exp == "Mid":
        return "₹16 - 32 LPA", 16, 32
    elif exp == "Senior":
        return "₹30 - 60 LPA", 30, 60
    elif exp == "Lead":
        return "₹50 - 90 LPA", 50, 90
    return "₹18 - 36 LPA", 18, 36


def detect_skills(text: str, tags: Optional[List[str]] = None) -> List[str]:
    """Detects relevant tech skills from title and tags."""
    t = (text or "").lower()
    if tags:
        t += " " + " ".join([clean_text(tg).lower() for tg in tags])

    if any(k in t for k in ["sdet", "qa", "quality", "test", "automation"]):
        return ["Selenium", "Playwright", "Cypress", "Python", "Test Automation", "Postman", "CI/CD"]
    if any(k in t for k in ["data", "spark", "databricks", "snowflake", "etl", "pipeline"]):
        return ["Python", "SQL", "Apache Spark", "Databricks", "Data Modeling", "ETL", "Snowflake"]
    if any(k in t for k in ["devops", "sre", "cloud", "infrastructure", "kubernetes", "docker", "terraform"]):
        return ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD", "Linux", "Prometheus"]
    if any(k in t for k in ["frontend", "front end", "react", "next.js", "vue", "angular", "ui"]):
        return ["React", "TypeScript", "Next.js", "Tailwind CSS", "JavaScript", "HTML/CSS"]
    if any(k in t for k in ["backend", "back end", "golang", "go", "node", "django", "fastapi"]):
        return ["Python", "Go", "Node.js", "PostgreSQL", "REST APIs", "Docker", "Microservices"]
    if any(k in t for k in ["fullstack", "full stack"]):
        return ["React", "Node.js", "TypeScript", "PostgreSQL", "Tailwind CSS", "REST APIs"]
    if any(k in t for k in ["mobile", "android", "ios", "flutter", "react native"]):
        return ["React Native", "Flutter", "Swift", "Kotlin", "Mobile App Development"]
    return ["Python", "JavaScript", "React", "AWS", "SQL", "Microservices"]


def extract_company_domain(company_name: str, fallback_domain: str = "remoteok.com") -> str:
    """Generates or cleans a company domain for favicon rendering."""
    c_lower = company_name.lower().strip()
    if c_lower in COMPANY_CANONICAL_NAMES:
        c_slug = c_lower
    else:
        c_slug = re.sub(r'[^a-zA-Z0-9]', '', c_lower)
    return f"{c_slug}.com" if c_slug else fallback_domain


def fetch_json(url: str, check_robots: bool = True, timeout: int = 10) -> Optional[Any]:
    """Fetches JSON from URL with RFC-compliant robots.txt check and browser-like user agent."""
    try:
        if check_robots and is_url_crawl_allowed and not is_url_crawl_allowed(url):
            logger.warning(f"Skipping {url}: Disallowed by robots.txt")
            return None
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; MapMyCareer/1.0)"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def normalize_remoteok_job(item: Dict[str, Any], now_iso: str) -> Optional[Dict[str, Any]]:
    """Normalizes a single RemoteOK API item into MapMyCareer schema."""
    if not isinstance(item, dict) or not item.get("id"):
        return None

    raw_title = item.get("position") or ""
    title = clean_text(raw_title)
    if not is_valid_title(title):
        return None

    tags = item.get("tags") or []
    if not is_target_tech_role(title, tags):
        return None

    location = clean_text(item.get("location") or "")
    if not is_india_or_worldwide_remote(location, title):
        return None

    raw_company = item.get("company") or "Remote Tech Co"
    company_clean = clean_text(raw_company)
    company_name = COMPANY_CANONICAL_NAMES.get(company_clean.lower(), company_clean)

    company_domain = extract_company_domain(company_name)
    company_logo = item.get("company_logo") or item.get("logo")
    if not company_logo:
        company_logo = f"https://www.google.com/s2/favicons?domain={company_domain}&sz=128"

    apply_url = item.get("apply_url") or item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id')}"

    # Map city & coordinates (India tech hub default: Bengaluru for Remote)
    matched_city = None
    loc_lower = location.lower()
    for ct in CITY_HUBS.keys():
        if ct.lower() in loc_lower:
            matched_city = ct
            break

    if not matched_city:
        matched_city = "Bengaluru"

    hub_info = CITY_HUBS[matched_city]
    yoe, exp, std = detect_experience(title)
    sal_range, sal_min, sal_max = get_salary_by_level(exp)
    skills = detect_skills(title, tags)

    return {
        "title": title,
        "company": company_name,
        "company_domain": company_domain,
        "company_logo": company_logo,
        "experience_yoe": yoe,
        "experience_level": exp,
        "job_type": "Full-time",
        "city": matched_city,
        "hub": hub_info["default_hub"],
        "lat": round(hub_info["lat"] + (random.random() - 0.5) * 0.01, 6),
        "lon": round(hub_info["lon"] + (random.random() - 0.5) * 0.01, 6),
        "skills": skills,
        "salary_range": sal_range,
        "salary_min_lpa": sal_min,
        "salary_max_lpa": sal_max,
        "workplace_model": "Remote",
        "apply_url": apply_url,
        "source": "remoteok",
        "standard_level": std,
        "level_name": f"{exp} Engineer",
        "level_code": std,
        "level_tier": exp,
        "level_yoe_range": yoe,
        "levels_fyi_benchmark": sal_range,
        "levels_fyi_url": f"https://www.levels.fyi/companies/{re.sub(r'[^a-zA-Z0-9]', '', company_name.lower())}/salaries/software-engineer",
        "first_seen_at": now_iso,
        "last_seen_at": now_iso
    }


def fetch_remoteok_feed(limit: int = 150) -> List[Dict[str, Any]]:
    """Ingests remote tech jobs from RemoteOK public API."""
    url = "https://remoteok.com/api"
    logger.info(f"Fetching RemoteOK feed from {url}...")
    data = fetch_json(url)
    if not data or not isinstance(data, list):
        logger.warning("Empty or invalid response from RemoteOK API")
        return []

    now_iso = datetime.now(timezone.utc).isoformat()
    jobs = []
    # RemoteOK returns metadata in index 0, jobs start at index 1
    items = data[1:] if len(data) > 1 and isinstance(data[0], dict) and "legal" in data[0] else data

    for item in items[:limit]:
        normalized = normalize_remoteok_job(item, now_iso)
        if normalized:
            jobs.append(normalized)

    logger.info(f"Successfully normalized {len(jobs)} tech jobs from RemoteOK.")
    return jobs


def fetch_free_feeds() -> List[Dict[str, Any]]:
    """Aggregates all free, non-AI public job feeds (RemoteOK and extensibility points)."""
    all_jobs: List[Dict[str, Any]] = []

    # 1. RemoteOK
    remoteok_jobs = fetch_remoteok_feed()
    all_jobs.extend(remoteok_jobs)

    return all_jobs


def atomic_save(data: Any, path: str):
    """Atomically writes JSON data to the target file path via a temporary file."""
    tmp_path = f"{path}.tmp"
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)


def merge_jobs_into_dataset(new_jobs: List[Dict[str, Any]], data_file: str, web_file: Optional[str] = None) -> Tuple[int, int]:
    """
    Merges newly ingested jobs into the master dataset without duplicating apply_url or id.
    Updates existing active jobs with new last_seen_at timestamp.
    Returns (num_new_added, num_updated).
    """
    if not os.path.exists(data_file):
        logger.error(f"Target data file does not exist: {data_file}")
        return 0, 0

    with open(data_file, "r", encoding="utf-8") as f:
        existing = json.load(f)

    url_map = {x.get("apply_url"): x for x in existing if x.get("apply_url")}
    max_id = max([x.get("id", 0) for x in existing if isinstance(x.get("id"), int)], default=0)

    now_iso = datetime.now(timezone.utc).isoformat()
    added_count = 0
    updated_count = 0

    for job in new_jobs:
        apply_url = job.get("apply_url")
        if not apply_url:
            continue

        if apply_url in url_map:
            # Job already exists - update last seen timestamp
            existing_job = url_map[apply_url]
            existing_job["last_seen_at"] = now_iso
            updated_count += 1
        else:
            # Append as new verified job
            max_id += 1
            job["id"] = max_id
            existing.append(job)
            url_map[apply_url] = job
            added_count += 1

    logger.info(f"Dataset merge: {added_count} new jobs added, {updated_count} existing jobs updated. Total: {len(existing)}")

    # Atomically save master file and web public file if provided
    atomic_save(existing, data_file)
    if web_file and os.path.exists(os.path.dirname(web_file)):
        atomic_save(existing, web_file)
        logger.info(f"Synchronized with web public file: {web_file}")

    return added_count, updated_count


def main():
    """Standalone CLI entry point for free feed ingestion."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_file = os.path.join(repo_root, "data", "sample_jobs.json")
    web_file = os.path.join(repo_root, "web", "public", "data", "jobs.json")

    logger.info("Starting free public job feeds ingestion...")
    jobs = fetch_free_feeds()
    logger.info(f"Ingested {len(jobs)} candidate tech jobs from free feeds.")

    if jobs:
        added, updated = merge_jobs_into_dataset(jobs, data_file, web_file)
        logger.info(f"Job ingestion complete: +{added} added, ~{updated} updated.")
    else:
        logger.warning("No jobs were ingested from free feeds.")


if __name__ == "__main__":
    main()
