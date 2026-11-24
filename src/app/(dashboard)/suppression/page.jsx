"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Search,
  PlusCircle,
  RefreshCw,
  UserX,
  AlertTriangle,
  FileDown,
} from "lucide-react";

export default function SuppressionListPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Manual Add Form
  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("MANUAL");
  const [newDetails, setNewDetails] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  async function fetchSuppression() {
    setLoading(true);
    try {
      const res = await fetch("/api/suppression");
      const data = await res.json();
      if (data.success) {
        setList(data.suppressionList || []);
      }
    } catch (err) {
      console.error("Failed to fetch suppression list:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuppression();
  }, []);

  async function handleAddSuppression(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsAdding(true);
    setFormMsg("");

    try {
      const res = await fetch("/api/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          reason: newReason,
          details: newDetails.trim() || "Manual block via admin dashboard",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormMsg("Email successfully added to suppression list.");
        setNewEmail("");
        setNewDetails("");
        fetchSuppression();
      } else {
        setFormMsg(data.error || "Failed to add email");
      }
    } catch (err) {
      setFormMsg(err.message || "Network error");
    } finally {
      setIsAdding(false);
    }
  }

  const filteredList = list.filter((item) =>
    item.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Global Suppression List
        </h1>
        <p className="text-sm text-slate-500">
          Emails stored here are automatically skipped across all current and future campaigns.
        </p>
      </div>

      {/* Add to suppression form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-indigo-600" />
          Manually Block / Suppress an Email
        </h2>

        <form onSubmit={handleAddSuppression} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <input
              type="email"
              required
              placeholder="recipient@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="MANUAL">Manual Block</option>
              <option value="UNSUBSCRIBE">Unsubscribed</option>
              <option value="BOUNCE">Hard Bounce</option>
              <option value="COMPLAINT">Spam Complaint</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={isAdding}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm"
            >
              {isAdding ? "Adding..." : "Add to Blocklist"}
            </button>
          </div>
        </form>

        {formMsg && (
          <p className="mt-2 text-xs font-medium text-indigo-600">{formMsg}</p>
        )}
      </div>

      {/* Suppression List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search blocked emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              Total Blocked: {list.length}
            </span>
            <button
              onClick={fetchSuppression}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase text-[10px] tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Blocked Email</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Details / Source</th>
                <th className="px-6 py-3">Added Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No suppressed emails found
                  </td>
                </tr>
              ) : (
                filteredList.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 font-mono font-semibold text-slate-900">
                      {item.email}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.reason === "BOUNCE"
                            ? "bg-rose-50 text-rose-700"
                            : item.reason === "COMPLAINT"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.reason}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 max-w-sm truncate">
                      {item.details || item.source || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
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
