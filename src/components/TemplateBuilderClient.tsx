"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PdfCanvasViewer from "./PdfCanvasViewer";
import {
  Save,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  PenTool,
  Stamp,
  Calendar,
  Type,
  UserCheck,
  CheckSquare,
  FileSignature,
  MousePointer,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  FIELD_TYPE_META,
  ROLE_COLORS,
  type DocumentField,
  type FieldType,
  type SignerRole,
} from "@/lib/types";

interface TemplateBuilderClientProps {
  template: {
    id: string;
    name: string;
    category: string;
    description: string;
    requirePhotoLocation?: boolean;
    roles: SignerRole[];
    fields: DocumentField[];
  };
}

const FIELD_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  signature: PenTool,
  initials: FileSignature,
  stamp: Stamp,
  name: UserCheck,
  date: Calendar,
  text: Type,
  checkbox: CheckSquare,
};

export default function TemplateBuilderClient({
  template,
}: TemplateBuilderClientProps) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState(template.category);
  const [requirePhotoLocation, setRequirePhotoLocation] = useState(
    Boolean(template.requirePhotoLocation)
  );
  const [roles, setRoles] = useState<SignerRole[]>(
    template.roles.length > 0
      ? template.roles
      : [{ name: "Client", color: ROLE_COLORS[0] }]
  );
  const [activeRole, setActiveRole] = useState<string>(
    template.roles[0]?.name || "Client"
  );
  // null = Select / Move mode, or a FieldType when placing
  const [placeTool, setPlaceTool] = useState<FieldType | null>(null);
  const [fields, setFields] = useState<DocumentField[]>(template.fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    containerW: number;
    containerH: number;
    hasMoved: boolean;
  } | null>(null);

  const roleColorMap = new Map(roles.map((r) => [r.name, r.color]));
  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  // Keyboard shortcuts: Esc cancels placement, Delete removes selected field, Arrows nudge
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setPlaceTool(null);
        setSelectedFieldId(null);
        return;
      }

      if (!selectedFieldId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setFields((prev) => prev.filter((f) => f.id !== selectedFieldId));
        setSelectedFieldId(null);
        return;
      }

      const step = e.shiftKey ? 0.01 : 0.0025;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        setFields((prev) =>
          prev.map((f) => {
            if (f.id !== selectedFieldId) return f;
            if (e.key === "ArrowLeft")
              return { ...f, x: Math.max(0, f.x - step) };
            if (e.key === "ArrowRight")
              return { ...f, x: Math.min(1 - f.width, f.x + step) };
            if (e.key === "ArrowUp")
              return { ...f, y: Math.max(0, f.y - step) };
            if (e.key === "ArrowDown")
              return { ...f, y: Math.min(1 - f.height, f.y + step) };
            return f;
          })
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFieldId]);

  function addRole() {
    const clean = newRoleName.trim();
    if (!clean || roles.some((r) => r.name === clean)) return;
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length];
    setRoles((prev) => [...prev, { name: clean, color }]);
    setActiveRole(clean);
    setNewRoleName("");
  }

  function dropFieldAt(
    type: FieldType,
    pageNumber: number,
    normX: number,
    normY: number
  ) {
    const meta = FIELD_TYPE_META[type];
    const w = meta.defaultWidth;
    const h = meta.defaultHeight;
    const x = Math.max(0.01, Math.min(1 - w - 0.01, normX - w / 2));
    const y = Math.max(0.01, Math.min(1 - h - 0.01, normY - h / 2));

    const newField: DocumentField = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: activeRole,
      type,
      label: meta.label,
      page: pageNumber,
      x,
      y,
      width: w,
      height: h,
      required: true,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    // Automatically return to Select/Move mode after placing so dragging is never accidental!
    setPlaceTool(null);
  }

  function handlePageClick(pageNumber: number, normX: number, normY: number) {
    if (dragRef.current) return;
    if (!placeTool) {
      setSelectedFieldId(null);
      return;
    }
    dropFieldAt(placeTool, pageNumber, normX, normY);
  }

  function startDrag(
    e: React.PointerEvent,
    field: DocumentField,
    mode: "move" | "resize"
  ) {
    e.stopPropagation();
    const fieldEl = e.currentTarget as HTMLElement;
    const overlay =
      mode === "move"
        ? fieldEl.parentElement
        : fieldEl.parentElement?.parentElement;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    fieldEl.setPointerCapture(e.pointerId);
    setSelectedFieldId(field.id);

    dragRef.current = {
      id: field.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      origW: field.width,
      origH: field.height,
      containerW: rect.width,
      containerH: rect.height,
      hasMoved: false,
    };
  }

  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;

    const pxDx = e.clientX - d.startX;
    const pxDy = e.clientY - d.startY;
    // 4px deadzone prevents accidental jitter when just clicking a field!
    if (!d.hasMoved && Math.hypot(pxDx, pxDy) < 4) return;
    d.hasMoved = true;

    const dx = pxDx / d.containerW;
    const dy = pxDy / d.containerH;

    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== d.id) return f;
        if (d.mode === "move") {
          return {
            ...f,
            x: Math.max(0, Math.min(1 - f.width, d.origX + dx)),
            y: Math.max(0, Math.min(1 - f.height, d.origY + dy)),
          };
        } else {
          return {
            ...f,
            width: Math.max(0.025, Math.min(1 - f.x, d.origW + dx)),
            height: Math.max(0.018, Math.min(1 - f.y, d.origH + dy)),
          };
        }
      })
    );
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    e.stopPropagation();
    setTimeout(() => {
      dragRef.current = null;
    }, 30);
  }

  async function saveTemplate(andSend = false) {
    setSaving(true);
    setSavedNotice("");
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          requirePhotoLocation,
          roles,
          fields,
        }),
      });
      if (res.ok) {
        if (andSend) {
          router.push(`/requests/new?templateId=${template.id}`);
          return;
        }
        setSavedNotice("Saved");
        setTimeout(() => setSavedNotice(""), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/templates"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-bold text-slate-900 text-sm sm:text-base px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs font-medium px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePhotoLocation}
              onChange={(e) => setRequirePhotoLocation(e.target.checked)}
              className="accent-red-800"
            />
            <span>Require Photo + GPS</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedNotice}
            </span>
          )}
          <button
            type="button"
            onClick={() => saveTemplate(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
          <button
            type="button"
            onClick={() => saveTemplate(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Save &amp; Send</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr_240px] gap-5 items-start">
        {/* Left Sidebar: Roles & Drag-or-Click Fields */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-5 lg:sticky lg:top-20">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Signer Party
            </h3>
            <div className="space-y-1.5">
              {roles.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setActiveRole(r.name)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border text-left cursor-pointer transition ${
                    activeRole === r.name
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="truncate">{r.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Add party (e.g. HR)"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={addRole}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                2. Drag or Click Field
              </h3>
              <button
                type="button"
                onClick={() => setPlaceTool(null)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer ${
                  placeTool === null
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MousePointer className="w-3 h-3" />
                Select
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((ft) => {
                const Icon = FIELD_ICONS[ft];
                const isPlacing = placeTool === ft;
                return (
                  <div
                    key={ft}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-sr-field", ft);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => setPlaceTool(isPlacing ? null : ft)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold border cursor-grab active:cursor-grabbing transition ${
                      isPlacing
                        ? "bg-red-50 border-red-700 text-red-900 ring-1 ring-red-700"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{FIELD_TYPE_META[ft].label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
            <strong>Builder Tip:</strong> Drag any field onto the PDF (or click a field, then click the PDF). Use <strong>Arrow keys</strong> to fine-adjust, <strong>Delete</strong> to remove.
          </div>
        </div>

        {/* Center: PDF Pages */}
        <div
          className={`min-w-0 ${placeTool ? "cursor-crosshair" : ""}`}
        >
          <PdfCanvasViewer
            pdfUrl={`/api/templates/${template.id}/pdf`}
            onPageClick={handlePageClick}
            renderOverlay={(pageNumber) => (
              <div
                className="w-full h-full relative"
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/x-sr-field")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(e) => {
                  const ft = e.dataTransfer.getData(
                    "application/x-sr-field"
                  ) as FieldType;
                  if (!ft) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const normX = (e.clientX - rect.left) / rect.width;
                  const normY = (e.clientY - rect.top) / rect.height;
                  dropFieldAt(ft, pageNumber, normX, normY);
                }}
              >
                {fields
                  .filter((f) => f.page === pageNumber)
                  .map((f) => {
                    const color = roleColorMap.get(f.role) || "#991B1B";
                    const selected = f.id === selectedFieldId;
                    return (
                      <div
                        key={f.id}
                        onPointerDown={(e) => startDrag(e, f, "move")}
                        onPointerMove={onDragMove}
                        onPointerUp={endDrag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(f.id);
                        }}
                        style={{
                          left: `${f.x * 100}%`,
                          top: `${f.y * 100}%`,
                          width: `${f.width * 100}%`,
                          height: `${f.height * 100}%`,
                          borderColor: color,
                          backgroundColor: `${color}14`,
                        }}
                        className={`group absolute border-[1.5px] rounded-xs cursor-move select-none touch-none ${
                          selected
                            ? "ring-2 ring-slate-900 shadow-sm z-10"
                            : "hover:ring-1 hover:ring-slate-500"
                        }`}
                      >
                        {/* Slim Floating Label ABOVE box so PDF text underneath stays visible */}
                        <span
                          className="absolute -top-4 left-0 text-[9px] leading-none font-bold text-white px-1.5 py-0.5 rounded-t-xs whitespace-nowrap pointer-events-none"
                          style={{ backgroundColor: color }}
                        >
                          {f.label}
                        </span>

                        {/* Quick Delete button when selected */}
                        {selected && (
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFields((prev) =>
                                prev.filter((item) => item.id !== f.id)
                              );
                              setSelectedFieldId(null);
                            }}
                            className="absolute -top-4 right-0 bg-slate-900 text-white text-[9px] leading-none px-1.5 py-0.5 rounded-t-xs cursor-pointer hover:bg-red-700"
                            title="Delete field"
                          >
                            ×
                          </button>
                        )}

                        {/* Bottom-Right Resize Handle */}
                        <div
                          onPointerDown={(e) => startDrag(e, f, "resize")}
                          onPointerMove={onDragMove}
                          onPointerUp={endDrag}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-[1.5px] border-slate-900 rounded-xs cursor-nwse-resize"
                          title="Drag to resize"
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          />
        </div>

        {/* Right Sidebar: Field Properties */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 lg:sticky lg:top-20">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Field Properties ({fields.length})
          </h3>

          {selectedField ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedField.label}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f) =>
                        f.id === selectedField.id
                          ? { ...f, label: e.target.value }
                          : f
                      )
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Assigned Party
                </label>
                <select
                  value={selectedField.role}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f) =>
                        f.id === selectedField.id
                          ? { ...f, role: e.target.value }
                          : f
                      )
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f) =>
                        f.id === selectedField.id
                          ? { ...f, required: e.target.checked }
                          : f
                      )
                    )
                  }
                />
                Required field
              </label>

              <button
                type="button"
                onClick={() => {
                  setFields((prev) =>
                    prev.filter((f) => f.id !== selectedField.id)
                  );
                  setSelectedFieldId(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Field
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Click any field box on the document to edit or resize it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
