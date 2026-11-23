'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ROLE_TEMPLATES,
  ResumeData,
  generateLatexSource,
  generateMarkdownSource,
  generatePlainText,
} from '../lib/latexTemplates';
import { STRONG_ACTION_VERBS, WEAK_PASSIVE_PHRASES, METRIC_REGEX } from '../lib/atsAuditor';
import {
  RESUME_THEMES,
  compileResumeStylesheet,
  RESUME_TYPEFACES,
  DEFAULT_TYPEFACE_ID,
  FontCategory,
  RESUME_COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE_ID,
} from '../lib/resumeThemes';
import { parseMarkdownToResumeData, sanitizeResumeData } from '../lib/markdownResumeParser';
import { renderMarkdownToResumeHtml } from '../lib/markdownResumeRenderer';
import { exportResumePdf } from '../lib/pdfExporter';
import { trackEvent } from '../lib/analytics';
import {
  X,
  FileCode2,
  Copy,
  Check,
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Wrench,
  FileEdit,
  Printer,
  Palette,
  Code,
  FileText,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ResumeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoleKey?: string;
  initialJobContext?: {
    title: string;
    company: string;
    skills: string[];
  } | null;
}

const STORAGE_KEY = 'mapmycareer_resume_draft';

// Helper to evaluate a single bullet point in real-time
function getBulletStatus(bullet: string): {
  type: 'strong' | 'needs_numbers' | 'weak';
  label: string;
} {
  const clean = bullet.trim();
  if (!clean) {
    return { type: 'needs_numbers', label: 'Empty Bullet' };
  }

  const lower = clean.toLowerCase();
  const hasPassive = WEAK_PASSIVE_PHRASES.some((p) => lower.includes(p));
  if (hasPassive) {
    return { type: 'weak', label: '🔴 Weak / Passive' };
  }

  const hasMetric = METRIC_REGEX.test(clean);
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase().replace(/[^\w]/g, '').replace(/ed$/, '') || '';
  
  let hasActionVerb = false;
  STRONG_ACTION_VERBS.forEach((v) => {
    if (v.startsWith(firstWord) || firstWord.startsWith(v)) {
      hasActionVerb = true;
    }
  });

  if (hasActionVerb && hasMetric) {
    return { type: 'strong', label: '🟢 Strong XYZ' };
  }
  if (hasActionVerb) {
    return { type: 'needs_numbers', label: '🟡 Needs Numbers' };
  }
  if (hasMetric) {
    return { type: 'needs_numbers', label: '🟡 Needs Action Verb' };
  }
  return { type: 'weak', label: '🔴 Weak / Unquantified' };
}

function FormattedText({ text }: { text?: string }) {
  if (!text) return null;

  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} className="font-bold text-zinc-950">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={match.index}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-800"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline hover:text-emerald-900"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    } else {
      tokens.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return <>{tokens}</>;
}

