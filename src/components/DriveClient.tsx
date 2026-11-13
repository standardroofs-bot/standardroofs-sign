"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HardDrive,
  Download,
  Search,
  FileText,
  CheckCircle2,
  ArrowUpCircle,
} from "lucide-react";
import { DRIVE_PLANS, formatBytes } from "@/lib/types";

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
  plan: string;
  usedBytes: string;
  quotaBytes: string;
  files: DriveFileItem[];
}

export default function DriveClient({
  orgName,
  plan: initialPlan,
  usedBytes,
  quotaBytes,
  files,
}: DriveClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [search, setSearch] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const used = Number(usedBytes);
  const quota = Math.max(1, Number(quotaBytes));
  const pct = Math.min(100, (used / quota) * 100);

  const filtered = files.filter((f) =>
    search.trim()
      ? f.name.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );

  async function switchPlan(newPlan: string) {
    setUpgrading(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade_plan", plan: newPlan }),
      });
      if (res.ok) {
        setPlan(newPlan);
        router.refresh();
      }
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-800 border border-red-200 flex items-center justify-center">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {orgName} — Cloud Drive
              </h1>
              <p className="text-xs text-slate-500">
                All uploaded templates, original documents, and signed proof PDFs.
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-bold text-slate-900">
              {formatBytes(used)} / {formatBytes(quota)} used
            </div>
            <div className="text-xs text-slate-500">
              Plan:{" "}
              <span className="font-semibold text-red-800">
                {DRIVE_PLANS[plan as keyof typeof DRIVE_PLANS]?.label || plan}
              </span>
            </div>
          </div>
        </div>

        {/* Storage Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-red-800 transition-all"
            style={{ width: `${Math.max(pct, used > 0 ? 1.5 : 0)}%` }}
          />
        </div>

        {/* Storage Tiers 10 GB -> 1 TB */}
        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          {Object.values(DRIVE_PLANS).map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={upgrading || active}
                onClick={() => switchPlan(p.id)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  active
                    ? "border-red-800 bg-red-50/50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {p.label}
                  </span>
                  {active ? (
                    <CheckCircle2 className="w-4 h-4 text-red-800" />
                  ) : (
                    <ArrowUpCircle className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">{p.priceLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* File Browser & PDF Downloader */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-semibold text-slate-900 text-sm">
            Stored Files ({filtered.length})
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files in Drive..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No files in Drive yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <div
                key={`${f.kind}-${f.id}`}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-red-800 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span className="font-medium">{f.kind}</span>
                      {f.sizeBytes > 0 && <span>• {formatBytes(f.sizeBytes)}</span>}
                      <span>• {new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={f.downloadUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0"
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

