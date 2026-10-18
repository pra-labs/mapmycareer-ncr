#!/usr/bin/env python3
"""
Career Portal Scraper - Non-AI extractor for tech career postings.
Parses schema.org JobPosting JSON-LD (<script type="application/ld+json">)
from HTML or fetched web pages (Greenhouse, Lever, standard company careers pages).
Normalizes extracted jobs into MapMyCareer's schema format compatible with sample_jobs.json.
"""

import argparse
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Tuple, Union

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MapMyCareerBot/1.0"

CITY_HUBS: Dict[str, Dict[str, Any]] = {
    "Gurugram": {"default_hub": "DLF Cyber City, Gurugram", "lat": 28.4942, "lon": 77.0898},
    "Noida": {"default_hub": "Sector 62 / Sector 125, Noida", "lat": 28.6234, "lon": 77.3689},
    "Delhi": {"default_hub": "Aerocity Worldmark, New Delhi", "lat": 28.5502, "lon": 77.1215},
    "Bengaluru": {"default_hub": "Outer Ring Road / Whitefield, Bengaluru", "lat": 12.9288, "lon": 77.6833},
    "Hyderabad": {"default_hub": "HITEC City / Gachibowli, Hyderabad", "lat": 17.4435, "lon": 78.3489},
    "Pune": {"default_hub": "Hinjawadi Infotech Park, Pune", "lat": 18.5912, "lon": 73.7389},
    "Mumbai": {"default_hub": "BKC / Powai, Mumbai", "lat": 19.1558, "lon": 72.8552},
    "Chennai": {"default_hub": "OMR Tech Corridor, Chennai", "lat": 12.9648, "lon": 80.2458},
    "Kolkata": {"default_hub": "Salt Lake Sector V, Kolkata", "lat": 22.5726, "lon": 88.3639},
    "Ahmedabad": {"default_hub": "GIFT City, Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    "Kochi": {"default_hub": "Infopark, Kochi", "lat": 10.0150, "lon": 76.3620},
    "Thiruvananthapuram": {"default_hub": "Technopark, Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366},
    "Coimbatore": {"default_hub": "Tidel Park, Coimbatore", "lat": 11.0168, "lon": 76.9558},
    "Chandigarh": {"default_hub": "IT Park, Chandigarh", "lat": 30.7333, "lon": 76.7794},
}

COMMON_TECH_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java", "C++", "C#", "Go", "Golang",
    "Rust", "Ruby", "PHP", "Swift", "Kotlin", "AWS", "Azure", "GCP", "Kubernetes", "Docker",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "GraphQL", "REST", "CI/CD",
    "Terraform", "Linux", "Git", "Spark", "Hadoop", "Pandas", "PyTorch", "TensorFlow",
    "Machine Learning", "System Design", "Microservices", "Agile", "DevOps"
]


class JSONLDExtractor(HTMLParser):
    """HTML parser that captures content inside <script type="application/ld+json"> tags."""

    def __init__(self):
        super().__init__()
        self.in_json_ld = False
        self.current_data: List[str] = []
        self.extracted_scripts: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        if tag.lower() == "script":
            attr_dict = {k.lower(): (v or "") for k, v in attrs}
            content_type = attr_dict.get("type", "").strip().lower()
            if "application/ld+json" in content_type:
                self.in_json_ld = True
                self.current_data = []

    def handle_data(self, data: str):
        if self.in_json_ld:
            self.current_data.append(data)

    def handle_endtag(self, tag: str):
        if tag.lower() == "script" and self.in_json_ld:
            self.in_json_ld = False
            full_text = "".join(self.current_data).strip()
            if full_text:
                self.extracted_scripts.append(full_text)
            self.current_data = []


def clean_html_text(raw_html: Optional[str]) -> str:
    """Strips HTML tags and unescapes HTML entities into clean plain text."""
    if not raw_html:
        return ""
    # Replace block level breaks with space
    text = re.sub(r"<(?:p|br|div|li|h[1-6])[^>]*>", " ", str(raw_html), flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_json_ld_blocks(html_content: str) -> List[Any]:
    """Parses all JSON-LD blocks from HTML content."""
    parser = JSONLDExtractor()
    try:
        parser.feed(html_content)
    except Exception:
        # Fallback to regex if HTML parser fails on malformed HTML
        pass

    scripts = list(parser.extracted_scripts)

    # Fallback / regex discovery in case parser missed script tags with unquoted or atypical attributes
    regex_matches = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html_content,
        re.DOTALL | re.IGNORECASE,
    )
    for m in regex_matches:
        cleaned = m.strip()
        if cleaned and cleaned not in scripts:
            scripts.append(cleaned)

    parsed_objects: List[Any] = []
    for s in scripts:
        try:
            parsed = json.loads(s)
            parsed_objects.append(parsed)
        except Exception:
            # Handle loose JSON or comments if needed
            cleaned = re.sub(r"/\*.*?\*/", "", s, flags=re.DOTALL).strip()
            try:
                parsed_objects.append(json.loads(cleaned))
            except Exception:
                continue

    return parsed_objects


def find_job_postings(data: Any) -> List[Dict[str, Any]]:
    """Recursively traverses parsed JSON-LD structure to locate all JobPosting objects."""
    jobs: List[Dict[str, Any]] = []

    if isinstance(data, list):
        for item in data:
            jobs.extend(find_job_postings(item))
    elif isinstance(data, dict):
        type_field = data.get("@type")
        is_job = False
        if isinstance(type_field, str) and type_field.lower() == "jobposting":
            is_job = True
        elif isinstance(type_field, list) and any(
            isinstance(t, str) and t.lower() == "jobposting" for t in type_field
        ):
            is_job = True

        if is_job:
            jobs.append(data)

        # Also search nested fields (e.g., @graph, mainEntity, hasPart, itemListElement)
        for key, val in data.items():
            if key != "@type" and isinstance(val, (dict, list)):
                jobs.extend(find_job_postings(val))

    return jobs


def detect_experience(title: str, description: str = "") -> Tuple[str, str, str]:
    """Infers experience yoe, experience level, and standard level (L1-L4)."""
    combined = f"{title} {description[:400]}".lower()

    # Search for explicit years in text (e.g. 5+ years, 3-5 years)
    yoe_match = re.search(r"(\d+)\s*(?:-|to|\+)\s*(\d+)?\s*(?:yrs|years|year)", combined)
    explicit_yoe = None
    if yoe_match:
        start_yr = int(yoe_match.group(1))
        if yoe_match.group(2):
            end_yr = int(yoe_match.group(2))
            explicit_yoe = f"{start_yr}-{end_yr} yrs"
        else:
            explicit_yoe = f"{start_yr}+ yrs"

    t = title.lower()
    if any(k in t for k in ["lead", "principal", "staff", "architect", "director", "head", "vp", "chief"]):
        return explicit_yoe or "8+ yrs", "Lead", "L4"
    if any(k in t for k in ["senior", "sr.", "sr ", "iii", "level 3"]):
        return explicit_yoe or "5-8 yrs", "Senior", "L3"
    if any(k in t for k in ["intern", "trainee", "junior", "jr.", "jr ", "entry", "associate", "graduate"]):
        return explicit_yoe or "0-2 yrs", "Entry", "L1"

    return explicit_yoe or "2-5 yrs", "Mid", "L2"


def detect_skills(text: str) -> List[str]:
    """Detects matching technology skills from job title and description."""
    found: List[str] = []
    text_lower = f" {text.lower()} "
    for skill in COMMON_TECH_SKILLS:
        # Match with word boundaries
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(skill.lower()) + r"(?![a-zA-Z0-9])"
        if re.search(pattern, text_lower):
            found.append(skill)
    if not found:
        return ["Python", "JavaScript", "SQL"]
    return found[:10]


def extract_location(raw_job: Dict[str, Any]) -> Tuple[str, str, str]:
    """
    Extracts (city, region, full_address_str) from schema.org jobLocation or applicantLocationRequirements.
    """
    loc_val = raw_job.get("jobLocation")
    city = ""
    region = ""
    address_parts: List[str] = []

    def inspect_place(place: Any):
        nonlocal city, region
        if not isinstance(place, dict):
            if isinstance(place, str):
                address_parts.append(place)
            return

        address = place.get("address")
        if isinstance(address, str):
            address_parts.append(address)
        elif isinstance(address, dict):
            loc_city = address.get("addressLocality")
            loc_reg = address.get("addressRegion")
            loc_country = address.get("addressCountry")
            street = address.get("streetAddress")

            if loc_city and not city:
                city = str(loc_city).strip()
            if loc_reg and not region:
                region = str(loc_reg).strip()

            for p in [street, loc_city, loc_reg, loc_country]:
                if p:
                    if isinstance(p, dict):
                        p_name = p.get("name")
                        if p_name:
                            address_parts.append(str(p_name))
                    else:
                        address_parts.append(str(p))

        name = place.get("name")
        if name and str(name).strip() not in address_parts:
            address_parts.append(str(name).strip())

    if isinstance(loc_val, list):
        for item in loc_val:
            inspect_place(item)
    elif isinstance(loc_val, dict):
        inspect_place(loc_val)
    elif isinstance(loc_val, str):
        address_parts.append(loc_val)

    # Check applicantLocationRequirements if jobLocation empty
    app_loc = raw_job.get("applicantLocationRequirements")
    if not address_parts and app_loc:
        if isinstance(app_loc, dict):
            inspect_place(app_loc)
        elif isinstance(app_loc, list):
            for al in app_loc:
                inspect_place(al)

    full_addr = ", ".join([p for p in address_parts if p])
    return city, region, full_addr


def extract_company_info(raw_job: Dict[str, Any], default_domain: str = "") -> Tuple[str, str]:
    """Extracts company name and company domain from hiringOrganization."""
    hiring_org = raw_job.get("hiringOrganization")
    company_name = ""
    company_domain = default_domain

    if isinstance(hiring_org, dict):
        company_name = hiring_org.get("name", "")
        same_as = hiring_org.get("sameAs") or hiring_org.get("url")
        if same_as:
            if isinstance(same_as, list) and len(same_as) > 0:
                same_as = same_as[0]
            if isinstance(same_as, str):
                parsed_u = urllib.parse.urlparse(same_as)
                if parsed_u.netloc:
                    company_domain = parsed_u.netloc.lower().replace("www.", "")
    elif isinstance(hiring_org, str):
        company_name = hiring_org

    if not company_name:
        company_name = "Tech Organization"
    if not company_domain:
        slug = re.sub(r"[^a-zA-Z0-9]", "", company_name).lower()
        company_domain = f"{slug}.com" if slug else "company.com"

    return company_name.strip(), company_domain.strip()


def extract_salary(raw_job: Dict[str, Any]) -> str:
    """Extracts formatted salary or benchmark string from baseSalary or estimatedSalary."""
    salary_obj = raw_job.get("baseSalary") or raw_job.get("estimatedSalary")
    if isinstance(salary_obj, dict):
        val = salary_obj.get("value")
        currency = salary_obj.get("currency", "INR")
        curr_sym = "₹" if currency in ["INR", "₹"] else f"{currency} "
        if isinstance(val, dict):
            min_val = val.get("minValue")
            max_val = val.get("maxValue")
            unit = val.get("unitText", "YEAR")
            if min_val and max_val:
                return f"{curr_sym}{min_val} - {max_val} ({unit})"
            elif min_val:
                return f"{curr_sym}{min_val}+ ({unit})"
            elif max_val:
                return f"Up to {curr_sym}{max_val} ({unit})"
        elif isinstance(val, (int, float, str)):
            return f"{curr_sym}{val}"
    return "₹20 - 50 LPA"


def detect_workplace_model(raw_job: Dict[str, Any], text_pool: str) -> str:
    """Determines Remote / Hybrid / On-site."""
    job_location_type = str(raw_job.get("jobLocationType", "")).upper()
    if "TELECOMMUTE" in job_location_type or "REMOTE" in job_location_type:
        return "Remote"

    pool_lower = text_pool.lower()
    if "remote" in pool_lower or "work from home" in pool_lower or "wfh" in pool_lower:
        if "hybrid" in pool_lower:
            return "Hybrid"
        return "Remote"
    if "hybrid" in pool_lower:
        return "Hybrid"
    return "On-site"


def normalize_job_posting(
    raw_job: Dict[str, Any],
    fallback_url: str = "",
    job_id: int = 1
) -> Dict[str, Any]:
    """
    Transforms schema.org JobPosting object to MapMyCareer's schema format.
    """
    title = str(raw_job.get("title", "Software Engineer")).strip()
    raw_desc = raw_job.get("description", "")
    clean_desc = clean_html_text(raw_desc)
    responsibilities = raw_job.get("responsibilities", "")
    if isinstance(responsibilities, list):
        clean_resp = " ".join([clean_html_text(r) for r in responsibilities])
    else:
        clean_resp = clean_html_text(str(responsibilities))

    full_text_context = f"{title} {clean_desc} {clean_resp}"

    # Company
    fallback_domain = ""
    if fallback_url:
        netloc = urllib.parse.urlparse(fallback_url).netloc.lower().replace("www.", "")
        fallback_domain = netloc
    company_name, company_domain = extract_company_info(raw_job, default_domain=fallback_domain)

    # Location & Hub
    city_field, region_field, full_address = extract_location(raw_job)
    workplace_model = detect_workplace_model(raw_job, f"{full_address} {full_text_context}")

    matched_city = "Bengaluru"
    search_location_str = f"{city_field} {region_field} {full_address}".lower()
    for known_city in CITY_HUBS:
        if known_city.lower() in search_location_str:
            matched_city = known_city
            break

    hub_info = CITY_HUBS.get(matched_city, CITY_HUBS["Bengaluru"])
    hub_name = hub_info["default_hub"]
    lat = hub_info["lat"]
    lon = hub_info["lon"]

    # Experience & Skills
    yoe, exp_level, std_level = detect_experience(title, clean_desc)
    skills = detect_skills(full_text_context)

    # Apply URL
    apply_url = raw_job.get("url")
    if not apply_url:
        direct_apply = raw_job.get("directApply")
        if isinstance(direct_apply, str) and direct_apply.startswith("http"):
            apply_url = direct_apply
    if not apply_url:
        apply_url = fallback_url or ""

    # Job Type
    raw_job_type = raw_job.get("employmentType", "FULL_TIME")
    if isinstance(raw_job_type, list) and raw_job_type:
        raw_job_type = raw_job_type[0]
    job_type = "Full-time"
    jt_str = str(raw_job_type).lower()
    if "part" in jt_str:
        job_type = "Part-time"
    elif "contract" in jt_str or "temp" in jt_str:
        job_type = "Contract"
    elif "intern" in jt_str:
        job_type = "Internship"

    salary = extract_salary(raw_job)
    date_posted = str(raw_job.get("datePosted", ""))
    valid_through = str(raw_job.get("validThrough", ""))

    normalized: Dict[str, Any] = {
        "id": job_id,
        "title": title,
        "company": company_name,
        "company_logo": f"https://www.google.com/s2/favicons?domain={company_domain}&sz=128",
        "company_domain": company_domain,
        "experience_yoe": yoe,
        "experience_level": exp_level,
        "job_type": job_type,
        "city": matched_city,
        "hub": hub_name,
        "lat": lat,
        "lon": lon,
        "skills": skills,
        "salary_range": salary,
        "workplace_model": workplace_model,
        "apply_url": apply_url,
        "source": "career_portal_scraper",
        "standard_level": std_level,
        "level_name": f"{exp_level} Engineer",
        "level_code": std_level,
        "level_tier": exp_level,
        "level_yoe_range": yoe,
        "levels_fyi_benchmark": salary,
        "levels_fyi_url": f"https://www.levels.fyi/companies/{company_domain.split('.')[0]}/salaries",
        "description": clean_desc,
        "date_posted": date_posted,
        "valid_through": valid_through,
    }
    return normalized


def scrape_from_html(html_content: str, source_url: str = "", start_id: int = 1) -> List[Dict[str, Any]]:
    """Extracts and normalizes all JobPosting entries found in HTML content."""
    json_ld_blocks = extract_json_ld_blocks(html_content)
    all_raw_jobs: List[Dict[str, Any]] = []
    for block in json_ld_blocks:
        all_raw_jobs.extend(find_job_postings(block))

    normalized_jobs: List[Dict[str, Any]] = []
    current_id = start_id
    for raw_job in all_raw_jobs:
        normalized_jobs.append(normalize_job_posting(raw_job, fallback_url=source_url, job_id=current_id))
        current_id += 1

    return normalized_jobs


def fetch_url_html(url: str, timeout: int = 15) -> str:
    """Fetches HTML content from a URL with standard HTTP request."""
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content_bytes = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
        return content_bytes.decode(charset, errors="replace")


def scrape_from_url(url: str, start_id: int = 1) -> List[Dict[str, Any]]:
    """Fetches a URL and parses JobPosting entries."""
    content = fetch_url_html(url)
    return scrape_from_html(content, source_url=url, start_id=start_id)


def scrape_batch(urls_file: str, start_id: int = 1) -> List[Dict[str, Any]]:
    """Scrapes a list of URLs specified in a file."""
    if not os.path.exists(urls_file):
        raise FileNotFoundError(f"URLs file not found: {urls_file}")

    with open(urls_file, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]

    results: List[Dict[str, Any]] = []
    current_id = start_id
    for u in urls:
        try:
            jobs = scrape_from_url(u, start_id=current_id)
            results.extend(jobs)
            current_id += len(jobs)
        except Exception as e:
            sys.stderr.write(f"Error scraping {u}: {e}\n")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Career Portal Scraper: Pure script-based JSON-LD extractor for job postings."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", help="Target career portal URL to scrape")
    group.add_argument("--file", help="Path to local HTML file containing JobPosting JSON-LD")
    group.add_argument("--batch", help="Path to file containing list of URLs (one per line)")

    parser.add_argument("--out", help="Path to save output JSON (defaults to stdout)")
    parser.add_argument("--start-id", type=int, default=1, help="Starting ID for jobs (default: 1)")

    args = parser.parse_args()

    jobs: List[Dict[str, Any]] = []
    if args.url:
        jobs = scrape_from_url(args.url, start_id=args.start_id)
    elif args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
        jobs = scrape_from_html(content, source_url="", start_id=args.start_id)
    elif args.batch:
        jobs = scrape_batch(args.batch, start_id=args.start_id)

    output_data = json.dumps(jobs, indent=2, ensure_ascii=False)

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output_data)
        print(f"Scraped {len(jobs)} job(s) and wrote to {args.out}")
    else:
        print(output_data)


if __name__ == "__main__":
    main()
