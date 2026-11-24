"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  Search,
  Mail,
  Send,
  Eye,
  Server,
  Zap,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");

  async function loadCampaignData() {
    try {
      const url =
        statusFilter === "ALL"
          ? `/api/campaigns/${campaignId}`
          : `/api/campaigns/${campaignId}?status=${statusFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCampaign(data.campaign);
        setRecipients(data.recipients || []);
      }
    } catch (err) {
      console.error("Failed to load campaign data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaignData();
    const interval = setInterval(loadCampaignData, 8000); // 8s auto refresh for live monitor
    return () => clearInterval(interval);
  }, [campaignId, statusFilter]);

  async function handleRetryFailed() {
    setRetrying(true);
    setRetryMessage("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setRetryMessage(data.message || "Failed recipients re-queued into SQS dispatch queue!");
        loadCampaignData();
      } else {
        setRetryMessage(data.error || "Retry failed");
      }
    } catch (err) {
      setRetryMessage(`Retry error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  }

  const filteredRecipients = recipients.filter((r) => {
    return (
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.company?.toLowerCase().includes(search.toLowerCase()) ||
      r.senderInbox?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading && !campaign) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-slate-800">Campaign Not Found</h2>
        <Link href="/campaigns" className="mt-3 inline-block text-xs font-semibold text-indigo-600">
          ← Back to campaigns list
        </Link>
      </div>
    );
  }

  const total = campaign.totalRecipients || 1;
  const sent = campaign.sentCount || 0;
  const opened = campaign.openedCount || recipients.filter((r) => r.status === "OPENED").length;
  const failed = campaign.failedCount || 0;
  const bounced = campaign.bouncedCount || 0;
  const unsub = campaign.unsubscribedCount || 0;
  const pending = campaign.pendingCount ?? Math.max(0, total - sent);

  const sentPct = Math.min(100, Math.round((sent / total) * 100));
  const openRatePct = sent > 0 ? Math.min(100, Math.round((opened / sent) * 100)) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  campaign.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Subject: &ldquo;{campaign.subject}&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {failed > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Re-queuing..." : `Retry Failed Emails (${failed})`}
            </button>
          )}

          <button
            onClick={loadCampaignData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Refresh logs"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            Refresh
          </button>
        </div>
      </div>

      {retryMessage && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-700">
          {retryMessage}
        </div>
      )}

      {/* Sending Account & Identity Information Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
          <Server className="h-4 w-4 text-indigo-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Sending Identity & Routing Configuration
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Sending Strategy</span>
            {campaign.senderStrategy === "POOL" ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Zap className="h-3.5 w-3.5" /> Multi-Domain Round-Robin Pool
              </span>
            ) : (
              <span className="font-semibold text-slate-800">Single Dedicated Mailbox</span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Sending From</span>
            <span className="font-mono font-semibold text-slate-800">
              {campaign.fromAddress || "Default configured sender"}
            </span>
            {campaign.fromName && (
              <span className="block text-[11px] text-slate-500">Name: &quot;{campaign.fromName}&quot;</span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Reply-To Address</span>
            <span className="font-mono font-semibold text-slate-800">
              {campaign.replyTo || campaign.fromAddress}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Protection & Compliance</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> RFC 8058 Unsubscribe Active
            </span>
          </div>
        </div>
      </div>

      {/* Primary Deliverability KPI Breakdown Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Target */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">1. Total Leads</span>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{total}</p>
          <span className="text-[10px] text-slate-400">Total in CSV list</span>
        </div>

        {/* Sent Successfully */}
        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
            <Send className="h-3 w-3 text-blue-600" /> 2. Dispatched
          </span>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">{sent}</p>
          <span className="text-[10px] text-blue-600 font-medium">{sentPct}% sent</span>
        </div>

        {/* Primary Inbox Confirmed */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <Eye className="h-3 w-3 text-emerald-600" /> 3. Primary Inbox
          </span>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{opened}</p>
          <span className="text-[10px] text-emerald-600 font-bold">{openRatePct}% Confirmed Opened</span>
        </div>

        {/* Pending Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" /> 4. In Queue
          </span>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{pending}</p>
          <span className="text-[10px] text-slate-400">Jittered pacing (30-45s)</span>
        </div>

        {/* Bounced / Failed */}
        <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-500" /> 5. Bounced
          </span>
          <p className="mt-1 text-2xl font-extrabold text-rose-600">{bounced + failed}</p>
          <span className="text-[10px] text-rose-500">
            {bounced} Bounces • {failed} Failed
          </span>
        </div>

        {/* Unsubscribed */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <UserX className="h-3 w-3 text-slate-400" /> 6. Unsub
          </span>
          <p className="mt-1 text-2xl font-extrabold text-slate-700">{unsub}</p>
          <span className="text-[10px] text-slate-400">Auto-suppressed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
          <span>Dispatch Progress: {sent} of {total} recipients sent</span>
          <span>{sentPct}% Complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${sentPct}%` }}
          />
        </div>
      </div>

      {/* Detailed Recipient Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search recipients by email, name, company, or inbox..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "ALL", label: "All Recipients" },
              { id: "OPENED", label: "✓ Opened in Inbox" },
              { id: "SENT", label: "Dispatched" },
              { id: "PENDING", label: "Pending" },
              { id: "FAILED", label: "Failed" },
              { id: "BOUNCED", label: "Bounced" },
              { id: "UNSUBSCRIBED", label: "Unsubscribed" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === f.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase text-[10px] tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Recipient Email</th>
                <th className="px-6 py-3.5">Sent Via Mailbox</th>
                <th className="px-6 py-3.5">Name / Company</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Event Diagnostic / Placement Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No recipients matching filter &ldquo;{statusFilter}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-900 font-mono">
                      {r.email}
                    </td>

                    <td className="px-6 py-3">
                      {r.senderInbox ? (
                        <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                          {r.senderInbox}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">
                          {campaign.fromAddress || "Default"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3 text-slate-700">
                      <span className="font-medium">{r.name || "—"}</span>{" "}
                      {r.company && <span className="text-slate-400 text-[11px]">({r.company})</span>}
                    </td>

                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.status === "OPENED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : r.status === "SENT"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : r.status === "FAILED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : r.status === "BOUNCED"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : r.status === "UNSUBSCRIBED"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status === "OPENED" && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        {r.status === "OPENED" ? "INBOX CONFIRMED" : r.status}
                      </span>
                    </td>

                    <td className="px-6 py-3 text-slate-500 text-[11px]">
                      {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : "—"}
                    </td>

                    <td className="px-6 py-3 font-mono text-[11px] text-slate-500 max-w-sm truncate">
                      {r.status === "OPENED" ? (
                        <span className="text-emerald-700 font-sans font-medium flex items-center gap-1">
                          <Eye className="h-3 w-3" /> User opened email in Primary Inbox
                        </span>
                      ) : r.errorMessage ? (
                        <span className="text-rose-600">{r.errorMessage}</span>
                      ) : (
                        r.messageId || "Dispatched to receiving mail server"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
