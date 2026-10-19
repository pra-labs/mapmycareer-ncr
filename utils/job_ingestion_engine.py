#!/usr/bin/env python3
import json, os, re, urllib.request, urllib.parse, random
from typing import List, Dict, Any, Optional

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
}

def get_canonical_company_name(slug: str) -> str:
    return COMPANY_CANONICAL_NAMES.get(slug.lower(), slug.title())

GREENHOUSE_COMPANIES = [{"slug": c, "name": get_canonical_company_name(c), "domain": f"{c}.com"} for c in [
    "databricks", "rubrik", "mongodb", "zscaler", "inmobi", "postman", "slice", "groww", "affirm", "gusto", 
    "cloudflare", "elastic", "gitlab", "stripe", "twilio", "pinterest", "instacart", "reddit", "okta", "druva", 
    "thoughtspot", "hashicorp", "confluent", "snowflake", "airbnb", "doordash", "uber", "lyft", "fivetran",
    "coinbase", "robinhood", "datadog", "samsara", "scaleai", "ripple", "dropbox", "chime", "pagerduty",
    "brex", "duolingo", "sofi", "carta", "checkr", "verkada", "launchdarkly", "braze", "canonical",
    "cockroachlabs", "circleci"
]]

LEVER_COMPANIES = [{"slug": c, "name": get_canonical_company_name(c), "domain": f"{c}.com"} for c in [
    "hotstar", "atlassian", "mux", "palantir", "spotify", "coursera", "udemy", "netflix", "canva", "figma",
    "outreach"
]]

ASHBY_COMPANIES = [{"slug": c, "name": get_canonical_company_name(c), "domain": f"{c}.com"} for c in [
    "notion", "docker", "linear", "ramp", "cursor", "vanta", "replit", "perplexity", "cohere", "openai", 
    "supabase", "resend", "brex", "gemini", "posthog", "dust", "midjourney", "modal", "langchain", 
    "elevenlabs", "pika", "runway", "tavily", "synthesia"
]]

try:
    from utils.robots_check import is_url_crawl_allowed
except ImportError:
    try:
        from robots_check import is_url_crawl_allowed
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from robots_check import is_url_crawl_allowed

def fetch_json(url: str, check_robots: bool = True) -> Optional[Any]:
    try:
        if check_robots and not is_url_crawl_allowed(url):
            print(f"Skipping {url}: Disallowed by robots.txt")
            return None
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception:
        return None

def detect_experience(title: str) -> tuple[str, str, str]:
    t = title.lower()
    if any(k in t for k in ["lead", "principal", "staff", "architect", "director", "head"]): return "8+ yrs", "Lead", "L4"
    if any(k in t for k in ["senior", "sr"]): return "5-8 yrs", "Senior", "L3"
    if any(k in t for k in ["intern", "junior", "entry"]): return "0-2 yrs", "Entry", "L1"
    return "2-5 yrs", "Mid", "L2"

def get_salary_by_level(exp: str) -> tuple[str, int, int]:
    if exp == "Entry":
        return "₹8 - 16 LPA", 8, 16
    elif exp == "Mid":
        return "₹16 - 32 LPA", 16, 32
    elif exp == "Senior":
        return "₹30 - 60 LPA", 30, 60
    elif exp == "Lead":
        return "₹50 - 90 LPA", 50, 90
    return "₹18 - 36 LPA", 18, 36

