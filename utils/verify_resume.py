#!/usr/bin/env python3
"""
verify_resume.py - Deterministic inspection of resume PDF files for ATS compatibility and layout integrity.

Deterministic checks without AI or LLM:
1. Extractable text layer check (pypdf with fallback to pdftotext subprocess).
2. ATS unicode dash/hyphen check: detect en-dash (\u2013), em-dash (\u2014), horizontal bar (\u2015),
   or minus sign (\u2212) in date and numeric ranges where ASCII '-' is required by parsers like Workday.
3. Text density and page count check (e.g. min/max word & character counts per page, total pages).
4. Section header orphan detection (headers appearing at bottom of page without substantive content following).
5. Layout integrity check (excessive blank areas, sudden truncation, or cutoffs).

CLI:
    python utils/verify_resume.py <path_to_pdf> [--pages N] [--dump-text] [--check-ascii-dates]
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from typing import Dict, List, Optional, Tuple, Any

# Common section headers often found on resumes
RESUME_SECTION_HEADERS = [
    r"experience",
    r"work experience",
    r"employment history",
    r"professional experience",
    r"education",
    r"academic background",
    r"skills",
    r"technical skills",
    r"projects",
    r"certifications",
    r"licenses",
    r"publications",
    r"awards",
    r"honors",
    r"summary",
    r"professional summary",
    r"objective",
    r"career objective",
    r"volunteer",
    r"volunteer experience",
    r"leadership",
    r"languages",
    r"references",
]

# Non-ASCII dash unicode codepoints commonly substituted by word processors
NON_ASCII_DASHES = {
    "\u2013": "EN DASH (–)",
    "\u2014": "EM DASH (—)",
    "\u2015": "HORIZONTAL BAR (―)",
    "\u2212": "MINUS SIGN (−)",
    "\u2010": "HYPHEN (‐)",
    "\u2011": "NON-BREAKING HYPHEN (‑)",
    "\u00ad": "SOFT HYPHEN",
}

# Regex to detect date/numeric ranges containing non-ASCII dashes:
# e.g., "2020 – 2023", "Jan 2021 — Present", "05/2019 – 08/2020", "2018–Present", "4 – 6 years"
DATE_OR_RANGE_DASH_PATTERN = re.compile(
    r"(?i)\b(?:"
    r"(?:19|20)\d{2}|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"(?:\s+(?:19|20)\d{2})?|"
    r"\d{1,2}/\d{2,4}"
    r")"
    r"\s*[\u2010\u2011\u2013\u2014\u2015\u2212]\s*"
    r"(?:"
    r"(?:19|20)\d{2}|"
    r"present|current|now|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"(?:\s+(?:19|20)\d{2})?|"
    r"\d{1,2}/\d{2,4}"
    r")\b"
)

# General numeric range with non-ascii dash: e.g. "5–10 years", "$50k–$70k"
NUMERIC_RANGE_DASH_PATTERN = re.compile(
    r"\b\d+\s*[\u2010\u2011\u2013\u2014\u2015\u2212]\s*\d+\b"
)


class ResumeVerificationResult:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.success = True
        self.num_pages = 0
        self.extraction_method = "none"
        self.pages_text: List[str] = []
        self.issues: List[str] = []
        self.warnings: List[str] = []
        self.stats: Dict[str, Any] = {}

    def add_issue(self, issue: str):
        self.issues.append(issue)
        self.success = False

    def add_warning(self, warning: str):
        self.warnings.append(warning)


def extract_text_pypdf(pdf_path: str) -> Optional[List[str]]:
    """Attempt extracting text page-by-page using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_path)
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            pages_text.append(t)
        return pages_text
    except Exception:
        return None


def extract_text_pdftotext(pdf_path: str) -> Optional[List[str]]:
    """Fallback extraction using pdftotext CLI."""
    if not shutil.which("pdftotext"):
        return None
    try:
        # pdftotext provides form feed character \x0c between pages
        cmd = ["pdftotext", "-layout", pdf_path, "-"]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw_text = res.stdout
        pages = raw_text.split("\x0c")
        # pdftotext usually puts an extra \x0c at the end of the last page
        if pages and pages[-1].strip() == "":
            pages.pop()
        return pages
    except Exception:
        return None


def extract_resume_pages(pdf_path: str) -> Tuple[List[str], str]:
    """Extract pages text trying pypdf first, then pdftotext."""
    pages = extract_text_pypdf(pdf_path)
    if pages is not None and any(p.strip() for p in pages):
        return pages, "pypdf"
    
    pages_fallback = extract_text_pdftotext(pdf_path)
    if pages_fallback is not None and any(p.strip() for p in pages_fallback):
        return pages_fallback, "pdftotext"
    
    # If pypdf returned empty pages and pdftotext also failed/empty
    if pages is not None:
        return pages, "pypdf"
    if pages_fallback is not None:
        return pages_fallback, "pdftotext"

    return [], "failed"


