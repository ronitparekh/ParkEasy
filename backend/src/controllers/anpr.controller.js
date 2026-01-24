import axios from "axios";
import FormData from "form-data";

/**
 * PlateRecogniser API Controller
 * Uses platerecogniser.com API for accurate ANPR
 */

/**
 * Score a plate candidate for quality
 */
function scorePlateCandidate(token) {
  const s = String(token ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

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

  // Prefer Indian-style format
  if (/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/.test(s)) score += 15;

  score -= Math.abs(10 - len);
  return { plate: s, score };
}

/**
 * Extract best plate from PlateRecogniser results
 */
function extractBestPlateFromApi(results) {
  if (!results?.length) return "";

  // Sort by confidence descending
  const sorted = [...results].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  for (const result of sorted) {
    const plate = String(result.plate || "").trim();
    if (plate) {
      const scored = scorePlateCandidate(plate);
      if (scored.score >= 10) return scored.plate; // Good quality
    }
  }

  // Fallback: just take the highest confidence one
  return sorted[0]?.plate ? scorePlateCandidate(sorted[0].plate).plate : "";
}

/**
 * Scan plate using PlateRecogniser API
 * POST /anpr/scan
 * Body: multipart/form-data with "image" field
 * Returns: { plate, confidence, method }
 */
export const scanPlate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const PLATE_RECOGNISER_API_KEY = process.env.PLATE_RECOGNISER_API_KEY;
    if (!PLATE_RECOGNISER_API_KEY) {
      return res.status(500).json({
        error: "PlateRecogniser API key not configured. Add PLATE_RECOGNISER_API_KEY to .env",
      });
    }

    // Prepare image for PlateRecogniser API
    const imageBuffer = req.file.buffer;
    
    // Create FormData for multipart request
    const formData = new FormData();
    formData.append("upload", imageBuffer, {
      filename: "image.jpg",
      contentType: req.file.mimetype,
    });

    // Call PlateRecogniser API with FormData
    const prApiUrl = "https://api.platerecognizer.com/v1/plate-reader/";
    const prResponse = await axios.post(
      prApiUrl,
      formData,
      {
        headers: {
          Authorization: `Token ${PLATE_RECOGNISER_API_KEY}`,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    // Extract plate from response
    // PlateRecogniser API returns: { results: [{plate: "ABC123", confidence: 0.95}, ...] }
    const results = prResponse.data?.results || [];
    
    if (!results.length) {
      return res.status(200).json({
        plate: "",
        confidence: 0,
        method: "platerecogniser",
        message: "No plate detected",
      });
    }

    // Get best plate by confidence
    let bestPlate = "";
    let bestConfidence = 0;

    for (const result of results) {
      const plate = String(result.plate || "").trim();
      const confidence = Number(result.confidence || 0);
      
      if (confidence > bestConfidence) {
        const scored = scorePlateCandidate(plate);
        // Accept if: high confidence (>0.5) OR decent heuristic score (>5)
        // This is more lenient than requiring high scores on both
        if (confidence > 0.5 || scored.score > 5) {
          bestPlate = scored.plate;
          bestConfidence = confidence;
        }
      }
    }

    // If we found nothing with thresholds, just take the highest confidence one
    if (!bestPlate && results.length > 0) {
      const topResult = results[0];
      const plate = String(topResult.plate || "").trim();
      if (plate) {
        const scored = scorePlateCandidate(plate);
        bestPlate = scored.plate;
        bestConfidence = Number(topResult.confidence || 0);
      }
    }

    return res.status(200).json({
      plate: bestPlate,
      confidence: bestConfidence,
      method: "platerecogniser",
      allResults: results, // Debug: return all results
    });
  } catch (error) {
    console.error("[ANPR] Error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });

    // If PlateRecogniser fails, return error but don't crash
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Invalid PlateRecogniser API key. Check PLATE_RECOGNISER_API_KEY in .env",
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: "PlateRecogniser rate limit exceeded. Try again later.",
      });
    }

    if (error.response?.status === 400) {
      return res.status(400).json({
        error: `Bad request to PlateRecogniser: ${error.response?.data?.message || error.message}`,
        debug: error.response?.data,
      });
    }

    // Network or other errors
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "Cannot reach PlateRecogniser API. Check your internet connection.",
      });
    }

    return res.status(500).json({
      error: error.message || "Plate recognition failed",
    });
  }
};

export default { scanPlate };
