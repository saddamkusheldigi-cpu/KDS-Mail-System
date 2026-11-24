"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Globe,
  ShieldCheck,
  Send,
  Zap,
  Info,
  Sliders,
  Check,
  X,
} from "lucide-react";

export default function SendersPage() {
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDnsModalOpen, setIsDnsModalOpen] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null); // { id, success, message }

  // Form State
  const [formData, setFormData] = useState({
    provider: "gmail",
    fromName: "",
    email: "",
    replyTo: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPass: "",
    dailyLimit: 50,
  });
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestError, setModalTestError] = useState("");
  const [modalTestSuccess, setModalTestSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // DNS Checker State
  const [checkDomain, setCheckDomain] = useState("");
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [dnsError, setDnsError] = useState("");

  const fetchSenders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/senders");
      const data = await res.json();
      if (data.success) {
        setSenders(data.senders || []);
      }
    } catch (err) {
      console.error("Failed to load senders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  // Preset switch
  const handleProviderChange = (provider) => {
    let host = "smtp.gmail.com";
    let port = 465;
    let secure = true;

    if (provider === "outlook") {
      host = "smtp.office365.com";
      port = 587;
      secure = false;
    } else if (provider === "ses") {
      host = "email-smtp.ap-south-1.amazonaws.com";
      port = 465;
      secure = true;
    } else if (provider === "custom") {
      host = "";
      port = 587;
      secure = false;
    }

    setFormData((prev) => ({
      ...prev,
      provider,
      smtpHost: host,
      smtpPort: port,
      smtpSecure: secure,
    }));
  };

  const handleTestModalConnection = async () => {
    setModalTesting(true);
    setModalTestError("");
    setModalTestSuccess("");

    try {
      const res = await fetch("/api/senders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formData.provider,
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpSecure: formData.smtpSecure,
          smtpUser: formData.smtpUser || formData.email,
          smtpPass: formData.smtpPass,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setModalTestSuccess(data.message || "Connection verified successfully!");
      } else {
        setModalTestError(data.error || "Connection failed. Please check credentials.");
      }
    } catch (err) {
      setModalTestError(err.message || "Failed to test connection");
    } finally {
      setModalTesting(false);
    }
  };

  const handleSaveSender = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalTestError("");

    try {
      const domain = formData.email.split("@")[1] || "";
      const payload = {
        ...formData,
        domain,
        smtpUser: formData.smtpUser || formData.email,
      };

      const res = await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchSenders();
        // Reset form
        setFormData({
          provider: "gmail",
          fromName: "",
          email: "",
          replyTo: "",
          smtpHost: "smtp.gmail.com",
          smtpPort: 465,
          smtpSecure: true,
          smtpUser: "",
          smtpPass: "",
          dailyLimit: 50,
        });
      } else {
        setModalTestError(data.error || "Failed to save sender");
      }
    } catch (err) {
      setModalTestError(err.message || "Failed to save sender");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (sender) => {
    const newStatus = sender.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: sender.id,
          status: newStatus,
        }),
      });
      fetchSenders();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDeleteSender = async (id) => {
    if (!confirm("Are you sure you want to remove this sender inbox?")) return;
    try {
      await fetch(`/api/senders?id=${id}`, { method: "DELETE" });
      fetchSenders();
    } catch (err) {
      console.error("Failed to delete sender:", err);
    }
  };

  const handleTestExistingSender = async (sender) => {
    setTestingId(sender.id);
    setTestResult(null);

    try {
      const res = await fetch("/api/senders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: sender.provider,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          smtpSecure: sender.smtpSecure,
          smtpUser: sender.smtpUser,
          smtpPass: sender.smtpPass,
        }),
      });
      const data = await res.json();
      setTestResult({
        id: sender.id,
        success: data.success,
        message: data.success ? data.message : data.error,
      });
    } catch (err) {
      setTestResult({
        id: sender.id,
        success: false,
        message: err.message || "Failed to test",
      });
    } finally {
      setTestingId(null);
    }
  };

  // DNS Verification
  const handleCheckDns = async (e) => {
    e.preventDefault();
    if (!checkDomain) return;

    setDnsLoading(true);
    setDnsError("");
    setDnsResult(null);

    try {
      const res = await fetch("/api/domains/verify-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: checkDomain }),
      });
      const data = await res.json();
      if (data.success) {
        setDnsResult(data);
      } else {
        setDnsError(data.error || "Failed to query DNS records");
      }
    } catch (err) {
      setDnsError(err.message || "DNS lookup failed");
    } finally {
      setDnsLoading(false);
    }
  };

  // Aggregated Stats
  const activeCount = senders.filter((s) => s.status === "ACTIVE").length;
  const uniqueDomains = [...new Set(senders.map((s) => s.domain).filter(Boolean))];
  const totalDailyCap = senders.reduce((acc, s) => acc + (s.status === "ACTIVE" ? Number(s.dailyLimit || 0) : 0), 0);
  const totalSentToday = senders.reduce((acc, s) => acc + Number(s.sentToday || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inboxes & Sending Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect dynamic mailboxes across Google Workspace, SES, Outlook, and Custom domains to rotate senders and prevent spam.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsDnsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Globe className="h-4 w-4 text-indigo-600" />
            Check Domain DNS
          </button>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setModalTestError("");
              setModalTestSuccess("");
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Connect New Inbox
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Connected Inboxes</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Server className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{senders.length}</span>
            <span className="text-xs font-medium text-emerald-600">({activeCount} Active)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Sending Domains</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Globe className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{uniqueDomains.length}</span>
            <span className="text-xs text-slate-500">Domains Linked</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Today&apos;s Dispatch</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalSentToday}</span>
            <span className="text-xs text-slate-500">/ {totalDailyCap} Max Cap</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Rotation Mode</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Zap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-sm font-bold text-slate-900">Round-Robin Pool</span>
            <p className="text-[11px] text-slate-500">Multi-domain load balancing enabled</p>
          </div>
        </div>
      </div>

      {/* Senders Table / Cards */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Configured Sender Mailboxes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These mailboxes are available in campaigns for single or multi-inbox round-robin distribution.
            </p>
          </div>
          <button
            onClick={fetchSenders}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading inboxes...</div>
        ) : senders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
              <Server className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No sender accounts added yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Connect your first Google Workspace, Microsoft 365, Amazon SES, or custom SMTP inbox to start sending.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Connect First Inbox
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Sender Mailbox</th>
                  <th className="px-6 py-3.5">Provider & Host</th>
                  <th className="px-6 py-3.5">Today&apos;s Quota</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {senders.map((s) => {
                  const sent = s.sentToday || 0;
                  const limit = s.dailyLimit || 50;
                  const percentage = Math.min(100, Math.round((sent / limit) * 100));

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{s.email}</div>
                        <div className="text-xs text-slate-500">
                          {s.fromName ? `From: "${s.fromName}"` : "Default sender"} • Reply-To: {s.replyTo || s.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 uppercase">
                            {s.provider}
                          </span>
                          <span className="text-xs text-slate-600">
                            {s.smtpHost ? `${s.smtpHost}:${s.smtpPort}` : "SES Identity"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-40">
                          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                            <span>{sent} sent</span>
                            <span className="text-slate-400">/ {limit} max</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentage >= 100
                                  ? "bg-rose-500"
                                  : percentage >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                            s.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              s.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-400"
                            }`}
                          />
                          {s.status}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTestExistingSender(s)}
                            disabled={testingId === s.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${testingId === s.id ? "animate-spin" : ""}`} />
                            Test
                          </button>
                          <button
                            onClick={() => handleDeleteSender(s.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Delete inbox"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {testResult && testResult.id === s.id && (
                          <div
                            className={`mt-1 text-[11px] ${
                              testResult.success ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {testResult.success ? "✓ Valid" : `✗ ${testResult.message}`}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Connect New Inbox */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Connect Sender Mailbox</h3>
                  <p className="text-xs text-slate-500">Configure SMTP/SES credentials for warm-up & rotation</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSender} className="p-6 space-y-4">
              {/* Provider Selection Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Provider Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "gmail", label: "Google / GSuite" },
                    { id: "outlook", label: "Outlook / M365" },
                    { id: "ses", label: "Amazon SES" },
                    { id: "custom", label: "Custom SMTP" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id)}
                      className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-all ${
                        formData.provider === p.id
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email & From Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sending Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@yourdomain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Display From Name</label>
                  <input
                    type="text"
                    placeholder="Alex from Growth"
                    value={formData.fromName}
                    onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Reply To & Daily Limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reply-To Address</label>
                  <input
                    type="email"
                    placeholder="Same as sending email or CRM"
                    value={formData.replyTo}
                    onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Daily Limit (Warm-up Cap)</label>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* SMTP Credentials (if not SES direct) */}
              {formData.provider !== "ses" && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        required
                        value={formData.smtpHost}
                        onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Port</label>
                      <input
                        type="number"
                        required
                        value={formData.smtpPort}
                        onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="Usually same as email"
                        value={formData.smtpUser}
                        onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {formData.provider === "gmail" ? "16-digit App Password" : "Password"}
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••••••"
                        value={formData.smtpPass}
                        onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {formData.provider === "gmail" && (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Google requires a 16-character App Password (from myaccount.google.com/apppasswords). Regular Gmail passwords are not accepted.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Status feedback */}
              {modalTestSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>{modalTestSuccess}</span>
                </div>
              )}
              {modalTestError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" />
                  <span>{modalTestError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestModalConnection}
                  disabled={modalTesting || (!formData.smtpPass && formData.provider !== "ses")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${modalTesting ? "animate-spin" : ""}`} />
                  {modalTesting ? "Verifying Handshake..." : "Test Connection"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Inbox"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: DNS Health Checker */}
      {isDnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Domain Deliverability & DNS Checker</h3>
                  <p className="text-xs text-slate-500">Live verification of SPF, DKIM, DMARC, and MX records</p>
                </div>
              </div>
              <button
                onClick={() => setIsDnsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <form onSubmit={handleCheckDns} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Enter domain (e.g. yourcompany.com)"
                  value={checkDomain}
                  onChange={(e) => setCheckDomain(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={dnsLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${dnsLoading ? "animate-spin" : ""}`} />
                  {dnsLoading ? "Querying DNS..." : "Scan Records"}
                </button>
              </form>

              {dnsError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {dnsError}
                </div>
              )}

              {dnsResult && (
                <div className="space-y-4">
                  {/* Score pill */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Domain Health Score</span>
                      <div className="text-xl font-bold text-slate-900">
                        {dnsResult.score} / 100
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        dnsResult.score >= 80
                          ? "bg-emerald-100 text-emerald-800"
                          : dnsResult.score >= 50
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {dnsResult.status} READINESS
                    </span>
                  </div>

                  {/* Record Checklist */}
                  <div className="space-y-2">
                    {/* SPF */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">SPF Record</span>
                        {dnsResult.records.spf.valid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Missing
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-500 break-all">
                        {dnsResult.records.spf.record || "No v=spf1 TXT record found."}
                      </p>
                    </div>

                    {/* DMARC */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">DMARC Policy</span>
                        {dnsResult.records.dmarc.valid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Missing
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-500 break-all">
                        {dnsResult.records.dmarc.record || "No _dmarc record found."}
                      </p>
                    </div>

                    {/* DKIM */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">DKIM Key</span>
                        {dnsResult.records.dkim.valid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Found ({dnsResult.records.dkim.selector})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Selector Not Found
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-500 break-all truncate">
                        {dnsResult.records.dkim.record || "Tested google, default, k1, ses selectors."}
                      </p>
                    </div>

                    {/* MX */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">MX Mail Servers</span>
                        {dnsResult.records.mx.valid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" /> {dnsResult.records.mx.records.length} Servers
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> No MX
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