def detect_skills(text: str) -> List[str]:
    t = (text or "").lower()
    if any(k in t for k in ["sdet", "qa", "quality", "test", "automation"]):
        return ["Selenium", "Playwright", "Cypress", "Python", "Test Automation", "Postman", "CI/CD"]
    if any(k in t for k in ["product manager", "product owner", "tpm", "program manager", "scrum master"]):
        return ["Product Strategy", "PRD Writing", "Agile/Scrum", "Jira", "A/B Testing", "Mixpanel", "SQL"]
    if any(k in t for k in ["designer", "ui/ux", "product design", "ux", "visual design"]):
        return ["Figma", "UI/UX", "User Research", "Wireframing", "Design Systems", "Prototyping"]
    if any(k in t for k in ["security", "cyber", "infosec", "soc", "penetration"]):
        return ["Cybersecurity", "SIEM", "Splunk", "OWASP", "Penetration Testing", "SOC", "Cloud Security"]
    if any(k in t for k in ["account executive", "sales", "bdr", "sdr", "business development"]):
        return ["Salesforce", "Enterprise Sales", "B2B Sales", "MEDDPICC", "Lead Generation", "Pipeline Management"]
    if any(k in t for k in ["customer success", "client success", "account manager", "csm"]):
        return ["Customer Success", "Salesforce", "Retention", "QBRs", "Zendesk", "Client Onboarding"]
    if any(k in t for k in ["marketing", "growth", "seo", "content", "brand"]):
        return ["Growth Marketing", "Google Analytics", "SEO", "PPC/SEM", "HubSpot", "A/B Testing"]
    if any(k in t for k in ["operations", "chief of staff", "bizops", "strategy"]):
        return ["Business Operations", "KPI Dashboards", "Process Optimization", "OKRs", "Financial Modeling"]
    if any(k in t for k in ["finance", "financial", "accounting", "fp&a", "audit", "tax"]):
        return ["Financial Modeling", "FP&A", "Variance Analysis", "Excel/VBA", "GAAP/IFRS", "NetSuite"]
    if any(k in t for k in ["recruiter", "talent", "human resources", "hr ", "people ops"]):
        return ["Technical Recruiting", "Candidate Sourcing", "Greenhouse", "ATS", "People Operations", "HRIS"]
    if any(k in t for k in ["data", "ml", "ai", "machine learning", "analytics"]):
        return ["Python", "Machine Learning", "PyTorch", "SQL", "Spark", "Databricks", "Snowflake"]
    if any(k in t for k in ["devops", "sre", "cloud", "infrastructure", "platform"]):
        return ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD", "Linux", "Prometheus"]
    if any(k in t for k in ["frontend", "front end", "react", "ui "]):
        return ["React", "TypeScript", "Next.js", "Tailwind CSS", "JavaScript", "HTML/CSS"]
    if any(k in t for k in ["mobile", "android", "ios", "flutter"]):
        return ["React Native", "Flutter", "Swift", "Kotlin", "Mobile App Development"]
    return ["Python", "JavaScript", "React", "AWS", "SQL", "Microservices"]

FOREIGN_TITLE_PATTERNS = [
    r'\(m/w/d\)', r'\(all genders\)', r'\(m/f/d\)', r'werkstudent', r'gmbh',
    r'entwickler', r'berater', r'spezialist', r'techniker', r'leiter', r'praktikant'
]

def is_valid_title(title: str) -> bool:
    if not title:
        return False
    for pat in FOREIGN_TITLE_PATTERNS:
        if re.search(pat, title, re.IGNORECASE):
            return False
    return True

def atomic_save(data: Any, path: str):
    tmp_path = f"{path}.tmp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)

def build_job(c: Dict, title: str, url: str, loc: str, remote: bool, src: str, now_iso: str) -> Optional[Dict[str, Any]]:
    if not is_valid_title(title):
        return None
    yoe, exp, std = detect_experience(title)
    sal_range, sal_min, sal_max = get_salary_by_level(exp)
    city_list = list(CITY_HUBS.keys())
    
    # Check if a specific city was mentioned in location string
    matched_city = None
    loc_lower = (loc or "").lower()
    for ct in city_list:
        if ct.lower() in loc_lower:
            matched_city = ct
            break

    # If no city match, check remote status
    if not matched_city:
        if remote or "remote" in loc_lower or "anywhere" in loc_lower:
            matched_city = "Bengaluru"
            remote = True
        else:
            matched_city = "Bengaluru"

    hub = CITY_HUBS[matched_city]
    company_name = c.get("name", "Tech Startup")
    return {
        "title": title, "company": company_name, "company_domain": c["domain"],
        "experience_yoe": yoe, "experience_level": exp, "job_type": "Full-time",
        "city": matched_city, "hub": hub["default_hub"],
        "lat": hub["lat"] + (random.random()-0.5)*0.01,
        "lon": hub["lon"] + (random.random()-0.5)*0.01,
        "skills": detect_skills(title), "salary_range": sal_range,
        "salary_min_lpa": sal_min, "salary_max_lpa": sal_max,
        "workplace_model": "Remote" if remote else "Hybrid", "apply_url": url,
        "source": src, "standard_level": std, "level_name": f"{exp} Engineer",
        "level_code": std, "level_tier": exp, "level_yoe_range": yoe,
        "levels_fyi_benchmark": sal_range, "levels_fyi_url": "https://www.levels.fyi",
        "first_seen_at": now_iso, "last_seen_at": now_iso
    }

def fetch_greenhouse_board(c: Dict, now_iso: str) -> List[Dict[str, Any]]:
    jobs = []
    data = fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{c['slug']}/jobs")
    if data and "jobs" in data:
        for j in data["jobs"]:
            built = build_job(c, j.get("title", ""), j.get("absolute_url", ""), j.get("location",{}).get("name",""), True, "greenhouse", now_iso)
            if built:
                jobs.append(built)
    return jobs

