#!/usr/bin/env python3
"""
test_verify_resume.py - Unit and integration tests for verify_resume.py.
"""

import os
import tempfile
import unittest
from utils.verify_resume import (
    ResumeVerificationResult,
    check_extractable_text,
    check_unicode_dashes,
    check_page_count_and_density,
    check_section_header_orphans,
    check_layout_integrity,
    is_section_header,
    verify_resume,
)


class TestResumeVerificationLogic(unittest.TestCase):

    def test_is_section_header(self):
        self.assertTrue(is_section_header("EXPERIENCE"))
        self.assertTrue(is_section_header("Work Experience"))
        self.assertTrue(is_section_header("## Skills"))
        self.assertTrue(is_section_header("Education:"))
        self.assertTrue(is_section_header("  Technical Skills  "))
        self.assertFalse(is_section_header("I have experience in Python and C++."))
        self.assertFalse(is_section_header(""))

    def test_check_extractable_text(self):
        res = ResumeVerificationResult("test.pdf")
        check_extractable_text([], res)
        self.assertFalse(res.success)
        self.assertTrue(any("No pages" in issue for issue in res.issues))

        res2 = ResumeVerificationResult("test.pdf")
        check_extractable_text(["", "   "], res2)
        self.assertFalse(res2.success)
        self.assertTrue(any("no extractable text" in issue for issue in res2.issues))

        res3 = ResumeVerificationResult("test.pdf")
        check_extractable_text(["A" * 100], res3)
        self.assertTrue(res3.success)
        self.assertEqual(len(res3.warnings), 0)

    def test_check_unicode_dashes(self):
        # Line with en-dash: 2020 – 2023 (\u2013)
        res_warn = ResumeVerificationResult("test.pdf")
        pages = ["Software Engineer\nAcme Corp\n2020 \u2013 2023\nBuilt scalable systems."]
        check_unicode_dashes(pages, res_warn, check_ascii_dates=False)
        self.assertTrue(res_warn.success)
        self.assertEqual(len(res_warn.warnings), 1)
        self.assertIn("en-dash/em-dash", res_warn.warnings[0])

        # En-dash with check_ascii_dates=True should fail
        res_fail = ResumeVerificationResult("test.pdf")
        check_unicode_dashes(pages, res_fail, check_ascii_dates=True)
        self.assertFalse(res_fail.success)
        self.assertEqual(len(res_fail.issues), 1)

        # ASCII dash: Jan 2020 - Present
        res_pass = ResumeVerificationResult("test.pdf")
        pages_ascii = ["Software Engineer\nAcme Corp\nJan 2020 - Present\nBuilt scalable systems."]
        check_unicode_dashes(pages_ascii, res_pass, check_ascii_dates=True)
        self.assertTrue(res_pass.success)
        self.assertEqual(len(res_pass.issues), 0)
        self.assertEqual(len(res_pass.warnings), 0)

    def test_check_page_count_and_density(self):
        res = ResumeVerificationResult("test.pdf")
        pages = ["Word " * 100, "Word " * 150]
        check_page_count_and_density(pages, res, expected_pages=2)
        self.assertTrue(res.success)
        self.assertEqual(res.num_pages, 2)
        self.assertEqual(res.stats["total_word_count"], 250)

        # Page mismatch
        res_mismatch = ResumeVerificationResult("test.pdf")
        check_page_count_and_density(pages, res_mismatch, expected_pages=1)
        self.assertFalse(res_mismatch.success)
        self.assertIn("Page count mismatch", res_mismatch.issues[0])

    def test_check_section_header_orphans(self):
        # Orphan header at end of page 1
        res = ResumeVerificationResult("test.pdf")
        pages = [
            "John Doe\nSummary of experience...\nEDUCATION",
            "B.S. Computer Science\nUniversity of Technology"
        ]
        check_section_header_orphans(pages, res)
        self.assertFalse(res.success)
        self.assertTrue(any("orphaned section header" in i for i in res.issues))

        # Non-orphan header
        res_ok = ResumeVerificationResult("test.pdf")
        pages_ok = [
            "John Doe\nSummary of experience...\nEDUCATION\nB.S. Computer Science",
            "EXPERIENCE\nSoftware Engineer at Google"
        ]
        check_section_header_orphans(pages_ok, res_ok)
        self.assertTrue(res_ok.success)
        self.assertEqual(len(res_ok.issues), 0)

    def test_check_layout_integrity(self):
        # Excessive vertical gap
        res = ResumeVerificationResult("test.pdf")
        lines = ["Header"] + [""] * 15 + ["Content"]
        pages = ["\n".join(lines)]
        check_layout_integrity(pages, res)
        self.assertTrue(any("excessive vertical gap" in w for w in res.warnings))

        # Abrupt cutoff at page boundary
        res2 = ResumeVerificationResult("test.pdf")
        pages2 = [
            "John Doe\nWorked on complex systems with",
            "distributed microservices."
        ]
        check_layout_integrity(pages2, res2)
        self.assertTrue(any("Possible mid-sentence page cutoff" in w for w in res2.warnings))


