"use client";

import { useState } from "react";
import { Save, UserPlus, CheckCircle2, Shield, UserX, AlertCircle, Building, Mail, Phone, Globe, MapPin } from "lucide-react";

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
    googleMapsApiKey?: string;
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
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: "MEMBER",
    title: "Project Coordinator",
    password: "Welcome@2026",
  });

  const canManageTeam =
    currentUserRole === "OWNER" ||
    currentUserRole === "ADMIN";

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
        setSavedMsg("Settings updated successfully.");
        setTimeout(() => setSavedMsg(""), 3500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviting(true);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_member",
          ...newMember,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to invite member.");
        return;
      }

      setUsers((prev) => [
        ...prev,
        {
          id: data.member.userId,
          name: data.member.name,
          email: data.member.email,
          role: data.member.role,
          title: data.member.title,
        },
      ]);

      setInviteSuccess(`Invited ${data.member.name} (${data.member.email}) successfully! Default password: ${newMember.password}`);
      setNewMember({
        name: "",
        email: "",
        role: "MEMBER",
        title: "Project Coordinator",
        password: "Welcome@2026",
      });
    } catch {
      setInviteError("Network error inviting member.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Organization Branding, Gateways &amp; Team
        </h1>
        <p className="text-sm text-slate-500">
          Configure company profile, WhatsApp / SMS credentials, and manage team member access.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Company Branding & Gateways Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5 shadow-xs">
        <div className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building className="w-4 h-4 text-indigo-600" />
          1. Company Identity &amp; Contact Details
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Workspace Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Support Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Support Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Physical Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
          />
        </div>

        {/* Custom SMTP Server */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-700" />
            2. Custom SMTP Email Server (Optional)
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com / smtp.zoho.com"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email</label>
              <input
                type="email"
                placeholder="noreply@domain.com"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp & SMS Webhook / API Gateways */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-700" />
            3. Automated Dispatch Gateways (WhatsApp Cloud &amp; SMS)
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Webhook / Cloud API URL</label>
              <input
                type="url"
                placeholder="https://graph.facebook.com/v19.0/..."
                value={form.whatsappWebhookUrl}
                onChange={(e) => setForm({ ...form, whatsappWebhookUrl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fast2SMS / MSG91 API Key</label>
              <input
                type="password"
                placeholder="API Key for automated SMS delivery"
                value={form.fast2smsApiKey}
                onChange={(e) => setForm({ ...form, fast2smsApiKey: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Google Maps Geocoding API Key (Optional)</label>
              <input
                type="password"
                placeholder="AIzaSy... (For doorstep Indian landmark precision matching Google Maps)"
                value={form.googleMapsApiKey || ""}
                onChange={(e) => setForm({ ...form, googleMapsApiKey: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                When provided, live address matches the Google Maps app 100% door-to-door. If empty, high-accuracy OpenStreetMap + Google Plus Code is used.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </form>

      {/* Team Members & Role-Based Access Control */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-700" />
            <h2 className="font-bold text-slate-900 text-sm">
              Team Members &amp; Workspace Roles ({users.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {canManageTeam ? "You have Admin permissions" : "Read-only access"}
          </span>
        </div>

        {inviteSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium">
            {inviteSuccess}
          </div>
        )}

        {inviteError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
            {inviteError}
          </div>
        )}

        <div className="divide-y divide-slate-100 text-sm">
          {users.map((u) => {
            const isOwner = u.role === "OWNER" || u.role === "ADMIN";
            return (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                    {u.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{u.email}</span>
                    <span>•</span>
                    <span>{u.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      u.role === "OWNER"
                        ? "bg-purple-100 text-purple-800"
                        : u.role === "ADMIN"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Invite New Team Member Form */}
        {canManageTeam && (
          <form onSubmit={handleInviteMember} className="pt-4 border-t border-slate-200 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              Invite Staff / Team Member
            </div>

            <div className="grid sm:grid-cols-4 gap-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <input
                type="email"
                required
                placeholder="Work Email *"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <input
                type="text"
                placeholder="Role / Title"
                value={newMember.title}
                onChange={(e) => setNewMember({ ...newMember, title: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-xl"
              />
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="MEMBER">Member (Can send/view)</option>
                <option value="ADMIN">Admin (Full permissions)</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-1">
              <p className="text-[11px] text-slate-500">
                A temporary password (<code>{newMember.password}</code>) will be assigned for their first login.
              </p>
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer shadow-xs transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{inviting ? "Inviting..." : "Invite Member"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
