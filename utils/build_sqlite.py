#!/usr/bin/env python3
"""
utils/build_sqlite.py

Zero-dependency SQLite database compiler for MapMyCareer NCR.
Reads web/public/data/jobs.json, extracts structured fields, infers city and corridor slugs,
and writes an optimized, indexed SQLite database atomically to web/data/jobs.db.
"""

import json
import os
import sqlite3
import sys
import time
from pathlib import Path

# Corridor configurations synced with web/src/lib/corridors.ts
CORRIDORS = [
    {
        "city_slug": "gurugram",
        "corridor_slug": "dlf-cyber-city",
        "corridor_name": "DLF Cyber City & Cyber Hub",
        "keywords": [
            "cyber city",
            "cyber hub",
            "dlf phase 2",
            "dlf phase 3",
            "tower 8c",
            "building 14",
            "infinity towers",
        ],
    },
    {
        "city_slug": "bengaluru",
        "corridor_slug": "outer-ring-road",
        "corridor_name": "Outer Ring Road (ORR) Tech Corridor",
        "keywords": [
            "outer ring road",
            "bellandur",
            "marathahalli",
            "kadubeesanahalli",
            "ecospace",
            "ecoworld",
            "cesna",
        ],
    },
    {
        "city_slug": "bengaluru",
        "corridor_slug": "whitefield",
        "corridor_name": "Whitefield IT Park Corridor",
        "keywords": [
            "whitefield",
            "itpl",
            "export promotion",
            "epip",
            "hoodi",
            "vydehi",
            "gr tech park",
        ],
    },
    {
        "city_slug": "hyderabad",
        "corridor_slug": "hitec-city",
        "corridor_name": "HITEC City & Gachibowli Tech Corridor",
        "keywords": [
            "hitec city",
            "hitex",
            "gachibowli",
            "madhapur",
            "financial district",
            "kondapur",
            "raidurg",
            "cyberabad",
            "waverock",
            "knowledge city",
        ],
    },
    {
        "city_slug": "noida",
        "corridor_slug": "sector-62",
        "corridor_name": "Sector 62 & Greater Noida Expressway",
        "keywords": [
            "sector 62",
            "sector 125",
            "sector 126",
            "sector 127",
            "sector 132",
            "sector 135",
            "sector 142",
            "greater noida expressway",
            "advant navis",
            "oxygen business park",
            "stellar 135",
            "candor techspace",
        ],
    },
    {
        "city_slug": "pune",
        "corridor_slug": "hinjawadi",
        "corridor_name": "Hinjawadi Rajiv Gandhi Infotech Park",
        "keywords": [
            "hinjawadi",
            "hinjewadi",
            "rajiv gandhi infotech",
            "phase 1",
            "phase 2",
            "phase 3",
            "blue ridge",
            "megapolis",
        ],
    },
    {
        "city_slug": "mumbai",
        "corridor_slug": "bkc",
        "corridor_name": "Bandra Kurla Complex (BKC) & Powai",
        "keywords": [
            "bkc",
            "bandra kurla",
            "bandra-kurla",
            "powai",
            "hiranandani",
            "godrej one",
            "vikhroli",
            "nirlon knowledge park",
            "goregaon east",
            "mindspace malad",
        ],
    },
    {
        "city_slug": "delhi",
        "corridor_slug": "aerocity",
        "corridor_name": "Aerocity Worldmark & South Delhi Tech",
        "keywords": [
            "aerocity",
            "worldmark",
            "okhla phase",
            "jasola",
            "nehru place",
            "saket district centre",
        ],
    },
]


def resolve_corridor(city_slug: str, hub: str, title: str):
    """Match job hub and title against known tech corridors for a city."""
    hub_lower = (hub or "").lower()
    title_lower = (title or "").lower()

    for corr in CORRIDORS:
        if corr["city_slug"] == city_slug:
            for kw in corr["keywords"]:
                if kw in hub_lower or kw in title_lower:
                    return corr["corridor_name"], corr["corridor_slug"]
    return None, None


