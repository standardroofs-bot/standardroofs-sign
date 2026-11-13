"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  XCircle,
  FileSignature,
  Search,
} from "lucide-react";

interface VerifyResult {
  verified: boolean;
  hash?: string;
  matchType?: string;
  request?: {
    id: string;
    title: string;
    projectName: string;
    category: string;
    status: string;
    completedAt: string | null;
    originalHash: string;
    signedHash: string | null;
    signers: {
      role: string;
      name: string;
      email: string;
      status: string;
      signedAt: string | null;
    }[];
  };
}

export default function VerifyPage() {
  const [requestId, setRequestId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (requestId.trim()) fd.append("requestId", requestId.trim());
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white border-b-4 border-orange-700">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-700 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">
              StandardRoofs <span className="text-orange-400">Sign</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-300 hover:text-white"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-11 h-11 text-orange-700 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">
            Verify Signed PDF Authenticity
          </h1>
          <p className="text-sm text-slate-500">
            Upload a signed Standard Roofs PDF or enter a Request ID to verify its SHA-256 cryptographic checksum and signer records.
          </p>
        </div>

        <form
          onSubmit={handleVerify}
          className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs"
        >
          <label className="block border-2 border-dashed border-slate-300 hover:border-orange-600 rounded-xl p-6 text-center cursor-pointer bg-slate-50">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-700">
              {file ? file.name : "Upload Signed PDF to Check SHA-256 Hash"}
            </div>
          </label>

          <div className="text-center text-xs text-slate-400 font-semibold uppercase">
            OR
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Request ID or SHA-256 Hash
            </label>
            <input
              type="text"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="Paste Request ID from Certificate of Completion"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (!file && !requestId.trim())}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? "Checking..." : "Verify Document"}</span>
          </button>
        </form>

        {result && (
          <div
            className={`p-5 rounded-2xl border ${
              result.verified
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {result.verified && result.request ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Verified Authentic Standard Roofs Document</span>
                </div>
                <div className="text-xs text-emerald-900 space-y-1">
                  <div>
                    <strong>Title:</strong> {result.request.title}
                  </div>
                  {result.request.projectName && (
                    <div>
                      <strong>Project:</strong> {result.request.projectName}
                    </div>
                  )}
                  <div>
                    <strong>Status:</strong> {result.request.status}
                  </div>
                  <div>
                    <strong>Match Type:</strong> {result.matchType}
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-200 space-y-1">
                  <div className="text-xs font-bold text-emerald-900">
                    Signers:
                  </div>
                  {result.request.signers.map((s, idx) => (
                    <div key={idx} className="text-xs text-emerald-800">
                      • {s.role}: {s.name} ({s.email}) — {s.status}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-800 text-sm font-semibold">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>
                  No matching document found. The file may have been modified or was not issued by this server.
                </span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

