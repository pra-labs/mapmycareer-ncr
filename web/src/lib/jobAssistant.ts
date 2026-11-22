/**
 * Job Assistant Edge AI Service & Guardrails Engine
 *
 * Provides:
 * 1. Sliding-window in-memory per-IP rate limiter (max 8 req/min/IP with bounded map pruning).
 * 2. In-memory LRU cache (max 200 items, 15-minute TTL) for nl_search query expansion.
 * 3. Strict input length cap (max 600 characters).
 * 4. 15-second AbortController timeout for upstream LiteLLM calls.
 * 5. nl_search structured JSON parsing & caching.
 * 6. ats_bullet Google XYZ rewriting with Server-Sent Events (SSE) streaming and abort cleanup.
 */

export type JobAssistantMode = 'nl_search' | 'ats_bullet';

export interface NLSearchResult {
  role: string;
  skills: string[];
  location: string;
  remote: boolean;
  query: string;
}

export interface JobAssistantRequestBody {
  mode: JobAssistantMode;
  input: string;
  model?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

// -----------------------------------------------------------------------------
// 1. Sliding-Window In-Memory Rate Limiter with Bounded Map Pruning
// -----------------------------------------------------------------------------

interface RateLimitRecord {
  timestamps: number[];
  lastSeen: number;
}

export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
export const RATE_LIMIT_MAX_REQUESTS = 8; // max 8 requests per minute per IP
export const MAX_TRACKED_IPS = 1000; // Hard bounded map pruning threshold

// In-memory rate limiting map
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Prunes expired and stale records from rateLimitStore to prevent unbounded memory growth.
 */
export function pruneRateLimitStore(now = Date.now()): void {
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now - record.lastSeen > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }

  // If still above threshold, evict oldest entries
  if (rateLimitStore.size > MAX_TRACKED_IPS) {
    const excess = rateLimitStore.size - MAX_TRACKED_IPS;
    let evicted = 0;
    for (const ip of rateLimitStore.keys()) {
      rateLimitStore.delete(ip);
      evicted++;
      if (evicted >= excess) break;
    }
  }
}

/**
 * Checks if the given client IP has exceeded the sliding window rate limit.
 */
export function checkRateLimit(ip: string, now = Date.now()): RateLimitResult {
  // Bounded pruning triggered when map grows or periodically
  if (rateLimitStore.size >= MAX_TRACKED_IPS || Math.random() < 0.05) {
    pruneRateLimitStore(now);
  }

  const record = rateLimitStore.get(ip) || { timestamps: [], lastSeen: now };

  // Filter timestamps within the sliding window
  const activeTimestamps = record.timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  if (activeTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = activeTimestamps[0];
    const retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    record.timestamps = activeTimestamps;
    record.lastSeen = now;
    rateLimitStore.set(ip, record);
    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter),
    };
  }

  activeTimestamps.push(now);
  record.timestamps = activeTimestamps;
  record.lastSeen = now;
  rateLimitStore.set(ip, record);

  return { allowed: true };
}

/**
 * Resets the in-memory rate limiter (useful for tests).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Returns current count of tracked IPs in the rate limiter store.
 */
export function getTrackedIpCount(): number {
  return rateLimitStore.size;
}

/**
 * Extracts client IP prioritizing X-Real-IP (from Caddy reverse proxy)
 * then X-Forwarded-For, defaulting to 127.0.0.1.
 */
export function extractClientIp(req: Request | { headers: Headers }): string {
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp && xRealIp.trim()) {
    return xRealIp.trim();
  }

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return '127.0.0.1';
}

