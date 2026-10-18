#!/usr/bin/env python3
"""
utils/keyword_matcher.py
========================
Purely deterministic technical skill and keyword matcher comparing job descriptions
to candidate resumes. Requires zero AI/LLM tokens and uses only Python standard library.

Features:
- Deterministic tokenization, stopword filtering, and n-gram extraction (1-gram, 2-gram, 3-gram).
- Comprehensive tech taxonomy (languages, frameworks, cloud, databases, tools, developer practices).
- Computes exact match score, missing critical keywords, keyword density, and matched skills.
- CLI interface supporting raw text, JSON files, or PDF resumes:
    python utils/keyword_matcher.py --job <job_text_or_json> --resume <resume_text_or_pdf>
"""

import argparse
import json
import math
import os
import re
import sys
from collections import Counter
from typing import Any, Dict, List, Optional, Set, Tuple

# Comprehensive curated taxonomy of technical skills and variants
TECH_TAXONOMY: Dict[str, Dict[str, Any]] = {
    # Programming Languages
    "python": {"category": "languages", "aliases": ["python", "py", "python3", "python2"]},
    "javascript": {"category": "languages", "aliases": ["javascript", "js", "ecmascript", "es6", "es2015", "es2020"]},
    "typescript": {"category": "languages", "aliases": ["typescript", "ts"]},
    "java": {"category": "languages", "aliases": ["java", "core java", "j2ee", "jee", "java 8", "java 11", "java 17", "java 21"]},
    "golang": {"category": "languages", "aliases": ["golang", "go", "go language"]},
    "c++": {"category": "languages", "aliases": ["c++", "cpp"]},
    "c#": {"category": "languages", "aliases": ["c#", "csharp", "c sharp", ".net", "dotnet"]},
    "c": {"category": "languages", "aliases": ["c language"]},
    "rust": {"category": "languages", "aliases": ["rust", "rustlang"]},
    "scala": {"category": "languages", "aliases": ["scala"]},
    "kotlin": {"category": "languages", "aliases": ["kotlin"]},
    "swift": {"category": "languages", "aliases": ["swift"]},
    "ruby": {"category": "languages", "aliases": ["ruby", "ruby on rails", "rails"]},
    "php": {"category": "languages", "aliases": ["php", "laravel", "symfony"]},
    "sql": {"category": "languages", "aliases": ["sql", "advanced sql", "pl/sql", "plsql", "t-sql", "tsql"]},
    "bash": {"category": "languages", "aliases": ["bash", "shell scripting", "shell script", "shell", "sh", "zsh"]},
    "r": {"category": "languages", "aliases": ["r language", "r programming"]},

    # Frontend Frameworks & Web
    "react": {"category": "frameworks", "aliases": ["react", "react.js", "reactjs"]},
    "react native": {"category": "frameworks", "aliases": ["react native", "react-native"]},
    "next.js": {"category": "frameworks", "aliases": ["next.js", "nextjs", "next js"]},
    "angular": {"category": "frameworks", "aliases": ["angular", "angularjs", "angular 2+"]},
    "vue": {"category": "frameworks", "aliases": ["vue", "vue.js", "vuejs"]},
    "svelte": {"category": "frameworks", "aliases": ["svelte", "sveltekit"]},
    "html": {"category": "frameworks", "aliases": ["html", "html5"]},
    "css": {"category": "frameworks", "aliases": ["css", "css3", "sass", "scss", "less"]},
    "tailwind": {"category": "frameworks", "aliases": ["tailwind", "tailwind css", "tailwindcss"]},
    "redux": {"category": "frameworks", "aliases": ["redux", "redux toolkit", "rtk", "zustand", "mobx"]},

    # Backend Frameworks & Architecture
    "node.js": {"category": "frameworks", "aliases": ["node.js", "nodejs", "node js", "node"]},
    "express": {"category": "frameworks", "aliases": ["express", "express.js", "expressjs"]},
    "nestjs": {"category": "frameworks", "aliases": ["nestjs", "nest.js"]},
    "spring boot": {"category": "frameworks", "aliases": ["spring boot", "springboot", "spring framework", "spring"]},
    "django": {"category": "frameworks", "aliases": ["django", "django rest framework", "drf"]},
    "flask": {"category": "frameworks", "aliases": ["flask"]},
    "fastapi": {"category": "frameworks", "aliases": ["fastapi", "fast api"]},
    "microservices": {"category": "developer practices", "aliases": ["microservices", "microservice", "distributed systems", "service-oriented"]},
    "restful": {"category": "developer practices", "aliases": ["restful", "rest api", "rest apis", "restful api", "restful apis", "rest"]},
    "graphql": {"category": "frameworks", "aliases": ["graphql"]},
    "grpc": {"category": "frameworks", "aliases": ["grpc"]},
    "kafka": {"category": "databases", "aliases": ["kafka", "apache kafka"]},
    "rabbitmq": {"category": "tools", "aliases": ["rabbitmq", "rabbit mq", "activemq"]},
    "redis": {"category": "databases", "aliases": ["redis", "caching", "memcached"]},

    # Cloud & DevOps
    "aws": {"category": "cloud", "aliases": ["aws", "amazon web services", "ec2", "s3", "lambda", "ecs", "eks", "rds", "sqs", "sns", "cloudformation", "iam"]},
    "azure": {"category": "cloud", "aliases": ["azure", "microsoft azure", "azure devops", "blob storage", "aks"]},
    "gcp": {"category": "cloud", "aliases": ["gcp", "google cloud", "google cloud platform", "bigquery", "gke"]},
    "docker": {"category": "tools", "aliases": ["docker", "containerization", "containers", "dockerfile", "docker compose"]},
    "kubernetes": {"category": "tools", "aliases": ["kubernetes", "k8s", "helm"]},
    "terraform": {"category": "tools", "aliases": ["terraform", "iac", "infrastructure as code"]},
    "ci/cd": {"category": "developer practices", "aliases": ["ci/cd", "ci-cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery"]},
    "jenkins": {"category": "tools", "aliases": ["jenkins"]},
    "github": {"category": "tools", "aliases": ["github", "git", "gitlab", "bitbucket", "version control"]},
    "ansible": {"category": "tools", "aliases": ["ansible"]},
    "linux": {"category": "tools", "aliases": ["linux", "unix", "ubuntu", "debian", "centos", "redhat"]},

    # Databases & Storage
    "postgresql": {"category": "databases", "aliases": ["postgresql", "postgres", "psql"]},
    "mysql": {"category": "databases", "aliases": ["mysql", "mariadb"]},
    "mongodb": {"category": "databases", "aliases": ["mongodb", "mongo"]},
    "dynamodb": {"category": "databases", "aliases": ["dynamodb"]},
    "elasticsearch": {"category": "databases", "aliases": ["elasticsearch", "elastic search", "opensearch", "elk", "elk stack"]},
    "snowflake": {"category": "databases", "aliases": ["snowflake"]},
    "databricks": {"category": "databases", "aliases": ["databricks"]},
    "spark": {"category": "databases", "aliases": ["spark", "apache spark", "pyspark"]},
    "hadoop": {"category": "databases", "aliases": ["hadoop", "hdfs", "mapreduce"]},
    "cassandra": {"category": "databases", "aliases": ["cassandra", "apache cassandra"]},
    "oracle": {"category": "databases", "aliases": ["oracle", "oracle db"]},

    # QA, SDET & Testing
    "selenium": {"category": "tools", "aliases": ["selenium", "selenium webdriver"]},
    "playwright": {"category": "tools", "aliases": ["playwright"]},
    "cypress": {"category": "tools", "aliases": ["cypress"]},
    "sdet": {"category": "developer practices", "aliases": ["sdet", "software development engineer in test"]},
    "test automation": {"category": "developer practices", "aliases": ["test automation", "automated testing", "automation testing", "test suites"]},
    "qa": {"category": "developer practices", "aliases": ["qa", "quality assurance", "software quality", "testing"]},
    "testng": {"category": "tools", "aliases": ["testng"]},
    "junit": {"category": "tools", "aliases": ["junit"]},
    "pytest": {"category": "tools", "aliases": ["pytest"]},
    "postman": {"category": "tools", "aliases": ["postman", "api testing"]},
    "jmeter": {"category": "tools", "aliases": ["jmeter", "performance testing", "load testing"]},
    "appium": {"category": "tools", "aliases": ["appium", "mobile testing"]},
    "cucumber": {"category": "tools", "aliases": ["cucumber", "bdd", "behavior driven development"]},

    # AI, ML & Data Science
    "machine learning": {"category": "developer practices", "aliases": ["machine learning", "ml"]},
    "deep learning": {"category": "developer practices", "aliases": ["deep learning", "neural networks", "ann", "cnn", "rnn"]},
    "ai": {"category": "developer practices", "aliases": ["ai", "artificial intelligence", "genai", "generative ai", "llm", "llms", "large language models"]},
    "pytorch": {"category": "frameworks", "aliases": ["pytorch", "torch"]},
    "tensorflow": {"category": "frameworks", "aliases": ["tensorflow", "tf", "keras"]},
    "pandas": {"category": "tools", "aliases": ["pandas"]},
    "numpy": {"category": "tools", "aliases": ["numpy"]},
    "scikit-learn": {"category": "tools", "aliases": ["scikit-learn", "sklearn"]},
    "power bi": {"category": "tools", "aliases": ["power bi", "powerbi"]},
    "tableau": {"category": "tools", "aliases": ["tableau"]},

    # Developer Practices & Methodologies
    "agile": {"category": "developer practices", "aliases": ["agile", "scrum", "kanban", "sprints"]},
    "system design": {"category": "developer practices", "aliases": ["system design", "solution architecture", "software architecture", "high level design", "low level design", "hld", "lld"]},
    "oop": {"category": "developer practices", "aliases": ["oop", "object-oriented", "object oriented", "solid principles", "design patterns"]},
    "tdd": {"category": "developer practices", "aliases": ["tdd", "test driven development"]},
}

