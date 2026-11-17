"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileSignature,
  LayoutDashboard,
  Files,
  Send,
  HardDrive,
  FileEdit,
  Settings,
  LogOut,
  Bell,
  CheckCheck,
  Building2,
  Plus,
  ChevronDown,
  Sparkles,
  Shield,
  ExternalLink,
} from "lucide-react";

interface NotificationEvent {
  id: string;
  action: string;
  details: string;
  seenByAdmin: boolean;
  createdAt: string;
  request: { id: string; title: string };
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

interface AppShellProps {
  user: {
    name: string;
    email: string;
    role: string;
    title: string;
    activeOrg?: { id: string; name: string; plan: string } | null;
    organizations?: OrgSummary[];
  };
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [unread, setUnread] = useState(0);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setUnread(0);
    setEvents((prev) => prev.map((e) => ({ ...e, seenByAdmin: true })));
  }

  async function switchOrg(orgId: string) {
    setOrgOpen(false);
    await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", organizationId: orgId }),
    });
    router.refresh();
  }

  async function createNewOrg() {
    const name = prompt("Enter New Organization / Company Name:");
    if (!name || !name.trim()) return;
    setOrgOpen(false);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: name.trim() }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  const navItems = [
    { href: "/dashboard", label: "Agreements", icon: LayoutDashboard },
    { href: "/templates", label: "Templates", icon: Files },
    { href: "/requests/new", label: "Send", icon: Send },
    { href: "/drive", label: "Cloud Drive", icon: HardDrive },
    { href: "/editor", label: "PDF Editor", icon: FileEdit },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Get user avatar initials
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "US";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 antialiased font-sans">
      {/* Top Navbar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand + Workspace Switcher */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-800 flex items-center justify-center shadow-sm shadow-indigo-900/20 group-hover:scale-105 transition-transform">
                <FileSignature className="w-5 h-5 text-indigo-200" />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                  Standard <span className="text-indigo-600 font-black">e-Sign</span>
                </div>
                <div className="text-[10px] text-slate-600 font-semibold tracking-wide">
                  Enterprise Platform
                </div>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Workspace Switcher */}
            {user.activeOrg && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOrgOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-slate-100/90 hover:border-slate-300 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                    {user.activeOrg.name[0]?.toUpperCase() || "O"}
                  </div>
                  <span className="max-w-[130px] truncate text-slate-800 font-semibold">
                    {user.activeOrg.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                </button>

                {orgOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Organizations &amp; Workspaces
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 font-semibold text-slate-600">
                        {user.organizations?.length || 1}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto p-1.5">
                      {(user.organizations || []).map((org) => {
                        const isCurrent = org.id === user.activeOrg?.id;
                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => switchOrg(org.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                              isCurrent
                                ? "bg-indigo-50/90 font-bold text-indigo-900 border border-indigo-100"
                                : "text-slate-700 hover:bg-slate-50 font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                  isCurrent
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {org.name[0]?.toUpperCase()}
                              </div>
                              <span className="truncate">{org.name}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-600 px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60">
                              {org.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-1.5 bg-slate-50 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={createNewOrg}
                        className="w-full px-3 py-2 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 text-xs font-semibold text-indigo-700 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Workspace
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Super Admin Command Center Pill */}
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/admin"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  pathname.startsWith("/admin")
                    ? "bg-slate-950 text-amber-300 border border-amber-400/40 shadow-xs"
                    : "bg-slate-900 hover:bg-slate-950 text-amber-300 border border-slate-800"
                }`}
                title="Super Admin Platform Command Center"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Command Center</span>
                <span className="md:hidden">Admin</span>
              </Link>
            )}
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard" ||
                    (pathname.startsWith("/requests/") &&
                      pathname !== "/requests/new")
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-slate-950 shadow-xs border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-indigo-600" : "text-slate-600"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Notifications & User Profile */}
          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-100/80 text-slate-700 transition cursor-pointer"
                title="Activity Alerts"
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Recent Activity &amp; Signatures
                    </span>
                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {events.length === 0 ? (
                      <div className="p-6 text-xs text-slate-600 text-center">
                        No activity yet. Signed contracts &amp; opens appear here.
                      </div>
                    ) : (
                      events.map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/requests/${ev.request.id}`}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 hover:bg-slate-50 transition ${
                            !ev.seenByAdmin ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="font-bold text-indigo-700">
                              {ev.action}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(ev.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {ev.request.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ev.details}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar & Details */}
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-900 to-indigo-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-600 font-medium leading-none mt-0.5">
                  {user.title}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Bar */}
        <div className="lg:hidden border-t border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto bg-slate-50/90">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-white bg-white/60 border border-slate-200/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
