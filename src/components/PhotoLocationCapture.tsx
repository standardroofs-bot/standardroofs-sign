"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Upload,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export interface PhotoLocationData {
  photoDataUrl: string; // Composite Signed Selfie + GPS banner + Signature
  rawSignatureDataUrl?: string; // Transparent PNG of just the signature strokes
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  locationAddress?: string;
}

interface PhotoLocationCaptureProps {
  required: boolean;
  signerName?: string;
  token?: string;
  photoDataUrl: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  locationAddress?: string;
  onChange: (data: PhotoLocationData) => void;
}

interface Point {
  x: number;
  y: number;
}

export default function PhotoLocationCapture({
  required,
  signerName = "Signer",
  token = "",
  photoDataUrl,
  latitude,
  longitude,
  locationLabel,
  locationAddress = "",
  onChange,
}: PhotoLocationCaptureProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>(locationAddress || "");
  const [error, setError] = useState("");
  const [penColor, setPenColor] = useState<string>("#1D4ED8"); // Blue default ink
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  // Raw base selfie before signature overlay (with burned banner)
  const [baseSelfieUrl, setBaseSelfieUrl] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas refs for the interactive Sign-on-Photo overlay
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  // Format IST & UTC timestamps
  const getFormattedTimestamps = useCallback(() => {
    const d = new Date();
    const ist = d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return `${ist} IST (${d.toISOString().slice(11, 19)} UTC)`;
  }, []);

  // Server-side reverse geocoding lookup
  const reverseGeocodeCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return "";
      const json = await res.json();
      const addr = (json.address as string) || "";
      if (addr) {
        setResolvedAddress(addr);
      }
      return addr;
    } catch {
      return "";
    }
  }, []);

  // Auto-reverse geocode if coordinates exist but address is not yet set
  useEffect(() => {
    if (latitude != null && longitude != null && !resolvedAddress) {
      void reverseGeocodeCoords(latitude, longitude);
    }
  }, [latitude, longitude, resolvedAddress, reverseGeocodeCoords]);

  // Fetch real-time pinpoint GPS by continuously listening to satellite updates until accuracy converges
  const requestGps = useCallback((): Promise<{ lat: number; lng: number; acc: number } | null> => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    setLocLoading(true);

    return new Promise((resolve) => {
      let bestFix: { lat: number; lng: number; acc: number } | null = null;
      let watchId: number | null = null;

      const finish = () => {
        if (watchId !== null) {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch {}
          watchId = null;
        }
        setLocLoading(false);
        resolve(bestFix);
      };

      // 6.5s convergence window: allows satellite chip to lock onto 4+ satellites
      const convergenceTimer = setTimeout(() => {
        finish();
      }, 6500);

      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy || 20);

            if (!bestFix || acc < bestFix.acc) {
              bestFix = { lat, lng, acc };
              setAccuracy(acc);

              // If doorstep satellite accuracy reached (<= 15 meters), lock immediately
              if (acc <= 15) {
                clearTimeout(convergenceTimer);
                finish();
              }
            }
          },
          () => {
            // If watchPosition encounters error, fallback to one-shot
            if (!bestFix) {
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  bestFix = {
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                    acc: Math.round(p.coords.accuracy || 25),
                  };
                  setAccuracy(bestFix.acc);
                  clearTimeout(convergenceTimer);
                  finish();
                },
                () => {
                  clearTimeout(convergenceTimer);
                  finish();
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
              );
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }
        );
      } catch {
        clearTimeout(convergenceTimer);
        finish();
      }
    });
  }, []);

  // Start front camera
  async function startCamera() {
    setError("");
    // Trigger GPS acquisition and address resolution in parallel
    void requestGps().then(async (coords) => {
      if (coords) {
        let addr = resolvedAddress;
        if (!addr) {
          addr = await reverseGeocodeCoords(coords.lat, coords.lng);
        }
        onChange({
          photoDataUrl,
          latitude: coords.lat,
          longitude: coords.lng,
          locationLabel,
          locationAddress: addr,
        });
      }
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 80);
    } catch {
      setError("Camera permission denied. Use 'Phone Camera / Upload' instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  // Burn clean verification banner onto bottom of captured selfie
  function burnVerificationBanner(
    sourceImg: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
    coords: { lat: number | null; lng: number | null; acc: number | null; address?: string }
  ): string {
    const canvas = document.createElement("canvas");
    const targetW = 640;
    const targetH = Math.round((srcHeight / (srcWidth || 1)) * 640) || 640;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // 1. Draw original selfie
    ctx.drawImage(sourceImg, 0, 0, targetW, targetH);

    // 2. Banner height (enough for 4 clean lines)
    const bannerH = Math.max(94, Math.round(targetH * 0.22));
    const bannerY = targetH - bannerH;

    // Semi-transparent dark gradient banner
    const grad = ctx.createLinearGradient(0, bannerY, 0, targetH);
    grad.addColorStop(0, "rgba(15, 23, 42, 0.82)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0.98)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY, targetW, bannerH);

    // Top crimson highlight bar
    ctx.fillStyle = "#DC2626";
    ctx.fillRect(0, bannerY, targetW, 3);

    // Line 1: Header + Signer Name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px sans-serif";
    const signerTag = `🛡️ STANDARD e-SIGN — SIGN-ON-SELFIE PROOF • ${signerName}${token ? ` (${token.slice(0, 8)})` : ""}`;
    ctx.fillText(signerTag, 16, bannerY + 22);

    // Line 2: GPS coordinates & accuracy
    let gpsStr = "GPS: Location Pending / Disabled";
    if (coords.lat != null && coords.lng != null) {
      gpsStr = `GPS: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}${
        coords.acc ? ` (±${coords.acc}m${coords.acc <= 15 ? " Sat" : ""})` : ""
      }`;
    }
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#38BDF8"; // Cyan highlight for GPS
    ctx.fillText(gpsStr, 16, bannerY + 40);

    // Line 3: Truncated readable address up to ~68 chars (includes site/landmark if provided)
    const baseAddr = coords.address || resolvedAddress || "Detecting live street address...";
    const combinedAddr = locationLabel ? `${locationLabel}, ${baseAddr}` : baseAddr;
    const truncatedAddr = combinedAddr.length > 68 ? combinedAddr.slice(0, 65) + "..." : combinedAddr;
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#E2E8F0";
    ctx.fillText(`LOC: ${truncatedAddr}`, 16, bannerY + 58);

    // Line 4: IST & UTC timestamp
    const timeStr = getFormattedTimestamps();
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText(`TIME: ${timeStr}`, 16, bannerY + 76);

    return canvas.toDataURL("image/jpeg", 0.88);
  }

  // Live Snapshot handler
  async function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;

    let currentLat = latitude;
    let currentLng = longitude;
    let currentAcc = accuracy;
    let currentAddr = resolvedAddress;

    // Refresh GPS coordinates if not already present
    if (currentLat == null || currentLng == null) {
      const coords = await requestGps();
      if (coords) {
        currentLat = coords.lat;
        currentLng = coords.lng;
        currentAcc = coords.acc;
        currentAddr = await reverseGeocodeCoords(coords.lat, coords.lng);
      }
    } else if (!currentAddr) {
      currentAddr = await reverseGeocodeCoords(currentLat, currentLng);
    }

    const stampedDataUrl = burnVerificationBanner(
      video,
      video.videoWidth || 640,
      video.videoHeight || 640,
      { lat: currentLat, lng: currentLng, acc: currentAcc, address: currentAddr }
    );

    stopCamera();
    setBaseSelfieUrl(stampedDataUrl);
    setHasDrawnSignature(false);
    strokesRef.current = [];

    // Notify parent
    onChange({
      photoDataUrl: stampedDataUrl,
      rawSignatureDataUrl: undefined,
      latitude: currentLat,
      longitude: currentLng,
      locationLabel,
      locationAddress: currentAddr,
    });
  }

  // Handle uploaded photo
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    void requestGps().then(async (coords) => {
      const currentLat = coords?.lat ?? latitude;
      const currentLng = coords?.lng ?? longitude;
      const currentAcc = coords?.acc ?? accuracy;
      let currentAddr = resolvedAddress;
      if (currentLat != null && currentLng != null && !currentAddr) {
        currentAddr = await reverseGeocodeCoords(currentLat, currentLng);
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const img = new Image();
          img.onload = () => {
            const stamped = burnVerificationBanner(
              img,
              img.width,
              img.height,
              { lat: currentLat, lng: currentLng, acc: currentAcc, address: currentAddr }
            );

            setBaseSelfieUrl(stamped);
            setHasDrawnSignature(false);
            strokesRef.current = [];

            onChange({
              photoDataUrl: stamped,
              rawSignatureDataUrl: undefined,
              latitude: currentLat,
              longitude: currentLng,
              locationLabel,
              locationAddress: currentAddr,
            });
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Sign-on-Photo Canvas Drawing Engine ---
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = penColor;

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  }, [penColor]);

  // Export composite (Selfie + Banner + Drawn Signature) and raw signature
  const exportComposite = useCallback(() => {
    if (!baseSelfieUrl || !canvasRef.current) return;
    const sigCanvas = canvasRef.current;

    const baseImg = new Image();
    baseImg.onload = () => {
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = baseImg.width;
      finalCanvas.height = baseImg.height;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) return;

      // 1. Draw base selfie + banner
      ctx.drawImage(baseImg, 0, 0, finalCanvas.width, finalCanvas.height);

      // 2. Draw signature overlay scaled to final canvas
      ctx.drawImage(sigCanvas, 0, 0, finalCanvas.width, finalCanvas.height);

      const compositeDataUrl = finalCanvas.toDataURL("image/png");
      const rawSignatureDataUrl = sigCanvas.toDataURL("image/png");

      onChange({
        photoDataUrl: compositeDataUrl,
        rawSignatureDataUrl,
        latitude,
        longitude,
        locationLabel,
        locationAddress: resolvedAddress,
      });
    };
    baseImg.src = baseSelfieUrl;
  }, [baseSelfieUrl, latitude, longitude, locationLabel, resolvedAddress, onChange]);

  // Mouse / Touch Event Handlers for Signature Drawing
  function getCanvasCoords(e: React.MouseEvent | React.TouchEvent): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pt = getCanvasCoords(e);
    if (!pt) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = [pt];
  }

  function handlePointerMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    if (!pt) return;

    currentStrokeRef.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = penColor;

    const pts = currentStrokeRef.current;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  }

  function handlePointerUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
      setHasDrawnSignature(true);
      exportComposite();
    }
  }

  function clearSignature() {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setHasDrawnSignature(false);
    redrawCanvas();
    if (baseSelfieUrl) {
      onChange({
        photoDataUrl: baseSelfieUrl,
        rawSignatureDataUrl: undefined,
        latitude,
        longitude,
        locationLabel,
        locationAddress: resolvedAddress,
      });
    }
  }

  function undoStroke() {
    strokesRef.current.pop();
    setHasDrawnSignature(strokesRef.current.length > 0);
    redrawCanvas();
    if (strokesRef.current.length > 0) {
      exportComposite();
    } else if (baseSelfieUrl) {
      onChange({
        photoDataUrl: baseSelfieUrl,
        rawSignatureDataUrl: undefined,
        latitude,
        longitude,
        locationLabel,
        locationAddress: resolvedAddress,
      });
    }
  }

  // Sync canvas size on mount/resize
  useEffect(() => {
    if (baseSelfieUrl && canvasRef.current) {
      canvasRef.current.width = 640;
      canvasRef.current.height = 640;
      redrawCanvas();
    }
  }, [baseSelfieUrl, redrawCanvas]);

  const isVerifiedReady = Boolean(photoDataUrl && latitude != null && longitude != null);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center border border-red-100">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Sign-on-Selfie + GPS Proof
              {required ? (
                <span className="text-red-700 text-xs font-semibold">*Required</span>
              ) : (
                <span className="text-slate-400 font-normal text-xs">(Optional)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Captures live face + GPS coordinates + your drawn signature right on your selfie for MD audit verification.
            </p>
          </div>
        </div>

        {isVerifiedReady && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            Proof Ready &amp; Sealed
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Main Grid: Selfie Stage + GPS info */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left Column: Camera / Interactive Sign-on-Selfie Canvas */}
        <div className="lg:col-span-8 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-red-700" />
              1. Live Selfie &amp; Sign-on-Photo
            </span>
            {baseSelfieUrl && !cameraActive && (
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                ✍️ Draw signature on photo
              </span>
            )}
          </div>

          {cameraActive ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black max-h-[360px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full max-h-[360px] object-cover"
                />
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Live Front Camera
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  Capture Selfie
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : baseSelfieUrl ? (
            <div className="space-y-3">
              {/* Interactive Sign-on-Photo Canvas Stage */}
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-300 shadow-inner bg-slate-900 mx-auto max-w-[420px] aspect-square select-none touch-none">
                {/* Background: Stamped Selfie */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baseSelfieUrl}
                  alt="Captured Selfie Verification"
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Transparent Overlay Canvas for Direct Drawing */}
                <canvas
                  ref={canvasRef}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                />

                {!hasDrawnSignature && (
                  <div className="absolute top-4 left-4 right-4 pointer-events-none bg-blue-900/80 backdrop-blur-xs text-white text-[11px] py-1.5 px-3 rounded-lg text-center font-medium shadow-md border border-blue-400/30 flex items-center justify-center gap-1.5 animate-pulse">
                    <PenTool className="w-3.5 h-3.5" />
                    Sign your name across your photo with finger or mouse
                  </div>
                )}
              </div>

              {/* Drawing Toolbar Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Ink Color:</span>
                  <button
                    type="button"
                    onClick={() => setPenColor("#1D4ED8")}
                    className={`w-6 h-6 rounded-full bg-blue-700 border-2 transition ${
                      penColor === "#1D4ED8" ? "border-slate-900 scale-110 shadow-sm" : "border-white"
                    }`}
                    title="Cobalt Blue"
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor("#0F172A")}
                    className={`w-6 h-6 rounded-full bg-slate-900 border-2 transition ${
                      penColor === "#0F172A" ? "border-blue-600 scale-110 shadow-sm" : "border-white"
                    }`}
                    title="Charcoal Black"
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor("#991B1B")}
                    className={`w-6 h-6 rounded-full bg-red-800 border-2 transition ${
                      penColor === "#991B1B" ? "border-slate-900 scale-110 shadow-sm" : "border-white"
                    }`}
                    title="Crimson Red"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={undoStroke}
                    disabled={!hasDrawnSignature}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={clearSignature}
                    disabled={!hasDrawnSignature}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Clear Ink
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBaseSelfieUrl("");
                      setHasDrawnSignature(false);
                      onChange({
                        photoDataUrl: "",
                        rawSignatureDataUrl: undefined,
                        latitude,
                        longitude,
                        locationLabel,
                        locationAddress: resolvedAddress,
                      });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retake Photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 border border-red-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-xs font-bold text-slate-800">
                  Ready to verify your presence?
                </p>
                <p className="text-[11px] text-slate-500">
                  Take a quick live selfie or select a photo from your gallery. GPS coordinates and live street address will be stamped automatically.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer transition"
                >
                  <Camera className="w-4 h-4" />
                  Open Live Camera
                </button>
                <label className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer transition">
                  <Upload className="w-4 h-4 text-slate-500" />
                  Phone Camera / Upload
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: GPS Location Verification & Landmark */}
        <div className="lg:col-span-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-red-700" />
              2. GPS Location Details
            </span>

            <button
              type="button"
              onClick={() => {
                void requestGps().then(async (coords) => {
                  if (coords) {
                    const addr = await reverseGeocodeCoords(coords.lat, coords.lng);
                    onChange({
                      photoDataUrl,
                      latitude: coords.lat,
                      longitude: coords.lng,
                      locationLabel,
                      locationAddress: addr,
                    });
                  }
                });
              }}
              disabled={locLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer transition shadow-xs"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {locLoading
                  ? "🛰️ Locking Real-time Satellite GPS..."
                  : latitude != null
                  ? "🛰️ Re-Pinpoint Satellite GPS"
                  : "🛰️ Lock Real-time Satellite GPS"}
              </span>
            </button>

            {latitude != null && longitude != null ? (
              <div className="space-y-2 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {accuracy && accuracy <= 20 ? "Satellite GPS Locked" : "Live GPS Acquired"}
                  </span>
                  {accuracy && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      accuracy <= 15 ? "bg-emerald-200 text-emerald-900 border border-emerald-300" : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}>
                      {accuracy <= 15 ? "🛰️ Pinpoint" : "📡 High"} ±{accuracy}m
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] font-semibold">
                  Lat: {latitude.toFixed(6)}<br />
                  Lng: {longitude.toFixed(6)}
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                    <span className="flex items-center gap-1">📍 Exact Live Street Address</span>
                    <span className="text-[10px] font-normal text-emerald-700 bg-white/60 px-1.5 py-0.5 rounded border border-emerald-200">
                      Auto-detected • Editable
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={resolvedAddress}
                    onChange={(e) => {
                      const updated = e.target.value;
                      setResolvedAddress(updated);
                      onChange({
                        photoDataUrl,
                        latitude,
                        longitude,
                        locationLabel,
                        locationAddress: updated,
                      });
                    }}
                    placeholder="Auto-detecting live street address..."
                    className="w-full p-2 text-xs bg-white text-slate-900 rounded-lg border border-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 leading-snug font-medium shadow-2xs resize-none"
                  />
                  <p className="text-[10px] text-emerald-700 leading-tight">
                    Confirm or refine Door No / Building / Street above. This is burned permanently onto your selfie and legal PDF certificate.
                  </p>
                </div>

                <a
                  href={`https://maps.google.com/?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] text-emerald-800 underline font-medium hover:text-emerald-950 pt-0.5"
                >
                  Verify GPS Pin on Google Maps ↗
                </a>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs text-center">
                GPS coordinates will be captured when camera is activated or detected above.
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Building / Site / Flat No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Standard Roofs Works, Shed #3"
                value={locationLabel}
                onChange={(e) =>
                  onChange({
                    photoDataUrl,
                    latitude,
                    longitude,
                    locationLabel: e.target.value,
                    locationAddress: resolvedAddress,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-700/20"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400 bg-white p-2.5 rounded-lg border border-slate-200/80">
            🔒 <strong>Legal Integrity:</strong> Stamping the selfie with GPS coordinates and drawing your signature directly onto the photo locks identity and location under Section 65B of the Indian Evidence Act.
          </div>
        </div>
      </div>
    </div>
  );
}
