#!/usr/bin/env python3
"""
Unit tests for career_portal_scraper.py.
Tests parsing of schema.org JobPosting JSON-LD from HTML, normalization to MapMyCareer schema,
handling of multiple postings, nested @graph representations, and CLI invocation.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

from utils.career_portal_scraper import (
    clean_html_text,
    detect_experience,
    detect_skills,
    extract_json_ld_blocks,
    find_job_postings,
    normalize_job_posting,
    scrape_from_html,
)

SAMPLE_GREENHOUSE_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Senior Backend Engineer - Databricks Careers</title>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": "Senior Backend Engineer",
        "description": "<p>We are seeking a <strong>Senior Backend Engineer</strong> with 5+ years experience to build scalable microservices using Python, Go, and Kubernetes on AWS.</p>",
        "identifier": {
            "@type": "PropertyValue",
            "name": "Databricks",
            "value": "1234567"
        },
        "datePosted": "2026-10-15T00:00:00Z",
        "validThrough": "2026-12-31T23:59:59Z",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": "Databricks",
            "sameAs": "https://databricks.com",
            "logo": "https://databricks.com/logo.png"
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "DLF Cyber City",
                "addressLocality": "Gurugram",
                "addressRegion": "Haryana",
                "postalCode": "122002",
                "addressCountry": "IN"
            }
        },
        "baseSalary": {
            "@type": "MonetaryAmount",
            "currency": "INR",
            "value": {
                "@type": "QuantitativeValue",
                "minValue": 3500000,
                "maxValue": 6500000,
                "unitText": "YEAR"
            }
        },
        "url": "https://boards.greenhouse.io/databricks/jobs/1234567"
    }
    </script>
</head>
<body>
    <h1>Senior Backend Engineer</h1>
</body>
</html>
"""

SAMPLE_LEVER_GRAPH_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Lead Frontend Architect - Stripe</title>
    <script type="application/ld+json">
    {
        "@context": "http://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "name": "Stripe Careers"
            },
            {
                "@type": "JobPosting",
                "title": "Lead Frontend Architect",
                "description": "Architect next generation user experiences using React, TypeScript, and GraphQL. 8+ years of engineering experience.",
                "datePosted": "2026-10-10",
                "validThrough": "2026-11-30",
                "employmentType": "FULL_TIME",
                "jobLocationType": "TELECOMMUTE",
                "hiringOrganization": {
                    "@type": "Organization",
                    "name": "Stripe",
                    "url": "https://stripe.com"
                },
                "jobLocation": {
                    "@type": "Place",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Bengaluru",
                        "addressRegion": "Karnataka",
                        "addressCountry": "India"
                    }
                },
                "directApply": "https://jobs.lever.co/stripe/lead-frontend-architect"
            }
        ]
    }
    </script>
</head>
<body>
    <div>Stripe Job Details</div>
</body>
</html>
"""

SAMPLE_MULTIPLE_JOBS_HTML = """
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    [
        {
            "@type": "JobPosting",
            "title": "Junior Python Developer",
            "description": "0-2 years of experience with Python, SQL, and Git.",
            "datePosted": "2026-10-12",
            "hiringOrganization": {
                "@type": "Organization",
                "name": "Zscaler",
                "url": "https://zscaler.com"
            },
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "addressLocality": "Noida",
                    "addressRegion": "Uttar Pradesh"
                }
            },
            "url": "https://zscaler.com/jobs/junior-dev"
        },
        {
            "@type": "JobPosting",
            "title": "DevOps Engineer",
            "description": "Manage Kubernetes clusters, CI/CD pipelines, Docker and Terraform.",
            "datePosted": "2026-10-14",
            "hiringOrganization": {
                "@type": "Organization",
                "name": "Zscaler",
                "url": "https://zscaler.com"
            },
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "addressLocality": "Pune",
                    "addressRegion": "Maharashtra"
                }
            },
            "url": "https://zscaler.com/jobs/devops-engineer"
        }
    ]
    </script>
