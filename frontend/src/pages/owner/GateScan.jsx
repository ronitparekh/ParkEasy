import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import OwnerNavbar from "../../components/OwnerNavbar";
import api from "../../api/api";
import Tesseract from "tesseract.js";

function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

export default function GateScan() {
  const [params] = useSearchParams();
  const parkingId = params.get("parkingId") || "";

  const [mode, setMode] = useState("ENTRY"); // ENTRY | EXIT
  const [cameraOn, setCameraOn] = useState(false);
  const [videoError, setVideoError] = useState("");

  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [plateText, setPlateText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
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
  }, []);

  async function startCamera() {
    try {
      setVideoError("");
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

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
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedDataUrl(dataUrl);
    return dataUrl;
  }

  async function runOcr() {
    try {
      setError("");
      setResult(null);

      const dataUrl = capturedDataUrl || captureFrame();
      if (!dataUrl) {
        throw new Error("Capture a frame first");
      }

      setOcrBusy(true);
      setOcrProgress(0);

      const res = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(m.progress);
          }
        },
      });

      const raw = String(res?.data?.text ?? "");
      const normalized = normalizePlate(raw);

      if (!normalized) {
        setPlateText(raw.trim());
        throw new Error("OCR ran, but plate text looks empty. Try closer / better lighting, or type manually.");
      }

      setPlateText(normalized);
    } catch (e) {
      setError(e?.message || "OCR failed");
    } finally {
      setOcrBusy(false);
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
              </div>
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Number Plate Recognition</h2>
              {/* <p className="text-gray-400 text-sm mt-1">
                Demo-friendly OCR using camera + Tesseract.js.
              </p> */}

              <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!cameraOn ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-white text-black"
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
                  onClick={runOcr}
                  disabled={!cameraOn || ocrBusy}
                  className="px-4 py-2 rounded-xl border border-white/20 disabled:opacity-50"
                >
                  {ocrBusy ? `OCR… ${(ocrProgress * 100).toFixed(0)}%` : "Run OCR"}
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
                  placeholder="e.g. MH12AB1234"
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
                className="mt-4 w-full bg-green-500 text-black py-3 rounded-xl hover:bg-green-400 disabled:opacity-60"
              >
                {apiBusy ? "Submitting…" : mode === "ENTRY" ? "Allow entry (match booking)" : "Exit scan (CHECKED_OUT)"}
              </button>
            </div>

            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">QR Fallback</h2>
              <p className="text-gray-400 text-sm mt-1">
                If OCR fails, scan the QR from the receipt (or paste booking id).
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
                <label className="text-sm text-gray-300">Booking ID (from QR)</label>
                <input
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="Paste booking _id"
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3"
                />
              </div>

              <button
                type="button"
                onClick={submitBookingId}
                disabled={apiBusy || !bookingId.trim()}
                className="mt-4 w-full bg-white text-black py-3 rounded-xl hover:bg-gray-200 disabled:opacity-60"
              >
                {apiBusy ? "Submitting…" : mode === "ENTRY" ? "Check in via QR" : "Check out via QR"}
              </button>

              <div className="mt-6 text-xs text-gray-500">
                Tip: for best OCR results, zoom in on the plate and keep it level.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
