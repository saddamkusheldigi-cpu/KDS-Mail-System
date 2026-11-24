"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Server,
  RefreshCw,
} from "lucide-react";
import { WARM_UP_TIERS } from "@/lib/constants";

export default function SettingsPage() {
  const [stats, setStats] = useState(null);
  const [newLimit, setNewLimit] = useState("1350");
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data);
        if (data.warmUp?.dailyLimit) {
          setNewLimit(String(data.warmUp.dailyLimit));
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings stats:", err);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  async function handleUpdateLimit(e) {
    e.preventDefault();
    setIsUpdating(true);
    setStatusMsg("");

    try {
      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit: Number(newLimit) }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("Daily limit updated successfully!");
        fetchStats();
      } else {
        setStatusMsg(data.error || "Update failed");
      }
    } catch (err) {
      setStatusMsg(err.message || "Failed to update");
    } finally {
      setIsUpdating(false);
    }
  }

  const warmUp = stats?.warmUp || { sentCount: 0, dailyLimit: 1350 };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Domain Warm-Up & Infrastructure Settings
        </h1>
        <p className="text-sm text-slate-500">
          Manage sending caps to protect domain reputation and inspect AWS configuration.
        </p>
      </div>

      {/* Daily Cap Guardrail Manager */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Today&apos;s Sending Cap (Guardrail)
          </h2>
          <p className="text-xs text-slate-500">
            Once sent count reaches this cap, remaining emails are automatically deferred by the Lambda worker.
          </p>
        </div>

        <form onSubmit={handleUpdateLimit} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Daily Limit (Emails / 24h Window)
            </label>
            <input
              type="number"
              min="1"
              max="50000"
              required
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isUpdating ? "Saving..." : "Save Daily Limit"}
          </button>
        </form>

        {statusMsg && (
          <p className="text-xs font-medium text-emerald-600">{statusMsg}</p>
        )}

        <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Current Today Status: </span>
          {warmUp.sentCount} sent out of {warmUp.dailyLimit} allowed cap.
        </div>
      </div>

      {/* Cold Warm-Up Schedule Reference */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Recommended Warm-Up Schedule (90–95%+ Inbox Rate)
          </h2>
          <p className="text-xs text-slate-500">
            Following this ramp-up strictly prevents Gmail and Microsoft 365 spam filtering.
          </p>
        </div>

        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-700">
              <tr>
                <th className="px-4 py-2.5">Phase</th>
                <th className="px-4 py-2.5">Day Range</th>
                <th className="px-4 py-2.5">Recommended Daily Cap</th>
                <th className="px-4 py-2.5">Worker Delay</th>
                <th className="px-4 py-2.5">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold text-indigo-700">Phase 1</td>
                <td className="px-4 py-3">Day 1 – 2</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">100 emails/day</td>
                <td className="px-4 py-3">45 seconds</td>
                <td className="px-4 py-3 text-slate-500">Warmest opt-in contacts only</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-indigo-700">Phase 2</td>
                <td className="px-4 py-3">Day 3 – 4</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">250 emails/day</td>
                <td className="px-4 py-3">40 seconds</td>
                <td className="px-4 py-3 text-slate-500">Domain reputation initialization</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-indigo-700">Phase 3</td>
                <td className="px-4 py-3">Day 5 – 7</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">500 emails/day</td>
                <td className="px-4 py-3">35 seconds</td>
                <td className="px-4 py-3 text-slate-500">Engagement & open rate tracking</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-indigo-700">Phase 4</td>
                <td className="px-4 py-3">Day 8 – 10</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-900">1,000 emails/day</td>
                <td className="px-4 py-3">35 seconds</td>
                <td className="px-4 py-3 text-slate-500">Scaling volume ramp-up</td>
              </tr>
              <tr className="bg-indigo-50/40">
                <td className="px-4 py-3 font-semibold text-indigo-700">Phase 5 (Steady)</td>
                <td className="px-4 py-3">Day 11+</td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-900">1,350+ emails/day</td>
                <td className="px-4 py-3">30–35 seconds</td>
                <td className="px-4 py-3 text-indigo-800 font-medium">Target 40,000 emails/month capacity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* DNS & Compliance Checklist */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Deliverability & DNS Alignment Checklist
          </h2>
          <p className="text-xs text-slate-500">Verify these records in your DNS zone for 95%+ inbox rate.</p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">Easy-DKIM (3 CNAME Records)</span>
              <p className="text-slate-500">Generated in Amazon SES Console for yourdomain.com</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">Custom MAIL FROM Domain</span>
              <p className="text-slate-500">
                Subdomain: <code className="font-mono">mail.yourdomain.com</code> (MX: <code className="font-mono">10 feedback-smtp.ap-south-1.amazonses.com</code>)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">SPF TXT Record</span>
              <p className="text-slate-500"><code className="font-mono">v=spf1 include:amazonses.com ~all</code></p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-900">DMARC Policy TXT Record</span>
              <p className="text-slate-500">
                Host: <code className="font-mono">_dmarc.yourdomain.com</code> Value: <code className="font-mono">v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@yourdomain.com</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
