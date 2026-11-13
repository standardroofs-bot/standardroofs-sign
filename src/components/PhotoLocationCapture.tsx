"use client";

import { useRef, useState } from "react";
import { Camera, MapPin, CheckCircle2, RefreshCw, Upload } from "lucide-react";

interface PhotoLocationCaptureProps {
  required: boolean;
  photoDataUrl: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  onChange: (data: {
    photoDataUrl: string;
    latitude: number | null;
    longitude: number | null;
    locationLabel: string;
  }) => void;
}

export default function PhotoLocationCapture({
  required,
  photoDataUrl,
  latitude,
  longitude,
  locationLabel,
  onChange,
}: PhotoLocationCaptureProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setError("Camera access denied or unavailable. Use 'Upload / Phone Camera' instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / (video.videoWidth || 1)) * 480) || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    stopCamera();
    onChange({ photoDataUrl: dataUrl, latitude, longitude, locationLabel });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Resize via canvas so JPEG stays compact for PDF embedding
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxW = 480;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onChange({
            photoDataUrl: canvas.toDataURL("image/jpeg", 0.82),
            latitude,
            longitude,
            locationLabel,
          });
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }

  function captureGps() {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLoading(false);
        onChange({
          photoDataUrl,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationLabel,
        });
      },
      (err) => {
        setLocLoading(false);
        setError(`Location permission failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const ready = Boolean(photoDataUrl && latitude != null && longitude != null);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-800 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Photo &amp; GPS Location Verification{" "}
              {required ? (
                <span className="text-red-700">*Required</span>
              ) : (
                <span className="text-slate-400 font-normal">(Optional)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Embedded onto the final signed PDF Audit Certificate as proof of presence.
            </p>
          </div>
        </div>
        {ready && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Photo &amp; GPS Ready
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Photo Capture */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-700">1. Live Photo</div>
          {cameraActive ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full rounded-lg bg-black max-h-48 object-cover"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="flex-1 py-2 rounded-lg bg-red-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Capture Photo
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : photoDataUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoDataUrl}
                alt="Signer verification"
                className="w-full max-h-40 object-contain rounded-lg border border-slate-200 bg-white"
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    photoDataUrl: "",
                    latitude,
                    longitude,
                    locationLabel,
                  })
                }
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-red-800 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retake Photo
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Open Camera
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
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
          )}
        </div>

        {/* GPS Location Capture */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-700">2. GPS Location</div>
          <button
            type="button"
            onClick={captureGps}
            disabled={locLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-800 hover:bg-red-900 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {locLoading
                ? "Getting GPS..."
                : latitude != null
                ? "Refresh GPS Location"
                : "Capture GPS Location"}
            </span>
          </button>

          {latitude != null && longitude != null && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
              <div className="font-semibold">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </div>
              <a
                href={`https://maps.google.com/?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-[11px]"
              >
                View on Google Maps ↗
              </a>
            </div>
          )}

          <input
            type="text"
            placeholder="Site / City / Landmark (optional)"
            value={locationLabel}
            onChange={(e) =>
              onChange({
                photoDataUrl,
                latitude,
                longitude,
                locationLabel: e.target.value,
              })
            }
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
          />
        </div>
      </div>
    </div>
  );
}

