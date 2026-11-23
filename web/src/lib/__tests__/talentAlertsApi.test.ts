import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { POST } from '@/app/api/talent-alerts/route';
import {
  setTalentAlertsDbPath,
  getTalentAlertsDatabase,
} from '@/lib/talentAlertsDb';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test_talent_alerts.db');

describe('Talent Alerts API Route (POST /api/talent-alerts)', () => {
  beforeEach(() => {
    // Configure isolated SQLite test database
    setTalentAlertsDbPath(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterEach(() => {
    setTalentAlertsDbPath(null);
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {
        // Ignored
      }
    }
  });

  it('rejects requests without affirmative DPDP consent', async () => {
    const req = new NextRequest('http://localhost:3000/api/talent-alerts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Sharma',
        email: 'aarav@example.com',
        target_role: 'Frontend Engineer',
        preferred_city: 'Gurugram',
        notice_period: 'Immediate',
        consent_given: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('DPDP affirmative consent is mandatory');
  });

  it('rejects requests with malformed or invalid RFC 5322 email', async () => {
    const req = new NextRequest('http://localhost:3000/api/talent-alerts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Sharma',
        email: 'invalid-email-address',
        target_role: 'Frontend Engineer',
        preferred_city: 'Gurugram',
        notice_period: 'Immediate',
        consent_given: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Valid RFC 5322 email is required');
  });

  it('rejects invalid notice period', async () => {
    const req = new NextRequest('http://localhost:3000/api/talent-alerts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Sharma',
        email: 'aarav@example.com',
        target_role: 'Frontend Engineer',
        preferred_city: 'Gurugram',
        notice_period: '90+ Days' as unknown,
        consent_given: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid notice period');
  });

  it('successfully persists valid candidate submission into SQLite talent_alerts table', async () => {
    const req = new NextRequest('http://localhost:3000/api/talent-alerts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rohit Verma',
        email: 'rohit.verma@example.com',
        target_role: 'Full Stack Engineer',
        preferred_city: 'Noida',
        notice_period: '<= 30 Days',
        linkedin_url: 'https://linkedin.com/in/rohitverma',
        consent_given: true,
        consent_version: 'v1.0',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Successfully enrolled');
    expect(body.id).toBeDefined();
    expect(body.timestamp).toBeDefined();

    // Verify row in SQLite database directly
    const db = getTalentAlertsDatabase();
    expect(db).not.toBeNull();
    const row = db?.prepare('SELECT * FROM talent_alerts WHERE email = ?').get('rohit.verma@example.com') as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.name).toBe('Rohit Verma');
    expect(row.email).toBe('rohit.verma@example.com');
    expect(row.target_role).toBe('Full Stack Engineer');
    expect(row.preferred_city).toBe('Noida');
    expect(row.notice_period).toBe('<= 30 Days');
    expect(row.linkedin_url).toBe('https://linkedin.com/in/rohitverma');
    expect(row.consent_given).toBe(1);
    expect(row.consent_version).toBe('v1.0');
  });
});
