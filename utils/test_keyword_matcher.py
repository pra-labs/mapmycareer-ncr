#!/usr/bin/env python3
"""
utils/test_keyword_matcher.py
=============================
Unit tests for utils/keyword_matcher.py verifying:
1. Tokenization and preservation of symbols (c++, c#, .net, node.js).
2. Stopword filtering and n-gram extraction (1-gram, 2-gram, 3-gram).
3. Taxonomy matching across categories (languages, frameworks, cloud, db, practices).
4. Exact match scoring, missing critical keywords, and keyword density.
5. CLI arguments, JSON payload inputs, and text inputs.
"""

import json
import os
import sys
import tempfile
import unittest

from utils.keyword_matcher import (
    STOPWORDS,
    TECH_TAXONOMY,
    calculate_keyword_density,
    extract_all_ngrams,
    extract_ngrams,
    load_input_text,
    match_job_and_resume,
    match_taxonomy_skills,
    tokenize,
)


class TestKeywordMatcher(unittest.TestCase):

    def test_tokenize_preserves_tech_symbols(self):
        text = "Experienced in C++, C#, .NET, Node.js, and CI/CD pipelines with Spring-Boot."
        tokens = tokenize(text)
        self.assertIn("c++", tokens)
        self.assertIn("c#", tokens)
        self.assertIn(".net", tokens)
        self.assertIn("node.js", tokens)
        self.assertIn("ci/cd", tokens)
        self.assertIn("spring-boot", tokens)

    def test_ngrams_extraction(self):
        tokens = ["senior", "software", "development", "engineer"]
        unigrams = extract_ngrams(tokens, 1)
        bigrams = extract_ngrams(tokens, 2)
        trigrams = extract_ngrams(tokens, 3)

        self.assertEqual(len(unigrams), 4)
        self.assertEqual(bigrams[0], "senior software")
        self.assertEqual(bigrams[1], "software development")
        self.assertEqual(trigrams[0], "senior software development")
        self.assertEqual(trigrams[1], "software development engineer")

    def test_extract_all_ngrams_stopword_filtering(self):
        tokens = ["looking", "for", "a", "lead", "python", "developer"]
        ngrams_dict = extract_all_ngrams(tokens, max_n=3, filter_stopwords=True)
        
        # Stopword-only ngrams like "for a" should be filtered out
        self.assertNotIn("for a", ngrams_dict.get(2, []))
        self.assertIn("python developer", ngrams_dict.get(2, []))

    def test_match_taxonomy_skills(self):
        sample = """
        Strong knowledge of Python, TypeScript, React, Docker, Kubernetes, AWS, PostgreSQL,
        and Microservices architecture. Experience with CI/CD, PyTest, and Selenium.
        """
        found = match_taxonomy_skills(sample)
        
        expected_skills = [
            "python", "typescript", "react", "docker", "kubernetes",
            "aws", "postgresql", "microservices", "ci/cd", "pytest", "selenium"
        ]
        for skill in expected_skills:
            self.assertIn(skill, found, f"Skill '{skill}' should be found in taxonomy match")
            self.assertTrue(found[skill]["count"] >= 1)

    def test_taxonomy_categories(self):
        text = "Python AWS PostgreSQL Docker React Microservices"
        found = match_taxonomy_skills(text)
        
        self.assertEqual(found["python"]["category"], "languages")
        self.assertEqual(found["aws"]["category"], "cloud")
        self.assertEqual(found["postgresql"]["category"], "databases")
        self.assertEqual(found["docker"]["category"], "tools")
        self.assertEqual(found["react"]["category"], "frameworks")
        self.assertEqual(found["microservices"]["category"], "developer practices")

    def test_match_job_and_resume_scoring(self):
        job_text = """
        We are seeking a Senior Backend Engineer.
        Required Skills: Python, FastAPI, Docker, Kubernetes, PostgreSQL, Redis, Kafka, AWS.
        Nice to have: Terraform, CI/CD.
        """

        # Resume matching 5 out of 10 skills
        resume_text = """
        Senior Python Developer with 5 years building REST APIs.
        Tech Stack: Python, FastAPI, Docker, PostgreSQL, AWS, Git, Linux.
        """

        result = match_job_and_resume(job_text, resume_text)

        self.assertIn("python", result["matched_skills"])
        self.assertIn("fastapi", result["matched_skills"])
        self.assertIn("docker", result["matched_skills"])
        self.assertIn("postgresql", result["matched_skills"])
        self.assertIn("aws", result["matched_skills"])

        # Missing should include kubernetes, redis, kafka, terraform, ci/cd
        self.assertIn("kubernetes", result["missing_skills"])
        self.assertIn("redis", result["missing_skills"])
        self.assertIn("kafka", result["missing_skills"])

        # Match score between 0 and 100
        self.assertTrue(0 < result["exact_match_score"] < 100)
        self.assertEqual(result["matched_skills_count"], len(result["matched_skills"]))

    def test_keyword_density_calculation(self):
        tokens = ["python", "code", "python", "developer", "aws", "docker", "python"]
        density = calculate_keyword_density(tokens, {"python", "aws", "kubernetes"})
        
        # 'python' appears 3 times
        self.assertIn("python", density)
        self.assertTrue(density["python"] > 0)
        self.assertNotIn("kubernetes", density)

    def test_load_input_text_json_file(self):
        job_data = {
            "title": "Lead SDET",
            "company": "FinTech Corp",
            "description": "Looking for Selenium, Playwright, Cypress, and TestNG experience.",
            "skills": ["Python", "Selenium", "Docker"]
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(job_data, f)
            temp_path = f.name

        try:
            loaded_text = load_input_text(temp_path)
            self.assertIn("Lead SDET", loaded_text)
            self.assertIn("Selenium", loaded_text)
            self.assertIn("Playwright", loaded_text)
        finally:
            os.remove(temp_path)

    def test_perfect_match_score(self):
        job = "Python Docker AWS"
        resume = "Python Docker AWS and additional experience in Linux"
        result = match_job_and_resume(job, resume)
        self.assertEqual(result["exact_match_score"], 100.0)
        self.assertEqual(result["missing_skills"], [])

    def test_cli_execution(self):
        import subprocess
        cmd = [
            sys.executable,
            "utils/keyword_matcher.py",
            "--job", "Looking for React, TypeScript, Next.js, and Tailwind.",
            "--resume", "Expert in React, TypeScript, Next.js, CSS, HTML.",
            "--json"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        self.assertIn("exact_match_score", data)
        self.assertIn("react", data["matched_skills"])
        self.assertIn("typescript", data["matched_skills"])
        self.assertIn("tailwind", data["missing_skills"])


if __name__ == "__main__":
    unittest.main()
