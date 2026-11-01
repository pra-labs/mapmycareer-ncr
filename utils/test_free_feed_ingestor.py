#!/usr/bin/env python3
"""
test_free_feed_ingestor.py - Comprehensive unit & integration tests for free_feed_ingestor.py.
Verifies:
1. Normalization into MapMyCareer job schema.
2. Filtering logic:
   - Matches target tech roles (SWE, Frontend, Backend, Fullstack, DevOps, Data Engineer).
   - Rejects non-tech roles and non-English foreign job postings.
   - Enforces remote India/Worldwide compatibility, excluding non-India regional postings.
3. Non-duplicating dataset merge logic:
   - Does not overwrite or duplicate existing IDs.
   - Accurately assigns next incremental ID.
   - Updates last_seen_at timestamp for re-encountered active jobs.
4. Extensibility and mock API feed testing.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock

from utils.free_feed_ingestor import (
    clean_text,
    detect_experience,
    detect_skills,
    extract_company_domain,
    get_salary_by_level,
    is_india_or_worldwide_remote,
    is_target_tech_role,
    is_valid_title,
    merge_jobs_into_dataset,
    normalize_remoteok_job,
    fetch_remoteok_feed,
    fetch_free_feeds,
)


class TestFreeFeedIngestor(unittest.TestCase):
    def setUp(self):
        self.sample_remoteok_item = {
            "slug": "remote-senior-full-stack-engineer-acme-123456",
            "id": "123456",
            "epoch": 1793404804,
            "date": "2026-10-31T00:00:04+00:00",
            "company": "Acme Corp",
            "company_logo": "https://example.com/logo.png",
            "position": "Senior Full Stack Engineer",
            "tags": ["react", "node", "typescript", "dev", "fullstack"],
            "description": "<p>We are seeking a Senior Full Stack Engineer...</p>",
            "location": "Worldwide",
            "apply_url": "https://remoteok.com/remote-jobs/123456",
            "salary_min": 100000,
            "salary_max": 150000,
            "url": "https://remoteok.com/remote-jobs/123456",
        }

    def test_clean_text_unescape_and_mojibake(self):
        self.assertEqual(clean_text("Sothebyâ€™s"), "Sotheby’s")
        self.assertEqual(clean_text("Travel &amp; Hospitality"), "Travel & Hospitality")
        self.assertEqual(clean_text("  Senior Engineer  "), "Senior Engineer")
        self.assertEqual(clean_text(None), "")

    def test_is_valid_title(self):
        self.assertTrue(is_valid_title("Senior Software Engineer"))
        self.assertTrue(is_valid_title("Frontend Engineer (React)"))
        # Foreign patterns
        self.assertFalse(is_valid_title("Softwareentwickler (m/w/d)"))
        self.assertFalse(is_valid_title("DESARROLLADOR FULL STACK"))
        self.assertFalse(is_valid_title("Werkstudent IT"))

    def test_is_target_tech_role(self):
        # Target tech roles
        self.assertTrue(is_target_tech_role("Senior Software Engineer"))
        self.assertTrue(is_target_tech_role("Frontend Developer"))
        self.assertTrue(is_target_tech_role("Back-End Engineer"))
        self.assertTrue(is_target_tech_role("Fullstack Engineer"))
        self.assertTrue(is_target_tech_role("DevOps Specialist"))
        self.assertTrue(is_target_tech_role("Senior Data Engineer"))
        self.assertTrue(is_target_tech_role("Site Reliability Engineer"))
        self.assertTrue(is_target_tech_role("Cloud Engineer Automation"))

        # Non-tech roles rejected
        self.assertFalse(is_target_tech_role("Scientific Account Executive"))
        self.assertFalse(is_target_tech_role("Contract Recruiter"))
        self.assertFalse(is_target_tech_role("Travel Booking Agent"))
        self.assertFalse(is_target_tech_role("Competent Wind Turbine Technician"))

        # Role matched by tech tags
        self.assertTrue(is_target_tech_role("Engineering Lead", ["frontend", "react"]))

    def test_is_india_or_worldwide_remote(self):
        # Open / Worldwide / India
        self.assertTrue(is_india_or_worldwide_remote("Worldwide", "Software Engineer"))
        self.assertTrue(is_india_or_worldwide_remote("Remote", "Backend Engineer"))
        self.assertTrue(is_india_or_worldwide_remote("India", "DevOps Engineer"))
        self.assertTrue(is_india_or_worldwide_remote("", "Fullstack Engineer"))

        # Restricted regions rejected
        self.assertFalse(is_india_or_worldwide_remote("US Only", "Software Engineer"))
        self.assertFalse(is_india_or_worldwide_remote("LATAM", "Software Engineer"))
        self.assertFalse(is_india_or_worldwide_remote("Remote - US", "Software Engineer"))
        self.assertFalse(is_india_or_worldwide_remote("", "Senior Backend Engineer LATAM"))
        self.assertFalse(is_india_or_worldwide_remote("Canada Only", "Software Engineer"))

    def test_detect_experience_and_salary(self):
        yoe, exp, std = detect_experience("Lead Platform Engineer")
        self.assertEqual(exp, "Lead")
        self.assertEqual(std, "L4")
        sal_range, s_min, s_max = get_salary_by_level(exp)
        self.assertEqual(sal_range, "₹50 - 90 LPA")
        self.assertEqual(s_min, 50)
        self.assertEqual(s_max, 90)

        yoe, exp, std = detect_experience("Senior DevOps Engineer")
        self.assertEqual(exp, "Senior")
        self.assertEqual(std, "L3")

        yoe, exp, std = detect_experience("Junior Frontend Developer")
        self.assertEqual(exp, "Entry")
        self.assertEqual(std, "L1")

    def test_detect_skills(self):
        skills_fe = detect_skills("Senior Frontend Engineer")
        self.assertIn("React", skills_fe)
        self.assertIn("TypeScript", skills_fe)

        skills_devops = detect_skills("DevOps Cloud Engineer")
        self.assertIn("Kubernetes", skills_devops)
        self.assertIn("AWS", skills_devops)

        skills_de = detect_skills("Senior Data Engineer", ["snowflake", "databricks"])
        self.assertIn("Databricks", skills_de)
        self.assertIn("SQL", skills_de)

    def test_extract_company_domain(self):
        self.assertEqual(extract_company_domain("DuckDuckGo"), "duckduckgo.com")
        self.assertEqual(extract_company_domain("OpenAI"), "openai.com")
        self.assertEqual(extract_company_domain("Smile Digital Health"), "smiledigitalhealth.com")

    def test_normalize_remoteok_job(self):
        job = normalize_remoteok_job(self.sample_remoteok_item, "2026-11-01T12:00:00Z")
        self.assertIsNotNone(job)
        # Check required schema fields
        required_fields = [
            "title", "company", "company_domain", "company_logo",
            "city", "hub", "lat", "lon", "skills", "salary_range",
            "salary_min_lpa", "salary_max_lpa", "workplace_model",
            "apply_url", "experience_level", "experience_yoe",
            "source", "standard_level", "level_name"
        ]
        for field in required_fields:
            self.assertIn(field, job, f"Missing expected field: {field}")

        self.assertEqual(job["title"], "Senior Full Stack Engineer")
        self.assertEqual(job["company"], "Acme Corp")
        self.assertEqual(job["workplace_model"], "Remote")
        self.assertEqual(job["source"], "remoteok")
        self.assertEqual(job["city"], "Bengaluru")
        self.assertEqual(job["experience_level"], "Senior")
        self.assertEqual(job["company_logo"], "https://example.com/logo.png")

    def test_normalize_remoteok_job_rejected_non_tech(self):
        item = dict(self.sample_remoteok_item)
        item["position"] = "Senior Recruiter"
        item["tags"] = ["recruiter", "talent", "hr"]
        job = normalize_remoteok_job(item, "2026-11-01T12:00:00Z")
        self.assertIsNone(job)

    def test_normalize_remoteok_job_rejected_regional_restriction(self):
        item = dict(self.sample_remoteok_item)
        item["location"] = "US Only"
        job = normalize_remoteok_job(item, "2026-11-01T12:00:00Z")
        self.assertIsNone(job)

    @patch("utils.free_feed_ingestor.fetch_json")
    def test_fetch_remoteok_feed(self, mock_fetch):
        mock_fetch.return_value = [
            {"legal": "terms..."},  # legal disclaimer header item from remoteok
            self.sample_remoteok_item
        ]
        jobs = fetch_remoteok_feed(limit=10)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["title"], "Senior Full Stack Engineer")

    def test_merge_jobs_into_dataset_non_duplication(self):
        with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".json") as f:
            temp_path = f.name
            initial_data = [
                {
                    "id": 100,
                    "title": "Existing Software Engineer",
                    "company": "Existing Co",
                    "apply_url": "https://example.com/existing-job",
                    "last_seen_at": "2026-10-01T00:00:00Z"
                }
            ]
            json.dump(initial_data, f)

        try:
            new_jobs = [
                # Existing job with same apply_url
                {
                    "title": "Existing Software Engineer",
                    "company": "Existing Co",
                    "apply_url": "https://example.com/existing-job",
                    "source": "remoteok"
                },
                # Brand new job
                {
                    "title": "Brand New DevOps Engineer",
                    "company": "New Corp",
                    "apply_url": "https://example.com/brand-new-job",
                    "source": "remoteok"
                }
            ]

            added, updated = merge_jobs_into_dataset(new_jobs, temp_path)
            self.assertEqual(added, 1)
            self.assertEqual(updated, 1)

            with open(temp_path, "r") as f:
                saved_data = json.load(f)

            self.assertEqual(len(saved_data), 2)
            # Check ID incrementation
            new_job_record = [j for j in saved_data if j["apply_url"] == "https://example.com/brand-new-job"][0]
            self.assertEqual(new_job_record["id"], 101)

            # Check update of existing job timestamp
            updated_job_record = [j for j in saved_data if j["apply_url"] == "https://example.com/existing-job"][0]
            self.assertEqual(updated_job_record["id"], 100)
            self.assertNotEqual(updated_job_record["last_seen_at"], "2026-10-01T00:00:00Z")

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
