"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  Files,
  ExternalLink,
  Download,
  Infinity as InfinityIcon,
  PenTool,
  Search,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { CATEGORY_LABELS, type DocumentCategory } from "@/lib/types";

export interface DashboardRequestItem {
  id: string;
  title: string;
  projectName: string;
  category: string;
  status: string;
  hasSignedPdf?: boolean;
  createdAt: string;
  completedAt: string | null;
  signers: {
    id: string;
    role: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    token: string;
  }[];
}

interface DashboardClientProps {
  requests: DashboardRequestItem[];
  templateCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  PARTIAL: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  VOIDED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function DashboardClient({
  requests: initialRequests,
  templateCount,
}: DashboardClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<DashboardRequestItem[]>(initialRequests);
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Auto-poll in background every 4s to keep requests and status counters fresh without manual reload
  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/requests", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (json.requests && isMounted) {
          setRequests(
            json.requests.map((r: any) => ({
              id: r.id,
              title: r.title,
              projectName: r.projectName,
              category: r.category,
              status: r.status,
              hasSignedPdf: Boolean(r.signedPdfPath),
              createdAt: new Date(r.createdAt).toISOString(),
              completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
              signers: (r.signers || []).map((s: any) => ({
                id: s.id,
                role: s.role,
                name: s.name,
                email: s.email,
                phone: s.phone,
                status: s.status,
                token: s.token,
              })),
            }))
          );
        }
      } catch {}
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  async function handleDeleteRequest(id: string, title: string) {
    if (!confirm(`Delete "${title}" permanently?`)) return;
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    }
  }

  const filtered = requests.filter((r) => {
    if (filterCat !== "ALL" && r.category !== filterCat) return false;
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const inTitle = r.title.toLowerCase().includes(q);
      const inProject = r.projectName.toLowerCase().includes(q);
      const inSigners = r.signers.some(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q)
      );
      if (!inTitle && !inProject && !inSigners) return false;
    }
    return true;
  });

  function exportCsv() {
    const headers = [
      "Request ID",
      "Document Title",
      "Project / Site",
      "Category",
      "Status",
      "Recipients",
      "Created At",
      "Completed At",
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.title,
      r.projectName || "",
      CATEGORY_LABELS[r.category as DocumentCategory] || r.category,
      r.status,
      r.signers
        .map(
          (s) =>
            `${s.name} (${s.role}: ${s.status}${s.phone ? ` | ${s.phone}` : ""}${s.email ? ` | ${s.email}` : ""})`
        )
        .join("; "),
      new Date(r.createdAt).toLocaleString(),
      r.completedAt ? new Date(r.completedAt).toLocaleString() : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `standardroofs-sign-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingCount = requests.filter(
    (r) => r.status === "PENDING" || r.status === "PARTIAL"
  ).length;
  const completedCount = requests.filter((r) => r.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-900 border border-red-200 text-xs font-semibold mb-2">
            <InfinityIcon className="w-3.5 h-3.5" />
            Unlimited Submissions • Standard Roofs Sign
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Document Records &amp; Submissions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track every document sent, who opened or signed it, and download signed proof copies.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/templates"
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
          >
            Documents / Templates
          </Link>
          <Link
            href="/requests/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-800 hover:bg-red-900 text-white text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Send Document
          </Link>
        </div>
      </div>

      {/* 3-Step Quickstart Workflow Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
              Commercial e-Sign Quickstart (3 Steps)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Ready in under 2 minutes</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          <Link
            href="/templates"
            className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
          >
            <div className="text-xs font-bold text-red-400">Step 1</div>
            <div className="text-sm font-bold text-white mt-0.5 group-hover:text-red-300">
              Upload Document →
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Upload any PDF, Word (.docx), or Excel (.xlsx) file.
            </div>
          </Link>

          <Link
            href="/templates"
            className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
          >
            <div className="text-xs font-bold text-blue-400">Step 2</div>
            <div className="text-sm font-bold text-white mt-0.5 group-hover:text-blue-300">
              Tag Fields &amp; Proof →
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Drag signature, initials, date, and Sign-on-Selfie proof boxes.
            </div>
          </Link>

          <Link
            href="/requests/new"
            className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
          >
            <div className="text-xs font-bold text-emerald-400">Step 3</div>
            <div className="text-sm font-bold text-white mt-0.5 group-hover:text-emerald-300">
              Send via WhatsApp &amp; SMS →
            </div>
            <div className="text-xs text-slate-400 mt-1">
              1-click direct link or automated background dispatch.
            </div>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Requests</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {requests.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">No monthly cap</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Awaiting Signature</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {pendingCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Pending / In Progress</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Signed &amp; Sealed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {completedCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">With SHA-256 certificate</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>PDF Templates</span>
            <Files className="w-4 h-4 text-orange-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {templateCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Reusable roofing forms</div>
        </div>
      </div>

      {/* Search, Status & Export Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by person name, phone, email, or document..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partially Signed</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCat("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
            filterCat === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Categories ({requests.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
              filterCat === key
                ? "bg-red-800 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="text-center py-14 px-4">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800">
              {requests.length === 0
                ? "No signature requests yet"
                : "No matching documents in this filter"}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {requests.length === 0
                ? "Upload a PDF, Word, or Excel document to start collecting signatures."
                : "Try selecting All Categories or clearing your search/status filter."}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/templates"
                className="px-4 py-2 rounded-xl bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800"
              >
                Create First Template
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Document / Project</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Signers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/requests/${req.id}`}
                        className="font-semibold text-slate-900 hover:text-orange-700"
                      >
                        {req.title}
                      </Link>
                      {req.projectName && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Project: {req.projectName}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {CATEGORY_LABELS[req.category as DocumentCategory] ||
                        req.category}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {req.signers.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${
                              s.status === "SIGNED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : s.status === "VIEWED"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {s.name}
                            <span className="text-[10px] opacity-75">
                              ({s.status === "VIEWED" ? "OPENED" : s.status})
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          STATUS_BADGE[req.status] || STATUS_BADGE.PENDING
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {(() => {
                          const nextActive = req.signers.find(
                            (s) => s.status === "PENDING" || s.status === "VIEWED"
                          );
                          return nextActive && req.status !== "VOIDED" ? (
                            <Link
                              href={`/s/${nextActive.token}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs font-semibold"
                              title={`Sign as ${nextActive.name} (${nextActive.role})`}
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              Sign Now
                            </Link>
                          ) : null;
                        })()}
                        {req.hasSignedPdf && (
                          <a
                            href={`/api/requests/${req.id}/pdf?variant=signed&download=1`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Signed PDF
                          </a>
                        )}
                        <Link
                          href={`/requests/${req.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                        >
                          <span>Manage</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id, req.title)}
                          title="Delete document record"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