def check_extractable_text(pages_text: List[str], result: ResumeVerificationResult, min_chars_per_page: int = 50):
    """Verify that extractable text layer exists and has substantial content."""
    if not pages_text:
        result.add_issue("No pages could be extracted from PDF.")
        return

    total_chars = sum(len(p.strip()) for p in pages_text)
    if total_chars == 0:
        result.add_issue("PDF has no extractable text layer (appears to be an image or scanned document).")
        return

    for idx, page_text in enumerate(pages_text, start=1):
        clean = page_text.strip()
        if len(clean) < min_chars_per_page:
            result.add_warning(
                f"Page {idx} has very low character count ({len(clean)} chars < {min_chars_per_page}). May contain unparsed graphics or blank space."
            )


def check_unicode_dashes(pages_text: List[str], result: ResumeVerificationResult, check_ascii_dates: bool = False):
    """
    ATS unicode dash check.
    Detects en-dash/em-dash in date and numeric ranges where ASCII '-' is required by parsers like Workday.
    """
    total_dash_occurrences = 0
    date_range_issues = []
    numeric_range_issues = []

    for idx, page_text in enumerate(pages_text, start=1):
        for line in page_text.splitlines():
            line_str = line.strip()
            if not line_str:
                continue

            # Check for non-ASCII dashes in date ranges
            date_matches = DATE_OR_RANGE_DASH_PATTERN.findall(line_str)
            for m in date_matches:
                date_range_issues.append((idx, m, line_str))

            # Check numeric ranges
            num_matches = NUMERIC_RANGE_DASH_PATTERN.findall(line_str)
            for m in num_matches:
                numeric_range_issues.append((idx, m, line_str))

            # General count of non-ascii dash chars
            for char in line_str:
                if char in NON_ASCII_DASHES:
                    total_dash_occurrences += 1

    result.stats["non_ascii_dash_count"] = total_dash_occurrences
    result.stats["date_range_dash_issues"] = len(date_range_issues)
    result.stats["numeric_range_dash_issues"] = len(numeric_range_issues)

    if date_range_issues:
        detail_msg = "; ".join([f"p.{p}: '{match}'" for p, match, _ in date_range_issues[:3]])
        if len(date_range_issues) > 3:
            detail_msg += f" (+{len(date_range_issues) - 3} more)"

        msg = f"Detected non-ASCII dashes (en-dash/em-dash) in date ranges: {detail_msg}. Parsers like Workday require standard ASCII '-'."
        if check_ascii_dates:
            result.add_issue(msg)
        else:
            result.add_warning(msg)

    if numeric_range_issues and not date_range_issues:
        detail_msg = "; ".join([f"p.{p}: '{match}'" for p, match, _ in numeric_range_issues[:2]])
        result.add_warning(f"Detected non-ASCII dashes in numeric ranges: {detail_msg}.")


def check_page_count_and_density(
    pages_text: List[str],
    result: ResumeVerificationResult,
    expected_pages: Optional[int] = None,
    min_words_per_page: int = 30,
    max_words_per_page: int = 1000
):
    """Checks page count and word density per page."""
    num_pages = len(pages_text)
    result.num_pages = num_pages

    if expected_pages is not None:
        if num_pages != expected_pages:
            result.add_issue(
                f"Page count mismatch: expected {expected_pages} pages, found {num_pages} pages."
            )

    # General page count guidance
    if num_pages > 3:
        result.add_warning(
            f"Resume is {num_pages} pages long. Standard industry guidelines recommend 1-2 pages (3 max for senior/executive)."
        )

    words_per_page = []
    for idx, page_text in enumerate(pages_text, start=1):
        words = len(page_text.split())
        words_per_page.append(words)
        if words < min_words_per_page and num_pages > 1:
            result.add_warning(
                f"Page {idx} has low word count ({words} words < {min_words_per_page}). Check for spillover."
            )
        elif words > max_words_per_page:
            result.add_warning(
                f"Page {idx} has unusually high word count ({words} words > {max_words_per_page}). Text may be overly dense for ATS parsing."
            )

    result.stats["words_per_page"] = words_per_page
    result.stats["total_word_count"] = sum(words_per_page)


def is_section_header(line: str) -> bool:
    """Heuristic check whether a trimmed line resembles a resume section header."""
    clean = line.strip()
    if not clean or len(clean) > 40:
        return False
    # Strip common markdown / punctuation (e.g. ## Experience, EXPERIENCE:, -- SKILLS --)
    normalized = re.sub(r"^[\#\*\-\s\:\=\_]+|[\#\*\-\s\:\=\_]+$", "", clean).lower()
    for header in RESUME_SECTION_HEADERS:
        if normalized == header:
            return True
    return False


