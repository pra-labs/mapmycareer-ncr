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
  });
});