class TestResumeVerificationPDFIntegration(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_minimal_pdf(self, filename: str, pages_text: list):
        """Generate a valid minimal PDF file using pypdf writer."""
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, ArrayObject, DecodedStreamObject

        # We can create a simple PDF text page using pypdf or a minimal PDF binary structure
        # A simpler reliable way: generate a valid raw PDF text stream
        writer = PdfWriter()
        for text in pages_text:
            writer.add_blank_page(width=612, height=792)
        
        pdf_path = os.path.join(self.temp_dir.name, filename)
        with open(pdf_path, "wb") as f:
            writer.write(f)
        return pdf_path

    def test_missing_and_invalid_file(self):
        res = verify_resume("/non/existent/path/resume.pdf")
        self.assertFalse(res.success)
        self.assertIn("File not found", res.issues[0])

        invalid_ext = os.path.join(self.temp_dir.name, "resume.docx")
        with open(invalid_ext, "w") as f:
            f.write("text")
        res2 = verify_resume(invalid_ext)
        self.assertFalse(res2.success)
        self.assertIn("does not appear to be a PDF", res2.issues[0])

    def test_cli_execution(self):
        import subprocess
        # Test CLI help flag
        cmd = ["python3", "utils/verify_resume.py", "--help"]
        out = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)
        self.assertIn("Verify resume PDF for ATS compatibility", out.stdout)

    def test_end_to_end_pdf_verification(self):
        # Create minimal PDF with text
        pdf_content = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
            b"5 0 obj << /Length 64 >> stream\n"
            b"BT\n"
            b"/F1 12 Tf\n"
            b"72 712 Td\n"
            b"(John Doe - Senior Software Engineer 2020 - 2023) Tj\n"
            b"ET\n"
            b"endstream\n"
            b"endobj\n"
            b"xref\n"
            b"0 6\n"
            b"0000000000 65535 f \n"
            b"0000000009 00000 n \n"
            b"0000000058 00000 n \n"
            b"0000000115 00000 n \n"
            b"0000000227 00000 n \n"
            b"0000000305 00000 n \n"
            b"trailer << /Size 6 /Root 1 0 R >>\n"
            b"startxref\n"
            b"420\n"
            b"%%EOF\n"
        )
        pdf_file = os.path.join(self.temp_dir.name, "sample_resume.pdf")
        with open(pdf_file, "wb") as f:
            f.write(pdf_content)

        res = verify_resume(pdf_file, expected_pages=1, check_ascii_dates=True)
        self.assertTrue(res.success)
        self.assertEqual(res.num_pages, 1)
        self.assertIn("John Doe", res.pages_text[0])


if __name__ == "__main__":
    unittest.main()

