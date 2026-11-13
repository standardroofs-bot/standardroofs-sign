"use client";

import { useState } from "react";
import { Save, UserPlus, CheckCircle2 } from "lucide-react";

interface SettingsClientProps {
  initialSettings: {
    companyName: string;
    tagline: string;
    website: string;
    email: string;
    phone: string;
    address: string;
    publicBaseUrl: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpFrom: string;
    whatsappWebhookUrl: string;
    smsWebhookUrl: string;
    fast2smsApiKey: string;
  };
  initialUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string;
  }[];
  currentUserRole: string;
}

export default function SettingsClient({
  initialSettings,
  initialUsers,
  currentUserRole,
}: SettingsClientProps) {
  const [form, setForm] = useState(initialSettings);
  const [users, setUsers] = useState(initialUsers);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    title: "Site Engineer",
    role: "STAFF",
  });
  const [userError, setUserError] = useState("");

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSavedMsg("Settings saved.");
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_user", ...newUser }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUserError(data.error || "Could not add user");
      return;
    }
    setUsers((prev) => [...prev, data.user]);
    setNewUser({
      name: "",
      email: "",
      password: "",
      title: "Site Engineer",
      role: "STAFF",
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Company Branding, SMTP &amp; Team
        </h1>
        <p className="text-sm text-slate-500">
          Configure Standard Roofs identity on signing portals, audit certificates, and automated SMTP emails.
        </p>
      </div>

      <form
        onSubmit={handleSaveSettings}
        className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-xs"
      >
        <div className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Company Profile
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tagline
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Website
            </label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Office Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        <div className="font-semibold text-slate-900 border-b border-slate-100 pb-2 pt-2">
          Public Signing Link URL (Fixes localhost links!)
        </div>
        <div className="text-sm space-y-2">
          <input
            type="url"
            placeholder="https://sign.standardroofs.in (or your Cloudflare Tunnel / LAN IP http://192.168.222.58:3030)"
            value={form.publicBaseUrl}
            onChange={(e) => setForm({ ...form, publicBaseUrl: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
          />
          <p className="text-xs text-slate-500">
            All WhatsApp, SMS, Email, and Copy Signing Links will use this base URL so clients on mobile data can open them.
          </p>
        </div>

        <div className="font-semibold text-slate-900 border-b border-slate-100 pb-2 pt-2">
          Automated WhatsApp &amp; SMS API (Optional — 1-Click Share Always Works)
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              WhatsApp Webhook URL (n8n / Meta / AiSensy / WATI)
            </label>
            <input
              type="url"
              placeholder="https://your-webhook-url/whatsapp"
              value={form.whatsappWebhookUrl}
              onChange={(e) =>
                setForm({ ...form, whatsappWebhookUrl: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Fast2SMS API Key (India Automated SMS)
            </label>
            <input
              type="password"
              placeholder="Fast2SMS Authorization Key"
              value={form.fast2smsApiKey}
              onChange={(e) =>
                setForm({ ...form, fast2smsApiKey: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Custom SMS Webhook URL (MSG91 / Twilio / n8n)
            </label>
            <input
              type="url"
              placeholder="https://your-webhook-url/sms"
              value={form.smsWebhookUrl}
              onChange={(e) =>
                setForm({ ...form, smsWebhookUrl: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        <div className="font-semibold text-slate-900 border-b border-slate-100 pb-2 pt-2">
          Custom SMTP Email Server (Sends invites + signed PDF copies)
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              SMTP Host
            </label>
            <input
              type="text"
              placeholder="smtp.gmail.com"
              value={form.smtpHost}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              SMTP Port
            </label>
            <input
              type="number"
              value={form.smtpPort}
              onChange={(e) =>
                setForm({ ...form, smtpPort: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              SMTP Username
            </label>
            <input
              type="text"
              value={form.smtpUser}
              onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              SMTP Password / App Password
            </label>
            <input
              type="password"
              value={form.smtpPass}
              onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {savedMsg && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              {savedMsg}
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-800 hover:bg-red-900 text-white text-sm font-semibold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </form>

      {/* Team Members */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
        <div className="font-semibold text-slate-900">
          Standard Roofs Team Members ({users.length})
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          {users.map((u) => (
            <div key={u.id} className="py-2.5 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500">
                  {u.email} • {u.title}
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {u.role}
              </span>
            </div>
          ))}
        </div>

        {currentUserRole === "ADMIN" && (
          <form
            onSubmit={handleAddUser}
            className="pt-4 border-t border-slate-200 space-y-3"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Add Staff User
            </div>
            {userError && (
              <div className="text-xs text-red-600">{userError}</div>
            )}
            <div className="grid sm:grid-cols-4 gap-2.5 text-sm">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <input
                type="text"
                placeholder="Job Title"
                value={newUser.title}
                onChange={(e) =>
                  setNewUser({ ...newUser, title: e.target.value })
                }
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <input
                type="password"
                required
                placeholder="Password (min 6)"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Team Member
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

