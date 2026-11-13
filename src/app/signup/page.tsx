"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSignature,
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  HardDrive,
  Briefcase,
  FileText,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"INDIVIDUAL" | "BUSINESS">("BUSINESS");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          companyName,
          gstin,
          name,
          email,
          phone,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create workspace.");
        return;
      }
      router.push("/dashboard?welcome=1");
      router.refresh();
    } catch {
      setError("Network error creating account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-950 px-6 py-5 border-b-4 border-red-800 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-800 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Standard <span className="text-red-400">e-Sign</span>
                </h1>
                <p className="text-[11px] text-slate-400">
                  Instant Self-Serve Onboarding
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full">
              <HardDrive className="w-3 h-3" />
              Free Tier Included
            </span>
          </div>
        </div>

        {/* Account Type Selector Toggle */}
        <div className="p-6 pb-2">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAccountType("BUSINESS")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                accountType === "BUSINESS"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 className="w-4 h-4 text-red-700" />
              <span>Business / Org</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("INDIVIDUAL")}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                accountType === "INDIVIDUAL"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <User className="w-4 h-4 text-blue-700" />
              <span>Individual / Freelance</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {accountType === "BUSINESS" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Engineering Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN (Optional)
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                Personal workspace will be auto-named <strong>{name ? `${name} (Workspace)` : "Your Workspace"}</strong>.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  placeholder="+91..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work / Sign-in Email *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password (min 6 chars) *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 disabled:opacity-60 text-white font-semibold text-sm cursor-pointer shadow-xs transition"
          >
            <span>{loading ? "Setting up workspace..." : "Get Started Free (10 Docs / Mo)"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <a href="http://localhost:3040" className="hover:text-slate-900">
              ← Back to Website
            </a>
            <Link href="/login" className="text-red-800 font-semibold hover:underline">
              Already have an account? Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