</head>
<body>
</body>
</html>
"""


class TestCareerPortalScraper(unittest.TestCase):

    def test_clean_html_text(self):
        raw = "<p>Hello &amp; welcome to <strong>ACME</strong>!</p>"
        cleaned = clean_html_text(raw)
        self.assertEqual(cleaned, "Hello & welcome to ACME!")

    def test_detect_experience(self):
        yoe, exp, std = detect_experience("Senior Software Engineer", "Needs 6 years of experience")
        self.assertEqual(exp, "Senior")
        self.assertEqual(std, "L3")
        self.assertIn("yrs", yoe)

        yoe_lead, exp_lead, std_lead = detect_experience("Staff Architect", "8+ years")
        self.assertEqual(exp_lead, "Lead")
        self.assertEqual(std_lead, "L4")

        yoe_jr, exp_jr, std_jr = detect_experience("Junior QA Tester", "Fresher entry level")
        self.assertEqual(exp_jr, "Entry")
        self.assertEqual(std_jr, "L1")

    def test_detect_skills(self):
        text = "We build distributed systems using Python, Go, Kubernetes, and Docker with PostgreSQL."
        skills = detect_skills(text)
        self.assertIn("Python", skills)
        self.assertIn("Go", skills)
        self.assertIn("Kubernetes", skills)
        self.assertIn("Docker", skills)

    def test_parse_greenhouse_single_job(self):
        jobs = scrape_from_html(SAMPLE_GREENHOUSE_HTML, source_url="https://boards.greenhouse.io/databricks")
        self.assertEqual(len(jobs), 1)

        job = jobs[0]
        self.assertEqual(job["title"], "Senior Backend Engineer")
        self.assertEqual(job["company"], "Databricks")
        self.assertEqual(job["company_domain"], "databricks.com")
        self.assertEqual(job["city"], "Gurugram")
        self.assertEqual(job["standard_level"], "L3")
        self.assertEqual(job["experience_level"], "Senior")
        self.assertEqual(job["apply_url"], "https://boards.greenhouse.io/databricks/jobs/1234567")
        self.assertIn("Python", job["skills"])
        self.assertIn("Kubernetes", job["skills"])
        self.assertIn("AWS", job["skills"])
        self.assertTrue("3500000" in job["salary_range"] and "6500000" in job["salary_range"])
        self.assertEqual(job["date_posted"], "2026-10-15T00:00:00Z")
        self.assertEqual(job["valid_through"], "2026-12-31T23:59:59Z")

    def test_parse_lever_graph_remote_job(self):
        jobs = scrape_from_html(SAMPLE_LEVER_GRAPH_HTML)
        self.assertEqual(len(jobs), 1)

        job = jobs[0]
        self.assertEqual(job["title"], "Lead Frontend Architect")
        self.assertEqual(job["company"], "Stripe")
        self.assertEqual(job["company_domain"], "stripe.com")
        self.assertEqual(job["city"], "Bengaluru")
        self.assertEqual(job["workplace_model"], "Remote")
        self.assertEqual(job["standard_level"], "L4")
        self.assertEqual(job["experience_level"], "Lead")
        self.assertEqual(job["apply_url"], "https://jobs.lever.co/stripe/lead-frontend-architect")
        self.assertIn("React", job["skills"])
        self.assertIn("TypeScript", job["skills"])
        self.assertIn("GraphQL", job["skills"])

    def test_parse_multiple_jobs_array(self):
        jobs = scrape_from_html(SAMPLE_MULTIPLE_JOBS_HTML, start_id=100)
        self.assertEqual(len(jobs), 2)

        j1, j2 = jobs[0], jobs[1]
        self.assertEqual(j1["id"], 100)
        self.assertEqual(j1["title"], "Junior Python Developer")
        self.assertEqual(j1["city"], "Noida")
        self.assertEqual(j1["experience_level"], "Entry")

        self.assertEqual(j2["id"], 101)
        self.assertEqual(j2["title"], "DevOps Engineer")
        self.assertEqual(j2["city"], "Pune")
        self.assertIn("Kubernetes", j2["skills"])
        self.assertIn("Terraform", j2["skills"])

    def test_cli_file_and_output(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as tf:
            tf.write(SAMPLE_GREENHOUSE_HTML)
            temp_html = tf.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as out_tf:
            out_json = out_tf.name

        try:
            cmd = [
                sys.executable,
                "utils/career_portal_scraper.py",
                "--file",
                temp_html,
                "--out",
                out_json,
                "--start-id",
                "50",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            self.assertIn("Scraped 1 job(s)", result.stdout)

            with open(out_json, "r", encoding="utf-8") as f:
                saved = json.load(f)

            self.assertEqual(len(saved), 1)
            self.assertEqual(saved[0]["id"], 50)
            self.assertEqual(saved[0]["title"], "Senior Backend Engineer")
            self.assertEqual(saved[0]["company"], "Databricks")
        finally:
            if os.path.exists(temp_html):
                os.remove(temp_html)
            if os.path.exists(out_json):
                os.remove(out_json)


if __name__ == "__main__":
    unittest.main()