def check_section_header_orphans(pages_text: List[str], result: ResumeVerificationResult):
    """
    Section header orphan detection:
    Detects if a section header appears at the very bottom of a page without substantial content following it.
    """
    for idx, page_text in enumerate(pages_text, start=1):
        lines = [line.strip() for line in page_text.splitlines() if line.strip()]
        if not lines:
            continue

        # Look at the last non-empty lines on the page
        last_line = lines[-1]
        second_last_line = lines[-2] if len(lines) >= 2 else None

        if is_section_header(last_line):
            result.add_issue(
                f"Page {idx} ends with orphaned section header: '{last_line}'. No content follows on this page."
            )
        elif second_last_line and is_section_header(second_last_line) and len(last_line.split()) < 3:
            # Header followed by only 1-2 words or punctuation before page break
            result.add_warning(
                f"Page {idx} appears to have an orphaned or near-orphaned header: '{second_last_line}' with insufficient trailing content."
            )


def check_layout_integrity(pages_text: List[str], result: ResumeVerificationResult):
    """
    Layout checks:
    - Detect excessive consecutive blank lines (blank holes).
    - Detect trailing cutoffs or truncated sentences at page boundaries.
    """
    for idx, page_text in enumerate(pages_text, start=1):
        lines = page_text.splitlines()
        max_consecutive_empty = 0
        current_empty = 0
        for line in lines:
            if not line.strip():
                current_empty += 1
                if current_empty > max_consecutive_empty:
                    max_consecutive_empty = current_empty
            else:
                current_empty = 0

        # Excessive blank lines within a single page
        if max_consecutive_empty >= 10:
            result.add_warning(
                f"Page {idx} has an excessive vertical gap ({max_consecutive_empty} consecutive empty lines). Possible layout hole."
            )

        # Truncated or abrupt ending on non-final pages
        if idx < len(pages_text):
            stripped_lines = [l.strip() for l in lines if l.strip()]
            if stripped_lines:
                last_line = stripped_lines[-1]
                # Ending with hyphen or trailing comma/conjunction might indicate awkward split
                if last_line.endswith("-") or re.search(r"\b(and|or|with|to|in|of|the|at)\s*$", last_line, re.IGNORECASE):
                    result.add_warning(
                        f"Page {idx} ends abruptly with '{last_line[-25:]}'. Possible mid-sentence page cutoff."
                    )


def verify_resume(
    pdf_path: str,
    expected_pages: Optional[int] = None,
    check_ascii_dates: bool = False
) -> ResumeVerificationResult:
    """Run all resume verification checks deterministically."""
    result = ResumeVerificationResult(pdf_path)

    if not os.path.exists(pdf_path):
        result.add_issue(f"File not found: {pdf_path}")
        return result

    if not pdf_path.lower().endswith(".pdf"):
        result.add_issue(f"File does not appear to be a PDF: {pdf_path}")
        return result

    pages_text, method = extract_resume_pages(pdf_path)
    result.extraction_method = method
    result.pages_text = pages_text

    # 1. Extractable text check
    check_extractable_text(pages_text, result)
    if not result.success:
        return result

    # 2. Unicode dash / ATS compatibility check
    check_unicode_dashes(pages_text, result, check_ascii_dates=check_ascii_dates)

    # 3. Density & Page count check
    check_page_count_and_density(pages_text, result, expected_pages=expected_pages)

    # 4. Section header orphan check
    check_section_header_orphans(pages_text, result)

    # 5. Layout integrity check
    check_layout_integrity(pages_text, result)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Verify resume PDF for ATS compatibility, layout integrity, and formatting."
    )
    parser.add_argument("pdf_path", help="Path to PDF resume file")
    parser.add_argument("--pages", type=int, default=None, help="Expected number of pages")
    parser.add_argument(
        "--check-ascii-dates",
        action="store_true",
        help="Treat non-ASCII unicode dashes (– / —) in date ranges as hard failures rather than warnings",
    )
    parser.add_argument("--dump-text", action="store_true", help="Dump extracted page text to stdout")

    args = parser.parse_args()

    result = verify_resume(
        pdf_path=args.pdf_path,
        expected_pages=args.pages,
        check_ascii_dates=args.check_ascii_dates,
    )

    print(f"=== Resume Verification Report: {args.pdf_path} ===")
    print(f"Extraction Method: {result.extraction_method}")
    print(f"Page Count: {result.num_pages}")
    if "total_word_count" in result.stats:
        print(f"Total Words: {result.stats['total_word_count']} ({result.stats['words_per_page']} words/page)")
    if "non_ascii_dash_count" in result.stats:
        print(f"Unicode Dashes Detected: {result.stats['non_ascii_dash_count']}")

    if args.dump_text:
        print("\n--- Extracted Text by Page ---")
        for i, text in enumerate(result.pages_text, start=1):
            print(f"\n[Page {i}]")
            print(text.strip())
        print("------------------------------\n")

    if result.warnings:
        print("\nWARNINGS:")
        for w in result.warnings:
            print(f"  [!] {w}")

    if result.issues:
        print("\nISSUES:")
        for issue in result.issues:
            print(f"  [X] {issue}")
        print("\nResult: FAILED")
        sys.exit(1)
    else:
        print("\nResult: PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
