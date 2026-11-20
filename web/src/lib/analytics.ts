/**
 * Umami Telemetry & Frontend Event Instrumentation Helper
 * Safe client-side tracking with PII stripping and null checks.
 */

// Global Umami type definition for window
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

export type AnalyticsEventName =
  | 'job_search_filter'
  | 'map_pin_select'
  | 'job_detail_open'
  | 'job_apply_outbound';

// Sensitive query parameters or tokens to strip from URLs / payloads
const SENSITIVE_PARAM_REGEX = /(token|auth|key|secret|password|access_token|refresh_token|id_token|session|bearer)=([^&]+)/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Sanitizes input string to ensure no email, phone, or token credentials leak in telemetry.
 */
function sanitizeValue(val: unknown): unknown {
  if (typeof val === 'string') {
    return val
      .replace(SENSITIVE_PARAM_REGEX, '$1=[REDACTED]')
      .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
      .replace(PHONE_REGEX, '[PHONE_REDACTED]');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      // Omit known sensitive keys entirely
      if (/password|secret|token|credential|auth/i.test(k)) {
        continue;
      }
      sanitizedObj[k] = sanitizeValue(v);
    }
    return sanitizedObj;
  }
  return val;
}

/**
 * Strips PII and sensitive tokens from payload data dictionary.
 */
export function sanitizePayload(payload?: Record<string, any>): Record<string, any> | undefined {
  if (!payload) return undefined;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/password|secret|token|credential|auth/i.test(key)) {
      continue;
    }
    clean[key] = sanitizeValue(value);
  }
  return clean;
}

/**
 * Track custom events in Umami analytics safely.
 */
export function trackEvent(name: AnalyticsEventName, payload?: Record<string, any>): void {
  if (typeof window === 'undefined') return;

  try {
    const cleanPayload = sanitizePayload(payload);
    if (typeof (window as any).umami?.track === 'function') {
      (window as any).umami.track(name, cleanPayload);
    }
  } catch (err) {
    // Silently handle any telemetry failures to avoid breaking UX
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Error]', err);
    }
  }
}