# Standard English stopwords for deterministic text processing
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
    "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
    "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "will", "shall", "may", "might", "must", "can", "etc", "eg", "ie",
    "role", "roles", "candidate", "responsibilities", "requirements", "experience", "years", "looking"
}


def read_pdf_minimal(file_path: str) -> str:
    """
    Extract text from PDF using pypdf if available, else a robust fallback
    extracting text stream literals without external libraries.
    """
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        if text.strip():
            return text
    except ImportError:
        pass
    except Exception:
        pass

    # Built-in lightweight PDF text extractor
    with open(file_path, "rb") as f:
        content = f.read()

    text_parts = []
    # Match strings inside parentheses inside BT ... ET text blocks or standalone TJ/Tj operators
    # Look for literal strings like (Hello world) Tj or [(Hello) -10 (world)] TJ
    str_matches = re.findall(rb"\(([^()]{1,200})\)\s*(?:Tj|'|\")", content)
    for m in str_matches:
        try:
            decoded = m.decode("latin1", errors="ignore")
            text_parts.append(decoded)
        except Exception:
            continue

    if not text_parts:
        # Array strings [(text) ... (text)] TJ
        array_matches = re.findall(rb"\[(.*?)\]\s*TJ", content, re.DOTALL)
        for arr in array_matches:
            sub = re.findall(rb"\(([^()]{1,200})\)", arr)
            for s in sub:
                try:
                    text_parts.append(s.decode("latin1", errors="ignore"))
                except Exception:
                    continue

    if text_parts:
        return " ".join(text_parts)
    
    # As last resort, decode raw stream as latin1 and strip control chars
    ascii_clean = re.sub(r"[^\x20-\x7E\n]", " ", content.decode("latin1", errors="ignore"))
    return ascii_clean