def build_sqlite(repo_root: Path):
    json_path = repo_root / "web" / "public" / "data" / "jobs.json"
    data_dir = repo_root / "web" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    db_path = data_dir / "jobs.db"
    tmp_db_path = data_dir / "jobs.db.tmp"

    if not json_path.exists():
        print(f"Error: {json_path} does not exist", file=sys.stderr)
        sys.exit(1)

    print(f"Loading jobs from {json_path}...")
    t0 = time.time()
    with open(json_path, "r", encoding="utf-8") as f:
        jobs = json.load(f)
    print(f"Loaded {len(jobs):,} records in {time.time() - t0:.2f}s")

    # Remove temporary database if it already exists
    if tmp_db_path.exists():
        tmp_db_path.unlink()

    conn = sqlite3.connect(tmp_db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA temp_store = MEMORY;")

    cur.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            company_domain TEXT,
            company_logo TEXT,
            experience_yoe TEXT,
            experience_level TEXT,
            standard_level TEXT,
            city TEXT,
            city_slug TEXT,
            corridor TEXT,
            corridor_slug TEXT,
            hub TEXT,
            lat REAL,
            lon REAL,
            skills_json TEXT,
            salary_range TEXT,
            workplace_model TEXT,
            apply_url TEXT,
            source TEXT,
            last_verified_at TEXT,
            raw_json TEXT
        );
        """
    )

    rows = []
    for item in jobs:
        job_id = str(item.get("id"))
        title = item.get("title") or ""
        company = item.get("company") or ""
        company_domain = item.get("company_domain") or ""
        company_logo = item.get("company_logo") or ""
        experience_yoe = item.get("experience_yoe") or ""
        experience_level = item.get("experience_level") or ""
        standard_level = item.get("standard_level") or ""
        city = item.get("city") or ""
        city_slug = city.strip().lower().replace(" ", "-") if city else ""

        hub = item.get("hub") or ""
        corridor, corridor_slug = resolve_corridor(city_slug, hub, title)

        lat = item.get("lat")
        lon = item.get("lon")

        skills = item.get("skills")
        skills_json = json.dumps(skills) if skills is not None else "[]"

        salary_range = item.get("salary_range") or ""
        workplace_model = item.get("workplace_model") or ""
        apply_url = item.get("apply_url") or ""
        source = item.get("source") or ""

        last_verified_at = (
            item.get("first_seen_at")
            or item.get("last_seen_at")
            or item.get("scraped_date")
            or ""
        )

        raw_json = json.dumps(item, separators=(",", ":"))

        rows.append(
            (
                job_id,
                title,
                company,
                company_domain,
                company_logo,
                experience_yoe,
                experience_level,
                standard_level,
                city,
                city_slug,
                corridor,
                corridor_slug,
                hub,
                lat,
                lon,
                skills_json,
                salary_range,
                workplace_model,
                apply_url,
                source,
                last_verified_at,
                raw_json,
            )
        )

    print(f"Inserting {len(rows):,} records into SQLite table...")
    cur.executemany(
        """
        INSERT INTO jobs (
            id, title, company, company_domain, company_logo,
            experience_yoe, experience_level, standard_level,
            city, city_slug, corridor, corridor_slug, hub,
            lat, lon, skills_json, salary_range, workplace_model,
            apply_url, source, last_verified_at, raw_json
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
        """,
        rows,
    )

    print("Creating B-tree indexes...")
    cur.execute("CREATE INDEX idx_jobs_city_slug ON jobs(city_slug);")
    cur.execute("CREATE INDEX idx_jobs_city_corridor ON jobs(city_slug, corridor_slug);")
    cur.execute("CREATE INDEX idx_jobs_company ON jobs(company);")
    cur.execute("CREATE INDEX idx_jobs_workplace ON jobs(workplace_model);")

    conn.commit()

    print("Optimizing database storage (PRAGMA journal_mode=DELETE; VACUUM)...")
    cur.execute("PRAGMA journal_mode=DELETE;")
    cur.execute("VACUUM;")
    conn.close()

    # Atomically replace destination
    print(f"Atomically replacing {tmp_db_path} -> {db_path}...")
    os.replace(tmp_db_path, db_path)

    size_mb = db_path.stat().st_size / (1024 * 1024)
    print(f"Successfully generated {db_path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parent if current_dir.name == "utils" else current_dir
    build_sqlite(repo_root)
