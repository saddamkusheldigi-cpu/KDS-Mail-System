"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Send,
  Eye,
  Code,
  Tag,
  ArrowLeft,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Server,
  Check,
} from "lucide-react";
import Link from "next/link";
import { isValidEmail } from "@/lib/csv-validator";
import { analyzeSpamRisk } from "@/lib/spam-analyzer";
import EmailVisualBuilder from "@/components/EmailVisualBuilder";
import { PRESET_TEMPLATES } from "@/lib/email-templates";

const SENDER_OPTIONS = [
  {
    label: "Kevin Digital Growth",
    email: "kevin.digitalgrowthus@gmail.com",
    defaultName: "Kevin",
    replyTo: "kevin.digitalgrowthus@gmail.com",
  },
  {
    label: "Info Team",
    email: "info@yourdomain.com",
    defaultName: "Company Info",
    replyTo: "info@yourdomain.com",
  },
  {
    label: "Sales Team",
    email: "sales@yourdomain.com",
    defaultName: "Sales Department",
    replyTo: "sales@yourdomain.com",
  },
];

const DEFAULT_HTML = PRESET_TEMPLATES[0].html;
const DEFAULT_PLAIN_TEXT = PRESET_TEMPLATES[0].plainText;

export default function NewCampaignPage() {
  const router = useRouter();

  // Campaign Form State
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Quick question for {{company}} regarding {{name}}");
  const [selectedSender, setSelectedSender] = useState(SENDER_OPTIONS[0]);
  const [fromName, setFromName] = useState(SENDER_OPTIONS[0].defaultName);
  const [replyTo, setReplyTo] = useState(SENDER_OPTIONS[0].replyTo);

  // Dynamic Senders & Pool State
  const [sendersList, setSendersList] = useState([]);
  const [senderStrategy, setSenderStrategy] = useState("SINGLE"); // "SINGLE" | "POOL"
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [selectedPoolIds, setSelectedPoolIds] = useState([]);

  useEffect(() => {
    async function loadSenders() {
      try {
        const res = await fetch("/api/senders");
        const data = await res.json();
        if (data.success && data.senders?.length > 0) {
          setSendersList(data.senders);
          const activeOnes = data.senders.filter((s) => s.status === "ACTIVE");
          if (activeOnes.length > 0) {
            setSelectedSenderId(activeOnes[0].id);
            setSelectedSender({
              email: activeOnes[0].email,
              defaultName: activeOnes[0].fromName || "Team",
              replyTo: activeOnes[0].replyTo || activeOnes[0].email,
            });
            setFromName(activeOnes[0].fromName || "");
            setReplyTo(activeOnes[0].replyTo || activeOnes[0].email);
            setSelectedPoolIds(activeOnes.map((s) => s.id));
          }
        }
      } catch (err) {
        console.error("Failed to load inboxes:", err);
      }
    }
    loadSenders();
  }, []);

  // Content State
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML);
  const [plainTextBody, setPlainTextBody] = useState(DEFAULT_PLAIN_TEXT);

  // CSV State
  const [csvFileName, setCsvFileName] = useState("");
  const [validRecipients, setValidRecipients] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Deliverability Seed Test State
  const [seedEmail, setSeedEmail] = useState("aman.kusheldigi@gmail.com");
  const [isSendingSeed, setIsSendingSeed] = useState(false);
  const [seedResult, setSeedResult] = useState("");

  // Size & Deliverability Checks (Strict 1 MB limit)
  const templateSizeBytes = typeof window !== "undefined" ? new Blob([htmlBody || ""]).size : (htmlBody || "").length;
  const isTemplateOverSize = templateSizeBytes > 1024 * 1024;

  // Live Spam Risk & Placement Analysis
  const spamAnalysis = analyzeSpamRisk({ subject, htmlBody, plainTextBody });

  async function handleSendSeedTest(e) {
    e.preventDefault();
    if (!seedEmail.trim()) return;

    // Strict 1 MB check
    const templateBytes = new Blob([htmlBody || ""]).size;
    if (templateBytes > 1024 * 1024) {
      setSeedResult(`❌ Template size (${(templateBytes / 1024).toFixed(1)} KB) exceeds strict 1 MB limit (1,024 KB max). Please reduce image or text size.`);
      return;
    }

    setIsSendingSeed(true);
    setSeedResult("");

    try {
      const res = await fetch("/api/campaigns/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmail: seedEmail.trim(),
          subject,
          fromAddress: selectedSender.email,
          fromName,
          replyTo,
          htmlBody,
          plainTextBody,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSeedResult(`✅ ${data.message}`);
      } else {
        setSeedResult(`❌ Error: ${data.error || "Failed to dispatch test email"}`);
      }
    } catch (err) {
      setSeedResult(`❌ Network Error: ${err.message}`);
    } finally {
      setIsSendingSeed(false);
    }
  }

  // Handle CSV file selection
  function handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setIsParsing(true);
    setSubmitError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const rawRows = results.data || [];
        const valid = [];
        const invalid = [];
        const seen = new Set();
        let dups = 0;

        const headers = results.meta.fields || [];
        setDetectedColumns(headers);

        rawRows.forEach((row, idx) => {
          // Find email field
          const emailKey =
            Object.keys(row).find((k) =>
              ["email", "e-mail", "email_address"].includes(k.toLowerCase())
            ) || "email";

          const rawEmail = (row[emailKey] || "").trim().toLowerCase();

          if (!isValidEmail(rawEmail)) {
            invalid.push({ rowNumber: idx + 2, email: rawEmail, row });
            return;
          }

          if (seen.has(rawEmail)) {
            dups++;
            return;
          }

          seen.add(rawEmail);

          // Name & Company fallback detection
          const nameKey = Object.keys(row).find((k) =>
            ["name", "fullname", "first_name", "firstname"].includes(k.toLowerCase())
          );
          const companyKey = Object.keys(row).find((k) =>
            ["company", "organization", "company_name"].includes(k.toLowerCase())
          );

          const customVariables = {};
          for (const [k, v] of Object.entries(row)) {
            if (k !== emailKey && k !== nameKey && k !== companyKey) {
              customVariables[k] = v;
            }
          }

          valid.push({
            email: rawEmail,
            name: nameKey ? (row[nameKey] || "").trim() : "",
            company: companyKey ? (row[companyKey] || "").trim() : "",
            customVariables,
          });
        });

        setValidRecipients(valid);
        setInvalidRows(invalid);
        setDuplicatesCount(dups);
        setIsParsing(false);
      },
      error: (err) => {
        setSubmitError(`CSV Error: ${err.message}`);
        setIsParsing(false);
      },
    });
  }

  // Insert variable tag into subject or HTML
  function insertVariable(varTag, targetField = "subject") {
    if (targetField === "subject") {
      setSubject((prev) => `${prev} ${varTag}`);
    } else if (targetField === "html") {
      setHtmlBody((prev) => `${prev}\n${varTag}`);
    }
  }

  // Submit and create campaign
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    if (!name.trim()) {
      setSubmitError("Please enter a campaign name.");
      return;
    }
    if (!subject.trim()) {
      setSubmitError("Please enter an email subject line.");
      return;
    }
    if (validRecipients.length === 0) {
      setSubmitError("Please upload a CSV file with at least 1 valid recipient.");
      return;
    }

    // Strict 1 MB total template size limit check
    const templateBytes = new Blob([htmlBody || ""]).size;
    if (templateBytes > 1024 * 1024) {
      setSubmitError(
        `Email template size (${(templateBytes / 1024).toFixed(1)} KB) exceeds the strict 1 MB limit (1,024 KB max). Please reduce image or text size before sending.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const chosenSender = sendersList.find((s) => s.id === selectedSenderId);
      const effectiveFromAddress = chosenSender ? chosenSender.email : selectedSender.email;

      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        fromAddress: effectiveFromAddress,
        fromName: fromName.trim(),
        replyTo: replyTo.trim(),
        senderStrategy,
        senderAccountId: senderStrategy === "SINGLE" ? selectedSenderId : null,
        senderAccountPool: senderStrategy === "POOL" ? selectedPoolIds : [],
        htmlBody,
        plainTextBody,
        recipients: validRecipients,
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create campaign");
      }

      // Redirect to campaign detail / logs page
      router.push(`/campaigns/${data.campaignId}`);
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "An error occurred while launching campaign.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/campaigns"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Outreach Campaign</h1>
          <p className="text-sm text-slate-500">
            Upload CSV list, customize sender identity, and queue automated warm-up delivery.
          </p>
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-500" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Campaign Info & Sender Identity */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">1. Sender Identity (Kis Email Se Bhejna Hai?)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select which email address will send these emails, or choose a multi-domain pool to rotate automatically.
            </p>
          </div>

          {/* Strategy Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Dispatch Mode (Sending Strategy)
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setSenderStrategy("SINGLE")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  senderStrategy === "SINGLE"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Server className="h-4 w-4" />
                Single Dedicated Email
              </button>
              <button
                type="button"
                onClick={() => setSenderStrategy("POOL")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  senderStrategy === "POOL"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Zap className="h-4 w-4 text-amber-500" />
                Multi-Domain Pool (Round-Robin)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campaign Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Saas Founders Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Internal campaign title to identify this outreach.
              </span>
            </div>

            {/* Single Inbox Selector */}
            {senderStrategy === "SINGLE" ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Sending Email Address (From Email) *
                  </label>
                  <Link href="/senders" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                    + Add New Inbox
                  </Link>
                </div>
                {sendersList.length > 0 ? (
                  <select
                    value={selectedSenderId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSenderId(id);
                      const s = sendersList.find((opt) => opt.id === id);
                      if (s) {
                        setFromName(s.fromName || "");
                        setReplyTo(s.replyTo || s.email);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    {sendersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email} ({s.sentToday || 0}/{s.dailyLimit} sent today) • [{s.provider.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedSender.email}
                    onChange={(e) => {
                      const s = SENDER_OPTIONS.find((opt) => opt.email === e.target.value);
                      if (s) {
                        setSelectedSender(s);
                        setFromName(s.defaultName);
                        setReplyTo(s.replyTo);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    {SENDER_OPTIONS.map((opt) => (
                      <option key={opt.email} value={opt.email}>
                        {opt.label} ({opt.email})
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-[11px] text-slate-400 mt-1 block">
                  The verified corporate email ID from which leads will receive your message.
                </span>
              </div>
            ) : (
              /* Pool Selection Box */
              <div className="sm:col-span-2 rounded-xl bg-indigo-50/50 p-4 border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">Choose Inboxes to Rotate Across Contacts</span>
                  </div>
                  <Link href="/senders" className="text-xs font-semibold text-indigo-600 hover:underline">
                    Manage Accounts
                  </Link>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Each email in your CSV list will alternate between these accounts in sequence (Lead 1 from Inbox A, Lead 2 from Inbox B). This protects domain health and guarantees high inbox placement.
                </p>

                {sendersList.length === 0 ? (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                    No custom mailboxes connected yet. <Link href="/senders" className="text-indigo-600 font-semibold underline">Add sender inboxes in the Inboxes tab</Link> to enable dynamic multi-domain rotation.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {sendersList.map((s) => {
                      const isChecked = selectedPoolIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-white border-indigo-500 text-slate-900 shadow-xs"
                              : "bg-white/60 border-slate-200 text-slate-500 hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPoolIds([...selectedPoolIds, s.id]);
                              } else {
                                setSelectedPoolIds(selectedPoolIds.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <div className="truncate">
                            <span className="font-semibold block truncate">{s.email}</span>
                            <span className="text-[10px] text-slate-400">
                              Limit: {s.dailyLimit}/day • {s.provider}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Display From Name (Recipient ko kya naam dikhega)
              </label>
              <input
                type="text"
                placeholder="e.g. Kevin from Growth"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Shown as sender name in their Gmail / Outlook inbox.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reply-To Email Address (Replies kahan receive karni hai)
              </label>
              <input
                type="email"
                placeholder="e.g. replies@yourdomain.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                When a recipient clicks &ldquo;Reply&rdquo;, replies will route here.
              </span>
            </div>
          </div>
        </div>

        {/* Step 2: CSV File Upload & Parsing */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">2. Recipient Leads List (Kisko Bhejna Hai?)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              CSV file upload karein. File me <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">email</code> column hona zaroori hai. Optional columns: <code className="bg-slate-100 px-1 py-0.5 rounded">name</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">company</code>.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 hover:border-indigo-500 transition-colors">
            <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-xs font-semibold text-slate-700">
              Drag & drop your CSV file here, or click to browse
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Supports up to 40,000 leads with automated deduplication</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFile}
              className="mt-4 text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          {/* CSV Summary Details */}
          {validRecipients.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">{csvFileName}</span>
                    <span className="block text-[11px] text-slate-500">
                      Detected Columns: {detectedColumns.join(", ")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {validRecipients.length} Valid Leads
                  </span>
                  {duplicatesCount > 0 && (
                    <span className="text-slate-500">
                      {duplicatesCount} Duplicates Skipped
                    </span>
                  )}
                  {invalidRows.length > 0 && (
                    <span className="text-rose-600">
                      {invalidRows.length} Invalid Skipped
                    </span>
                  )}
                </div>
              </div>

              {/* Recipient preview table */}
              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                <table className="w-full text-left text-[11px] text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Email Address</th>
                      <th className="px-4 py-2">Lead Name</th>
                      <th className="px-4 py-2">Company</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validRecipients.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{r.email}</td>
                        <td className="px-4 py-2">{r.name || "—"}</td>
                        <td className="px-4 py-2">{r.company || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 text-right">
                Showing first 5 of {validRecipients.length} parsed recipients
              </p>
            </div>
          )}
        </div>

        {/* Step 3: Subject & Content */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">3. Email Message & Personalization (Kya Bhejna Hai?)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Insert custom dynamic variables like {"{{name}}"} and {"{{company}}"}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Subject Line *
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Insert Tag:</span>
                <button
                  type="button"
                  onClick={() => insertVariable("{{name}}", "subject")}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  + {"{{name}}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable("{{company}}", "subject")}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  + {"{{company}}"}
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Dynamic Visual Email Designer (No Coding Required & 1 MB Image Ready) */}
          <EmailVisualBuilder
            htmlBody={htmlBody}
            setHtmlBody={setHtmlBody}
            plainTextBody={plainTextBody}
            setPlainTextBody={setPlainTextBody}
            subject={subject}
            setSubject={setSubject}
          />
        </div>

        {/* Step 4: Deliverability & Placement Predictor (Inbox vs Spam) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                4. Inbox Placement & Spam Risk Predictor (Inbox vs Spam Test)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time scan for spam trigger words, corporate deliverability compliance, and seed test send.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Estimated Delivery:</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  spamAnalysis.badgeColor === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : spamAnalysis.badgeColor === "amber"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    spamAnalysis.badgeColor === "emerald"
                      ? "bg-emerald-500"
                      : spamAnalysis.badgeColor === "amber"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                ></span>
                {spamAnalysis.placementLabel} ({spamAnalysis.score}/100 Score)
              </span>
            </div>
          </div>

          {/* Warnings & Recommendations */}
          {spamAnalysis.warnings.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs">
              <span className="font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Spam Filter Warnings Detected:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-amber-900">
                {spamAnalysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              {spamAnalysis.recommendations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] text-amber-800">
                  <span className="font-semibold">Tips: </span>
                  {spamAnalysis.recommendations.join(" ")}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-800">
              <span className="font-semibold">✓ Clean Copy: </span>
              Zero high-risk spam trigger words detected. 95%+ Primary Inbox placement expected!
            </div>
          )}

          {/* Instant Seed Test Send Box */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  Instant Seed Placement Test (Check your Phone / Inbox)
                </span>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Send a single test email directly to yourself right now to physically verify whether it lands in Primary, Promotions, or Spam.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <input
                type="email"
                placeholder="Enter your personal/test email..."
                value={seedEmail}
                onChange={(e) => setSeedEmail(e.target.value)}
                className="w-full sm:flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendSeedTest}
                disabled={isSendingSeed}
                className="w-full sm:w-auto rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
              >
                {isSendingSeed ? "Dispatching..." : "Send Test Email"}
              </button>
            </div>

            {seedResult && (
              <div className="rounded border border-indigo-200 bg-white p-2.5 text-xs font-medium text-indigo-800">
                {seedResult}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/campaigns"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || validRecipients.length === 0 || isTemplateOverSize}
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors ${
              isTemplateOverSize
                ? "bg-rose-600 hover:bg-rose-700 cursor-not-allowed opacity-90"
                : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            <Send className="h-4 w-4" />
            {isTemplateOverSize
              ? `Template Exceeds 1 MB (${(templateSizeBytes / 1024).toFixed(0)} KB / 1,024 KB)`
              : isSubmitting
              ? "Queuing to SQS..."
              : `Queue & Launch Campaign (${validRecipients.length})`}
          </button>
        </div>
      </form>
    </div>
  );
}