// -----------------------------------------------------------------------------
// 2. In-Memory LRU Cache (max 200 items, 15-minute TTL)
// -----------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 200, ttlMs = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string, now = Date.now()): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (now > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh entry to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict least recently used (first element in Map iteration order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, {
      value,
      expiresAt: now + this.ttlMs,
    });
  }

  has(key: string, now = Date.now()): boolean {
    return this.get(key, now) !== null;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

// Global LRU cache for natural language query expansion (max 200 items, 15-minute TTL)
export const nlSearchCache = new LRUCache<NLSearchResult>(200, 15 * 60 * 1000);

// -----------------------------------------------------------------------------
// 3. Constants, Configuration & Timeouts
// -----------------------------------------------------------------------------

export const MAX_INPUT_LENGTH = 600;
export const UPSTREAM_TIMEOUT_MS = 15_000; // 15-second AbortController timeout

export function getLiteLLMBaseUrl(): string {
  return (process.env.LITELLM_BASE_URL || 'http://127.0.0.1:4000/v1').replace(/\/+$/, '');
}

export function getDefaultModel(): string {
  return process.env.LITELLM_MODEL || 'pralabs-gemma4:edge';
}

export function getLiteLLMApiKey(): string {
  return process.env.LITELLM_API_KEY || process.env.OPENAI_API_KEY || '';
}

/**
 * Creates an AbortController with a 15-second timeout, linked to any client-provided signal.
 */
export function createTimeoutSignal(timeoutMs = UPSTREAM_TIMEOUT_MS, clientSignal?: AbortSignal | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Upstream request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const onClientAbort = () => {
    controller.abort(clientSignal?.reason || new Error('Client aborted request'));
  };

  if (clientSignal) {
    if (clientSignal.aborted) {
      controller.abort(clientSignal.reason);
      clearTimeout(timer);
    } else {
      clientSignal.addEventListener('abort', onClientAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (clientSignal) {
      clientSignal.removeEventListener('abort', onClientAbort);
    }
  };

  return { controller, signal: controller.signal, cleanup };
}

// -----------------------------------------------------------------------------
// 4. Mode: nl_search Query Expansion
// -----------------------------------------------------------------------------

export const NL_SEARCH_SYSTEM_PROMPT = `You are a search query parser for a job portal in the Delhi-NCR / Indian tech market.
Extract structured search criteria from the user's natural language request.
You MUST output ONLY a valid JSON object matching this exact schema:
{
  "role": string,
  "skills": string[],
  "location": string,
  "remote": boolean,
  "query": string
}
Guidelines:
- "role": Primary job title or specialization (e.g. "Frontend Engineer", "DevOps Engineer"), or empty string if not specified.
- "skills": Array of relevant technical or domain skills mentioned (e.g. ["React", "TypeScript", "Next.js"]).
- "location": City or sub-region (e.g. "Noida", "Gurugram", "Delhi", "Bengaluru", "Cyber City", "Sector 62"), or empty string.
- "remote": true if remote or work-from-home is requested, false otherwise.
- "query": Cleaned keywords for traditional database text match.
Output ONLY the JSON object. Do not include markdown formatting, code fences, or explanatory commentary.`;

/**
 * Parses raw text from LLM into a validated NLSearchResult with fallback handling.
 */
export function parseNLSearchResponse(rawText: string, fallbackQuery: string): NLSearchResult {
  const trimmed = rawText.trim();

  // Strip markdown code fences if present
  let candidate = trimmed;
  if (candidate.includes('```')) {
    const match = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      candidate = match[1].trim();
    }
  }

  // Attempt JSON parsing; fallback to locating curly brace bounds if extra text surrounds JSON
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(candidate.substring(firstBrace, lastBrace + 1));
      } catch {
        parsed = null;
      }
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const role = typeof obj.role === 'string' ? obj.role.trim() : '';
    const location = typeof obj.location === 'string' ? obj.location.trim() : '';
    const remote = Boolean(obj.remote);

    let skills: string[] = [];
    if (Array.isArray(obj.skills)) {
      skills = obj.skills
        .filter((s): s is string => typeof s === 'string')
        .map(s => s.trim())
        .filter(Boolean);
    }

    const query = typeof obj.query === 'string' && obj.query.trim().length > 0
      ? obj.query.trim()
      : fallbackQuery.trim();

    return {
      role,
      skills,
      location,
      remote,
      query,
    };
  }

  // Safe fallback if JSON parsing completely fails
  return {
    role: '',
    skills: [],
    location: '',
    remote: false,
    query: fallbackQuery.trim(),
  };
}

/**
 * Processes an nl_search natural language query with in-memory LRU caching and upstream LiteLLM call.
 */
