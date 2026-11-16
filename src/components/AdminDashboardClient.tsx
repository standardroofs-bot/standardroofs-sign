"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Building2,
  Users,
  FileCheck2,
  HardDrive,
  IndianRupee,
  Search,
  Sliders,
  CheckCircle2,
  XCircle,
  Database,
  Lock,
  ExternalLink,
  Trash2,
  RefreshCw,
  Edit3,
  Server,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  accountType: string;
  status: string;
  planTier: string;
  monthlyDocLimit: number;
  docsSentThisMonth: number;
  storageUsedBytes: string;
  storageLimitBytes: string;
  isEnterpriseDedicated: boolean;
  customDatabaseUrl: string;
  customStorageBucket: string;
  adminNotes: string;
  totalRequests: number;
  totalTemplates: number;
  memberCount: number;
  owner: { name: string; email: string } | null;
  createdAt: string;
}

interface AdminDashboardProps {
  initialMetrics: {
    totalOrganizations: number;
    activeOrganizations: number;
    totalUsers: number;
    totalRequests: number;
    completedRequests: number;
    totalStorageBytes: string;
    estimatedMRR: number;
    tierCount: { FREE: number; PRO: number; ENTERPRISE: number };
  };
  initialOrganizations: AdminOrg[];
}

export default function AdminDashboardClient({
  initialMetrics,
  initialOrganizations,
}: AdminDashboardProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [organizations, setOrganizations] = useState<AdminOrg[]>(initialOrganizations);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modal State
  const [selectedOrg, setSelectedOrg] = useState<AdminOrg | null>(null);
  const [modalTab, setModalTab] = useState<"plan" | "dedicated" | "notes">("plan");
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Edit fields
  const [editPlan, setEditPlan] = useState("FREE");
  const [editDocLimit, setEditDocLimit] = useState(10);
  const [editStorageLimitGb, setEditStorageLimitGb] = useState(1);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editIsDedicated, setEditIsDedicated] = useState(false);
  const [editDbUrl, setEditDbUrl] = useState("");
  const [editBucket, setEditBucket] = useState("");
  const [editNotes, setEditNotes] = useState("");

  function openManageModal(org: AdminOrg) {
    setSelectedOrg(org);
    setEditPlan(org.planTier || "FREE");
    setEditDocLimit(org.monthlyDocLimit);
    const limitGb = Math.round(Number(org.storageLimitBytes) / (1024 * 1024 * 1024));
    setEditStorageLimitGb(limitGb || 1);
    setEditStatus(org.status || "ACTIVE");
    setEditIsDedicated(Boolean(org.isEnterpriseDedicated));
    setEditDbUrl(org.customDatabaseUrl || "");
    setEditBucket(org.customStorageBucket || "");
    setEditNotes(org.adminNotes || "");
    setFeedback("");
    setModalTab("plan");
  }

  function formatBytes(bytesStr: string) {
    const bytes = Number(bytesStr);
    if (bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase()) ||
      (org.owner?.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesTier = filterTier === "ALL" || org.planTier.toUpperCase() === filterTier;
    const matchesStatus = filterStatus === "ALL" || org.status === filterStatus;
    return matchesSearch && matchesTier && matchesStatus;
  });

  async function handleSavePlan() {
    if (!selectedOrg) return;
    setUpdating(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_plan",
          organizationId: selectedOrg.id,
          planTier: editPlan,
          monthlyDocLimit: editDocLimit,
          storageLimitBytes: (BigInt(editStorageLimitGb) * BigInt(1024 * 1024 * 1024)).toString(),
        }),
      });
      if (res.ok) {
        setOrganizations((prev) =>
          prev.map((o) =>
            o.id === selectedOrg.id
              ? {
                  ...o,
                  planTier: editPlan,
                  monthlyDocLimit: editDocLimit,
                  storageLimitBytes: (
                    BigInt(editStorageLimitGb) * BigInt(1024 * 1024 * 1024)
                  ).toString(),
                }
              : o
          )
        );
        setFeedback("Plan tier and quotas updated successfully.");
        setTimeout(() => setSelectedOrg(null), 1200);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleToggleStatus() {
    if (!selectedOrg) return;
    const nextStatus = editStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUpdating(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          organizationId: selectedOrg.id,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        setEditStatus(nextStatus);
        setOrganizations((prev) =>
          prev.map((o) => (o.id === selectedOrg.id ? { ...o, status: nextStatus } : o))
        );
        setFeedback(`Account marked as ${nextStatus}.`);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveDedicated() {
    if (!selectedOrg) return;
    setUpdating(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_dedicated",
          organizationId: selectedOrg.id,
          isEnterpriseDedicated: editIsDedicated,
          customDatabaseUrl: editDbUrl,
          customStorageBucket: editBucket,
        }),
      });
      if (res.ok) {
        setOrganizations((prev) =>
          prev.map((o) =>
            o.id === selectedOrg.id
              ? {
                  ...o,
                  isEnterpriseDedicated: editIsDedicated,
                  customDatabaseUrl: editDbUrl,
                  customStorageBucket: editBucket,
                }
              : o
          )
        );
        setFeedback("Dedicated database & storage routing saved.");
        setTimeout(() => setSelectedOrg(null), 1200);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveNotes() {
    if (!selectedOrg) return;
    setUpdating(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_notes",
          organizationId: selectedOrg.id,
          adminNotes: editNotes,
        }),
      });
      if (res.ok) {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === selectedOrg.id ? { ...o, adminNotes: editNotes } : o))
        );
        setFeedback("Internal notes saved.");
        setTimeout(() => setSelectedOrg(null), 1200);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleResetUsage(orgId: string) {
    if (!confirm("Reset this customer's monthly document usage counter to 0?")) return;
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_usage", organizationId: orgId }),
    });
    if (res.ok) {
      setOrganizations((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, docsSentThisMonth: 0 } : o))
      );
      if (selectedOrg && selectedOrg.id === orgId) {
        setSelectedOrg({ ...selectedOrg, docsSentThisMonth: 0 });
      }
    }
  }

  async function handleDeleteOrg(orgId: string, orgName: string) {
    if (
      !confirm(
        `Are you sure you want to permanently delete customer "${orgName}" and all their documents? This action CANNOT be undone.`
      )
    )
      return;

    const res = await fetch(`/api/admin?id=${orgId}`, { method: "DELETE" });
    if (res.ok) {
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
      setSelectedOrg(null);
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete organization");
    }
  }

  return (
    <div className="space-y-8">
      {/* Super Admin Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-slate-700">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Platform Owner &amp; Super Admin Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Customer Fleet &amp; SaaS Revenue Command Center
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Monitor all onboarded client companies, govern multi-tenant workspaces, inspect private database silos, and manage customer subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition"
          >
            <Building2 className="w-4 h-4 text-slate-300" />
            Return to Workspace
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {metrics.totalOrganizations}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Total Customer Workspaces
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {metrics.activeOrganizations} Active Tenants
            </div>
          </div>
        </div>

        {/* Estimated MRR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              ₹{metrics.estimatedMRR.toLocaleString("en-IN")}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Monthly Recurring Revenue (MRR)
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              {metrics.tierCount.PRO} Pro • {metrics.tierCount.ENTERPRISE} Enterprise
            </div>
          </div>
        </div>

        {/* Total Documents Executed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {metrics.totalRequests}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Total Platform Documents
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {metrics.completedRequests} Fully Signed &amp; Sealed
            </div>
          </div>
        </div>

        {/* Total Storage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatBytes(metrics.totalStorageBytes)}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Total Cloud Storage Used
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {metrics.totalUsers} registered users
            </div>
          </div>
        </div>
      </div>

      {/* Customer Organizations Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Customer Organizations ({filteredOrgs.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              View and govern all company accounts, plans, document quotas, and dedicated database routing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search company or owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
              />
            </div>

            {/* Plan Tier Filter */}
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Plans</option>
              <option value="FREE">Starter Free</option>
              <option value="PRO">Business Pro (₹1,499)</option>
              <option value="ENTERPRISE">Enterprise (₹4,999)</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Organization / Company</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Docs Sent (Month)</th>
                <th className="py-3 px-4">Storage Consumed</th>
                <th className="py-3 px-4">Isolation Silo</th>
                <th className="py-3 px-4">Owner &amp; Members</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrgs.map((org) => {
                const usedBytes = Number(org.storageUsedBytes);
                const limitBytes = Number(org.storageLimitBytes);
                const storagePercent = Math.min(
                  100,
                  Math.round((usedBytes / (limitBytes || 1)) * 100)
                );

                return (
                  <tr key={org.id} className="hover:bg-slate-50/80 transition">
                    {/* Organization Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{org.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        slug: /{org.slug}
                      </div>
                    </td>

                    {/* Plan Tier Badge */}
                    <td className="py-3.5 px-4">
                      {org.planTier === "ENTERPRISE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px] uppercase">
                          <Sparkles className="w-3 h-3" />
                          Enterprise 1TB
                        </span>
                      ) : org.planTier === "PRO" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px] uppercase">
                          Business Pro
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px]">
                          Starter Free
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {org.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Suspended
                        </span>
                      )}
                    </td>

                    {/* Docs Sent (Quota) */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {org.docsSentThisMonth}{" "}
                        <span className="text-slate-400 font-normal">
                          / {org.monthlyDocLimit === -1 ? "∞ Unlimited" : org.monthlyDocLimit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {org.totalRequests} lifetime docs
                      </div>
                    </td>

                    {/* Storage */}
                    <td className="py-3.5 px-4 min-w-[130px]">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-medium text-slate-700">
                        <span>{formatBytes(org.storageUsedBytes)}</span>
                        <span className="text-slate-400">{storagePercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            storagePercent > 80 ? "bg-amber-500" : "bg-indigo-600"
                          }`}
                          style={{ width: `${storagePercent}%` }}
                        />
                      </div>
                    </td>

                    {/* Isolation Silo */}
                    <td className="py-3.5 px-4">
                      {org.isEnterpriseDedicated ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                          <Database className="w-3 h-3 text-amber-600" />
                          Private DB Silo
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                          <Server className="w-3 h-3 text-slate-400" />
                          Multi-Tenant Cloud
                        </div>
                      )}
                    </td>

                    {/* Owner & Members */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {org.owner ? org.owner.name : "Unclaimed"}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {org.owner?.email}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {org.memberCount} team members
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openManageModal(org)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 font-semibold text-xs text-slate-700 transition cursor-pointer"
                      >
                        Manage Tenant
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrgs.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-xs">
              No customer organizations matched your search filter.
            </div>
          )}
        </div>
      </div>

      {/* Customer Governance Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  Tenant Governance
                </div>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  {selectedOrg.name}
                </h3>
                <div className="text-xs text-slate-400 font-mono">
                  ID: {selectedOrg.id} • Slug: /{selectedOrg.slug}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab("plan")}
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition ${
                  modalTab === "plan"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Plan &amp; Quotas
              </button>
              <button
                type="button"
                onClick={() => setModalTab("dedicated")}
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition ${
                  modalTab === "dedicated"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Private DB &amp; Storage Silo
              </button>
              <button
                type="button"
                onClick={() => setModalTab("notes")}
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition ${
                  modalTab === "notes"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Admin Notes &amp; Actions
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {feedback && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  {feedback}
                </div>
              )}

              {/* TAB 1: PLAN & QUOTAS */}
              {modalTab === "plan" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Subscription Plan Tier
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["FREE", "PRO", "ENTERPRISE"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setEditPlan(t);
                            if (t === "FREE") {
                              setEditDocLimit(10);
                              setEditStorageLimitGb(1);
                            } else if (t === "PRO") {
                              setEditDocLimit(-1);
                              setEditStorageLimitGb(100);
                            } else if (t === "ENTERPRISE") {
                              setEditDocLimit(-1);
                              setEditStorageLimitGb(1024);
                            }
                          }}
                          className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                            editPlan === t
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          {t === "FREE" && "Starter Free"}
                          {t === "PRO" && "Business Pro"}
                          {t === "ENTERPRISE" && "Enterprise 1TB"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Monthly Document Limit
                      </label>
                      <input
                        type="number"
                        value={editDocLimit}
                        onChange={(e) => setEditDocLimit(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                      <span className="text-[10px] text-slate-400">
                        Set -1 for Unlimited documents
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Storage Limit (in GB)
                      </label>
                      <input
                        type="number"
                        value={editStorageLimitGb}
                        onChange={(e) => setEditStorageLimitGb(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                      <span className="text-[10px] text-slate-400">
                        1 GB (Free) • 100 GB (Pro) • 1024 GB (Enterprise)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">Account Access Status</div>
                      <div className="text-[11px] text-slate-500">
                        Currently: <strong>{editStatus}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleToggleStatus}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                        editStatus === "ACTIVE"
                          ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {editStatus === "ACTIVE" ? "Suspend Account" : "Activate Account"}
                    </button>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleSavePlan}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition"
                    >
                      {updating ? "Saving..." : "Apply Plan Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DEDICATED PRIVATE DATABASE & STORAGE */}
              {modalTab === "dedicated" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-amber-700" />
                      Enterprise Isolated Data Silo Architecture
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      For corporate clients with stringent data localization mandates (law firms, defense contractors, banks), you can attach a dedicated private PostgreSQL connection URL or private Cloudflare R2 bucket specifically for this organization.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsDedicated}
                      onChange={(e) => setEditIsDedicated(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Enable Dedicated Private Database / Bucket Silo for this Customer
                  </label>

                  {editIsDedicated && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Custom PostgreSQL Database URL (Private Tenant Silo)
                        </label>
                        <input
                          type="text"
                          placeholder="postgresql://user:pass@ep-isolated.neon.tech/tenant_db?sslmode=require"
                          value={editDbUrl}
                          onChange={(e) => setEditDbUrl(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]"
                        />
                        <span className="text-[10px] text-slate-400">
                          Leave empty to use shared multi-tenant cluster with row-level isolation.
                        </span>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Dedicated S3 / R2 Storage Bucket
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. apex-logistics-contracts"
                          value={editBucket}
                          onChange={(e) => setEditBucket(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]"
                        />
                        <span className="text-[10px] text-slate-400">
                          Dedicated bucket name for storing customer PDFs.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleSaveDedicated}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition"
                    >
                      {updating ? "Saving..." : "Save Silo Configuration"}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ADMIN NOTES & EMERGENCY ACTIONS */}
              {modalTab === "notes" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Internal Super Admin Notes (Private)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="e.g. Paid annual invoice via NEFT #91823. Special contract signed with Managing Partner."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleSaveNotes}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer transition"
                    >
                      Save Notes
                    </button>
                  </div>

                  <hr className="border-slate-200 my-4" />

                  {/* Danger Zone */}
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-700" />
                      Tenant Controls &amp; Danger Zone
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">
                          Reset Monthly Document Usage
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Resets documents sent this month back to 0.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetUsage(selectedOrg.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-semibold cursor-pointer"
                      >
                        Reset to 0
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-rose-200/60">
                      <div>
                        <div className="font-semibold text-rose-900">
                          Delete Customer Workspace
                        </div>
                        <div className="text-[10px] text-rose-700">
                          Permanently deletes organization and all its signature data.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrg(selectedOrg.id, selectedOrg.name)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                      >
                        Delete Workspace
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