def load_input_text(source: str) -> str:
    """
    Load text from a string, a file path (.txt, .json, .pdf, .md), or standard input.
    """
    if not source:
        return ""

    if os.path.exists(source) and os.path.isfile(source):
        lower_path = source.lower()
        if lower_path.endswith(".pdf"):
            return read_pdf_minimal(source)
        
        with open(source, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().strip()
        
        if lower_path.endswith(".json"):
            try:
                data = json.loads(content)
                if isinstance(data, dict):
                    # Combine all string values, title, description, skills, etc.
                    parts = []
                    for key in ["title", "company", "description", "requirements", "summary", "experience", "education", "rawText"]:
                        if key in data and isinstance(data[key], str):
                            parts.append(data[key])
                    if "skills" in data and isinstance(data["skills"], list):
                        parts.append(" ".join(str(s) for s in data["skills"]))
                    if parts:
                        return "\n".join(parts)
                    return json.dumps(data)
                elif isinstance(data, list):
                    return " ".join(str(item) for item in data)
            except Exception:
                pass
        return content

    # If it's inline JSON string
    if source.strip().startswith("{") and source.strip().endswith("}"):
        try:
            data = json.loads(source)
            if isinstance(data, dict):
                parts = []
                for k, v in data.items():
                    if isinstance(v, str):
                        parts.append(v)
                    elif isinstance(v, list):
                        parts.append(" ".join(str(x) for x in v))
                return "\n".join(parts)
        except Exception:
            pass

    return source


def tokenize(text: str) -> List[str]:
    """
    Deterministic tokenizer preserving technical identifiers (+, #, ., /, -).
    """
    if not text:
        return []
    # Replace non-printable characters and linebreaks with spaces
    clean = re.sub(r"[\r\n\t]", " ", text.lower())
    # Match tokens containing word chars, dots, pluses, hashes, slashes, hyphens
    pattern = r"[\w\.\+\#\/\-]+"
    raw_tokens = re.findall(pattern, clean)
    tokens: List[str] = []
    for t in raw_tokens:
        # Strip trailing punctuation like commas, semicolons, colons
        t = re.sub(r"[,;:]+$", "", t)
        # Strip trailing dot if not in dot-extension or prefix (e.g. '.net' preserved, 'selenium.' -> 'selenium')
        if t.endswith(".") and not t.startswith("."):
            t = t.rstrip(".")
        if t:
            tokens.append(t)
    return tokens


def extract_ngrams(tokens: List[str], n: int) -> List[str]:
    """
    Extract n-grams from a list of tokens.
    """
    if n < 1 or len(tokens) < n:
        return []
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def extract_all_ngrams(tokens: List[str], max_n: int = 3, filter_stopwords: bool = False) -> Dict[int, List[str]]:
    """
    Extract 1-gram, 2-gram, 3-gram up to max_n.
    """
    results: Dict[int, List[str]] = {}
    for n in range(1, max_n + 1):
        ngrams = extract_ngrams(tokens, n)
        if filter_stopwords:
            filtered = []
            for ng in ngrams:
                words = ng.split()
                # If all words in ngram are stopwords, discard
                if all(w in STOPWORDS for w in words):
                    continue
                # Also avoid n-grams that start or end with a pure stopword
                if words[0] in STOPWORDS and words[-1] in STOPWORDS:
                    continue
                filtered.append(ng)
            results[n] = filtered
        else:
            results[n] = ngrams
    return results


def match_taxonomy_skills(text: str) -> Dict[str, Dict[str, Any]]:
    """
    Scans text against TECH_TAXONOMY using deterministic token & phrase matching.
    Returns dictionary: {canonical_name: {"category": cat, "matched_alias": alias, "count": count}}
    """
    raw_lower = f" {text.lower()} "
    # Normalize punctuation separators: replace commas, semicolons, colons, brackets, quotes,
    # and sentence-ending periods with spaces, but preserve dots in '.net' or 'node.js'
    cleaned_punct = re.sub(r"[\,\;\:\!\?\(\)\[\]\{\}\"\'\|\*\`\~]|(?<=\w)\.(?=\s|$)", " ", raw_lower)
    normalized_spaced = f" {re.sub(r'\s+', ' ', cleaned_punct)} "

    found_skills: Dict[str, Dict[str, Any]] = {}

    for canonical, details in TECH_TAXONOMY.items():
        aliases = details.get("aliases", [canonical])
        category = details.get("category", "other")
        total_count = 0
        best_alias = canonical

        for alias in aliases:
            escaped = re.escape(alias)
            # Use negative lookbehind and lookahead for word/symbol boundary
            pattern = rf"(?<![a-zA-Z0-9\+\#\.\/]){escaped}(?![a-zA-Z0-9\+\#\.\/])"
            matches = re.findall(pattern, normalized_spaced)
            if matches:
                total_count += len(matches)
                best_alias = alias

        if total_count > 0:
            found_skills[canonical] = {
                "category": category,
                "matched_alias": best_alias,
                "count": total_count,
            }

    return found_skills


def calculate_keyword_density(tokens: List[str], target_keywords: Set[str]) -> Dict[str, float]:
    """
    Calculate keyword density (percentage of occurrences relative to total filtered words).
    """
    filtered_tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 1]
    total_words = len(filtered_tokens)
    if total_words == 0:
        return {}

    counts = Counter(filtered_tokens)
    density: Dict[str, float] = {}

    for kw in target_keywords:
        # Match single or multi-token
        kw_parts = kw.split()
        if len(kw_parts) == 1:
            cnt = counts.get(kw, 0)
        else:
            # count occurrences of multi-word sequence in filtered_tokens
            cnt = 0
            for i in range(len(filtered_tokens) - len(kw_parts) + 1):
                if filtered_tokens[i : i + len(kw_parts)] == kw_parts:
                    cnt += 1
        if cnt > 0:
            density[kw] = round((cnt / total_words) * 100, 2)

    return density