export const ResumeBuilderModal: React.FC<ResumeBuilderModalProps> = ({
  isOpen,
  onClose,
  initialRoleKey,
  initialJobContext,
}) => {
  const [selectedRole, setSelectedRole] = useState<string>('swe');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('split');
  const [editorMode, setEditorMode] = useState<'form' | 'markdown' | 'css'>('form');
  const [selectedTheme, setSelectedTheme] = useState<string>('modern');
  const [customCss, setCustomCss] = useState<string>(RESUME_THEMES.modern.defaultCss);
  const [markdownSource, setMarkdownSource] = useState<string>('');
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [activeFormat, setActiveFormat] = useState<'preview' | 'latex' | 'markdown' | 'text'>('preview');
  const [selectedTypeface, setSelectedTypeface] = useState<string>(DEFAULT_TYPEFACE_ID);
  const [fontCategory, setFontCategory] = useState<FontCategory>('all');
  const [selectedPalette, setSelectedPalette] = useState<string>(DEFAULT_COLOR_PALETTE_ID);
  const [showStylePanel, setShowStylePanel] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const markdownTextareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredTypefaces =
    fontCategory === 'all'
      ? RESUME_TYPEFACES || []
      : (RESUME_TYPEFACES || []).filter((tf) => tf.category === fontCategory);

  // Auto-detect role template from job title or prop
  useEffect(() => {
    let target = 'swe';
    if (initialRoleKey && ROLE_TEMPLATES[initialRoleKey]) {
      target = initialRoleKey;
    } else if (initialJobContext?.title) {
      const t = initialJobContext.title.toLowerCase();
      if (t.includes('fullstack') || t.includes('full stack') || t.includes('frontend')) {
        target = 'fullstack';
      } else if (t.includes('data') || t.includes('etl') || t.includes('analytics') || t.includes('spark')) {
        target = 'data';
      } else if (t.includes('ai') || t.includes('ml') || t.includes('learning') || t.includes('llm')) {
        target = 'aiml';
      } else if (t.includes('devops') || t.includes('cloud') || t.includes('sre') || t.includes('infrastructure')) {
        target = 'devops';
      } else if (t.includes('qa') || t.includes('sdet') || t.includes('test') || t.includes('automation')) {
        target = 'sdet';
      } else if (t.includes('lead') || t.includes('principal') || t.includes('staff') || t.includes('architect') || t.includes('manager')) {
        target = 'lead';
      }
    }
    setSelectedRole(target);
  }, [initialRoleKey, initialJobContext]);

  // Load from LocalStorage or template defaults
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeResumeData(parsed);
        setResumeData(sanitized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        return;
      } catch {
        // Fallback to template defaults
      }
    }

    loadTemplateDefaults(selectedRole);
  }, [selectedRole]);

  const loadTemplateDefaults = (roleKey: string) => {
    const tmpl = ROLE_TEMPLATES[roleKey] || ROLE_TEMPLATES.swe;
    const skillsCopy = JSON.parse(JSON.stringify(tmpl.defaultSkills));
    if (initialJobContext?.skills && initialJobContext.skills.length > 0) {
      const topSkills = initialJobContext.skills.slice(0, 6).join(', ');
      skillsCopy[0] = {
        category: 'Target Role Competencies',
        skills: topSkills,
      };
    }

    const defaultData: ResumeData = {
      name: 'Abhinav Prakash',
      title: tmpl.defaultTitle,
      email: 'abhinav.prakash@example.com',
      location: 'Bengaluru / Gurugram, India',
      linkedin: 'linkedin.com/in/abhinav-prakash',
      github: 'github.com/AbhiPra24',
      website: '',
      summary: tmpl.defaultSummary,
      skills: skillsCopy,
      experience: tmpl.defaultExperience,
      projects: [
        {
          name: 'Distributed Event Streaming Engine',
          technologies: 'Go, Kafka, Redis, Docker',
          url: 'https://github.com/example/engine',
          bullets: [
            'Architected asynchronous messaging worker pool processing 50k RPS with sub-10ms delivery.',
            'Implemented zero-loss offset recovery mechanisms in Redis caching layer.',
          ],
        },
      ],
      education: tmpl.defaultEducation,
    };

    setResumeData(defaultData);
    setMarkdownSource(generateMarkdownSource(defaultData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  };

  // Save to LocalStorage whenever resumeData updates
  const updateResumeData = (updater: (prev: ResumeData) => ResumeData) => {
    setResumeData((prev) => {
      if (!prev) return prev;
      const updated = sanitizeResumeData(updater(prev));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Synchronize markdownSource whenever resumeData changes from the form
  useEffect(() => {
    if (resumeData && editorMode !== 'markdown') {
      setMarkdownSource(generateMarkdownSource(resumeData));
    }
  }, [resumeData, editorMode]);

  const handleThemeChange = (newThemeId: string) => {
    setSelectedTheme(newThemeId);
    const newTheme = RESUME_THEMES[newThemeId];
    if (newTheme) {
      setCustomCss(newTheme.defaultCss);
    }
  };

  const handleEditorModeChange = (mode: 'form' | 'markdown' | 'css') => {
    if (mode === 'markdown' && resumeData) {
      setMarkdownSource(generateMarkdownSource(resumeData));
      setActiveFormat('preview');
    } else if (mode === 'form' && markdownSource) {
      try {
        const parsed = sanitizeResumeData(parseMarkdownToResumeData(markdownSource));
        setResumeData(parsed);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch (e) {
        console.warn('Sync markdown to form error:', e);
      }
    }
    setEditorMode(mode);
  };

  const handleMarkdownChange = (newMd: string) => {
    setMarkdownSource(newMd);
    try {
      const updated = sanitizeResumeData(parseMarkdownToResumeData(newMd));
      setResumeData(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Markdown parse error:', e);
    }
  };

  const insertMarkdownSnippet = (snippet: string, isWrap: boolean = false) => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      handleMarkdownChange(markdownSource + snippet);
      return;
    }

    const start = textarea.selectionStart ?? markdownSource.length;
    const end = textarea.selectionEnd ?? markdownSource.length;
    const selectedText = markdownSource.slice(start, end);

    let replacement = snippet;
    let newCursorPos = start + snippet.length;

    if (isWrap) {
      if (selectedText) {
        replacement = `${snippet}${selectedText}${snippet}`;
        newCursorPos = start + replacement.length;
      } else {
        const defaultText = snippet === '**' ? '**bold text**' : '*italic text*';
        replacement = defaultText;
        newCursorPos = start + replacement.length;
      }
    } else {
      if (snippet.startsWith('\n') && start > 0 && markdownSource[start - 1] !== '\n') {
        replacement = '\n' + snippet;
      }
      newCursorPos = start + replacement.length;
    }

    const newMd = markdownSource.slice(0, start) + replacement + markdownSource.slice(end);
    handleMarkdownChange(newMd);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertCssSnippet = (snippet: string) => {
    setCustomCss((prev) => prev + snippet);
  };

  const handleExportPdf = () => {
    if (typeof window === 'undefined') return;

    const printDoc = document.getElementById('resume-print-document');
    if (!printDoc) return;

    trackEvent('resume_builder_export', { format: 'pdf' });

    const compiledCss = compileResumeStylesheet(selectedTheme, customCss, selectedTypeface, selectedPalette);

    exportResumePdf({
      element: printDoc,
      title: resumeData ? resumeData.name : 'Resume',
      compiledCss,
      containerClass: RESUME_THEMES[selectedTheme]?.containerClass || '',
      onStart: () => setExportingPdf(true),
      onFinish: () => setExportingPdf(false),
      onError: (err) => {
        console.error('PDF export failed:', err);
        setExportingPdf(false);
      },
    });
  };

  const handleClearResume = () => {
    if (confirm('Clear all resume fields and start with a blank document?')) {
      const emptyData: ResumeData = {
        name: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: '',
        summary: '',
        skills: [],
        experience: [],
        projects: [],
        education: { degree: '', school: '', dates: '', gpa: '', certifications: '' },
        achievements: [],
      };
      setResumeData(emptyData);
      setMarkdownSource('');
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData));
      }
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset form to role template defaults? Any manual unsaved edits will be replaced.')) {
      loadTemplateDefaults(selectedRole);
    }
  };

  if (!isOpen || !resumeData) return null;

  const latexCode = generateLatexSource(resumeData);
  const markdownCode = generateMarkdownSource(resumeData);
  const plainTextCode = generatePlainText(resumeData);

  const getActiveCode = () => {
    switch (activeFormat) {
      case 'latex':
        return latexCode;
      case 'markdown':
        return editorMode === 'markdown' && markdownSource.trim() ? markdownSource : markdownCode;
      case 'text':
        return plainTextCode;
      default:
        return editorMode === 'markdown' && markdownSource.trim() ? markdownSource : markdownCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'tex' | 'md' | 'txt') => {
    let content = '';
    let mimeType = 'text/plain';
    const filename = `Resume_${selectedRole.toUpperCase()}.${format}`;

    const analyticsFormatMap: Record<'tex' | 'md' | 'txt', 'latex' | 'markdown' | 'txt'> = {
      tex: 'latex',
      md: 'markdown',
      txt: 'txt',
    };
    trackEvent('resume_builder_export', { format: analyticsFormatMap[format] });

    if (format === 'tex') {
      content = latexCode;
      mimeType = 'application/x-tex';
    } else if (format === 'md') {
      content = editorMode === 'markdown' && markdownSource.trim() ? markdownSource : markdownCode;
      mimeType = 'text/markdown';
    } else {
      content = plainTextCode;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-1.5 sm:p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-builder-title"
    >
      <div
        className="relative flex h-[96vh] w-full max-w-[98vw] 2xl:max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="resume-builder-title" className="text-base font-bold text-zinc-900 dark:text-white sm:text-lg">
                  Visual ATS Resume Architect & Form Editor
                </h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300">
                  REAL-TIME SYNC
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Non-AI visual editor • Live Google XYZ bullet badges • Persistent draft in LocalStorage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Track:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setSelectedRole(newRole);
                  loadTemplateDefaults(newRole);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {Object.values(ROLE_TEMPLATES).map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Resume Theme Selector */}
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-zinc-500" />
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Theme:
              </label>
              <select
                value={selectedTheme}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {Object.values(RESUME_THEMES).map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
              title="Reset current form to template baseline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={handleClearResume}
              className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
              title="Clear all fields to start with an empty blank resume"
            >
              <Trash2 className="h-3 w-3" />
              <span>Blank Resume</span>
            </button>
          </div>

          {/* View Modes, Editor Mode, & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Editor Mode Selector */}
            <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => handleEditorModeChange('form')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  editorMode === 'form'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                title="Structured visual form editor"
              >
                <FileEdit className="mr-1 inline h-3 w-3" />
                Form
              </button>
              <button
                onClick={() => handleEditorModeChange('markdown')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  editorMode === 'markdown'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                title="Live Markdown editor"
              >
                <FileText className="mr-1 inline h-3 w-3" />
                Markdown
              </button>
              <button
                onClick={() => handleEditorModeChange('css')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  editorMode === 'css'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                title="Custom CSS styling overrides"
              >
                <Code className="mr-1 inline h-3 w-3" />
                Custom CSS
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800 xl:flex">
              <button
                onClick={() => setViewMode('editor')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === 'editor'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Editor Only
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === 'split'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === 'preview'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Preview Only
              </button>
            </div>

            {/* Primary Action: Export PDF */}
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              title="Print / Save as high-fidelity PDF with active theme and custom CSS"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{exportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Downloads */}
            <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => handleDownload('tex')}
                className="rounded px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                title="Download LaTeX Source"
              >
                .TEX
              </button>
              <button
                onClick={() => handleDownload('md')}
                className="rounded px-2 py-1 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/50"
                title="Download Markdown"
              >
                .MD
              </button>
              <button
                onClick={() => handleDownload('txt')}
                className="rounded px-2 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title="Download Plain Text"
              >
                .TXT
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Form / Markdown / CSS Editor (Left) */}
          {(viewMode === 'editor' || viewMode === 'split') && (
            <div
              className={`flex h-full flex-col overflow-y-auto border-r border-zinc-200 p-4 dark:border-zinc-800 ${
                viewMode === 'split' ? 'lg:col-span-5 xl:col-span-4' : 'lg:col-span-12'
              }`}
            >
              {editorMode === 'form' && (
                <div className="flex flex-col gap-5 pb-6">
                  {/* 1. Header & Contact Information */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      Personal & Contact Details
                    </h3>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Full Name</label>
                      <input
                        type="text"
                        value={resumeData.name}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, name: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Target Role Title</label>
                      <input
                        type="text"
                        value={resumeData.title}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, title: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Email Address</label>
                      <input
                        type="email"
                        value={resumeData.email}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, email: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Location (City, Country)</label>
                      <input
                        type="text"
                        value={resumeData.location}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, location: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">LinkedIn URL</label>
                      <input
                        type="text"
                        value={resumeData.linkedin}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, linkedin: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">GitHub (Optional)</label>
                      <input
                        type="text"
                        value={resumeData.github || ''}
                        onChange={(e) => updateResumeData((prev) => ({ ...prev, github: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Professional Summary */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Professional Summary
                      </h3>
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {resumeData.summary.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={resumeData.summary}
                    onChange={(e) => updateResumeData((prev) => ({ ...prev, summary: e.target.value }))}
                    className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>

                {/* 3. Technical Skills Categorization */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Technical Skills
                      </h3>
                    </div>
                    <button
                      onClick={() =>
                        updateResumeData((prev) => ({
                          ...prev,
                          skills: [...prev.skills, { category: 'Tools & Protocols', skills: '' }],
                        }))
                      }
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Category</span>
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-2.5">
                    {resumeData.skills.map((skillGroup, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={skillGroup.category}
                          placeholder="Category (e.g. Languages)"
                          onChange={(e) => {
                            const val = e.target.value;
                            updateResumeData((prev) => {
                              const s = [...prev.skills];
                              s[idx].category = val;
                              return { ...prev, skills: s };
                            });
                          }}
                          className="w-1/3 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-semibold text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                        <input
                          type="text"
                          value={skillGroup.skills}
                          placeholder="Comma-separated skills (e.g. Go, Python, SQL)"
                          onChange={(e) => {
                            const val = e.target.value;
                            updateResumeData((prev) => {
                              const s = [...prev.skills];
                              s[idx].skills = val;
                              return { ...prev, skills: s };
                            });
                          }}
                          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                        <button
                          onClick={() =>
                            updateResumeData((prev) => ({
                              ...prev,
                              skills: prev.skills.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 text-zinc-400 hover:text-rose-600"
                          title="Remove Category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Professional Experience & Rule-Based Bullet Badges */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Professional Experience
                      </h3>
                    </div>
                    <button
                      onClick={() =>
                        updateResumeData((prev) => ({
                          ...prev,
                          experience: [
                            {
                              role: 'Software Engineer',
                              company: 'Company Name',
                              dates: '2023 -- Present',
                              location: 'City, India',
                              bullets: ['Architected scalable features increasing system throughput by 30%.'],
                            },
                            ...prev.experience,
                          ],
                        }))
                      }
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Position</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-5">
                    {resumeData.experience.map((job, jobIdx) => (
                      <div
                        key={jobIdx}
                        className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-800/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Position #{jobIdx + 1}
                          </span>
                          <button
                            onClick={() =>
                              updateResumeData((prev) => ({
                                ...prev,
                                experience: prev.experience.filter((_, i) => i !== jobIdx),
                              }))
                            }
                            className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remove Job</span>
                          </button>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            placeholder="Job Title"
                            value={job.role}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const exp = [...prev.experience];
                                exp[jobIdx].role = val;
                                return { ...prev, experience: exp };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Company Name"
                            value={job.company}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const exp = [...prev.experience];
                                exp[jobIdx].company = val;
                                return { ...prev, experience: exp };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Dates (e.g. 2022 -- Present)"
                            value={job.dates}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const exp = [...prev.experience];
                                exp[jobIdx].dates = val;
                                return { ...prev, experience: exp };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Location (e.g. Bengaluru / Hybrid)"
                            value={job.location}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const exp = [...prev.experience];
                                exp[jobIdx].location = val;
                                return { ...prev, experience: exp };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                        </div>

                        {/* Bullets List */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500">
                            <span>Key Achievements & Responsibilities</span>
                            <button
                              onClick={() => {
                                updateResumeData((prev) => {
                                  const exp = [...prev.experience];
                                  exp[jobIdx].bullets.push('Architected new feature delivering 20% latency optimization.');
                                  return { ...prev, experience: exp };
                                });
                              }}
                              className="text-emerald-600 hover:underline"
                            >
                              + Add Bullet
                            </button>
                          </div>

                          <div className="mt-2 flex flex-col gap-2">
                            {job.bullets.map((b, bIdx) => {
                              const badge = getBulletStatus(b);
                              return (
                                <div key={bIdx} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={b}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateResumeData((prev) => {
                                          const exp = [...prev.experience];
                                          exp[jobIdx].bullets[bIdx] = val;
                                          return { ...prev, experience: exp };
                                        });
                                      }}
                                      className="flex-1 rounded-lg border border-zinc-200 bg-white p-2 font-mono text-[11px] text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                    <button
                                      onClick={() => {
                                        updateResumeData((prev) => {
                                          const exp = [...prev.experience];
                                          exp[jobIdx].bullets = exp[jobIdx].bullets.filter((_, i) => i !== bIdx);
                                          return { ...prev, experience: exp };
                                        });
                                      }}
                                      className="p-1.5 text-zinc-400 hover:text-rose-600"
                                      title="Remove Bullet"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between px-1">
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                        badge.type === 'strong'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                          : badge.type === 'needs_numbers'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      }`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Key Projects */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Key Projects
                      </h3>
                    </div>
                    <button
                      onClick={() =>
                        updateResumeData((prev) => ({
                          ...prev,
                          projects: [
                            ...(prev.projects || []),
                            {
                              name: 'Project Title',
                              technologies: 'React, Node.js, AWS',
                              url: '',
                              bullets: ['Engineered scalable web application serving 10k users.'],
                            },
                          ],
                        }))
                      }
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Project</span>
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    {resumeData.projects?.map((proj, pIdx) => (
                      <div
                        key={pIdx}
                        className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3 text-xs dark:border-zinc-800/80 dark:bg-zinc-800/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            Project #{pIdx + 1}
                          </span>
                          <button
                            onClick={() =>
                              updateResumeData((prev) => ({
                                ...prev,
                                projects: prev.projects?.filter((_, i) => i !== pIdx),
                              }))
                            }
                            className="text-[10px] font-semibold text-rose-600 hover:underline"
                          >
                            Remove Project
                          </button>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input
                            type="text"
                            placeholder="Project Name"
                            value={proj.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const p = [...(prev.projects || [])];
                                p[pIdx].name = val;
                                return { ...prev, projects: p };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Technologies (e.g. Next.js, Go)"
                            value={proj.technologies}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const p = [...(prev.projects || [])];
                                p[pIdx].technologies = val;
                                return { ...prev, projects: p };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="URL / Demo (Optional)"
                            value={proj.url || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateResumeData((prev) => {
                                const p = [...(prev.projects || [])];
                                p[pIdx].url = val;
                                return { ...prev, projects: p };
                              });
                            }}
                            className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Education & Certifications */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
                    <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      Education & Certifications
                    </h3>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Degree</label>
                      <input
                        type="text"
                        value={resumeData.education.degree}
                        onChange={(e) =>
                          updateResumeData((prev) => ({
                            ...prev,
                            education: { ...prev.education, degree: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Institution / University</label>
                      <input
                        type="text"
                        value={resumeData.education.school}
                        onChange={(e) =>
                          updateResumeData((prev) => ({
                            ...prev,
                            education: { ...prev.education, school: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">Graduation Dates</label>
                      <input
                        type="text"
                        value={resumeData.education.dates}
                        onChange={(e) =>
                          updateResumeData((prev) => ({
                            ...prev,
                            education: { ...prev.education, dates: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-500">GPA / Honors (Optional)</label>
                      <input
                        type="text"
                        value={resumeData.education.gpa || ''}
                        onChange={(e) =>
                          updateResumeData((prev) => ({
                            ...prev,
                            education: { ...prev.education, gpa: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-[11px] font-semibold text-zinc-500">Certifications (Optional)</label>
                    <input
                      type="text"
                      value={resumeData.education.certifications || ''}
                      onChange={(e) =>
                        updateResumeData((prev) => ({
                          ...prev,
                          education: { ...prev.education, certifications: e.target.value },
                        }))
                      }
                      placeholder="e.g. AWS Solutions Architect, CKA"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

              {/* 2. Markdown Editor Mode */}
              {editorMode === 'markdown' && (
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Markdown Resume Editor
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('**', true)}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        title="Wrap selection in bold (**text**)"
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('*', true)}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        title="Wrap selection in italic (*text*)"
                      >
                        Italic
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertMarkdownSnippet(
                            '\n  - Spearheaded [X initiative], accelerating [Y outcome] by [Z%].'
                          )
                        }
                        className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        title="Insert Google XYZ Metric Bullet at cursor"
                      >
                        + Metric Bullet
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertMarkdownSnippet(
                            '\n\n### Role Title | Company Name\n*2022 -- Present | Bengaluru, India*\n\n  - Spearheaded scalable microservices platform reducing response times by 35%.\n'
                          )
                        }
                        className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                        title="Insert New Experience Section at cursor"
                      >
                        + Role
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertMarkdownSnippet(
                            '\n- **Cloud & DevOps:** AWS, Docker, Kubernetes, Terraform, GitHub Actions'
                          )
                        }
                        className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                        title="Insert New Skill Category at cursor"
                      >
                        + Skills
                      </button>
                      <button
                        type="button"
                        onClick={handleClearResume}
                        className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                        title="Clear all text to start with an empty resume"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex-1 flex flex-col min-h-[420px]">
                    <textarea
                      ref={markdownTextareaRef}
                      value={markdownSource}
                      onChange={(e) => handleMarkdownChange(e.target.value)}
                      className="h-full min-h-[400px] w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-900 outline-none transition focus:border-emerald-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="# Full Name\n**Target Title**\n*Location | Email | LinkedIn*..."
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>
                      💡 Live two-way sync: edits directly update the preview and form data.
                    </span>
                    <span className="font-mono text-[10px]">
                      {markdownSource.split('\n').length} lines • {markdownSource.length} chars
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Custom CSS Mode */}
              {editorMode === 'css' && (
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2.5 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Custom CSS Overrides
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomCss(RESUME_THEMES[selectedTheme]?.defaultCss || '')}
                      className="flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset to Theme Defaults</span>
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        insertCssSnippet('\n.resume-header .resume-title { color: #2563eb !important; }\n')
                      }
                      className="rounded bg-blue-50 px-2 py-1 text-[10.5px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                    >
                      + Blue Accent
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertCssSnippet('\n.resume-preview { font-family: "Georgia", serif !important; }\n')
                      }
                      className="rounded bg-purple-50 px-2 py-1 text-[10.5px] font-semibold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300"
                    >
                      + Serif Font
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertCssSnippet(
                          '\n.resume-bullet { margin-bottom: 1.5px !important; font-size: 10.5px !important; }\n'
                        )
                      }
                      className="rounded bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      + Ultra Compact Spacing
                    </button>
                  </div>

                  <div className="mt-2 flex-1 flex flex-col min-h-[420px]">
                    <textarea
                      value={customCss}
                      onChange={(e) => setCustomCss(e.target.value)}
                      className="h-full min-h-[400px] w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-emerald-400 outline-none transition focus:border-emerald-500 dark:border-zinc-800"
                      placeholder="/* Write custom CSS styles here */"
                    />
                  </div>

                  <div className="mt-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Selectors: <code className="text-zinc-700 dark:text-zinc-300">.resume-preview</code>,{' '}
                    <code className="text-zinc-700 dark:text-zinc-300">.resume-header</code>,{' '}
                    <code className="text-zinc-700 dark:text-zinc-300">.resume-title</code>,{' '}
                    <code className="text-zinc-700 dark:text-zinc-300">.resume-section-title</code>,{' '}
                    <code className="text-zinc-700 dark:text-zinc-300">.resume-bullet</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Preview & Code View (Right) */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className={`flex h-full flex-col overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 ${
                viewMode === 'split' ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'
              }`}
            >
              {/* Format Tabs & Toolbar Actions */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 sm:px-6 text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveFormat('preview')}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
                      activeFormat === 'preview'
                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveFormat('latex')}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
                      activeFormat === 'latex'
                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span>LaTeX (.tex)</span>
                  </button>
                  <button
                    onClick={() => setActiveFormat('markdown')}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
                      activeFormat === 'markdown'
                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    onClick={() => setActiveFormat('text')}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition ${
                      activeFormat === 'text'
                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span>Text (.txt)</span>
                  </button>
                </div>

                {/* Right toolbar controls: Zoom + Full Preview + Typeface/Colors Toggle + Download PDF */}
                {activeFormat === 'preview' && (
                  <div className="flex items-center gap-1.5 sm:gap-2 py-1.5">
                    {/* Zoom Controls */}
                    <div className="hidden md:flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800 text-xs">
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(60, z - 10))}
                        className="px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded"
                        title="Zoom Out"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewZoom(100)}
                        className="px-1.5 py-0.5 font-bold text-[11px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                        title="Reset Zoom to 100%"
                      >
                        {previewZoom}%
                      </button>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(140, z + 10))}
                        className="px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded"
                        title="Zoom In"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Maximize / Split Toggle */}
                    <button
                      onClick={() => setViewMode(viewMode === 'split' ? 'preview' : 'split')}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition"
                      title={viewMode === 'split' ? "Expand Preview to Full Width" : "Switch to Split View"}
                    >
                      {viewMode === 'split' ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{viewMode === 'split' ? 'Full Preview' : 'Split View'}</span>
                    </button>

                    {/* Typeface & Colors Sidebar Toggle */}
                    <button
                      onClick={() => setShowStylePanel(!showStylePanel)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        showStylePanel
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                      title="Toggle Typeface & Colors Sidebar"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Typeface & Colors</span>
                    </button>

                    {/* Download PDF Button */}
                    <button
                      onClick={handleExportPdf}
                      disabled={exportingPdf}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{exportingPdf ? 'Exporting...' : 'Download PDF'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Rendered View */}
              <div className="flex flex-1 overflow-hidden">
                {activeFormat === 'preview' ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                      <div className="relative">
                        {/* Live Scoped Theme, Typeface & Palette CSS */}
                        <style
                          dangerouslySetInnerHTML={{
                            __html: compileResumeStylesheet(selectedTheme, customCss, selectedTypeface, selectedPalette),
                          }}
                        />

                        <div
                          id="resume-print-document"
                          className={`mx-auto w-full max-w-3xl xl:max-w-4xl rounded-xl border border-zinc-200/90 bg-white p-6 sm:p-8 md:p-10 shadow-2xl text-zinc-900 resume-preview transition-transform origin-top ${
                            RESUME_THEMES[selectedTheme]?.containerClass || ''
                          }`}
                          style={{
                            minHeight: '840px',
                            backgroundColor: '#ffffff',
                            color: '#1f2937',
                            transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                          }}
                        >
                          {editorMode === 'markdown' ? (
                            <div
                              className="resume-markdown-rendered space-y-2 text-left"
                              dangerouslySetInnerHTML={{
                                __html: renderMarkdownToResumeHtml(markdownSource),
                              }}
                            />
                          ) : (
                            <>
                              {/* Document Header */}
                              <div className="resume-header border-b border-zinc-200 pb-3.5 text-center">
                                <h1 className="text-xl font-black tracking-tight text-zinc-900">
                          {resumeData.name}
                        </h1>
                        <p className="resume-title mt-0.5 text-xs font-bold">
                          {resumeData.title}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {[
                            resumeData.location,
                            resumeData.email,
                            resumeData.linkedin,
                            resumeData.github,
                            resumeData.website,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>

                      {/* Summary */}
                      {resumeData.summary && (
                        <div className="mt-3.5">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Professional Summary
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-700">
                            <FormattedText text={resumeData.summary} />
                          </p>
                        </div>
                      )}

                      {/* Skills */}
                      {resumeData.skills && resumeData.skills.length > 0 && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Technical Skills
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-1.5 flex flex-col gap-1 text-xs">
                            {resumeData.skills.map((s, idx) => (
                              <div key={idx} className="text-zinc-700">
                                <strong className="resume-skill-badge text-zinc-900">
                                  {s.category}:
                                </strong>{' '}
                                <FormattedText text={s.skills} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Experience */}
                      {resumeData.experience && resumeData.experience.length > 0 && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Professional Experience
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-2.5 flex flex-col gap-3.5">
                            {resumeData.experience.map((job, idx) => {
                              const cleanCompany = (job.company || '').replace(/^company(?:\s*name)?$/i, '').trim();
                              return (
                                <div key={idx} className="flex flex-col gap-0.5 text-xs">
                                  <div className="resume-row flex items-baseline justify-between font-bold text-zinc-900">
                                    <span className="resume-row-left">
                                      <FormattedText text={job.role} />
                                    </span>
                                    {job.dates && (
                                      <span className="resume-row-right text-zinc-500 font-normal">
                                        {job.dates}
                                      </span>
                                    )}
                                  </div>
                                  {(cleanCompany || job.location) && (
                                    <div className="resume-row flex items-baseline justify-between text-[11px] italic text-zinc-600">
                                      <span className="resume-row-left">
                                        <FormattedText text={cleanCompany} />
                                      </span>
                                      {job.location && (
                                        <span className="resume-row-right not-italic">
                                          {job.location}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {job.bullets && job.bullets.length > 0 && (
                                    <ul className="resume-bullet-list mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-zinc-700">
                                      {job.bullets.map((b, bIdx) => (
                                        <li key={bIdx} className="resume-bullet">
                                          <FormattedText text={b} />
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Projects */}
                      {resumeData.projects && resumeData.projects.length > 0 && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Key Projects
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-2.5 flex flex-col gap-3">
                            {resumeData.projects.map((proj, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5 text-xs">
                                <div className="resume-row flex items-baseline justify-between font-bold text-zinc-900">
                                  <span className="resume-row-left">
                                    <FormattedText text={proj.name} />
                                    {proj.technologies && (
                                      <span className="font-normal italic text-zinc-500">
                                        {' '}[{proj.technologies}]
                                      </span>
                                    )}
                                  </span>
                                  {proj.url && (
                                    <a
                                      href={proj.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="resume-row-right text-[10px] font-normal text-blue-600 hover:underline"
                                    >
                                      Demo / Code
                                    </a>
                                  )}
                                </div>
                                {proj.bullets && proj.bullets.length > 0 && (
                                  <ul className="resume-bullet-list mt-0.5 list-disc pl-4 space-y-0.5 text-[11px] text-zinc-700">
                                    {proj.bullets.map((b, bIdx) => (
                                      <li key={bIdx} className="resume-bullet">
                                        <FormattedText text={b} />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education */}
                      {(resumeData.education?.degree ||
                        resumeData.education?.school ||
                        resumeData.education?.certifications) && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Education & Certifications
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-1.5 text-xs">
                            {resumeData.education.degrees && resumeData.education.degrees.length > 0 ? (
                              <div className="space-y-2">
                                {resumeData.education.degrees.map((deg, dIdx) => (
                                  <div key={dIdx}>
                                    <div className="resume-row flex items-baseline justify-between font-bold text-zinc-900">
                                      <span className="resume-row-left">
                                        <FormattedText text={deg.degree} />
                                      </span>
                                      {deg.dates && (
                                        <span className="resume-row-right text-zinc-500 font-normal">
                                          {deg.dates}
                                        </span>
                                      )}
                                    </div>
                                    {(deg.school || deg.gpa) && (
                                      <p className="text-[11px] italic text-zinc-600">
                                        <FormattedText text={deg.school} />
                                        {deg.gpa
                                          ? ` • ${deg.gpa.toLowerCase().includes('cpi') || deg.gpa.toLowerCase().includes('gpa') ? deg.gpa : `GPA: ${deg.gpa}`}`
                                          : ''}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                {(resumeData.education.degree || resumeData.education.dates) && (
                                  <div className="resume-row flex items-baseline justify-between font-bold text-zinc-900">
                                    <span className="resume-row-left">
                                      <FormattedText text={resumeData.education.degree} />
                                    </span>
                                    {resumeData.education.dates && (
                                      <span className="resume-row-right text-zinc-500 font-normal">
                                        {resumeData.education.dates}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {(resumeData.education.school || resumeData.education.gpa) && (
                                  <p className="text-[11px] italic text-zinc-600">
                                    <FormattedText text={resumeData.education.school} />
                                    {resumeData.education.gpa
                                      ? ` • ${resumeData.education.gpa.toLowerCase().includes('cpi') || resumeData.education.gpa.toLowerCase().includes('gpa') ? resumeData.education.gpa : `GPA: ${resumeData.education.gpa}`}`
                                      : ''}
                                  </p>
                                )}
                              </>
                            )}
                            {resumeData.education.certifications && (
                              <p className="mt-0.5 text-[11px] text-zinc-700">
                                <strong>Certifications:</strong>{' '}
                                <FormattedText text={resumeData.education.certifications} />
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Achievements */}
                      {resumeData.achievements &&
                        resumeData.achievements
                          .filter((a) => !/^(?:interests?|hobbies|activities)$/i.test(a.category || ''))
                          .filter((a) => a.bullets.length > 0 || (a.category && !/^(?:key\s+|notable\s+|major\s+)?(?:achievements?|accomplishments?)$/i.test(a.category.trim())))
                          .length > 0 && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Achievements
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-1.5 space-y-2 text-xs">
                            {resumeData.achievements
                              .filter((a) => !/^(?:interests?|hobbies|activities)$/i.test(a.category || ''))
                              .filter((a) => a.bullets.length > 0 || (a.category && !/^(?:key\s+|notable\s+|major\s+)?(?:achievements?|accomplishments?)$/i.test(a.category.trim())))
                              .map((ach, aIdx) => {
                                const isSelfHeader = /^(?:key\s+|notable\s+|major\s+)?(?:achievements?|accomplishments?)$/i.test((ach.category || '').trim());
                                return (
                                  <div key={aIdx} className="space-y-1">
                                    {ach.category && !isSelfHeader && (
                                      <h3 className="resume-subsection-title text-[11px] font-bold tracking-wide uppercase">
                                        <FormattedText text={ach.category} />
                                      </h3>
                                    )}
                                    {ach.bullets && ach.bullets.length > 0 && (
                                      <ul className="resume-bullet-list list-disc pl-4 space-y-0.5 text-[11px] text-zinc-700">
                                        {ach.bullets.map((b, bIdx) => (
                                          <li key={bIdx} className="resume-bullet">
                                            <FormattedText text={b} />
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Interests */}
                      {resumeData.achievements &&
                        resumeData.achievements.filter((a) => /^(?:interests?|hobbies|activities)$/i.test(a.category || '')).length > 0 && (
                        <div className="mt-4">
                          <h2 className="resume-section-title text-[11px] font-black uppercase tracking-wider">
                            Interests
                          </h2>
                          <div className="resume-section-divider mt-0.5 h-[1.5px] w-full bg-zinc-200" />
                          <div className="mt-1.5 space-y-1 text-xs">
                            {resumeData.achievements
                              .filter((a) => /^(?:interests?|hobbies|activities)$/i.test(a.category || ''))
                              .map((item, iIdx) => (
                              <div key={iIdx}>
                                <ul className="resume-bullet-list list-disc pl-4 space-y-0.5 text-[11px] text-zinc-700">
                                  {item.bullets.map((b, bIdx) => (
                                    <li key={bIdx} className="resume-bullet">
                                      <FormattedText text={b} />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Style & Typeface Panel (Matching Reference Image) */}
            {showStylePanel && (
              <div className="w-64 shrink-0 border-l border-zinc-200 bg-white p-3.5 overflow-y-auto flex flex-col space-y-3.5 dark:border-zinc-800 dark:bg-zinc-900 text-xs">
                {/* 1. TYPEFACE */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      Typeface
                    </span>
                    <button
                      onClick={() => setShowStylePanel(false)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      title="Collapse Style Panel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Font Category Filter Tabs */}
                  <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800 mb-2.5">
                    {(['all', 'sans', 'serif', 'mono'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFontCategory(cat)}
                        className={`flex-1 rounded py-1 text-center text-[10px] font-bold capitalize transition ${
                          fontCategory === cat
                            ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {cat === 'all' ? 'All' : cat}
                      </button>
                    ))}
                  </div>

                  {/* Font Cards */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {(filteredTypefaces || []).map((tf) => {
                      const isSelected = selectedTypeface === tf.id;
                      return (
                        <button
                          key={tf.id}
                          onClick={() => setSelectedTypeface(tf.id)}
                          className={`w-full text-left p-2 rounded-xl border transition flex items-center justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500/60 ring-1 ring-emerald-500'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50'
                          }`}
                        >
                          <div>
                            <div
                              className="text-xs font-bold text-zinc-900 dark:text-white"
                              style={{ fontFamily: tf.fontFamily }}
                            >
                              {tf.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {tf.description}
                            </div>
                          </div>
                          <span
                            className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 pl-2"
                            style={{ fontFamily: tf.fontFamily }}
                          >
                            Aa
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. COLOURS */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      Colours
                    </span>
                    <button
                      onClick={() => {
                        setSelectedPalette(DEFAULT_COLOR_PALETTE_ID);
                        setSelectedTypeface(DEFAULT_TYPEFACE_ID);
                      }}
                      className="text-[10px] text-emerald-600 hover:underline font-semibold dark:text-emerald-400"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Palette Presets */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(RESUME_COLOR_PALETTES || []).map((pal) => {
                      const isSelected = selectedPalette === pal.id;
                      return (
                        <button
                          key={pal.id}
                          onClick={() => setSelectedPalette(pal.id)}
                          title={pal.name}
                          className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition ${
                            isSelected
                              ? 'bg-zinc-50 dark:bg-zinc-800'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                          }`}
                          style={
                            isSelected
                              ? { borderColor: pal.primary, boxShadow: `0 0 0 1.5px ${pal.primary}` }
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 rounded-full shadow-xs ring-1 ring-black/10" style={{ backgroundColor: pal.primary }} />
                            <span className="w-3.5 h-3.5 rounded-full shadow-xs ring-1 ring-black/10" style={{ backgroundColor: pal.accent }} />
                          </div>
                          <span
                            className="text-[9px] font-medium text-center leading-tight truncate w-full"
                            style={isSelected ? { color: pal.primary, fontWeight: 700 } : undefined}
                          >
                            {pal.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Picker */}
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Custom Accent</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={selectedPalette.startsWith('#') ? selectedPalette : (RESUME_COLOR_PALETTES.find((p) => p.id === selectedPalette)?.primary || '#0d9488')}
                        onChange={(e) => setSelectedPalette(e.target.value)}
                        className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                        title="Pick custom color"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. LAYOUT THEME */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 block mb-1.5">
                    Layout Theme
                  </span>
                  <select
                    value={selectedTheme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    {Object.values(RESUME_THEMES).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. DOWNLOAD PDF ACTION */}
                <div className="mt-auto pt-4">
                  <button
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="h-full rounded-xl border border-zinc-200 bg-zinc-900 p-4 font-mono text-xs text-zinc-100 dark:border-zinc-800 overflow-x-auto">
              <pre>{getActiveCode()}</pre>
            </div>
          </div>
        )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80">
          <span className="text-xs text-zinc-500">
            Auto-persisted to LocalStorage • Compatible with Overleaf & LaTeX Workshop
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
