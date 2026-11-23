import { NextRequest, NextResponse } from 'next/server';
import { validateEmailSyntax } from '@/lib/emailValidator';
import { insertTalentAlert } from '@/lib/talentAlertsDb';

const VALID_NOTICE_PERIODS = new Set([
  'Immediate',
  '<= 30 Days',
  '30-60 Days',
  '> 60 Days',
]);

export async function POST(req: NextRequest) {
  try {
    // 1. Guardrail: Request size limit (max 8KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 8192) {
      return NextResponse.json(
        { error: 'Payload size exceeds 8KB limit.' },
        { status: 413 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      target_role,
      preferred_city,
      notice_period,
      linkedin_url,
      consent_given,
      consent_version,
    } = body;

    // Validate Name
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Name is required (max 100 characters).' },
        { status: 400 }
      );
    }

    // Validate Email
    if (typeof email !== 'string' || !validateEmailSyntax(email.trim())) {
      return NextResponse.json(
        { error: 'Valid RFC 5322 email is required.' },
        { status: 400 }
      );
    }

    // Validate Target Role
    if (typeof target_role !== 'string' || target_role.trim().length === 0 || target_role.trim().length > 100) {
      return NextResponse.json(
        { error: 'Target role is required (max 100 characters).' },
        { status: 400 }
      );
    }

    // Validate Preferred City
    if (typeof preferred_city !== 'string' || preferred_city.trim().length === 0 || preferred_city.trim().length > 80) {
      return NextResponse.json(
        { error: 'Preferred City/Hub is required.' },
        { status: 400 }
      );
    }

    // Validate Notice Period
    if (typeof notice_period !== 'string' || !VALID_NOTICE_PERIODS.has(notice_period.trim())) {
      return NextResponse.json(
        { error: 'Invalid notice period. Options: "Immediate", "<= 30 Days", "30-60 Days", "> 60 Days".' },
        { status: 400 }
      );
    }

    // Validate Optional LinkedIn URL
    let cleanLinkedin: string | null = null;
    if (linkedin_url !== undefined && linkedin_url !== null && linkedin_url !== '') {
      if (typeof linkedin_url !== 'string') {
        return NextResponse.json(
          { error: 'LinkedIn URL must be a valid string.' },
          { status: 400 }
        );
      }
      const trimmedUrl = linkedin_url.trim();
      if (trimmedUrl.length > 255) {
        return NextResponse.json(
          { error: 'LinkedIn URL exceeds maximum 255 characters.' },
          { status: 400 }
        );
      }
      if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
        return NextResponse.json(
          { error: 'LinkedIn URL must start with http:// or https://' },
          { status: 400 }
        );
      }
      cleanLinkedin = trimmedUrl;
    }

    // DPDP Affirmative Consent Check
    if (consent_given !== true) {
      return NextResponse.json(
        { error: 'DPDP affirmative consent is mandatory to join the talent radar.' },
        { status: 400 }
      );
    }

    const version = typeof consent_version === 'string' && consent_version.trim()
      ? consent_version.trim()
      : 'v1.0';

    const consent_timestamp = new Date().toISOString();

    const insertResult = insertTalentAlert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      target_role: target_role.trim(),
      preferred_city: preferred_city.trim(),
      notice_period: notice_period.trim() as 'Immediate' | '<= 30 Days' | '30-60 Days' | '> 60 Days',
      linkedin_url: cleanLinkedin,
      consent_given: true,
      consent_timestamp,
      consent_version: version,
    });

    if (!insertResult.success) {
      return NextResponse.json(
        { error: insertResult.error || 'Failed to persist talent alert opt-in.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled in PraLabs Talent Radar & Job Alerts.',
      id: insertResult.id,
      timestamp: consent_timestamp,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
