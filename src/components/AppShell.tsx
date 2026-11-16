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
    { href: "/dashboard", label: "Submissions", icon: LayoutDashboard },
    { href: "/templates", label: "Documents", icon: Files },
    { href: "/requests/new", label: "Send", icon: Send },
    { href: "/drive", label: "Drive", icon: HardDrive },
    { href: "/editor", label: "PDF Editor", icon: FileEdit },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="h-1 bg-red-800 w-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-800 flex items-center justify-center shadow-xs">
                <FileSignature className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="font-bold text-sm text-slate-900 tracking-tight">
                  Standard <span className="text-red-800">e-Sign</span>
                </div>
              </div>
            </Link>

            {/* Organization Switcher */}
            {user.activeOrg && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOrgOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-red-800" />
                  <span className="max-w-[130px] truncate">
                    {user.activeOrg.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {orgOpen && (
                  <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      Organizations
                    </div>
                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {(user.organizations || []).map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => switchOrg(org.id)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                            org.id === user.activeOrg?.id
                              ? "bg-red-50/50 font-bold text-red-900"
                              : "text-slate-700"
                          }`}
                        >
                          <span className="truncate">{org.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {org.role}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={createNewOrg}
                      className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-t border-slate-200 text-xs font-semibold text-red-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Organization
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Platform Super Admin Badge & Link */}
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/admin"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-500 text-slate-900 border border-amber-600 shadow-xs"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Super Admin</span>
              </Link>
            )}

            <nav className="hidden lg:flex items-center gap-1">
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
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      active
                        ? "bg-red-800 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                title="Document Activity Notifications"
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-700 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Activity &amp; Alerts
                    </span>
                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] font-semibold text-red-800 hover:underline cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {events.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        No activity yet. Opens &amp; signatures appear here.
                      </div>
                    ) : (
                      events.map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/requests/${ev.request.id}`}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-3.5 py-2.5 hover:bg-slate-50 ${
                            !ev.seenByAdmin ? "bg-red-50/40" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-red-800">
                              {ev.action}
                            </span>
                            <span className="text-slate-400">
                              {new Date(ev.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-800 truncate">
                            {ev.request.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {ev.details}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:block text-right pl-1">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-500">{user.title}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Nav */}
        <div className="lg:hidden border-t border-slate-200 px-3 py-1.5 flex items-center gap-1 overflow-x-auto bg-slate-50">
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  active ? "bg-red-800 text-white" : "text-slate-600"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
