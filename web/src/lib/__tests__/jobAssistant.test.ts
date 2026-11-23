import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  extractClientIp,
  checkRateLimit,
  resetRateLimitStore,
  pruneRateLimitStore,
  getTrackedIpCount,
  LRUCache,
  parseNLSearchResponse,
  processNLSearch,
  streamATSBullet,
  nlSearchCache,
  MAX_INPUT_LENGTH,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  MAX_TRACKED_IPS,
} from '../jobAssistant';
import { POST } from '@/app/api/job-assistant/route';
import { NextRequest } from 'next/server';

describe('Job Assistant - Guardrails & Utilities', () => {
  beforeEach(() => {
    resetRateLimitStore();
    nlSearchCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractClientIp', () => {
    it('prioritizes x-real-ip from Caddy', () => {
      const headers = new Headers({
        'x-real-ip': '203.0.113.195',
        'x-forwarded-for': '198.51.100.1, 192.168.1.1',
      });
      const ip = extractClientIp({ headers });
      expect(ip).toBe('203.0.113.195');
    });

    it('falls back to first entry in x-forwarded-for if x-real-ip is missing', () => {
      const headers = new Headers({
        'x-forwarded-for': '198.51.100.42, 10.0.0.1',
      });
      const ip = extractClientIp({ headers });
      expect(ip).toBe('198.51.100.42');
    });

    it('defaults to 127.0.0.1 if no IP headers are present', () => {
      const headers = new Headers();
      const ip = extractClientIp({ headers });
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('Sliding-Window Rate Limiter', () => {
    it('allows up to 8 requests per minute for a single IP', () => {
      const ip = '192.168.1.100';
      const baseTime = 1000000;

      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const result = checkRateLimit(ip, baseTime + i * 1000);
        expect(result.allowed).toBe(true);
      }

      // 9th request within the 60s window should be blocked
      const blockedResult = checkRateLimit(ip, baseTime + 8000);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
      expect(blockedResult.retryAfter).toBeLessThanOrEqual(60);
    });

    it('isolates rate limits per distinct IP', () => {
      const ip1 = '1.1.1.1';
      const ip2 = '2.2.2.2';
      const baseTime = 1000000;

      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit(ip1, baseTime + i * 100).allowed).toBe(true);
      }

      // ip1 is now blocked
      expect(checkRateLimit(ip1, baseTime + 1000).allowed).toBe(false);

      // ip2 should still be allowed
      expect(checkRateLimit(ip2, baseTime + 1000).allowed).toBe(true);
    });

    it('allows requests again after sliding window expires', () => {
      const ip = '10.0.0.5';
      const baseTime = 1000000;

      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit(ip, baseTime + i * 1000);
      }
      expect(checkRateLimit(ip, baseTime + 7000).allowed).toBe(false);

      // Advance time past 60 seconds
      const futureTime = baseTime + RATE_LIMIT_WINDOW_MS + 1000;
      const allowedResult = checkRateLimit(ip, futureTime);
      expect(allowedResult.allowed).toBe(true);
    });

    it('prunes stale entries to maintain bounded memory', () => {
      const baseTime = 1000000;

      // Seed multiple IPs
      for (let i = 0; i < 50; i++) {
        checkRateLimit(`ip-${i}`, baseTime);
      }
      expect(getTrackedIpCount()).toBe(50);

      // Advance time past window and trigger pruning
      pruneRateLimitStore(baseTime + RATE_LIMIT_WINDOW_MS + 5000);
      expect(getTrackedIpCount()).toBe(0);
    });

    it('enforces hard capacity cap MAX_TRACKED_IPS on store', () => {
      const baseTime = 1000000;
      // Seed more than MAX_TRACKED_IPS
      for (let i = 0; i < MAX_TRACKED_IPS + 50; i++) {
        checkRateLimit(`flood-ip-${i}`, baseTime);
      }
      pruneRateLimitStore(baseTime);
      expect(getTrackedIpCount()).toBeLessThanOrEqual(MAX_TRACKED_IPS);
    });

    it('slides the window incrementally as individual timestamps age out', () => {
      const ip = '172.16.0.9';
      const t0 = 1000000;

      // Make 4 requests at t0
      for (let i = 0; i < 4; i++) {
        expect(checkRateLimit(ip, t0).allowed).toBe(true);
      }

      // Make 4 requests at t0 + 30s
      const t30 = t0 + 30000;
      for (let i = 0; i < 4; i++) {
        expect(checkRateLimit(ip, t30).allowed).toBe(true);
      }

      // 9th request at t30 is blocked (8 total in window)
      expect(checkRateLimit(ip, t30).allowed).toBe(false);

      // At t0 + 61s: the first 4 requests have expired (>60s), but the 4 requests from t30 are still active (31s old)
      const t61 = t0 + 61000;
      for (let i = 0; i < 4; i++) {
        expect(checkRateLimit(ip, t61).allowed).toBe(true);
      }
      // Now 4 (from t30) + 4 (from t61) = 8 active -> 9th should block
      expect(checkRateLimit(ip, t61).allowed).toBe(false);
    });
  });

  describe('LRUCache', () => {
    it('stores and retrieves values', () => {
      const cache = new LRUCache<string>(3, 60000);
      cache.set('a', 'alpha');
      cache.set('b', 'beta');

      expect(cache.get('a')).toBe('alpha');
      expect(cache.get('b')).toBe('beta');
      expect(cache.get('c')).toBeNull();
    });

    it('evicts least recently used item when capacity is reached', () => {
      const cache = new LRUCache<string>(3, 60000);
      cache.set('a', 'alpha');
      cache.set('b', 'beta');
      cache.set('c', 'gamma');

      // Access 'a' so 'b' becomes least recently used
      cache.get('a');

      // Insert 'd', which should evict 'b'
      cache.set('d', 'delta');

      expect(cache.get('a')).toBe('alpha');
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBe('gamma');
      expect(cache.get('d')).toBe('delta');
    });

    it('expires items after TTL', () => {
      const cache = new LRUCache<string>(3, 5000);
      const now = 1000000;

      cache.set('a', 'alpha', now);
      expect(cache.get('a', now + 2000)).toBe('alpha');

      // Beyond TTL (5000ms)
      expect(cache.get('a', now + 6000)).toBeNull();
    });

    it('refreshes existing keys on set without triggering unwanted capacity eviction', () => {
      const cache = new LRUCache<string>(2, 60000);
      const now = 1000000;

      cache.set('k1', 'v1', now);
      cache.set('k2', 'v2', now);

      // Update k1
      cache.set('k1', 'v1_updated', now + 10);
      expect(cache.size).toBe(2);

      // Now insert k3 -> k2 should be evicted (since k1 was just updated)
      cache.set('k3', 'v3', now + 20);

      expect(cache.get('k1', now + 30)).toBe('v1_updated');
      expect(cache.get('k2', now + 30)).toBeNull();
      expect(cache.get('k3', now + 30)).toBe('v3');
    });

    it('checks existence via has() and respects TTL expiry', () => {
      const cache = new LRUCache<string>(3, 5000);
      const now = 1000000;

      cache.set('item', 'val', now);
      expect(cache.has('item', now + 2000)).toBe(true);
      expect(cache.has('item', now + 6000)).toBe(false);
    });

    it('clears all entries via clear()', () => {
      const cache = new LRUCache<number>(5, 60000);
      cache.set('x', 1);
      cache.set('y', 2);
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('x')).toBeNull();
    });
  });

  describe('parseNLSearchResponse', () => {
    it('parses valid raw JSON correctly', () => {
      const raw = JSON.stringify({
        role: 'React Developer',
        skills: ['React', 'TypeScript', 'Tailwind'],
        location: 'Noida',
        remote: false,
        query: 'React Developer Noida',
      });

      const parsed = parseNLSearchResponse(raw, 'react jobs in noida');
      expect(parsed).toEqual({
        role: 'React Developer',
        skills: ['React', 'TypeScript', 'Tailwind'],
        location: 'Noida',
        remote: false,
        query: 'React Developer Noida',
      });
    });

    it('strips markdown code blocks gracefully', () => {
      const raw = `\`\`\`json
{
  "role": "Backend Engineer",
  "skills": ["Go", "Kubernetes"],
  "location": "Gurugram",
  "remote": true,
  "query": "Go Kubernetes Gurugram"
}
\`\`\``;

      const parsed = parseNLSearchResponse(raw, 'fallback query');
      expect(parsed.role).toBe('Backend Engineer');
      expect(parsed.skills).toEqual(['Go', 'Kubernetes']);
      expect(parsed.location).toBe('Gurugram');
      expect(parsed.remote).toBe(true);
      expect(parsed.query).toBe('Go Kubernetes Gurugram');
    });

    it('extracts JSON when surrounded by commentary', () => {
      const raw = `Here is the search criteria you requested:
{
  "role": "Data Engineer",
  "skills": ["Python", "SQL"],
  "location": "Delhi",
  "remote": false,
  "query": "Data Engineer Delhi"
}
Hope this helps!`;

      const parsed = parseNLSearchResponse(raw, 'fallback');
      expect(parsed.role).toBe('Data Engineer');
      expect(parsed.skills).toEqual(['Python', 'SQL']);
    });

    it('falls back safely on completely unparseable input', () => {
      const parsed = parseNLSearchResponse('not a json string at all', 'original user input');
      expect(parsed).toEqual({
        role: '',
        skills: [],
        location: '',
        remote: false,
        query: 'original user input',
      });
    });

    it('sanitizes and trims fields, filtering out non-string or whitespace skills', () => {
      const dirtyData = JSON.stringify({
        role: '  Security Engineer   ',
        skills: ['  Burp Suite  ', '', null, 123, '  SIEM  '],
        location: '  Cyber City Gurugram  ',
        remote: 'yes',
        query: '   ',
      });

      const parsed = parseNLSearchResponse(dirtyData, 'security engineer cyber city');
      expect(parsed.role).toBe('Security Engineer');
      expect(parsed.skills).toEqual(['Burp Suite', 'SIEM']);
      expect(parsed.location).toBe('Cyber City Gurugram');
      expect(parsed.remote).toBe(true);
      expect(parsed.query).toBe('security engineer cyber city');
    });

    it('handles empty string or whitespace-only input safely', () => {
      const parsed = parseNLSearchResponse('   ', 'fallback query');
      expect(parsed).toEqual({
        role: '',
        skills: [],
        location: '',
        remote: false,
        query: 'fallback query',
      });
    });

    it('handles partial JSON with missing fields using sensible defaults', () => {
      const partialJson = JSON.stringify({
        role: 'MLOps Engineer',
      });

      const parsed = parseNLSearchResponse(partialJson, 'mlops engineer');
      expect(parsed.role).toBe('MLOps Engineer');
      expect(parsed.skills).toEqual([]);
      expect(parsed.location).toBe('');
      expect(parsed.remote).toBe(false);
      expect(parsed.query).toBe('mlops engineer');
    });

    it('extracts notice period and urgency signals and maps skill synonyms', () => {
      const raw = JSON.stringify({
        role: 'QA',
        skills: ['GenAI', 'LLM', 'Frontend', 'Testing'],
        location: 'Bengaluru',
        remote: false,
        notice_period: '30 days',
        urgency: 'high',
        query: 'QA GenAI LLM 30 days',
      });

      const parsed = parseNLSearchResponse(raw, 'fallback');
      expect(parsed.role).toBe('Software Development Engineer in Test / QA');
      expect(parsed.skills).toContain('Artificial Intelligence / Machine Learning');
      expect(parsed.skills).toContain('React / Web Development');
      expect(parsed.skills).toContain('Software Development Engineer in Test / QA');
      expect(parsed.notice_period).toBe('30 days');
      expect(parsed.urgency).toBe('high');
    });

    it('extracts immediate notice period from fallback query when unparseable', () => {
      const parsed = parseNLSearchResponse('broken json', 'Looking for immediate joiner React dev');
      expect(parsed.notice_period).toBe('immediate');
      expect(parsed.urgency).toBe('immediate');
    });
  });

  describe('processNLSearch', () => {
    it('caches successful query expansions in LRU cache', async () => {
      const query = 'senior python engineer in gurugram';
      const mockResult = {
        role: 'Senior Python Engineer',
        skills: ['Python', 'FastAPI'],
        location: 'Gurugram',
        remote: false,
        query: 'Senior Python Engineer Gurugram',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResult) } }],
        }),
      } as unknown as Response);

      // First call invokes fetch
      const result1 = await processNLSearch(query);
      expect(result1.role).toBe('Senior Python Engineer');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call uses LRU cache
      const result2 = await processNLSearch(query);
      expect(result2.role).toBe('Senior Python Engineer');
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Not called again
    });

    it('throws error on upstream LiteLLM failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      } as unknown as Response);

      await expect(processNLSearch('test query')).rejects.toThrow('Upstream LiteLLM error (502)');
    });
  });

  describe('streamATSBullet', () => {
    it('sets up stream with correct parameters and emits SSE tokens', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Architected "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"distributed "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"microservices."}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockBody = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of sseChunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        body: mockBody,
      } as unknown as Response);

      const response = await streamATSBullet('I built some microservices');
      expect(fetchSpy).toHaveBeenCalled();
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      const decoder = new TextDecoder();
      let streamedText = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedText += decoder.decode(value);
      }

      expect(streamedText).toContain('Architected ');
      expect(streamedText).toContain('distributed ');
      expect(streamedText).toContain('[DONE]');
    });
  });
});

