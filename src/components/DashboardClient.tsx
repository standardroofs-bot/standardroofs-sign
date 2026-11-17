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
  PenTool,
  Search,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  X,
  Filter,
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

export default function DashboardClient({
  requests: initialRequests,
  templateCount,
}: DashboardClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<DashboardRequestItem[]>(initialRequests);
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showQuickstart, setShowQuickstart] = useState<boolean>(true);

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
    if (!confirm(`Delete agreement "${title}" permanently?`)) return;
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
      "Project / Reference",
      "Category",
      "Status",
      "Signers Breakdown",
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
    a.download = `standard-esign-agreements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingCount = requests.filter(
    (r) => r.status === "PENDING" || r.status === "PARTIAL"
  ).length;
  const completedCount = requests.filter((r) => r.status === "COMPLETED").length;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Executive SaaS Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Legally Binding • Section 65B Compliant
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Documents &amp; Signatures
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Send, track, and execute court-admissible contracts with biometric selfies, doorstep GPS geocoding, and tamper-evident SHA-256 seals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/templates"
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold transition shadow-2xs flex items-center gap-2"
          >
            <Files className="w-4 h-4 text-slate-500" />
            <span>Templates Library</span>
          </Link>
          <Link
            href="/requests/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Send for Signature</span>
          </Link>
        </div>
      </div>

      {/* Modern Collapsible Quickstart Guide */}
      {showQuickstart && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-lg border border-slate-800 relative overflow-hidden transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Quickstart 3-Step Execution Workflow
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickstart(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Dismiss quickstart"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            <Link
              href="/templates"
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs mb-2">
                1
              </div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-200 flex items-center gap-1.5">
                Upload Agreement
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Upload any PDF contract, quotation, NDA, or work order file.
              </p>
            </Link>

            <Link
              href="/templates"
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs mb-2">
                2
              </div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-200 flex items-center gap-1.5">
                Place Signature Boxes
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Drag signature, initial, date, and Sign-on-Selfie proof boxes.
              </p>
            </Link>

            <Link
              href="/requests/new"
              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs mb-2">
                3
              </div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-200 flex items-center gap-1.5">
                Send via WhatsApp &amp; Email
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Dispatch instantly via WhatsApp deep links or automated cloud API.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* World-Class Bento-Grid Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Agreements */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Agreements
            </span>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200/60 text-slate-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {requests.length}
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-1">
              Active agreement records
            </div>
          </div>
        </div>

        {/* Card 2: Awaiting Signature */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Awaiting Signature
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-amber-700 tracking-tight">
              {pendingCount}
            </div>
            <div className="text-xs font-semibold text-amber-800/80 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Pending counter-sign
            </div>
          </div>
        </div>

        {/* Card 3: Executed & Sealed */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Executed &amp; Sealed
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-700 tracking-tight">
              {completedCount}
            </div>
            <div className="text-xs font-semibold text-emerald-800/80 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Section 65B Audit Trail
            </div>
          </div>
        </div>

        {/* Card 4: Contract Templates */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Contract Templates
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-700 flex items-center justify-center">
              <Files className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {templateCount}
            </div>
            <div className="text-xs font-semibold text-indigo-600 mt-1">
              Reusable contract forms
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Search, Status & Category Filters */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 space-y-4 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agreement, signer name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition shadow-2xs"
              />
            </div>

            {/* Status Filter & Export Button */}
            <div className="flex items-center gap-2.5">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
            <button
              type="button"
              onClick={() => setFilterCat("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                filterCat === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Agreements ({requests.length})
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterCat(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                  filterCat === key
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {requests.length === 0
                ? "No agreements in this workspace"
                : "No matching documents found"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {requests.length === 0
                ? "Upload a document template or start your first signature request to begin collecting legally binding signatures."
                : "Try selecting All Categories or clearing your search and status filter."}
            </p>
            {requests.length === 0 && (
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  href="/requests/new"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition"
                >
                  Send First Agreement
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Document / Reference</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Signers &amp; Audit Status</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition group">
                    {/* Title & Project */}
                    <td className="py-4 px-5">
                      <Link
                        href={`/requests/${req.id}`}
                        className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition flex items-center gap-1.5"
                      >
                        <span>{req.title}</span>
                      </Link>
                      {req.projectName && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Ref: {req.projectName}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-600">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {CATEGORY_LABELS[req.category as DocumentCategory] || req.category}
                      </span>
                    </td>

                    {/* Signers Status */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {req.signers.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                              s.status === "SIGNED"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                                : s.status === "VIEWED"
                                ? "bg-blue-50 text-blue-800 border-blue-200/80"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {s.status === "SIGNED" && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {s.status === "VIEWED" && (
                              <Clock className="w-3 h-3 text-blue-600" />
                            )}
                            <span>{s.name}</span>
                            <span className="text-[10px] opacity-70">
                              ({s.status === "VIEWED" ? "OPENED" : s.status})
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Overall Status */}
                    <td className="py-4 px-4">
                      {req.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Completed
                        </span>
                      ) : req.status === "PARTIAL" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Partially Signed
                        </span>
                      ) : req.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Signature
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {req.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {(() => {
                          const nextActive = req.signers.find(
                            (s) => s.status === "PENDING" || s.status === "VIEWED"
                          );
                          return nextActive && req.status !== "VOIDED" ? (
                            <Link
                              href={`/s/${nextActive.token}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
                              title={`Sign as ${nextActive.name} (${nextActive.role})`}
                            >
                              <PenTool className="w-3.5 h-3.5 text-indigo-300" />
                              <span>Sign Now</span>
                            </Link>
                          ) : null;
                        })()}

                        {req.hasSignedPdf && (
                          <a
                            href={`/api/requests/${req.id}/pdf?variant=signed&download=1`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                            title="Download Signed PDF + Section 65B Certificate"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Signed PDF</span>
                          </a>
                        )}

                        <Link
                          href={`/requests/${req.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold transition shadow-2xs"
                        >
                          <span>Manage</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id, req.title)}
                          title="Delete agreement record"
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
