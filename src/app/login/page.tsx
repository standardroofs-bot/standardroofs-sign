"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileSignature, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@standardroofs.in");
  const [password, setPassword] = useState("StandardRoofs@2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-950 px-6 py-6 border-b-4 border-red-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-800 flex items-center justify-center">
              <FileSignature className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Standard Roofs <span className="text-red-400">Sign</span>
              </h1>
              <p className="text-xs text-slate-400">
                Document Signing &amp; Approval Portal
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-700 hover:bg-orange-800 disabled:opacity-60 text-white font-semibold text-sm cursor-pointer transition"
          >
            <span>{loading ? "Signing in..." : "Sign In to Dashboard"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Initial Admin Login:</div>
            <div>
              Email: <code className="font-mono">admin@standardroofs.in</code>
            </div>
            <div>
              Password: <code className="font-mono">StandardRoofs@2026</code>
            </div>
          </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link href="/signup" className="text-red-800 hover:underline font-semibold">
              + Create New Organization
            </Link>
            <Link
              href="/verify"
              className="flex items-center gap-1 text-slate-600 hover:underline font-medium"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify Signed PDF
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