describe('Job Assistant API Route (POST /api/job-assistant)', () => {
  beforeEach(() => {
    resetRateLimitStore();
    nlSearchCache.clear();
    vi.restoreAllMocks();
  });

  it('returns 400 if body is invalid JSON or empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON body in request.');
  });

  it('returns 400 for unsupported mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: 'unsupported_mode', input: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid mode');
  });

  it('returns 400 if input is missing or empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: 'nl_search', input: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Input parameter is required');
  });

  it('returns 400 if input exceeds 600 characters', async () => {
    const longInput = 'a'.repeat(MAX_INPUT_LENGTH + 1);
    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: 'nl_search', input: longInput }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Input exceeds maximum allowed length');
  });

  it('enforces 8 requests/minute rate limit and returns 429', async () => {
    const makeReq = () =>
      new NextRequest('http://localhost:3000/api/job-assistant', {
        method: 'POST',
        body: JSON.stringify({ mode: 'nl_search', input: 'devops engineer' }),
        headers: {
          'Content-Type': 'application/json',
          'x-real-ip': '198.51.100.99',
        },
      });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                role: 'DevOps',
                skills: ['Docker'],
                location: 'Noida',
                remote: false,
                query: 'DevOps Docker',
              }),
            },
          },
        ],
      }),
    } as unknown as Response);

    // Make 8 allowed requests
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(200);
    }

    // 9th request should receive 429
    const blockedRes = await POST(makeReq());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    const data = await blockedRes.json();
    expect(data.error).toContain('Rate limit exceeded');
  });

  it('returns 503 if upstream LiteLLM fails during nl_search', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: 'nl_search', input: 'cloud architect' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('Upstream AI service unavailable');
  });

  it('returns 503 if upstream LiteLLM fails during ats_bullet', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Upstream timeout'));

    const req = new NextRequest('http://localhost:3000/api/job-assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: 'ats_bullet', input: 'Responsible for leading backend team.' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('Upstream AI service unavailable');
  });
});
