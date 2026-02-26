import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import OwnerNavbar from "../../components/OwnerNavbar";
import api from "../../api/api";

function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function scorePlateCandidate(token) {
  const s = normalizePlate(token);
  if (!s) return { plate: "", score: -1 };

  const len = s.length;
  if (len < 6 || len > 14) return { plate: s, score: 0 };

  const hasLetters = /[A-Z]/.test(s);
  const hasDigits = /\d/.test(s);

  let score = 10;
  if (hasLetters && hasDigits) score += 20;
  if (!hasLetters || !hasDigits) score -= 10;

  if (/(.)\1\1/.test(s)) score -= 5;
  if (/^\d+$/.test(s) || /^[A-Z]+$/.test(s)) score -= 5;

  if (/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/.test(s)) score += 15;

  score -= Math.abs(10 - len);
  return { plate: s, score };
}

async function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function canvasToDataUrl(canvas, format = "image/jpeg", quality = 0.92) {
  return canvas.toDataURL(format, quality);
}

/**
 * Build image variants for better plate recognition hit rate
 * Sends these to backend which calls PlateRecogniser API
 */
async function buildCaptureVariants(dataUrl) {
  const img = await loadImage(dataUrl);

  const variants = [];

  // Scale down for upload speed but keep enough detail
  const maxW = 1600;
  const scale = Math.min(1, maxW / (img.naturalWidth || img.width || maxW));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = w;
  baseCanvas.height = h;
  const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true });
  baseCtx.drawImage(img, 0, 0, w, h);
  variants.push({ name: "full", dataUrl: canvasToDataUrl(baseCanvas) });

  // Crops that likely contain plate
  const crops = [
    { name: "center", x: 0.05, y: 0.30, ww: 0.90, hh: 0.45 },
    { name: "lower", x: 0.05, y: 0.45, ww: 0.90, hh: 0.50 },
    { name: "tight", x: 0.12, y: 0.42, ww: 0.76, hh: 0.35 },
  ];

  for (const c of crops) {
    const cx = Math.max(0, Math.round(w * c.x));
    const cy = Math.max(0, Math.round(h * c.y));
    const cw = Math.max(1, Math.round(w * c.ww));
    const ch = Math.max(1, Math.round(h * c.hh));

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cw;
    cropCanvas.height = ch;
    const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });
    cropCtx.drawImage(baseCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

    variants.push({ name: c.name, dataUrl: canvasToDataUrl(cropCanvas) });

    // Enhanced variant: contrast + brightness boost
    const imgData = cropCtx.getImageData(0, 0, cw, ch);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      y = (y - 128) * 1.3 + 128;
      y = Math.max(0, Math.min(255, y));

      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
      data[i + 3] = 255;
    }
    cropCtx.putImageData(imgData, 0, 0);
    variants.push({ name: `${c.name}-enh`, dataUrl: canvasToDataUrl(cropCanvas) });
  }

  return variants;
}