export async function processNLSearch(
  input: string,
  modelOverride?: string,
  clientSignal?: AbortSignal | null
): Promise<NLSearchResult> {
  const normalizedKey = input.trim().toLowerCase();

  // 1. Check in-memory LRU cache
  const cached = nlSearchCache.get(normalizedKey);
  if (cached) {
    return cached;
  }

  const baseUrl = getLiteLLMBaseUrl();
  const model = modelOverride?.trim() || getDefaultModel();
  const apiKey = getLiteLLMApiKey();

  const { signal, cleanup } = createTimeoutSignal(UPSTREAM_TIMEOUT_MS, clientSignal);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: NL_SEARCH_SYSTEM_PROMPT },
          { role: 'user', content: input.trim() },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Upstream LiteLLM error (${response.status}): ${errText}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';
    const result = parseNLSearchResponse(content, input);

    // Cache parsed result in LRU cache
    nlSearchCache.set(normalizedKey, result);

    return result;
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------------
// 5. Mode: ats_bullet Rewrite with SSE Streaming
// -----------------------------------------------------------------------------

export const ATS_BULLET_SYSTEM_PROMPT = `You are an expert resume editor and ATS (Applicant Tracking System) optimization specialist.
Rewrite the provided resume bullet point strictly following the Google XYZ formula:
"Accomplished [X] as measured by [Y], by doing [Z]"

Rules:
1. Begin with a strong action verb in the past tense (e.g., Architected, Engineered, Spearheaded, Optimized, Accelerated, Streamlined, Automated).
2. Clearly articulate the accomplishment [X], the measurable metric or business outcome [Y], and the technical methodology or action [Z].
3. If the bullet point lacks quantifiable metrics, introduce plausible, realistic metrics (e.g., "by 35%", "reducing latency by 140ms", "scaling to 50K+ daily active users").
4. Eliminate weak passive phrasing ("worked on", "responsible for", "helped with") and filler words.
5. Keep the rewritten bullet concise, punchy, and between 18 and 40 words.
6. Output ONLY the rewritten bullet point text. Do NOT include quotes, bullet markers (• or -), introductory remarks, or explanations.`;

/**
 * Initiates an ATS bullet point rewrite with Server-Sent Events (SSE) streaming back to the client.
 */
export async function streamATSBullet(
  input: string,
  modelOverride?: string,
  clientSignal?: AbortSignal | null
): Promise<Response> {
  const baseUrl = getLiteLLMBaseUrl();
  const model = modelOverride?.trim() || getDefaultModel();
  const apiKey = getLiteLLMApiKey();

  const { controller, signal, cleanup } = createTimeoutSignal(UPSTREAM_TIMEOUT_MS, clientSignal);

  let upstreamResponse: globalThis.Response;
  try {
    upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ATS_BULLET_SYSTEM_PROMPT },
          { role: 'user', content: input.trim() },
        ],
        stream: true,
        max_tokens: 180,
        temperature: 0.2,
      }),
      signal,
    });
  } catch (err) {
    cleanup();
    throw err;
  }

  if (!upstreamResponse.ok) {
    cleanup();
    const errText = await upstreamResponse.text().catch(() => '');
    throw new Error(`Upstream LiteLLM error (${upstreamResponse.status}): ${errText}`);
  }

  const upstreamBody = upstreamResponse.body;
  if (!upstreamBody) {
    cleanup();
    throw new Error('Upstream response body is null');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstreamBody.getReader();

  const sseStream = new ReadableStream({
    async start(streamController) {
      let buffer = '';
      let doneEmitted = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6).trim();
              if (data === '[DONE]') {
                streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
                doneEmitted = true;
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  streamController.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token, text: token, content: token })}\n\n`)
                  );
                }
              } catch {
                // Ignore malformed or heartbeat chunk
              }
            }
          }

          if (doneEmitted) break;
        }

        // Flush remainder if present
        if (!doneEmitted && buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') {
              streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
              doneEmitted = true;
            } else {
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  streamController.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token, text: token, content: token })}\n\n`)
                  );
                }
              } catch {
                // Ignore
              }
            }
          }
        }

        if (!doneEmitted) {
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
        }
        streamController.close();
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError' || signal.aborted) {
          try {
            streamController.close();
          } catch {
            // Already closed
          }
        } else {
          streamController.error(err);
        }
      } finally {
        cleanup();
        try {
          await reader.cancel();
        } catch {
          // Ignore cancel error
        }
      }
    },
    async cancel(reason) {
      cleanup();
      controller.abort(reason);
      try {
        await reader.cancel();
      } catch {
        // Ignore cancel error
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
