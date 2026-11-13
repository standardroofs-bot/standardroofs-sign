"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, PenTool, Type, Upload, Check } from "lucide-react";

interface SignaturePadModalProps {
  isOpen: boolean;
  title: string;
  defaultText?: string;
  isStamp?: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export default function SignaturePadModal({
  isOpen,
  title,
  defaultText = "",
  isStamp = false,
  onClose,
  onSave,
}: SignaturePadModalProps) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">(
    isStamp ? "upload" : "draw"
  );
  const [typedText, setTypedText] = useState(defaultText);
  const [uploadedDataUrl, setUploadedDataUrl] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTypedText(defaultText);
      setHasDrawn(false);
      setTab(isStamp ? "upload" : "draw");
    }
  }, [isOpen, defaultText, isStamp]);

  useEffect(() => {
    if (!isOpen || tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0f172a";
  }, [isOpen, tab]);

  if (!isOpen) return null;

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pt = getPoint(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    setHasDrawn(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pt = getPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function onPointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function renderTypedToPng(text: string): string {
    const c = document.createElement("canvas");
    c.width = 520;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);

    if (isStamp) {
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, c.width - 24, c.height - 24);
      ctx.fillStyle = "#1d4ed8";
      ctx.font = "bold 26px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text || "STANDARD ROOFS", c.width / 2, c.height / 2);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 48px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, c.width / 2, c.height / 2);
    }
    return c.toDataURL("image/png");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleApply() {
    if (tab === "draw") {
      if (!hasDrawn || !canvasRef.current) return;
      onSave(canvasRef.current.toDataURL("image/png"));
    } else if (tab === "type") {
      if (!typedText.trim()) return;
      onSave(renderTypedToPng(typedText.trim()));
    } else {
      if (!uploadedDataUrl) return;
      onSave(uploadedDataUrl);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTab("draw")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                tab === "draw"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PenTool className="w-4 h-4" />
              Draw
            </button>
            <button
              type="button"
              onClick={() => setTab("type")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                tab === "type"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Type className="w-4 h-4" />
              Type
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                tab === "upload"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>

          {tab === "draw" && (
            <div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">
                  Draw using mouse, stylus, or finger
                </span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-orange-700 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-3">
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={
                  isStamp ? "e.g. STANDARD ROOFS APPROVED" : "Type your full name"
                }
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              <div className="h-32 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center p-4">
                {typedText ? (
                  <span
                    className={
                      isStamp
                        ? "border-2 border-blue-700 text-blue-700 font-bold px-4 py-2 text-lg uppercase tracking-wide"
                        : "text-3xl italic font-serif text-slate-900"
                    }
                  >
                    {typedText}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Preview appears here</span>
                )}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3">
              <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-orange-600 bg-slate-50">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                <div className="text-sm font-medium text-slate-700">
                  Upload PNG / JPG {isStamp ? "Company Stamp" : "Signature"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Transparent PNG recommended
                </div>
              </label>
              {uploadedDataUrl && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedDataUrl}
                    alt="Uploaded signature"
                    className="max-h-28 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-orange-700 hover:bg-orange-800 text-white text-sm font-semibold cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

