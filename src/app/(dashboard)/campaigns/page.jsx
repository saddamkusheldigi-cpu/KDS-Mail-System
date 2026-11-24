"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Mail,
  RefreshCw,
  Send,
  Eye,
  AlertTriangle,
  Zap,
  Server,
  ArrowRight,
} from "lucide-react";

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.subject?.toLowerCase().includes(search.toLowerCase()) ||
      c.fromAddress?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ? true : c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate high-level summary counters across listed campaigns
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + (c.openedCount || 0), 0);
  const totalBounced = campaigns.reduce((acc, c) => acc + (c.bouncedCount || 0), 0);
  const overallOpenRate = totalSent > 0 ? Math.min(100, Math.round((totalOpened / totalSent) * 100)) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns Manager</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track all active, scheduled, and completed bulk outreach campaigns with detailed delivery metrics.
          </p>
        </div>

        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Create New Campaign
        </Link>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Campaigns</span>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{campaigns.length}</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
            <Send className="h-3.5 w-3.5 text-blue-600" /> Total Dispatched
          </span>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">{totalSent}</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-emerald-600" /> Primary Inbox (Opened)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{totalOpened}</span>
            <span className="text-xs font-bold text-emerald-600">({overallOpenRate}%)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Bounces / Spam
          </span>
          <p className="mt-1 text-2xl font-extrabold text-rose-600">{totalBounced}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns by name, subject, or sending email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "QUEUED", "PROCESSING", "COMPLETED", "PAUSED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={fetchCampaigns}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No campaigns found</h3>
            <p className="mt-1 text-xs text-slate-500">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Campaign Name & Subject</th>
                  <th className="px-6 py-3.5">Sending Mailbox</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Dispatched / Target</th>
                  <th className="px-6 py-3.5">Primary Inbox (Opened)</th>
                  <th className="px-6 py-3.5">Bounces / Issues</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCampaigns.map((c) => {
                  const sent = c.sentCount || 0;
                  const total = c.totalRecipients || 1;
                  const opened = c.openedCount || 0;
                  const failed = c.failedCount || 0;
                  const bounced = c.bouncedCount || 0;
                  const openRate = sent > 0 ? Math.min(100, Math.round((opened / sent) * 100)) : 0;

                  return (
                    <tr key={c.campaignId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/campaigns/${c.campaignId}`}
                          className="font-bold text-slate-900 hover:text-indigo-600 text-sm block"
                        >
                          {c.name}
                        </Link>
                        <span className="block text-xs text-slate-400 mt-0.5 truncate max-w-sm">
                          &ldquo;{c.subject}&rdquo;
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {c.senderStrategy === "POOL" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                            <Zap className="h-3 w-3" />
                            Multi-Inbox Pool
                          </span>
                        ) : (
                          <span className="font-mono text-slate-700 text-xs">
                            {c.fromAddress}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : c.status === "PROCESSING" || c.status === "QUEUED"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 text-xs">
                          {sent} / {total} sent
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.pendingCount > 0 ? `${c.pendingCount} pending` : "All dispatched"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700 text-xs">
                          <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{opened} opened ({openRate}%)</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Inbox placement confirmed</span>
                      </td>

                      <td className="px-6 py-4">
                        {bounced === 0 && failed === 0 ? (
                          <span className="text-xs text-emerald-600 font-medium">0 Clean</span>
                        ) : (
                          <div className="text-xs font-semibold text-rose-600">
                            {bounced > 0 && <span>{bounced} Bounced </span>}
                            {failed > 0 && <span>{failed} Failed</span>}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/campaigns/${c.campaignId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          View Logs →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
