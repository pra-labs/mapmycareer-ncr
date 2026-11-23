import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  trackEvent,
  sanitizePayload,
  normalizeSearchQuery,
} from '../analytics';

describe('analytics lib', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { umami?: unknown }).umami;
  });

  describe('normalizeSearchQuery', () => {
    it('lowercases and collapses multiple whitespaces', () => {
      expect(normalizeSearchQuery('   Senior    React    Engineer   ')).toBe(
        'senior react engineer'
      );
    });

    it('truncates queries exceeding 60 characters', () => {
      const longQuery = 'a'.repeat(80);
      const normalized = normalizeSearchQuery(longQuery);
      expect(normalized?.length).toBe(60);
      expect(normalized).toBe('a'.repeat(60));
    });

    it('returns undefined for non-string or empty queries', () => {
      expect(normalizeSearchQuery('')).toBeUndefined();
      expect(normalizeSearchQuery('    ')).toBeUndefined();
      expect(normalizeSearchQuery(123)).toBeUndefined();
      expect(normalizeSearchQuery(null)).toBeUndefined();
    });
  });

  describe('sanitizePayload', () => {
    it('returns undefined when payload is not provided', () => {
      expect(sanitizePayload(undefined)).toBeUndefined();
    });

    it('redacts sensitive credentials, tokens, emails, and phone numbers', () => {
      const payload = {
        email: 'candidate@example.com',
        phone: '+91 98765 43210',
        token: 'secret-12345',
        auth: 'bearer-token',
        password: 'my-password',
        resume_text: 'full resume text with candidate life story',
        regular_field: 'valid value',
      };

      const sanitized = sanitizePayload(payload);
      expect(sanitized).toBeDefined();
      expect(sanitized?.email).toBe('[EMAIL_REDACTED]');
      expect(sanitized?.phone).toBe('[PHONE_REDACTED]');
      expect(sanitized?.token).toBeUndefined();
      expect(sanitized?.auth).toBeUndefined();
      expect(sanitized?.password).toBeUndefined();
      expect(sanitized?.resume_text).toBeUndefined();
      expect(sanitized?.regular_field).toBe('valid value');
    });

    it('preserves job IDs in URLs for known ATS and job boards without phone redaction', () => {
      const payload = {
        greenhouse_url: 'https://job-boards.greenhouse.io/verkada/jobs/5300741007',
        lever_url: 'https://jobs.lever.co/company/1234567890',
        naukri_url: 'https://www.naukri.com/job-listings-custom-engineer-200826918563',
        workday_url: 'https://company.myworkdayjobs.com/careers/job/1023456789',
        datadog_url: 'https://datadoghq.com/careers/detail/?gh_jid=9876543210',
        coinbase_url: 'https://coinbase.com/careers/positions/1234567890',
        other_text: 'Contact recruiter at +91 9876543210 for details',
      };

      const sanitized = sanitizePayload(payload);
      expect(sanitized).toBeDefined();
      expect(sanitized?.greenhouse_url).toBe('https://job-boards.greenhouse.io/verkada/jobs/5300741007');
      expect(sanitized?.lever_url).toBe('https://jobs.lever.co/company/1234567890');
      expect(sanitized?.naukri_url).toBe('https://www.naukri.com/job-listings-custom-engineer-200826918563');
      expect(sanitized?.workday_url).toBe('https://company.myworkdayjobs.com/careers/job/1023456789');
      expect(sanitized?.datadog_url).toBe('https://datadoghq.com/careers/detail/?gh_jid=9876543210');
      expect(sanitized?.coinbase_url).toBe('https://coinbase.com/careers/positions/1234567890');
      expect(sanitized?.other_text).toBe('Contact recruiter at [PHONE_REDACTED] for details');
    });

    it('redacts sensitive query tokens even on ATS URLs', () => {
      const payload = {
        apply_url: 'https://job-boards.greenhouse.io/verkada/jobs/5300741007?token=secret123&utm_source=board',
      };
      const sanitized = sanitizePayload(payload);
      expect(sanitized?.apply_url).toBe('https://job-boards.greenhouse.io/verkada/jobs/5300741007?token=[REDACTED]&utm_source=board');
    });

    it('normalizes search_query keys within payloads to clean Umami metrics', () => {
      const payload = {
        search_query: '  Senior   GOLANG   Developer in Gurugram   ',
      };
      const sanitized = sanitizePayload(payload);
      expect(sanitized?.search_query).toBe('senior golang developer in gurugram');
    });
  });

  describe('trackEvent', () => {
    it('does nothing gracefully when window.umami is not present', () => {
      expect(() => {
        trackEvent('job_search_filter', { search_query: 'test' });
      }).not.toThrow();
    });

    it('invokes window.umami.track with sanitized payload', () => {
      const mockTrack = vi.fn();
      window.umami = { track: mockTrack };

      trackEvent('resume_matcher_applied', {
        threshold: 40,
        matched_count: 5,
        detected_track: 'Frontend Engineer',
        seniority: 'Senior',
      });

      expect(mockTrack).toHaveBeenCalledTimes(1);
      expect(mockTrack).toHaveBeenCalledWith('resume_matcher_applied', {
        threshold: 40,
        matched_count: 5,
        detected_track: 'Frontend Engineer',
        seniority: 'Senior',
      });
    });

    it('tracks resume_builder_export with clean format payload', () => {
      const mockTrack = vi.fn();
      window.umami = { track: mockTrack };

      trackEvent('resume_builder_export', { format: 'pdf' });
      expect(mockTrack).toHaveBeenCalledWith('resume_builder_export', {
        format: 'pdf',
      });
    });

    it('tracks ai_assistant_used with feature, status, and latency', () => {
      const mockTrack = vi.fn();
      window.umami = { track: mockTrack };

      trackEvent('ai_assistant_used', {
        feature: 'ats_bullet',
        status: 'success',
        latency_ms: 245,
      });

      expect(mockTrack).toHaveBeenCalledWith('ai_assistant_used', {
        feature: 'ats_bullet',
        status: 'success',
        latency_ms: 245,
      });
    });

    it('tracks search_zero_results event', () => {
      const mockTrack = vi.fn();
      window.umami = { track: mockTrack };

      trackEvent('search_zero_results', {
        query: 'quantum computing engineer',
        city: 'Delhi NCR',
        hub: 'Cyber City',
        notice_period: 'Immediate',
      });

      expect(mockTrack).toHaveBeenCalledWith('search_zero_results', {
        query: 'quantum computing engineer',
        city: 'Delhi NCR',
        hub: 'Cyber City',
        notice_period: 'Immediate',
      });
    });

    it('tracks commute_calculator_used event with coarse distance bucket', () => {
      const mockTrack = vi.fn();
      window.umami = { track: mockTrack };

      trackEvent('commute_calculator_used', {
        distance_bucket: '10-25 km',
        transport_mode: 'transit_and_drive',
        hub: 'Cyber City Rapid Metro (Gurugram)',
      });

      expect(mockTrack).toHaveBeenCalledWith('commute_calculator_used', {
        distance_bucket: '10-25 km',
        transport_mode: 'transit_and_drive',
        hub: 'Cyber City Rapid Metro (Gurugram)',
      });
    });
  });
});
