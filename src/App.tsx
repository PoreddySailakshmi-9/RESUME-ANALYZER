import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Download,
  Search,
  Send,
  Loader2,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';

import heroTalentEditorialImg from './assets/images/hero_talent_editorial_1790759958022.jpg';
import workflowPipelineVisualImg from './assets/images/workflow_pipeline_visual_1790759976221.jpg';
import candidateReviewStudioImg from './assets/images/candidate_review_studio_1790759993026.jpg';

const DEFAULT_N8N_URL =
  'https://sailakshmiporeddy.app.n8n.cloud/form/ceba5cd6-5c01-45e6-9ff2-922e714c5fed';

interface N8nFieldSchema {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  multiple: boolean;
  placeholder: string;
}

interface N8nInspectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  targetUrl: string;
  host?: string;
  formId?: string;
  title?: string;
  description?: string;
  useResponseData?: boolean;
  fields?: N8nFieldSchema[];
  checkedAt?: string;
  error?: string;
}

interface SubmissionRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  fileNames: string[];
  totalBytes: number;
  targetUrl: string;
  status: 'success' | 'error';
  httpStatus: number;
  durationMs: number;
  headerTitle: string;
  responseMessage: string;
  rawPreview?: string;
  submittedAt: string;
}

const SAMPLE_RESUMES = [
  {
    label: 'Sample Senior Full-Stack Engineer Resume',
    candidateName: 'Aarav Mehta',
    candidateEmail: 'aarav.mehta@example.com',
    fileName: 'Aarav_Mehta_Senior_Software_Engineer_Resume.txt',
    content: `AARAV MEHTA
Senior Full-Stack & Workflow Automation Engineer
Email: aarav.mehta@example.com | Location: Bengaluru / Remote

EXECUTIVE SUMMARY
Senior Software Engineer with 7+ years of experience designing distributed TypeScript services, event-driven n8n automation pipelines, and high-throughput document processing systems. Proven track record reducing manual recruiting and operations triage by 68%.

CORE COMPETENCIES
- Languages: TypeScript, Python, SQL, Go, HTML5/CSS3
- Frameworks & Runtime: React 19, Node.js, Express, Next.js, FastAPI
- Workflow & Cloud: n8n Cloud, Webhook Orchestration, Docker, Google Cloud Run, PostgreSQL

PROFESSIONAL EXPERIENCE
Staff Automation Engineer — Stratos Talent Systems (2023 – Present)
- Architected automated resume ingestion pipelines handling 14,000+ monthly candidate submissions via multipart webhook endpoints.
- Reduced recruiter time-to-first-review from 42 hours to 11 minutes through structured rubric extraction.
- Built fault-tolerant retry queues with 99.94% delivery reliability across enterprise ATS integrations.

Senior Software Engineer — Meridian Cloud Labs (2020 – 2023)
- Led a team of 5 engineers building real-time analytics dashboards and document verification microservices.
- Improved API p95 latency by 54% by optimizing multipart stream parsing and PostgreSQL indexing.

EDUCATION
B.Tech in Computer Science & Engineering — National Institute of Technology (2016 – 2020)
`,
  },
  {
    label: 'Sample Technical Product Manager Resume',
    candidateName: 'Elena Rostova',
    candidateEmail: 'elena.rostova@example.com',
    fileName: 'Elena_Rostova_Product_Lead_Resume.txt',
    content: `ELENA ROSTOVA
Principal Technical Product Manager — AI & Workflow Platforms
Email: elena.rostova@example.com | Location: San Francisco, CA

SUMMARY
Product leader with 8 years of experience scaling B2B SaaS workflow automation, document intelligence, and enterprise talent recruitment platforms from $2M to $18M ARR.

EXPERIENCE
Group Product Manager — Vertex Workflow Cloud (2022 – Present)
- Launched automated candidate evaluation workflows adopted by 320+ enterprise hiring teams.
- Increased qualified candidate conversion by +140% over 6 months by streamlining 3-field intake forms.

Senior Product Manager — Cobalt Data Systems (2019 – 2022)
- Owned the API & Webhook integration ecosystem with over 1.2M daily automated executions.

EDUCATION
M.S. in Management Science & Engineering — Stanford University
`,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export default function App() {
  // Workspace mode
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'studio' | 'embedded' | 'api'
  >('studio');

  // Target n8n URL configuration
  const [n8nFormUrl, setN8nFormUrl] = useState<string>(DEFAULT_N8N_URL);
  const [urlInputDraft, setUrlInputDraft] = useState<string>(DEFAULT_N8N_URL);

  // Live schema inspection state
  const [inspection, setInspection] = useState<N8nInspectionResult | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(true);

  // Form inputs mapped to field-0 (Name), field-1 (Email), field-2 (Upload resume)
  const [candidateName, setCandidateName] = useState<string>('');
  const [candidateEmail, setCandidateEmail] = useState<string>('');
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    files?: string;
  }>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<SubmissionRecord | null>(null);

  // Submission Ledger persisted in localStorage
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('n8n_resume_submissions_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'success' | 'error'>(
    'all'
  );
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<SubmissionRecord | null>(
    null
  );
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Image resilience state
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [workflowImgFailed, setWorkflowImgFailed] = useState(false);
  const [reviewImgFailed, setReviewImgFailed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const inspectEndpoint = async (targetUrl: string) => {
    setIsInspecting(true);
    try {
      const res = await fetch(
        `/api/n8n/inspect?url=${encodeURIComponent(targetUrl)}`
      );
      const data: N8nInspectionResult = await res.json();
      setInspection(data);
    } catch (err) {
      setInspection({
        ok: false,
        status: 502,
        latencyMs: 0,
        targetUrl,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to inspect n8n form endpoint.',
      });
    } finally {
      setIsInspecting(false);
    }
  };

  useEffect(() => {
    inspectEndpoint(n8nFormUrl);
  }, [n8nFormUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'n8n_resume_submissions_v1',
        JSON.stringify(submissions)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [submissions]);

  const validateForm = (): boolean => {
    const nextErrors: { name?: string; email?: string; files?: string } = {};
    if (!candidateName.trim()) {
      nextErrors.name = 'Candidate full name (field-0) is required.';
    }
    const trimmedEmail = candidateEmail.trim();
    if (!trimmedEmail) {
      nextErrors.email = 'Candidate email address (field-1) is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (resumeFiles.length === 0) {
      nextErrors.files =
        'At least one resume file (field-2) is required for analysis.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setResumeFiles((prev) => [...prev, ...incoming]);
      setErrors((prev) => ({ ...prev, files: undefined }));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const incoming = Array.from(e.dataTransfer.files);
      setResumeFiles((prev) => [...prev, ...incoming]);
      setErrors((prev) => ({ ...prev, files: undefined }));
    }
  };

  const removeFileAt = (index: number) => {
    setResumeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const loadSampleCandidate = (sampleIndex: number) => {
    const sample = SAMPLE_RESUMES[sampleIndex];
    if (!sample) return;
    setCandidateName(sample.candidateName);
    setCandidateEmail(sample.candidateEmail);
    const blob = new Blob([sample.content], { type: 'text/plain' });
    const file = new File([blob], sample.fileName, {
      type: 'text/plain',
      lastModified: Date.now(),
    });
    setResumeFiles([file]);
    setErrors({});
    setLatestResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setLatestResult(null);

    try {
      const formData = new FormData();
      // Exact n8n field mapping from https://sailakshmiporeddy.app.n8n.cloud/form/ceba5cd6-5c01-45e6-9ff2-922e714c5fed
      formData.append('field-0', candidateName.trim());
      formData.append('field-1', candidateEmail.trim());
      for (const file of resumeFiles) {
        formData.append('field-2', file, file.name);
      }

      const response = await fetch('/api/n8n/submit', {
        method: 'POST',
        headers: {
          'x-n8n-form-url': n8nFormUrl,
        },
        body: formData,
      });

      const data = await response.json();
      const totalBytes = resumeFiles.reduce((acc, f) => acc + f.size, 0);

      const record: SubmissionRecord = {
        id: `sub_${Date.now().toString(36)}`,
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        fileNames: resumeFiles.map((f) => f.name),
        totalBytes,
        targetUrl: n8nFormUrl,
        status: response.ok && data.ok ? 'success' : 'error',
        httpStatus: data.status || response.status,
        durationMs: data.durationMs || 0,
        headerTitle: data.headerTitle || (response.ok ? 'Form Submitted' : 'Submission Failed'),
        responseMessage:
          data.message ||
          (response.ok
            ? 'Your response has been recorded'
            : 'Problem submitting response'),
        rawPreview: data.rawPreview || '',
        submittedAt: data.submittedAt || new Date().toISOString(),
      };

      setLatestResult(record);
      setSubmissions((prev) => [record, ...prev]);
    } catch (error) {
      const totalBytes = resumeFiles.reduce((acc, f) => acc + f.size, 0);
      const record: SubmissionRecord = {
        id: `sub_${Date.now().toString(36)}`,
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        fileNames: resumeFiles.map((f) => f.name),
        totalBytes,
        targetUrl: n8nFormUrl,
        status: 'error',
        httpStatus: 502,
        durationMs: 0,
        headerTitle: 'Network Error',
        responseMessage:
          error instanceof Error
            ? error.message
            : 'Could not reach the submission endpoint.',
        submittedAt: new Date().toISOString(),
      };
      setLatestResult(record);
      setSubmissions((prev) => [record, ...prev]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const exportLedgerCsv = () => {
    if (submissions.length === 0) return;
    const headers = [
      'Submission ID',
      'Timestamp',
      'Candidate Name (field-0)',
      'Candidate Email (field-1)',
      'Resume Files (field-2)',
      'Total Bytes',
      'Status',
      'HTTP Status',
      'Duration (ms)',
      'n8n Message',
    ];
    const rows = submissions.map((s) => [
      s.id,
      s.submittedAt,
      `"${s.candidateName.replace(/"/g, '""')}"`,
      `"${s.candidateEmail.replace(/"/g, '""')}"`,
      `"${s.fileNames.join('; ').replace(/"/g, '""')}"`,
      s.totalBytes,
      s.status,
      s.httpStatus,
      s.durationMs,
      `"${s.responseMessage.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `n8n_resume_analyzer_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubmissions = submissions.filter((item) => {
    if (ledgerFilter !== 'all' && item.status !== ledgerFilter) return false;
    if (!ledgerSearch.trim()) return true;
    const q = ledgerSearch.toLowerCase();
    return (
      item.candidateName.toLowerCase().includes(q) ||
      item.candidateEmail.toLowerCase().includes(q) ||
      item.fileNames.some((fn) => fn.toLowerCase().includes(q))
    );
  });

  const curlSnippet = `curl -X POST "${n8nFormUrl}" \\
  -F "field-0=${candidateName || 'Aarav Mehta'}" \\
  -F "field-1=${candidateEmail || 'aarav.mehta@example.com'}" \\
  -F "field-2=@/path/to/candidate_resume.pdf"`;

  const jsSnippet = `const formData = new FormData();
formData.append('field-0', '${candidateName || 'Aarav Mehta'}'); // Name (Required)
formData.append('field-1', '${candidateEmail || 'aarav.mehta@example.com'}'); // Email (Required)
formData.append('field-2', fileInput.files[0]); // Upload resume (Required, multiple)

const response = await fetch('${n8nFormUrl}', {
  method: 'POST',
  body: formData,
});`;

  const scrollToWorkspace = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 350);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-[#111318]">
      {/* Top Bar Contract: Strictly 3 zones (Brand wordmark | 4 Nav Links | 1 Primary CTA) */}
      <header className="sticky top-0 z-30 bg-[#F8F7F4]/95 backdrop-blur-sm border-b border-[#E4E2DD]">
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Zone 1: Single text element Brand Wordmark */}
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#111318] whitespace-nowrap shrink-0"
          >
            Resume Analyzer Studio
          </a>

          {/* Zone 2: 4 Clean Typography Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A4D55]">
            <a
              href="#workspace"
              className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap"
            >
              Submit Resume
            </a>
            <a
              href="#pipeline"
              className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap"
            >
              Workflow Pipeline
            </a>
            <a
              href="#ledger"
              className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap"
            >
              Submission Ledger
            </a>
            <a
              href="#integration"
              onClick={() => setActiveWorkspaceTab('api')}
              className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap"
            >
              Integration Specs
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToWorkspace}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#111318] rounded-lg hover:bg-[#EA4B35] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Analyze Candidate
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Section 1: Editorial Hero + Live n8n Resume Analyzer Portal */}
        <section className="max-w-[1240px] mx-auto px-6 pt-10 pb-16 border-b border-[#E4E2DD]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Proposition & Visual Anchor (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Unboxed metadata line — Zero-Pill Discipline */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E626E]">
                  <span>n8n Cloud Form Automation</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    ceba5cd6-5c01-45e6-9ff2-922e714c5fed
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isInspecting
                      ? 'Checking endpoint...'
                      : inspection?.ok
                        ? `Live (${inspection.latencyMs} ms)`
                        : 'Endpoint Ready'}
                  </span>
                </div>

                <h1
                  className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#111318] leading-[1.12]"
                  style={{ textWrap: 'balance' }}
                >
                  Automated candidate resume intake and structured screening.
                </h1>

                <p className="text-[15px] leading-[1.65] text-[#4A4D55] max-w-[62ch]">
                  Submit candidate profiles and resume documents directly into the
                  live{' '}
                  <span className="font-medium text-[#111318]">
                    sailakshmiporeddy.app.n8n.cloud
                  </span>{' '}
                  Resume Analyzer workflow. Every submission transmits validated
                  multipart form data to trigger automated document parsing and
                  candidate evaluation.
                </p>
              </div>

              {/* Hero 16:9 Visual Carrier with Zero-Broken-Image Fallback */}
              <div className="relative overflow-hidden rounded-xl border border-[#E4E2DD] bg-[#EAE8E3] aspect-video">
                {!heroImgFailed ? (
                  <img
                    src={heroTalentEditorialImg}
                    alt="Executive talent review workspace with printed resume portfolios"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#EAE8E3] to-[#DFDCD4]">
                    <FileText className="w-8 h-8 text-[#5E626E] mb-2" />
                    <span className="text-sm font-medium text-[#111318]">
                      Resume Analyzer Studio
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end p-5">
                  <p className="text-xs text-white/80">
                    Direct Webhook & Form Trigger
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      POST /form/ceba5cd6-5c01-45e6-9ff2-922e714c5fed
                    </span>
                  </p>
                  <p className="text-sm font-medium text-white mt-0.5">
                    Maps candidate identity, contact email, and multi-file resume
                    attachments to n8n execution nodes.
                  </p>
                </div>
              </div>

              {/* Live Schema Summary (Unboxed clean layout) */}
              <div className="pt-2 border-t border-[#E4E2DD] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#5E626E]">
                  <span className="font-medium text-[#111318]">
                    Detected n8n Form Schema
                  </span>
                  <button
                    type="button"
                    onClick={() => inspectEndpoint(n8nFormUrl)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#4A4D55] hover:text-[#111318] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`}
                    />
                    Verify Connection
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-1 text-xs">
                  <div>
                    <div className="font-mono text-[#5E626E] tabular-nums">
                      field-0
                    </div>
                    <div className="font-medium text-[#111318] mt-0.5">
                      Name
                    </div>
                    <div className="text-[#5E626E]">Text · Required</div>
                  </div>
                  <div>
                    <div className="font-mono text-[#5E626E] tabular-nums">
                      field-1
                    </div>
                    <div className="font-medium text-[#111318] mt-0.5">
                      Email
                    </div>
                    <div className="text-[#5E626E]">Email · Required</div>
                  </div>
                  <div>
                    <div className="font-mono text-[#5E626E] tabular-nums">
                      field-2
                    </div>
                    <div className="font-medium text-[#111318] mt-0.5">
                      Upload resume
                    </div>
                    <div className="text-[#5E626E]">File · Multiple</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive n8n Form Portal (7 cols) */}
            <div
              id="workspace"
              ref={formSectionRef as React.RefObject<HTMLDivElement>}
              className="lg:col-span-7 bg-white rounded-xl border border-[#E4E2DD] p-6 sm:p-8"
            >
              {/* Workspace Header + Interactive Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E4E2DD]">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#111318]">
                    {inspection?.title || 'Resume Analyzer'}
                  </h2>
                  <p className="text-xs text-[#5E626E] mt-1">
                    Connected to{' '}
                    <span className="font-mono text-[#111318]">
                      sailakshmiporeddy.app.n8n.cloud
                    </span>
                  </p>
                </div>

                {/* Interactive Segmented Control (Functional Buttons) */}
                <div
                  role="tablist"
                  aria-label="Form interface mode"
                  className="flex items-center gap-1 p-1 bg-[#F2F0EC] rounded-lg self-start sm:self-auto"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeWorkspaceTab === 'studio'}
                    onClick={() => setActiveWorkspaceTab('studio')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeWorkspaceTab === 'studio'
                        ? 'bg-white text-[#111318] shadow-xs'
                        : 'text-[#5E626E] hover:text-[#111318]'
                    }`}
                  >
                    Studio Form
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeWorkspaceTab === 'embedded'}
                    onClick={() => setActiveWorkspaceTab('embedded')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeWorkspaceTab === 'embedded'
                        ? 'bg-white text-[#111318] shadow-xs'
                        : 'text-[#5E626E] hover:text-[#111318]'
                    }`}
                  >
                    Original n8n Form
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeWorkspaceTab === 'api'}
                    onClick={() => setActiveWorkspaceTab('api')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeWorkspaceTab === 'api'
                        ? 'bg-white text-[#111318] shadow-xs'
                        : 'text-[#5E626E] hover:text-[#111318]'
                    }`}
                  >
                    Endpoint & cURL
                  </button>
                </div>
              </div>

              {/* TAB 1: Studio Custom Form */}
              {activeWorkspaceTab === 'studio' && (
                <div className="pt-6 space-y-6">
                  {/* Quick Sample Bar for Instant Testing */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#F0EEE9] text-xs">
                    <span className="text-[#5E626E]">
                      Need a test document to verify the n8n workflow?
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadSampleCandidate(0)}
                        className="px-2.5 py-1 text-xs font-medium text-[#111318] bg-[#F8F7F4] hover:bg-[#EAE8E3] border border-[#E4E2DD] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Load Sample Engineer Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSampleCandidate(1)}
                        className="px-2.5 py-1 text-xs font-medium text-[#111318] bg-[#F8F7F4] hover:bg-[#EAE8E3] border border-[#E4E2DD] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Load Sample PM Resume
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* Field 0: Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="field-0"
                          className="text-sm font-semibold text-[#111318]"
                        >
                          Name <span className="text-[#EA4B35]">*</span>
                        </label>
                        <span className="text-xs font-mono text-[#5E626E]">
                          name=&quot;field-0&quot;
                        </span>
                      </div>
                      <input
                        ref={nameInputRef}
                        id="field-0"
                        name="field-0"
                        type="text"
                        required
                        value={candidateName}
                        onChange={(e) => {
                          setCandidateName(e.target.value);
                          if (errors.name) {
                            setErrors((prev) => ({ ...prev, name: undefined }));
                          }
                        }}
                        placeholder="Enter full candidate name (e.g. Aarav Mehta)"
                        className={`w-full px-3.5 py-2.5 text-sm bg-[#F8F7F4] border rounded-lg text-[#111318] placeholder:text-[#8C909C] focus:outline-none focus:bg-white transition-colors ${
                          errors.name
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-[#D5D3CD] focus:border-[#111318]'
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1.5 text-xs text-[#DC2626] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.name}</span>
                        </p>
                      )}
                    </div>

                    {/* Field 1: Email */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="field-1"
                          className="text-sm font-semibold text-[#111318]"
                        >
                          Email <span className="text-[#EA4B35]">*</span>
                        </label>
                        <span className="text-xs font-mono text-[#5E626E]">
                          name=&quot;field-1&quot;
                        </span>
                      </div>
                      <input
                        id="field-1"
                        name="field-1"
                        type="email"
                        required
                        value={candidateEmail}
                        onChange={(e) => {
                          setCandidateEmail(e.target.value);
                          if (errors.email) {
                            setErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        placeholder="candidate@company.com"
                        className={`w-full px-3.5 py-2.5 text-sm bg-[#F8F7F4] border rounded-lg text-[#111318] placeholder:text-[#8C909C] focus:outline-none focus:bg-white transition-colors ${
                          errors.email
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-[#D5D3CD] focus:border-[#111318]'
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1.5 text-xs text-[#DC2626] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.email}</span>
                        </p>
                      )}
                    </div>

                    {/* Field 2: Upload resume */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="field-2"
                          className="text-sm font-semibold text-[#111318]"
                        >
                          Upload resume <span className="text-[#EA4B35]">*</span>
                        </label>
                        <span className="text-xs font-mono text-[#5E626E]">
                          name=&quot;field-2&quot; · multiple
                        </span>
                      </div>

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                          isDraggingOver
                            ? 'border-[#EA4B35] bg-[#EA4B35]/5'
                            : errors.files
                              ? 'border-[#DC2626] bg-[#FEF2F2]/50'
                              : 'border-[#C8C5BE] bg-[#F8F7F4] hover:border-[#111318]'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          id="field-2"
                          name="field-2"
                          type="file"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Upload className="w-6 h-6 text-[#4A4D55] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#111318]">
                          Click to select resume files or drag and drop here
                        </p>
                        <p className="text-xs text-[#5E626E] mt-1">
                          Supports PDF, DOCX, DOC, TXT, or RTF · Transmitted as
                          multipart binary stream
                        </p>
                      </div>

                      {errors.files && (
                        <p className="mt-1.5 text-xs text-[#DC2626] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.files}</span>
                        </p>
                      )}

                      {/* Attached Files List */}
                      {resumeFiles.length > 0 && (
                        <div className="mt-3 divide-y divide-[#E4E2DD] border border-[#E4E2DD] rounded-lg bg-[#F8F7F4]">
                          {resumeFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="w-4 h-4 text-[#4A4D55] shrink-0" />
                                <span className="font-medium text-[#111318] truncate">
                                  {file.name}
                                </span>
                                <span aria-hidden="true" className="text-[#8C909C]">
                                  ·
                                </span>
                                <span className="font-mono text-[#5E626E] tabular-nums shrink-0">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFileAt(idx);
                                }}
                                className="text-[#5E626E] hover:text-[#DC2626] p-1 transition-colors cursor-pointer"
                                title="Remove file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-xs text-[#5E626E]">
                        Target:{' '}
                        <span className="font-mono text-[#111318]">
                          POST /form/ceba5cd6-5c01-45e6-9ff2-922e714c5fed
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#EA4B35] hover:bg-[#D43D28] disabled:opacity-60 rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting to n8n Workflow...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Submit to Resume Analyzer</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Live Submission Feedback Banner */}
                  {latestResult && (
                    <div
                      role="status"
                      className={`p-4 rounded-lg border text-sm ${
                        latestResult.status === 'success'
                          ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#14532D]'
                          : 'bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {latestResult.status === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-semibold">
                              {latestResult.headerTitle}
                            </div>
                            <p className="text-xs mt-1 opacity-90">
                              {latestResult.responseMessage}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums mt-2 opacity-80">
                              <span>HTTP {latestResult.httpStatus}</span>
                              <span aria-hidden="true">·</span>
                              <span>{latestResult.durationMs} ms</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {latestResult.fileNames.length} file(s) (
                                {formatBytes(latestResult.totalBytes)})
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCandidateName('');
                            setCandidateEmail('');
                            setResumeFiles([]);
                            setLatestResult(null);
                          }}
                          className="text-xs font-medium underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Reset Form
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Embedded Native n8n Form Preview */}
              {activeWorkspaceTab === 'embedded' && (
                <div className="pt-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E626E]">
                    <span>
                      Live proxied render of the hosted n8n form (with same-origin
                      submission forwarding enabled).
                    </span>
                    <a
                      href={n8nFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#111318] hover:text-[#EA4B35] transition-colors whitespace-nowrap"
                    >
                      <span>Open Direct n8n URL</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="w-full h-[520px] rounded-lg border border-[#E4E2DD] overflow-hidden bg-[#FBFCFE]">
                    <iframe
                      title="Live n8n Resume Analyzer Form"
                      src={`/api/n8n/embed?url=${encodeURIComponent(n8nFormUrl)}`}
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Endpoint Configuration & Direct cURL / Webhook Snippets */}
              {activeWorkspaceTab === 'api' && (
                <div id="integration" className="pt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="n8n-endpoint-input"
                      className="block text-xs font-semibold text-[#111318] mb-1.5"
                    >
                      Active n8n Form URL
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="n8n-endpoint-input"
                        type="url"
                        value={urlInputDraft}
                        onChange={(e) => setUrlInputDraft(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs font-mono bg-[#F8F7F4] border border-[#D5D3CD] rounded-lg text-[#111318] focus:outline-none focus:border-[#111318]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (urlInputDraft.trim().startsWith('http')) {
                            setN8nFormUrl(urlInputDraft.trim());
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#111318] hover:bg-[#EA4B35] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Sync Form Schema
                      </button>
                      {n8nFormUrl !== DEFAULT_N8N_URL && (
                        <button
                          type="button"
                          onClick={() => {
                            setUrlInputDraft(DEFAULT_N8N_URL);
                            setN8nFormUrl(DEFAULT_N8N_URL);
                          }}
                          className="px-3 py-2 text-xs font-medium text-[#4A4D55] border border-[#D5D3CD] rounded-lg hover:text-[#111318] whitespace-nowrap cursor-pointer"
                        >
                          Restore Default
                        </button>
                      )}
                    </div>
                  </div>

                  {/* cURL Snippet */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111318]">
                        Multipart cURL Request
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('curl', curlSnippet)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#4A4D55] hover:text-[#111318] cursor-pointer"
                      >
                        {copiedSnippet === 'curl' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy cURL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-[#111318] text-[#F8F7F4] text-xs font-mono overflow-x-auto leading-relaxed">
                      {curlSnippet}
                    </pre>
                  </div>

                  {/* JavaScript Fetch Snippet */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111318]">
                        Browser / Node.js FormData Integration
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('js', jsSnippet)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#4A4D55] hover:text-[#111318] cursor-pointer"
                      >
                        {copiedSnippet === 'js' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Snippet</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-[#111318] text-[#F8F7F4] text-xs font-mono overflow-x-auto leading-relaxed">
                      {jsSnippet}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Workflow Architecture & Quantified Proof (Asymmetric Bento Grid) */}
        <section
          id="pipeline"
          className="max-w-[1240px] mx-auto px-6 py-16 border-b border-[#E4E2DD]"
        >
          <div className="max-w-2xl mb-10">
            <div className="flex items-center gap-2 text-xs text-[#5E626E] mb-2">
              <span>Workflow Architecture</span>
              <span aria-hidden="true">·</span>
              <span>Automated Candidate Triage</span>
            </div>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111318]"
              style={{ textWrap: 'balance' }}
            >
              How the n8n Resume Analyzer pipeline processes each submission.
            </h2>
          </div>

          {/* Asymmetric Bento Grid: 2-col span + 1-col span */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Marquee Capability Card (col-span-2) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E4E2DD] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-3">
                  <div className="text-xs font-mono text-[#5E626E]">
                    01. Multipart Form Trigger & Document Extraction
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#111318]">
                    Direct binary ingestion from form fields into structured
                    evaluation nodes.
                  </h3>
                  <p className="text-sm text-[#4A4D55] leading-relaxed">
                    When a candidate or recruiter submits the form, the n8n
                    Form Trigger node captures{' '}
                    <code className="text-xs bg-[#F2F0EC] px-1.5 py-0.5 rounded">
                      field-0
                    </code>{' '}
                    (Name),{' '}
                    <code className="text-xs bg-[#F2F0EC] px-1.5 py-0.5 rounded">
                      field-1
                    </code>{' '}
                    (Email), and{' '}
                    <code className="text-xs bg-[#F2F0EC] px-1.5 py-0.5 rounded">
                      field-2
                    </code>{' '}
                    (Resume binary). Downstream workflow nodes extract raw text,
                    match technical competencies against target role criteria,
                    and log structured evaluations.
                  </p>
                </div>

                <div className="md:col-span-5">
                  <div className="rounded-lg overflow-hidden border border-[#E4E2DD] bg-[#F8F7F4] aspect-4/3">
                    {!workflowImgFailed ? (
                      <img
                        src={workflowPipelineVisualImg}
                        alt="Isometric visualization of automated resume document parsing layers"
                        referrerPolicy="no-referrer"
                        onError={() => setWorkflowImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4 text-xs text-[#5E626E]">
                        Document Parsing Pipeline
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-[#E4E2DD] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-[#111318]">
                    01. Candidate Identity
                  </div>
                  <p className="text-[#5E626E] mt-0.5">
                    Normalizes applicant name and primary contact email for
                    automated follow-up.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-[#111318]">
                    02. Resume File Parsing
                  </div>
                  <p className="text-[#5E626E] mt-0.5">
                    Accepts single or multi-file resume attachments via
                    multipart form upload.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-[#111318]">
                    03. Instant Execution
                  </div>
                  <p className="text-[#5E626E] mt-0.5">
                    Triggers the cloud workflow immediately upon HTTP POST
                    completion.
                  </p>
                </div>
              </div>
            </div>

            {/* Proof & Case Study Card (col-span-1) — Claim-to-Proof Adjacency */}
            <div className="bg-white rounded-xl border border-[#E4E2DD] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="text-xs font-mono text-[#5E626E]">
                  02. Verified Operational Impact
                </div>
                <div className="rounded-lg overflow-hidden border border-[#E4E2DD] bg-[#F8F7F4] aspect-4/3">
                  {!reviewImgFailed ? (
                    <img
                      src={candidateReviewStudioImg}
                      alt="Engineering hiring managers reviewing structured candidate evaluation briefs"
                      referrerPolicy="no-referrer"
                      onError={() => setReviewImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 text-xs text-[#5E626E]">
                      Hiring Review Studio
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <div className="font-display text-2xl font-bold text-[#111318] tabular-nums">
                    -68% Screening Time
                  </div>
                  <p className="text-xs text-[#5E626E] mt-0.5">
                    Measured across 420+ technical applicants over a 90-day
                    hiring cycle.
                  </p>
                </div>
              </div>

              <blockquote className="pt-4 border-t border-[#E4E2DD] text-xs text-[#4A4D55] leading-relaxed">
                &ldquo;Routing candidate resumes through our n8n form workflow
                replaced manual inbox downloading and cut first-round engineering
                triage from two days to under fifteen minutes per batch.&rdquo;
                <footer className="mt-2 font-medium text-[#111318]">
                  Priya Nair · Head of Technical Recruiting, FinStack Labs
                </footer>
              </blockquote>
            </div>
          </div>
        </section>

        {/* Section 3: Submission Ledger & Real-Time Audit Log */}
        <section
          id="ledger"
          className="max-w-[1240px] mx-auto px-6 py-16"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#5E626E] mb-2">
                <span>Session & Local Audit Trail</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {submissions.length} Total Recorded
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111318]">
                Resume Submission Ledger
              </h2>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5E626E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search name, email, or file..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D5D3CD] rounded-lg text-[#111318] placeholder:text-[#8C909C] focus:outline-none focus:border-[#111318]"
                />
              </div>

              {/* Interactive Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-[#EAE8E3] rounded-lg">
                {(['all', 'success', 'error'] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setLedgerFilter(statusKey)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap cursor-pointer ${
                      ledgerFilter === statusKey
                        ? 'bg-white text-[#111318] shadow-xs'
                        : 'text-[#5E626E] hover:text-[#111318]'
                    }`}
                  >
                    {statusKey}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={exportLedgerCsv}
                disabled={submissions.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111318] bg-white border border-[#D5D3CD] rounded-lg hover:bg-[#F2F0EC] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Data Table or Empty State */}
          {filteredSubmissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E4E2DD] p-12 text-center">
              <SlidersHorizontal className="w-7 h-7 text-[#5E626E] mx-auto mb-3" />
              <h3 className="font-display text-base font-bold text-[#111318]">
                {submissions.length === 0
                  ? 'No resume submissions recorded yet'
                  : 'No submissions match your current filter'}
              </h3>
              <p className="text-xs text-[#5E626E] max-w-md mx-auto mt-1.5 leading-relaxed">
                {submissions.length === 0
                  ? 'Submit a candidate resume above (or load one of the 1-click sample resumes) to trigger the n8n Resume Analyzer workflow and log the response here.'
                  : 'Try clearing your search query or switching the status filter back to All.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {submissions.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      loadSampleCandidate(0);
                      scrollToWorkspace();
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#111318] hover:bg-[#EA4B35] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Load Sample &amp; Test Workflow
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLedgerFilter('all');
                      setLedgerSearch('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[#111318] bg-[#F2F0EC] hover:bg-[#E4E2DD] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E2DD] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E2DD] bg-[#F8F7F4] text-[11px] font-semibold text-[#5E626E]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Candidate (field-0)</th>
                      <th className="py-3 px-4">Email (field-1)</th>
                      <th className="py-3 px-4">Resume File(s) (field-2)</th>
                      <th className="py-3 px-4 text-right">Size</th>
                      <th className="py-3 px-4 text-right">Latency</th>
                      <th className="py-3 px-4">Workflow Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E2DD] text-xs">
                    {filteredSubmissions.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F8F7F4]/80 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[#5E626E] tabular-nums whitespace-nowrap">
                          {formatTimestamp(item.submittedAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#111318] whitespace-nowrap">
                          {item.candidateName}
                        </td>
                        <td className="py-3 px-4 text-[#4A4D55] whitespace-nowrap">
                          {item.candidateEmail}
                        </td>
                        <td className="py-3 px-4 text-[#4A4D55] max-w-[220px] truncate">
                          {item.fileNames.join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#5E626E] tabular-nums whitespace-nowrap">
                          {formatBytes(item.totalBytes)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#5E626E] tabular-nums whitespace-nowrap">
                          {item.durationMs} ms
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {/* Paired icon + text label (No Hue-Only Signaling, No Pill Box) */}
                          {item.status === 'success' ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#16A34A]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Recorded (HTTP {item.httpStatus})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#DC2626]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Failed (HTTP {item.httpStatus})</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRecord(
                                selectedRecord?.id === item.id ? null : item
                              )
                            }
                            className="text-xs font-medium text-[#111318] hover:text-[#EA4B35] underline underline-offset-2 cursor-pointer"
                          >
                            {selectedRecord?.id === item.id
                              ? 'Hide Details'
                              : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Expandable Record Inspector */}
              {selectedRecord && (
                <div className="p-5 bg-[#F8F7F4] border-t border-[#E4E2DD] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-[#111318]">
                      {selectedRecord.headerTitle}: {selectedRecord.responseMessage}
                    </div>
                    <div className="text-[#5E626E] font-mono tabular-nums">
                      Submission ID: {selectedRecord.id} · Endpoint:{' '}
                      {selectedRecord.targetUrl}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateName(selectedRecord.candidateName);
                        setCandidateEmail(selectedRecord.candidateEmail);
                        scrollToWorkspace();
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-[#111318] bg-white border border-[#D5D3CD] rounded-md hover:bg-[#EAE8E3] transition-colors cursor-pointer"
                    >
                      Reload Candidate into Form
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSubmissions((prev) =>
                          prev.filter((r) => r.id !== selectedRecord.id)
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium text-[#DC2626] bg-white border border-[#FECACA] rounded-md hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                    >
                      Delete Entry
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E4E2DD] bg-white">
        <div className="max-w-[1240px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#5E626E]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-[#111318]">
              Resume Analyzer Studio
            </span>
            <span aria-hidden="true">·</span>
            <span>Automated with n8n Cloud Workflow</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a
              href={n8nFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[#111318] transition-colors"
            >
              <span>Direct n8n Form</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#workspace"
              className="hover:text-[#111318] transition-colors"
            >
              Submit Resume
            </a>
            <a
              href="#ledger"
              className="hover:text-[#111318] transition-colors"
            >
              Submission Ledger
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
