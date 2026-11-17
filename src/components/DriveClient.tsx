"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HardDrive,
  Download,
  Search,
  FileText,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  Layers,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { formatBytes } from "@/lib/types";
import { PLANS, type PlanTier } from "@/lib/plans";

interface DriveFileItem {
  id: string;
  kind: "TEMPLATE" | "ORIGINAL" | "SIGNED";
  name: string;
  category: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}

interface DriveClientProps {
  orgName: string;
  planTier: string;
  monthlyDocLimit: number;
  docsSentThisMonth: number;
  usedBytes: string;
  storageLimitBytes: string;
  files: DriveFileItem[];
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any;
  }
}

export default function DriveClient({
  orgName,
  planTier: initialPlanTier,
  monthlyDocLimit: initialDocLimit,
  docsSentThisMonth: initialDocsSent,
  usedBytes,
  storageLimitBytes,
  files,
}: DriveClientProps) {
  const router = useRouter();
  const [currentTier, setCurrentTier] = useState<string>(initialPlanTier.toUpperCase());
  const [docsSent, setDocsSent] = useState(initialDocsSent);
  const [docLimit, setDocLimit] = useState(initialDocLimit);
  const [search, setSearch] = useState("");
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const used = Number(usedBytes);
  const quota = Math.max(1, Number(storageLimitBytes));
  const storagePct = Math.min(100, (used / quota) * 100);

  const docPct = docLimit === -1 ? 0 : Math.min(100, (docsSent / Math.max(1, docLimit)) * 100);

  const filtered = files.filter((f) =>
    search.trim()
      ? f.name.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );

  async function handleUpgrade(tier: PlanTier) {
    if (tier === currentTier) return;
    setUpgradingTier(tier);
    setNotification(null);

    try {
      const res = await fetch("/api/billing/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotification({ type: "error", message: data.error || "Upgrade failed" });
        return;
      }

      // 1. If Razorpay live order returned, trigger Razorpay modal
      if (data.live && data.orderId) {
        if (!window.Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
            document.body.appendChild(script);
          });
        }

        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "Standard e-Sign",
          description: `Upgrade to ${data.planName}`,
          order_id: data.orderId,
          prefill: {
            name: data.userName,
            email: data.userEmail,
          },
          theme: { color: "#991B1B" },
          handler: function () {
            setNotification({
              type: "success",
              message: `Payment successful! Upgraded to ${data.planName}.`,
            });
            setCurrentTier(tier);
            router.refresh();
          },
        });
        rzp.open();
        return;
      }

      // 2. Demo / Instant Upgrade Mode
      setNotification({
        type: "success",
        message: data.message || `Upgraded to ${tier} successfully!`,
      });
      setCurrentTier(tier);
      if (tier === "PRO" || tier === "ENTERPRISE") {
        setDocLimit(-1);
      }
      router.refresh();
    } catch {
      setNotification({
        type: "error",
        message: "Network error processing plan upgrade.",
      });
    } finally {
      setUpgradingTier(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Drive Overview & Quota Meters */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-xs">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {orgName} — Cloud Storage &amp; Usage
                </h1>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wide">
                  {currentTier}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time storage metering for all templates, uploaded contracts, and cryptographically sealed Section 65B audit PDFs.
              </p>
            </div>
          </div>
        </div>

        {/* Meters Grid: Document Cap + Storage Quota */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Meter 1: Monthly Document Quota */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <FileText className="w-4 h-4 text-indigo-600" />
                Monthly Documents Quota
              </div>
              <div className="text-xs font-bold text-slate-900">
                {docLimit === -1 ? (
                  <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Unlimited Documents
                  </span>
                ) : (
                  <span>
                    {docsSent} / {docLimit} sent this month
                  </span>
                )}
              </div>
            </div>

            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  docLimit === -1
                    ? "bg-emerald-600 w-full"
                    : docPct >= 90
                    ? "bg-rose-600"
                    : "bg-indigo-600"
                }`}
                style={{ width: docLimit === -1 ? "100%" : `${Math.max(docPct, docsSent > 0 ? 5 : 0)}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>{docLimit === -1 ? "Business Pro tier active" : `${Math.max(0, docLimit - docsSent)} free documents remaining`}</span>
              {docLimit !== -1 && <span className="font-semibold text-indigo-700">{docLimit} docs/month cap</span>}
            </div>
          </div>

          {/* Meter 2: Cloud Storage Capacity */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <HardDrive className="w-4 h-4 text-indigo-600" />
                Cloud Drive Storage
              </div>
              <div className="text-xs font-bold text-slate-900">
                {formatBytes(used)} / {formatBytes(quota)} used
              </div>
            </div>

            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  storagePct >= 90 ? "bg-rose-600" : "bg-indigo-600"
                }`}
                style={{ width: `${Math.max(storagePct, used > 0 ? 3 : 0)}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>{storagePct.toFixed(1)}% space utilized</span>
              <span className="font-semibold text-slate-700">{formatBytes(quota)} capacity</span>
            </div>
          </div>
        </div>

        {/* Pricing Tiers: Free / Pro (100 GB) / Enterprise (1 TB) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600" />
              Available Commercial Tiers &amp; Drive Quotas
            </h2>
            <span className="text-xs text-slate-500">
              Upgrade instantly via Razorpay Checkout
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {Object.values(PLANS).map((p) => {
              const isCurrent = currentTier === p.id;
              const isPro = p.id === "PRO";
              const isEnt = p.id === "ENTERPRISE";

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isCurrent
                      ? "border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-600/20"
                      : isPro
                      ? "border-indigo-200 hover:border-indigo-300 bg-white"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{p.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isCurrent
                            ? "bg-indigo-600 text-white"
                            : isPro
                            ? "bg-indigo-100 text-indigo-800"
                            : isEnt
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isCurrent ? "Active Plan" : p.badge}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg font-black text-slate-900">{p.priceLabel}</div>
                      <div className="text-xs text-indigo-700 font-semibold mt-0.5">
                        {p.storageLabel} Storage • {p.monthlyDocLimit === -1 ? "Unlimited Docs" : "10 Docs/mo"}
                      </div>
                    </div>

                    <ul className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                      {p.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        Current Plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgrade(p.id)}
                        disabled={upgradingTier !== null}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isPro
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20"
                            : isEnt
                            ? "bg-purple-700 hover:bg-purple-800 text-white shadow-sm shadow-purple-700/20"
                            : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                        }`}
                      >
                        {upgradingTier === p.id ? (
                          "Upgrading..."
                        ) : (
                          <>
                            <span>Upgrade to {p.name}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* File Browser & PDF Downloader */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Stored Cloud Documents ({filtered.length})
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files in Drive..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 shadow-2xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500">
            No files in Cloud Drive yet. Upload templates or send documents to start saving.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <div
                key={`${f.kind}-${f.id}`}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span className="font-semibold text-indigo-700">{f.kind}</span>
                      {f.sizeBytes > 0 && <span>• {formatBytes(f.sizeBytes)}</span>}
                      <span>• {new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={f.downloadUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 cursor-pointer transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
