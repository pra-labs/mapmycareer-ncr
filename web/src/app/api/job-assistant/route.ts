import { NextRequest, NextResponse } from 'next/server';
import {
  extractClientIp,
  checkRateLimit,
  processNLSearch,
  streamATSBullet,
  MAX_INPUT_LENGTH,
} from '@/lib/jobAssistant';

export async function POST(req: NextRequest) {
  try {
    // 1. Guardrail: Sliding-window in-memory per-IP rate limiter (max 8 requests / minute / IP)
    const ip = extractClientIp(req);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Maximum 8 requests per minute.',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    // 2. Request body validation with byte size guard (max 4KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 4096) {
      return NextResponse.json(
        { error: 'Payload size exceeds 4KB limit.' },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body in request.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const { mode, input, model } = body as Record<string, unknown>;

    // Validate mode
    if (mode !== 'nl_search' && mode !== 'ats_bullet') {
      return NextResponse.json(
        { error: 'Invalid mode. Supported modes: "nl_search", "ats_bullet".' },
        { status: 400 }
      );
    }

    // Validate input presence and type
    if (typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json(
        { error: 'Input parameter is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    // Guardrail: Strict input length cap (max 600 characters)
    if (input.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Input exceeds maximum allowed length of ${MAX_INPUT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const modelOverride = typeof model === 'string' ? model : undefined;

    // 3. Execution by mode
    if (mode === 'nl_search') {
      try {
        const result = await processNLSearch(input, modelOverride, req.signal);
        return NextResponse.json(result, { status: 200 });
      } catch (err: unknown) {
        console.error('[job-assistant] nl_search error:', err);
        return NextResponse.json(
          { error: 'Upstream AI service unavailable or timed out.' },
          { status: 503 }
        );
      }
    }

    if (mode === 'ats_bullet') {
      try {
        return await streamATSBullet(input, modelOverride, req.signal);
      } catch (err: unknown) {
        console.error('[job-assistant] ats_bullet error:', err);
        return NextResponse.json(
          { error: 'Upstream AI service unavailable or timed out.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Unhandled request mode.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error('[job-assistant] Unhandled route error:', err);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