def match_job_and_resume(job_raw: str, resume_raw: str) -> Dict[str, Any]:
    """
    Perform complete deterministic matching between a Job Description and a Candidate Resume.
    """
    job_text = load_input_text(job_raw)
    resume_text = load_input_text(resume_raw)

    job_tokens = tokenize(job_text)
    resume_tokens = tokenize(resume_text)

    # Filtered tokens
    job_filtered = [t for t in job_tokens if t not in STOPWORDS]
    resume_filtered = [t for t in resume_tokens if t not in STOPWORDS]

    # N-grams (1, 2, 3)
    job_ngrams = extract_all_ngrams(job_tokens, max_n=3, filter_stopwords=True)
    resume_ngrams = extract_all_ngrams(resume_tokens, max_n=3, filter_stopwords=True)

    # Extract taxonomy skills
    job_skills_dict = match_taxonomy_skills(job_text)
    resume_skills_dict = match_taxonomy_skills(resume_text)

    job_skills_set = set(job_skills_dict.keys())
    resume_skills_set = set(resume_skills_dict.keys())

    # Taxonomy Matched vs Missing
    matched_skills = sorted(list(job_skills_set & resume_skills_set))
    missing_skills = sorted(list(job_skills_set - resume_skills_set))

    # Exact Taxonomy Match Score (0 to 100)
    if job_skills_set:
        exact_match_score = round((len(matched_skills) / len(job_skills_set)) * 100, 2)
    else:
        # If job text specified no recognized tech skills, compute Jaccard over filtered n-grams
        job_words_set = set(job_filtered)
        resume_words_set = set(resume_filtered)
        if job_words_set:
            overlap = job_words_set & resume_words_set
            exact_match_score = round((len(overlap) / len(job_words_set)) * 100, 2)
        else:
            exact_match_score = 100.0

    # Critical Keywords (High frequency tech skills or domain words in job description)
    # Skills appearing most frequently in the job are deemed critical
    critical_skills_sorted = sorted(
        job_skills_set,
        key=lambda k: job_skills_dict[k]["count"],
        reverse=True
    )
    # Missing critical keywords are the missing ones that had high weight in the job
    missing_critical = [s for s in critical_skills_sorted if s in missing_skills]

    # Calculate keyword density in resume for matched and job skills
    resume_density = calculate_keyword_density(resume_tokens, job_skills_set | set(matched_skills))

    # Categorize matched skills
    matched_by_category: Dict[str, List[str]] = {}
    for skill in matched_skills:
        cat = TECH_TAXONOMY.get(skill, {}).get("category", "other")
        matched_by_category.setdefault(cat, []).append(skill)

    # Word and Token Counts
    stats = {
        "job_word_count": len(job_tokens),
        "job_unique_terms": len(set(job_filtered)),
        "resume_word_count": len(resume_tokens),
        "resume_unique_terms": len(set(resume_filtered)),
        "job_tech_skills_count": len(job_skills_set),
        "resume_tech_skills_count": len(resume_skills_set),
    }

    return {
        "exact_match_score": exact_match_score,
        "matched_skills_count": len(matched_skills),
        "total_job_skills_count": len(job_skills_set),
        "matched_skills": matched_skills,
        "matched_by_category": matched_by_category,
        "missing_skills": missing_skills,
        "missing_critical_keywords": missing_critical,
        "keyword_density": resume_density,
        "stats": stats,
        "job_ngrams_sample": {
            "unigrams_count": len(job_ngrams.get(1, [])),
            "bigrams_count": len(job_ngrams.get(2, [])),
            "trigrams_count": len(job_ngrams.get(3, [])),
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic technical skill and keyword matcher for jobs and resumes."
    )
    parser.add_argument(
        "--job",
        "-j",
        required=True,
        help="Job description (plain text, JSON file path, or raw JSON string).",
    )
    parser.add_argument(
        "--resume",
        "-r",
        required=True,
        help="Candidate resume (plain text, text file path, or PDF file path).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON to stdout.",
    )

    args = parser.parse_args()

    result = match_job_and_resume(args.job, args.resume)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Formatted CLI summary output
    print("=" * 60)
    print("      DETERMINISTIC KEYWORD & SKILL MATCH REPORT")
    print("=" * 60)
    print(f"Exact Match Score:          {result['exact_match_score']}%")
    print(f"Matched Skills:             {result['matched_skills_count']} / {result['total_job_skills_count']}")
    print(f"Matched Skills List:        {', '.join(result['matched_skills']) if result['matched_skills'] else 'None'}")
    print(f"Missing Skills:             {', '.join(result['missing_skills']) if result['missing_skills'] else 'None'}")
    print(f"Missing Critical Keywords:  {', '.join(result['missing_critical_keywords']) if result['missing_critical_keywords'] else 'None'}")
    
    if result["matched_by_category"]:
        print("\nSkills by Category:")
        for cat, skills in result["matched_by_category"].items():
            print(f"  • {cat.title()}: {', '.join(skills)}")

    if result["keyword_density"]:
        print("\nResume Keyword Density:")
        for kw, dens in sorted(result["keyword_density"].items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  • {kw}: {dens}%")

    print("\nToken Statistics:")
    print(f"  • Job Tokens:    {result['stats']['job_word_count']} (Tech Skills: {result['stats']['job_tech_skills_count']})")
    print(f"  • Resume Tokens: {result['stats']['resume_word_count']} (Tech Skills: {result['stats']['resume_tech_skills_count']})")
    print("=" * 60)


if __name__ == "__main__":
    main()
