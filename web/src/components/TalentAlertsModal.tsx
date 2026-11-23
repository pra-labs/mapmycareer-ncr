import React, { useState } from 'react';
import { X, BellRing, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { validateEmailSyntax } from '@/lib/emailValidator';

export interface TalentAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: string;
  defaultCity?: string;
}

const NOTICE_PERIOD_OPTIONS = [
  'Immediate',
  '<= 30 Days',
  '30-60 Days',
  '> 60 Days',
] as const;

const CITY_OPTIONS = [
  'All Cities (Pan-India)',
  'Gurugram',
  'Noida',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Chennai',
];

export const TalentAlertsModal: React.FC<TalentAlertsModalProps> = ({
  isOpen,
  onClose,
  defaultRole = '',
  defaultCity = 'All Cities (Pan-India)',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [targetRole, setTargetRole] = useState(defaultRole);
  const [preferredCity, setPreferredCity] = useState(defaultCity);
  const [noticePeriod, setNoticePeriod] = useState<typeof NOTICE_PERIOD_OPTIONS[number]>('<= 30 Days');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Sync defaultRole / defaultCity when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (defaultRole) setTargetRole(defaultRole);
      if (defaultCity) setPreferredCity(defaultCity);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, defaultRole, defaultCity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Client-side validations
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      setStatus('error');
      return;
    }

    if (!validateEmailSyntax(email.trim())) {
      setErrorMessage('Please enter a valid work or personal email address.');
      setStatus('error');
      return;
    }

    if (!targetRole.trim()) {
      setErrorMessage('Please provide your target role or tech stack.');
      setStatus('error');
      return;
    }

    if (linkedinUrl.trim()) {
      const url = linkedinUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        setErrorMessage('LinkedIn profile URL must start with https:// or http://');
        setStatus('error');
        return;
      }
    }

    if (!consentGiven) {
      setErrorMessage('Affirmative consent under DPDP guidelines is required to receive alerts.');
      setStatus('error');
      return;
    }

    setIsSubmitting(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/talent-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          target_role: targetRole.trim(),
          preferred_city: preferredCity.trim(),
          notice_period: noticePeriod,
          linkedin_url: linkedinUrl.trim() || null,
          consent_given: true,
          consent_version: 'v1.0',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enroll in talent alerts');
      }

      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setTargetRole('');
    setLinkedinUrl('');
    setConsentGiven(false);
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="talent-alerts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h2 id="talent-alerts-title" className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                Voluntary Talent Radar & Job Alerts
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                100% voluntary, DPDP-compliant private notification list.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {status === 'success' ? (
          <div className="py-8 text-center space-y-4 animate-in fade-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                You&apos;re On the Radar!
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Thank you for opting in. We&apos;ll notify you at <strong className="text-zinc-900 dark:text-white">{email}</strong> whenever high-signal tech roles matching your preferences drop.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-left text-[11px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                DPDP Consent Logged (Version v1.0)
              </p>
              <p className="mt-1 text-[10px] opacity-90">
                Your opt-in record has been timestamped and encrypted in our isolated data store. You can request deletion anytime.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3.5">
            {/* DPDP Notice Card */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs dark:border-indigo-950 dark:bg-indigo-950/30">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                <p className="text-[11px] text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  <strong>Digital Personal Data Protection (DPDP) Standard:</strong> Your contact info is collected solely for proactive job matching by PraLabs. We never sell or share candidate data with third-party aggregators.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Candidate Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="talent-name" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="talent-name"
                  type="text"
                  required
                  placeholder="e.g. Abhinav Prakash"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label htmlFor="talent-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="talent-email"
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                />
              </div>
            </div>

            {/* Target Role & Preferred City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="talent-role" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Target Role / Domain <span className="text-rose-500">*</span>
                </label>
                <input
                  id="talent-role"
                  type="text"
                  required
                  placeholder="e.g. Full-Stack Engineer, AI/ML"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label htmlFor="talent-city" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Preferred City / Tech Hub <span className="text-rose-500">*</span>
                </label>
                <select
                  id="talent-city"
                  value={preferredCity}
                  onChange={(e) => setPreferredCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                >
                  {CITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notice Period & LinkedIn URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="talent-notice" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Notice Period <span className="text-rose-500">*</span>
                </label>
                <select
                  id="talent-notice"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value as typeof NOTICE_PERIOD_OPTIONS[number])}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                >
                  {NOTICE_PERIOD_OPTIONS.map((np) => (
                    <option key={np} value={np}>
                      {np}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="talent-linkedin" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  LinkedIn URL <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="talent-linkedin"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:focus:border-blue-400"
                />
              </div>
            </div>

            {/* Explicit DPDP Affirmative Opt-in Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="talent-consent"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                  <strong className="text-zinc-800 dark:text-zinc-200">Affirmative Consent:</strong> I agree to receive job alerts from PraLabs; my data will never be sold.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !consentGiven}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="h-3.5 w-3.5" />
                    <span>Join Radar & Get Alerts</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