export default function GateScan() {
  const [params] = useSearchParams();
  const parkingId = params.get("parkingId") || "";

  const [mode, setMode] = useState("ENTRY");
  const [cameraOn, setCameraOn] = useState(false);
  const [videoError, setVideoError] = useState("");

  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [plateText, setPlateText] = useState("");
  const [plateRecognitionBusy, setPlateRecognitionBusy] = useState(false);
  const [plateRecognitionHint, setPlateRecognitionHint] = useState("");
  const [plateRecognitionConfidence, setPlateRecognitionConfidence] = useState(null);
  const [apiBusy, setApiBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [qrBusy, setQrBusy] = useState(false);
  const [bookingId, setBookingId] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef({ running: false, rafId: null });

  const plateNormalized = useMemo(() => normalizePlate(plateText), [plateText]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopQrScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      setVideoError("");
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      try {
        const [track] = stream.getVideoTracks();
        if (track?.applyConstraints) {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        }
      } catch {
        // ignore
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setVideoError(e?.message || "Failed to access camera");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    streamRef.current = null;
    setCameraOn(false);
  }

  function captureFrame() {
    setError("");
    setResult(null);

    const video = videoRef.current;
    if (!video) return "";

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);

    setPlateRecognitionConfidence(null);
    setPlateRecognitionHint("");
    return dataUrl;
  }

  /**
   * ✅ PlateRecogniser API Integration
   * - Creates 7 image variants (full + crops + enhanced crops)
   * - Calls backend /anpr/scan which uses PlateRecogniser API
   * - Selects best plate based on confidence & heuristic score
   */
  async function runPlateRecognition() {
    try {
      setError("");
      setResult(null);
      setPlateRecognitionHint("");
      setPlateRecognitionConfidence(null);

      const dataUrl = capturedDataUrl || captureFrame();
      if (!dataUrl) throw new Error("Capture a frame first");

      setPlateRecognitionBusy(true);
      setPlateRecognitionHint("Preparing image…");

      const variants = await buildCaptureVariants(dataUrl);

      let best = { plate: "", combined: -1, conf: 0, source: "" };

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        setPlateRecognitionHint(
          `Recognizing plate (${i + 1}/${variants.length}) — ${v.name}`
        );

        const blob = await (await fetch(v.dataUrl)).blob();

        const form = new FormData();
        form.append("image", blob, "frame.jpg");

        // Call backend /anpr/scan which uses PlateRecogniser API
        const res = await api.post("/anpr/scan", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const plate = String(res?.data?.plate || "").trim();
        const confidence = Number(res?.data?.confidence || 0);

        const scored = scorePlateCandidate(plate);
        // Weight: 70% confidence + 30% heuristic score
        const combined = confidence * 70 + scored.score * 3;

        if (combined > best.combined) {
          best = {
            plate: scored.plate,
            combined,
            conf: confidence,
            source: v.name,
          };
        }

        // Early exit if good enough (more lenient: 0.6+ confidence OR high heuristic score)
        if (best.plate && (best.conf >= 0.6 || scored.score >= 25)) break;
      }

      // Accept even low confidence if we have something that looks like a plate
      if (!best.plate || (best.conf < 0.3 && best.combined < 30)) {
        setPlateText("");
        setPlateRecognitionConfidence(null);
        throw new Error(
          "Couldn't detect plate. Try: position plate center, improve lighting, avoid glare, or use QR/manual entry."
        );
      }

      setPlateText(best.plate);
      setPlateRecognitionConfidence(best.conf);
      setPlateRecognitionHint(`Best match from ${best.source}`);
    } catch (e) {
      console.error("[GateScan] Plate recognition error:", e);
      
      let errorMsg = "Plate recognition failed";
      
      if (e?.response?.status === 401) {
        errorMsg = "Invalid API key. Contact administrator.";
      } else if (e?.response?.status === 429) {
        errorMsg = "API rate limit exceeded. Try again in a moment.";
      } else if (e?.response?.status === 400) {
        errorMsg = e?.response?.data?.error || "Bad request - invalid image format.";
      } else if (e?.response?.status === 503) {
        errorMsg = "PlateRecogniser service unavailable. Check internet connection.";
      } else if (e?.message?.includes("Network Error") || e?.message?.includes("ERR_NETWORK")) {
        errorMsg = "Network error. Ensure backend is running on http://localhost:5000";
      } else if (e?.response?.status === 500) {
        errorMsg = e?.response?.data?.error || "Server error. Check backend logs.";
      } else {
        errorMsg = e?.response?.data?.message || e?.response?.data?.error || e?.message || errorMsg;
      }
      
      setError(errorMsg);
    } finally {
      setPlateRecognitionBusy(false);
    }
  }

  function supportsQrDetector() {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  }

  async function startQrScan() {
    try {
      setError("");
      setResult(null);

      if (!supportsQrDetector()) {
        throw new Error("QR scan not supported here. Use manual Booking ID input below.");
      }

      if (!cameraOn) {
        await startCamera();
      }

      const video = videoRef.current;
      if (!video) throw new Error("Camera not ready");

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanLoopRef.current.running = true;
      setQrBusy(true);

      const loop = async () => {
        if (!scanLoopRef.current.running) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes?.length) {
            const value = barcodes[0]?.rawValue;
            if (value) {
              setBookingId(String(value).trim());
              stopQrScan();
              return;
            }
          }
        } catch {
          // ignore per-frame detection errors
        }
        scanLoopRef.current.rafId = requestAnimationFrame(loop);
      };

      scanLoopRef.current.rafId = requestAnimationFrame(loop);
    } catch (e) {
      setError(e?.message || "Failed to start QR scan");
      setQrBusy(false);
    }
  }

  function stopQrScan() {
    scanLoopRef.current.running = false;
    if (scanLoopRef.current.rafId) {
      cancelAnimationFrame(scanLoopRef.current.rafId);
    }
    scanLoopRef.current.rafId = null;
    setQrBusy(false);
  }

  async function submitPlate() {
    try {
      setError("");
      setResult(null);

      if (!parkingId) throw new Error("Missing parkingId. Open this page from a parking card.");
      if (!plateNormalized) throw new Error("Enter / scan a number plate first");

      setApiBusy(true);

      const endpoint =
        mode === "ENTRY"
          ? "/booking/owner/gate/check-in/plate"
          : "/booking/owner/gate/check-out/plate";

      const res = await api.post(endpoint, {
        parkingId,
        plateNumber: plateNormalized,
        rawText: plateText,
      });

      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Request failed");
    } finally {
      setApiBusy(false);
    }
  }

  async function submitBookingId() {
    try {
      setError("");
      setResult(null);

      if (!bookingId.trim()) throw new Error("Enter / scan bookingId first");

      setApiBusy(true);

      const endpoint =
        mode === "ENTRY"
          ? "/booking/owner/gate/check-in/booking"
          : "/booking/owner/gate/check-out/booking";

      const res = await api.post(endpoint, {
        bookingId: bookingId.trim(),
        parkingId: parkingId || undefined,
      });

      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Request failed");
    } finally {
      setApiBusy(false);
    }
  }

  return (
    <>
      <OwnerNavbar />
      <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Gate Scan</h1>
              <p className="text-gray-400 text-sm mt-1">
                Parking: <span className="text-white/90">{parkingId || "(missing)"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("ENTRY")}
                className={
                  mode === "ENTRY"
                    ? "px-4 py-2 rounded-xl bg-white text-black"
                    : "px-4 py-2 rounded-xl border border-white/20"
                }
              >
                Entry
              </button>
              <button
                type="button"
                onClick={() => setMode("EXIT")}
                className={
                  mode === "EXIT"
                    ? "px-4 py-2 rounded-xl bg-white text-black"
                    : "px-4 py-2 rounded-xl border border-white/20"
                }
              >
                Exit
              </button>
            </div>
          </div>

          {(error || videoError) ? (
            <div className="mb-4 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {videoError || error}
            </div>
          ) : null}

          {result?.booking ? (
            <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <p className="text-green-200 font-semibold">{result.message}</p>
              <div className="text-sm text-gray-200 mt-2 grid sm:grid-cols-2 gap-2">
                <p><span className="text-gray-400">Booking:</span> {result.booking._id}</p>
                <p><span className="text-gray-400">Plate:</span> {result.booking.vehicleNumber}</p>
                <p><span className="text-gray-400">Gate:</span> {result.booking.gateStatus}</p>
                <p><span className="text-gray-400">Status:</span> {result.booking.status}</p>
                {(Number(result.booking.overstayFineDue || 0) > 0 || Number(result.booking.overstayFine || 0) > 0) ? (
                  <p className="sm:col-span-2">
                    <span className="text-amber-300 font-semibold">Overstay fine:</span>{" "}
                    ₹{Number(result.booking.overstayFineDue || result.booking.overstayFine || 0)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Number Plate Recognition</h2>
              <p className="text-gray-400 text-sm mt-1">
                Using PlateRecogniser API for high accuracy plate detection
              </p>

              <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
              </div>

              {plateRecognitionBusy ? (
                <p className="mt-3 text-xs text-gray-300">
                  {plateRecognitionHint || "Running recognition…"}
                </p>
              ) : plateRecognitionHint ? (
                <p className="mt-3 text-xs text-gray-400">
                  {plateRecognitionHint}
                  {plateRecognitionConfidence !== null ? (
                    <span> (confidence: {(plateRecognitionConfidence * 100).toFixed(0)}%)</span>
                  ) : null}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {!cameraOn ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-white text-black font-medium"
                  >
                    Start camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-xl border border-white/20"
                  >
                    Stop camera
                  </button>
                )}

                <button
                  type="button"
                  onClick={captureFrame}
                  disabled={!cameraOn}
                  className="px-4 py-2 rounded-xl border border-white/20 disabled:opacity-50"
                >
                  Capture
                </button>

                <button
                  type="button"
                  onClick={runPlateRecognition}
                  disabled={!cameraOn || plateRecognitionBusy}
                  className="px-4 py-2 rounded-xl border border-white/20 disabled:opacity-50"
                >
                  {plateRecognitionBusy ? "Recognizing…" : "Recognize Plate"}
                </button>
              </div>

              {capturedDataUrl ? (
                <img
                  src={capturedDataUrl}
                  alt="Captured frame"
                  className="mt-4 w-full rounded-2xl border border-white/10"
                />
              ) : null}

              <div className="mt-4">
                <label className="text-sm text-gray-300">Detected / Entered plate</label>
                <input
                  value={plateText}
                  onChange={(e) => setPlateText(e.target.value)}
                  placeholder="e.g. GJ12AB1234"
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Normalized: <span className="text-gray-300">{plateNormalized || "—"}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={submitPlate}
                disabled={apiBusy || !plateNormalized}
                className="mt-4 w-full bg-green-500 text-black py-3 rounded-xl hover:bg-green-400 disabled:opacity-60 font-medium"
              >
                {apiBusy ? "Submitting…" : mode === "ENTRY" ? "Allow entry (match booking)" : "Exit scan (CHECKED_OUT)"}
              </button>
            </div>

            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">QR Fallback</h2>
              <p className="text-gray-400 text-sm mt-1">
                If plate recognition fails, scan the QR from the receipt (or paste booking id).
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={qrBusy ? stopQrScan : startQrScan}
                  disabled={!supportsQrDetector()}
                  className="px-4 py-2 rounded-xl border border-white/20 disabled:opacity-50"
                  title={supportsQrDetector() ? "" : "BarcodeDetector not supported"}
                >
                  {qrBusy ? "Stop QR scan" : "Scan QR"}
                </button>

                {!supportsQrDetector() ? (
                  <span className="text-xs text-gray-500 self-center">
                    QR camera scan not supported here; use manual booking id.
                  </span>
                ) : null}
              </div>

              <div className="mt-4">
                <label className="text-sm text-gray-300">Booking ID (from QR or manual)</label>
                <input
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="Paste Booking ID"
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                />
              </div>

              <button
                type="button"
                onClick={submitBookingId}
                disabled={apiBusy || !bookingId.trim()}
                className="mt-4 w-full bg-white text-black py-3 rounded-xl hover:bg-gray-200 disabled:opacity-60 font-medium"
              >
                {apiBusy ? "Submitting…" : mode === "ENTRY" ? "Check in via QR" : "Check out via QR"}
              </button>

              <div className="mt-6 text-xs text-gray-500">
                Tip: for best recognition results, zoom in on the plate and keep it level.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
