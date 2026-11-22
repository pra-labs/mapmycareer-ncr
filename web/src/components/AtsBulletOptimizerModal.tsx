'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Loader2,
  RotateCcw,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { trackEvent } from '../lib/analytics';

const MAX_CHARS = 600;

const SAMPLE_BULLETS = [
  'Worked on microservices migration and made backend APIs faster for users.',
  'Responsible for writing SQL queries and optimizing Postgres database tables.',
  'Implemented Kafka event streaming pipeline for distributed orders and payments.',
  'Led frontend refactor to Next.js and Tailwind CSS improving page load speeds.',
];

export interface AtsBulletOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBullet?: string;
  targetRole?: string;
}

export const AtsBulletOptimizerModal: React.FC<AtsBulletOptimizerModalProps> = ({
  isOpen,
  onClose,
  initialBullet = '',
  targetRole,
}) => {
  const [bulletText, setBulletText] = useState<string>(initialBullet);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [optimizedOutput, setOptimizedOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialBullet) {
      setBulletText(initialBullet);
    }
  }, [initialBullet]);

  // Clean up any ongoing stream when modal closes
  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    onClose();
  }, [onClose]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleCopy = async () => {
    if (!optimizedOutput) return;
    try {
      await navigator.clipboard.writeText(optimizedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleOptimize = async () => {
    const trimmed = bulletText.trim();
    if (!trimmed || isStreaming) return;

    if (trimmed.length > MAX_CHARS) {
      setError(`Bullet exceeds the maximum limit of ${MAX_CHARS} characters.`);
      return;
    }

    setIsStreaming(true);
    setOptimizedOutput('');
    setError(null);
    setCopied(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Umami telemetry
      trackEvent('ai_assistant_used', {
        feature: 'ats_bullet',
        length: trimmed.length,
        has_target_role: Boolean(targetRole),
      });

      const response = await fetch('/api/job-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'ats_bullet',
          text: trimmed,
          target_role: targetRole || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }
        throw new Error(`Edge AI returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on this response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process SSE formatted chunks (data: <token>)
        const lines = buffer.split('\n');
        // Keep trailing partial chunk in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }

          if (trimmedLine.startsWith('data:')) {
            const dataContent = trimmedLine.slice(5).trim();
            if (dataContent === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(dataContent);
              const token =
                parsed.chunk ??
                parsed.content ??
                parsed.text ??
                parsed.delta ??
                (typeof parsed === 'string' ? parsed : '');
              accumulated += token;
            } catch {
              // Raw string line
              accumulated += dataContent + '\n';
            }
          } else {
            // Direct text chunk fallback
            accumulated += line + '\n';
          }

          setOptimizedOutput(accumulated);
        }
      }

      // Handle any trailing buffer
      if (buffer.trim()) {
        const trimmedTail = buffer.trim();
        if (trimmedTail.startsWith('data:')) {
          const dataContent = trimmedTail.slice(5).trim();
          if (dataContent !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataContent);
              accumulated += parsed.chunk ?? parsed.content ?? parsed.text ?? '';
            } catch {
              accumulated += dataContent;
            }
          }
        } else {
          accumulated += buffer;
        }
        setOptimizedOutput(accumulated);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      console.error('[AtsBulletOptimizerModal Error]', err);
      setError((err as Error)?.message || 'Failed to optimize bullet. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleUseSample = (sample: string) => {
    setBulletText(sample);
    setError(null);
  };

  if (!isOpen) return null;

  const charsCount = bulletText.length;
  const isOverLimit = charsCount > MAX_CHARS;
  const isNearLimit = charsCount >= 500 && !isOverLimit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ats-bullet-title"
      onClick={handleClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ats-bullet-title" className="text-base font-bold text-zinc-900 dark:text-white">
                  AI Resume Bullet Optimizer
                </h2>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-950/50 dark:text-violet-300">
                  Edge AI · XYZ Formula
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Turn plain job duties into high-impact, metric-driven accomplishments.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Section */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Original Resume Bullet Point
            </label>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                isOverLimit
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : isNearLimit
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-400'
              }`}
            >
              {charsCount} / {MAX_CHARS}
            </span>
          </div>

          <textarea
            value={bulletText}
            onChange={(e) => {
              setBulletText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste a single bullet point... (e.g. Led migration of backend auth to Go microservices, improving throughput by 40% and cutting P99 latency from 180ms to 24ms across 12M users.)"
            rows={4}
            className={`w-full rounded-xl border p-3 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:ring-2 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
              isOverLimit
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
                : 'border-zinc-200 focus:border-violet-500 focus:ring-violet-500/10 dark:border-zinc-700 dark:focus:border-violet-400'
            }`}
          />

          {/* Quick sample pills */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Try a sample bullet:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_BULLETS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleUseSample(sample)}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:border-violet-700 dark:hover:text-violet-300 truncate max-w-full"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setBulletText('');
              setOptimizedOutput('');
              setError(null);
            }}
            disabled={!bulletText && !optimizedOutput}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleOptimize}
            disabled={!bulletText.trim() || isStreaming || isOverLimit}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStreaming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Streaming XYZ Polish...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-violet-200" />
                <span>Optimize with Edge AI</span>
              </>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Streaming Result Container */}
        {(optimizedOutput || isStreaming) && (
          <div className="mt-4 rounded-xl border border-violet-200/90 bg-gradient-to-br from-violet-50/50 to-indigo-50/30 p-3.5 dark:border-violet-900/60 dark:bg-zinc-800/40 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-violet-100 dark:border-violet-900/40">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  {isStreaming ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  )}
                </span>
                <span className="text-xs font-bold text-violet-900 dark:text-violet-200">
                  {isStreaming ? 'Streaming Edge AI Output...' : 'Optimized Google XYZ Bullet'}
                </span>
              </div>

              {optimizedOutput && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 shadow-xs transition hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-800 dark:text-violet-300 dark:hover:bg-zinc-700"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Real-time streaming content */}
            <div className="mt-3 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-sans">
              {optimizedOutput || (
                <span className="italic text-zinc-400">
                  Waiting for first token from Edge AI...
                </span>
              )}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-violet-600 ml-1 animate-pulse align-middle" />
              )}
            </div>

            <div ref={resultEndRef} />
          </div>
        )}

        {/* Education Callout: Google XYZ Framework */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              The Google XYZ Formula:
            </span>{' '}
            <span className="font-mono text-[10px] text-violet-700 dark:text-violet-400">
              &quot;Accomplished [X], as measured by [Y], by doing [Z]&quot;
            </span>
            <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
              Top recruiters score bullets with quantified outcomes (e.g. 40% latency reduction, 25M requests/day) over passive task descriptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
