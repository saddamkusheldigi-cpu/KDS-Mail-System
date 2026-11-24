"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mail,
  Send,
  PlusCircle,
  ShieldAlert,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  ExternalLink,
  Server,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Inboxes & Senders", href: "/senders", icon: Server },
  { name: "Campaigns", href: "/campaigns", icon: Mail },
  { name: "New Campaign", href: "/campaigns/new", icon: PlusCircle },
  { name: "Suppression List", href: "/suppression", icon: ShieldAlert },
  { name: "Warm-Up & Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">InboxMailer</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-indigo-600">AWS Serverless</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Reputation Badge */}
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>SES Status: Active</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700">
              ap-south-1 • Pacing: 1 / 35s
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="text-sm font-medium text-slate-500">
            Infrastructure: <span className="font-semibold text-slate-800">AWS SQS + Lambda + SES</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Worker Concurrency: 1</span>
            </div>

            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Create Campaign
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