def fetch_lever_board(c: Dict, now_iso: str) -> List[Dict[str, Any]]:
    jobs = []
    data = fetch_json(f"https://api.lever.co/v0/postings/{c['slug']}?mode=json")
    if data and isinstance(data, list):
        for j in data:
            built = build_job(c, j.get("text", ""), j.get("hostedUrl", ""), j.get("categories",{}).get("location",""), True, "lever", now_iso)
            if built:
                jobs.append(built)
    return jobs

def fetch_ashby_board(c: Dict, now_iso: str) -> List[Dict[str, Any]]:
    jobs = []
    data = fetch_json(f"https://api.ashbyhq.com/posting-api/job-board/{c['slug']}")
    if data and "jobs" in data:
        for j in data["jobs"]:
            built = build_job(c, j.get("title", ""), j.get("jobUrl", ""), j.get("location",""), True, "ashby", now_iso)
            if built:
                jobs.append(built)
    return jobs

def main():
    from datetime import datetime, timezone
    from concurrent.futures import ThreadPoolExecutor, as_completed

    now_iso = datetime.now(timezone.utc).isoformat()
    jobs = []
    
    print("Initiating high-throughput concurrent corporate board ingestion...")
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for c in GREENHOUSE_COMPANIES:
            futures.append(executor.submit(fetch_greenhouse_board, c, now_iso))
        for c in LEVER_COMPANIES:
            futures.append(executor.submit(fetch_lever_board, c, now_iso))
        for c in ASHBY_COMPANIES:
            futures.append(executor.submit(fetch_ashby_board, c, now_iso))

        for fut in as_completed(futures):
            try:
                res = fut.result()
                if res:
                    jobs.extend(res)
            except Exception as e:
                pass

    print(f"Fetched {len(jobs)} active jobs from ATS boards concurrently.")

    # APIs with English Tech postings
    data = fetch_json("https://remotive.com/api/remote-jobs")
    if data and "jobs" in data:
        for j in data["jobs"][:300]:
            built = build_job({"name": j.get("company_name", "Startup"), "domain": "remotive.com"}, j.get("title", ""), j.get("url", ""), "Remote", True, "remotive", now_iso)
            if built:
                jobs.append(built)

    data = fetch_json("https://jobicy.com/api/v2/remote-jobs")
    if data and "jobs" in data:
        for j in data["jobs"][:300]:
            built = build_job({"name": j.get("companyName", "Startup"), "domain": "jobicy.com"}, j.get("jobTitle", ""), j.get("url", ""), "Remote", True, "jobicy", now_iso)
            if built:
                jobs.append(built)
            
    # Load and clean existing
    existing = []
    data_file = "data/sample_jobs.json"
    web_file = "web/public/data/jobs.json"

    if os.path.exists(data_file):
        raw_existing = json.load(open(data_file))
        for j in raw_existing:
            src = j.get("source", "")
            url = j.get("apply_url", "")
            title = j.get("title", "")
            if "arbeitnow" in src or "arbeitnow" in url or not is_valid_title(title):
                continue
            comp = j.get("company", "")
            if comp.lower() in COMPANY_CANONICAL_NAMES:
                j["company"] = COMPANY_CANONICAL_NAMES[comp.lower()]
            elif comp == comp.lower():
                j["company"] = comp.title()
            if j.get("salary_range") == "₹20 - 50 LPA" and j.get("experience_level"):
                sal_range, sal_min, sal_max = get_salary_by_level(j["experience_level"])
                j["salary_range"] = sal_range
                j["salary_min_lpa"] = sal_min
                j["salary_max_lpa"] = sal_max
                j["levels_fyi_benchmark"] = sal_range
            if "first_seen_at" not in j:
                j["first_seen_at"] = now_iso
            existing.append(j)
        
    url_map = {x.get("apply_url"): x for x in existing if x.get("apply_url")}
    max_id = max([x.get("id", 0) for x in existing], default=0)

    for j in jobs:
        apply_url = j.get("apply_url")
        if apply_url in url_map:
            # Update last_seen_at for active job
            url_map[apply_url]["last_seen_at"] = now_iso
        else:
            max_id += 1
            j["id"] = max_id
            j["company_logo"] = f"https://www.google.com/s2/favicons?domain={j['company_domain']}&sz=128"
            existing.append(j)
            url_map[apply_url] = j
            
    print(f"Total curated jobs: {len(existing)}")
    atomic_save(existing, data_file)
    atomic_save(existing, web_file)
    print("Atomic save complete.")

if __name__ == "__main__":
    main()
