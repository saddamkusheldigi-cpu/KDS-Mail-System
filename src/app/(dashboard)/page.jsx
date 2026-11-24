"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Inbox,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Server,
  Eye,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const [statsRes, campRes, sendersRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/campaigns"),
        fetch("/api/senders"),
      ]);
      const statsData = await statsRes.json();
      const campData = await campRes.json();
      const sendersData = await sendersRes.json();

      if (statsData.success) setStats(statsData);
      if (campData.success) setCampaigns(campData.campaigns || []);
      if (sendersData.success) setSenders(sendersData.senders || []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const warmUp = stats?.warmUp || {
    sentCount: 0,
    dailyLimit: 1350,
    remainingToday: 1350,
    percentageUsed: 0,
  };
  const agg = stats?.aggregate || {
    totalRecipients: 0,
    totalSent: 0,
    totalOpened: 0,
    totalFailed: 0,
    totalBounced: 0,
    inboxPlacementRate: 0,
    bounceRate: 0,
  };
  const queue = stats?.queue || { visible: 0, delayed: 0 };
  const activeSendersCount = senders.filter((s) => s.status === "ACTIVE").length;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Dispatch Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time deliverability tracking, sender inboxes health, and primary inbox placement analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            Refresh Data
          </button>

          <Link
            href="/senders"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Server className="h-4 w-4 text-indigo-600" />
            Manage Inboxes ({activeSendersCount})
          </Link>

          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Create Campaign
          </Link>
        </div>
      </div>

      {/* Main KPI Deliverability Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Emails Sent Successfully */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Dispatched (Success)
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {agg.totalSent}
            </span>
            <span className="text-xs text-slate-500">/ {agg.totalRecipients} total leads</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Successfully delivered across all campaigns
          </p>
        </div>

        {/* Card 2: Primary Inbox Placement / Confirmed Opens */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Primary Inbox (Opened)
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-700">
              {agg.totalOpened}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              ({agg.inboxPlacementRate}% open rate)
            </span>
          </div>
          <p className="mt-2 text-xs text-emerald-700 font-medium">
            ✓ Confirmed landed in user&apos;s main inbox
          </p>
        </div>

        {/* Card 3: Spam & Bounces */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Spam & Bounces
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-rose-600">
              {agg.totalBounced}
            </span>
            <span className="text-xs text-slate-500">({agg.bounceRate}% bounce rate)</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {agg.totalFailed > 0 ? `${agg.totalFailed} retryable failures` : "Protected by auto-suppression list"}
          </p>
        </div>

        {/* Card 4: Today's Warm-up Cap */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today&apos;s Sending Quota
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {warmUp.sentCount}
            </span>
            <span className="text-xs text-slate-500">/ {warmUp.dailyLimit} allowed today</span>
          </div>
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  warmUp.percentageUsed > 90 ? "bg-amber-500" : "bg-indigo-600"
                }`}
                style={{ width: `${Math.min(100, warmUp.percentageUsed)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{warmUp.remainingToday} remaining</span>
              <span>{queue.visible} queued</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Sender Inboxes Quick Preview Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Active Sending Inboxes (Where emails send from)</h2>
          </div>
          <Link href="/senders" className="text-xs font-semibold text-indigo-600 hover:underline">
            Manage / Add New Sender →
          </Link>
        </div>

        {senders.length === 0 ? (
          <div className="pt-4 text-center">
            <p className="text-xs text-slate-500">
              No custom inboxes connected yet. Using fallback sender from .env.
            </p>
            <Link
              href="/senders"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 underline"
            >
              + Connect Google Workspace, Outlook, or SES inboxes
            </Link>
          </div>
        ) : (
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {senders.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/75"
              >
                <div className="truncate pr-2">
                  <span className="block text-xs font-bold text-slate-800 truncate">{s.email}</span>
                  <span className="text-[10px] text-slate-500">
                    {s.sentToday || 0}/{s.dailyLimit} sent • {s.provider}
                  </span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    s.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  title={s.status}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaigns Table with Crystal Clear Deliverability Stats */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Campaigns Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed view of sent emails, inbox confirmations, and bounce rates per campaign
            </p>
          </div>

          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            View all campaigns
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No campaigns launched yet</h3>
            <p className="mt-1 text-xs text-slate-500">
              Upload your contacts CSV and launch your first email campaign.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <PlusCircle className="h-4 w-4" />
              Launch First Campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Campaign Name & Subject</th>
                  <th className="px-6 py-3.5">Sent From (Mailbox)</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Dispatched / Target</th>
                  <th className="px-6 py-3.5">Primary Inbox (Opened)</th>
                  <th className="px-6 py-3.5">Bounces / Issues</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.slice(0, 5).map((c) => {
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
                        <span className="text-xs text-slate-400 truncate block max-w-xs mt-0.5">
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
                        <div className="font-semibold text-slate-800">
                          {sent} / {total} sent
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.pendingCount > 0 ? `${c.pendingCount} pending` : "All dispatched"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
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
