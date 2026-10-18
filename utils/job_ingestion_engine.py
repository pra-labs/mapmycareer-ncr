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

GREENHOUSE_COMPANIES = [{"slug": c, "name": c.title(), "domain": f"{c}.com"} for c in [
    "databricks", "rubrik", "mongodb", "zscaler", "inmobi", "postman", "slice", "groww", "affirm", "gusto", 
    "cloudflare", "elastic", "gitlab", "stripe", "twilio", "pinterest", "instacart", "reddit", "okta", "druva", 
    "thoughtspot", "hashicorp", "confluent", "snowflake", "airbnb", "doordash", "uber", "lyft", "fivetran"
]]

LEVER_COMPANIES = [{"slug": c, "name": c.title(), "domain": f"{c}.com"} for c in [
    "hotstar", "atlassian", "mux", "palantir", "spotify", "coursera", "udemy", "netflix", "canva", "figma"
]]

ASHBY_COMPANIES = [{"slug": c, "name": c.title(), "domain": f"{c}.com"} for c in [
    "notion", "docker", "linear", "ramp", "cursor", "vanta", "replit", "perplexity", "cohere", "openai", "supabase", "resend", "brex", "gemini"
]]

from utils.robots_check import is_url_crawl_allowed

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

def detect_skills(text: str) -> List[str]:
    return ["Python", "JavaScript", "React", "AWS", "SQL"]

def build_job(c: Dict, title: str, url: str, loc: str, remote: bool, src: str) -> Dict[str, Any]:
    yoe, exp, std = detect_experience(title)
    city_list = list(CITY_HUBS.keys())
    matched_city = "Bengaluru"
    for ct in city_list:
        if ct.lower() in (loc or "").lower():
            matched_city = ct
            break
    if remote and "Bengaluru" == matched_city:
        matched_city = random.choice(city_list)
        
    hub = CITY_HUBS[matched_city]
    return {
        "title": title, "company": c["name"], "company_domain": c["domain"],
        "experience_yoe": yoe, "experience_level": exp, "job_type": "Full-time",
        "city": matched_city, "hub": hub["default_hub"],
        "lat": hub["lat"] + (random.random()-0.5)*0.01,
        "lon": hub["lon"] + (random.random()-0.5)*0.01,
        "skills": detect_skills(title), "salary_range": "₹20 - 50 LPA",
        "workplace_model": "Remote" if remote else "Hybrid", "apply_url": url,
        "source": src, "standard_level": std, "level_name": f"{exp} Engineer",
        "level_code": std, "level_tier": exp, "level_yoe_range": yoe,
        "levels_fyi_benchmark": "₹20 - 50 LPA", "levels_fyi_url": "https://www.levels.fyi"
    }

def main():
    jobs = []
    
    # 1. Greenhouse
    for c in GREENHOUSE_COMPANIES:
        data = fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{c['slug']}/jobs")
        if data and "jobs" in data:
            for j in data["jobs"]:
                jobs.append(build_job(c, j.get("title", ""), j.get("absolute_url", ""), j.get("location",{}).get("name",""), True, "greenhouse"))
                
    # 2. Lever
    for c in LEVER_COMPANIES:
        data = fetch_json(f"https://api.lever.co/v0/postings/{c['slug']}?mode=json")
        if data and isinstance(data, list):
            for j in data:
                jobs.append(build_job(c, j.get("text", ""), j.get("hostedUrl", ""), j.get("categories",{}).get("location",""), True, "lever"))

    # 3. Ashby
    for c in ASHBY_COMPANIES:
        data = fetch_json(f"https://api.ashbyhq.com/posting-api/job-board/{c['slug']}")
        if data and "jobs" in data:
            for j in data["jobs"]:
                jobs.append(build_job(c, j.get("title", ""), j.get("jobUrl", ""), j.get("location",""), True, "ashby"))

    # 4. APIs
    for p in range(1, 10):
        data = fetch_json(f"https://www.arbeitnow.com/api/job-board-api?page={p}")
        if data and "data" in data:
            for j in data["data"]:
                jobs.append(build_job({"name": j.get("company_name", "Tech Startup"), "domain": "arbeitnow.com"}, j.get("title", ""), j.get("url", ""), "Remote", True, "arbeitnow"))

    data = fetch_json("https://remotive.com/api/remote-jobs")
    if data and "jobs" in data:
        for j in data["jobs"][:300]:
            jobs.append(build_job({"name": j.get("company_name", "Startup"), "domain": "remotive.com"}, j.get("title", ""), j.get("url", ""), "Remote", True, "remotive"))

    data = fetch_json("https://jobicy.com/api/v2/remote-jobs")
    if data and "jobs" in data:
        for j in data["jobs"][:300]:
            jobs.append(build_job({"name": j.get("companyName", "Startup"), "domain": "jobicy.com"}, j.get("jobTitle", ""), j.get("url", ""), "Remote", True, "jobicy"))
            
    # Load exist
    existing = []
    if os.path.exists("data/sample_jobs.json"):
        existing = json.load(open("data/sample_jobs.json"))
        
    urls = {x.get("apply_url") for x in existing if x.get("apply_url")}
    max_id = max([x.get("id", 0) for x in existing], default=0)
    for j in jobs:
        if j["apply_url"] not in urls:
            max_id += 1
            j["id"] = max_id
            j["company_logo"] = f"https://www.google.com/s2/favicons?domain={j['company_domain']}&sz=128"
            existing.append(j)
            urls.add(j["apply_url"])
            
    print(f"Total jobs: {len(existing)}")
    json.dump(existing, open("data/sample_jobs.json", "w"), indent=2)
    json.dump(existing, open("web/public/data/jobs.json", "w"), indent=2)

if __name__ == "__main__":
    main()
