import axios from "axios";

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
    const imageBase64 = imageBuffer.toString("base64");

    // Call PlateRecogniser API
    const prApiUrl = "https://api.platerecognizer.com/v1/plate-reader/";
    const prResponse = await axios.post(
      prApiUrl,
      {
        uploads: [
          {
            image: `data:${req.file.mimetype};base64,${imageBase64}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Token ${PLATE_RECOGNISER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    // Extract plate from response
    const uploads = prResponse.data?.uploads || [];
    if (!uploads.length) {
      return res.status(200).json({
        plate: "",
        confidence: 0,
        method: "platerecogniser",
        message: "No plate detected",
      });
    }

    const upload = uploads[0];
    const results = upload.results || [];

    // Get best plate
    let bestPlate = extractBestPlateFromApi(results);
    let bestConfidence = 0;

    if (results.length && bestPlate) {
      // Find the result for this plate
      const matchingResult = results.find(
        (r) => scorePlateCandidate(r.plate).plate === bestPlate
      );
      if (matchingResult) {
        bestConfidence = Number(matchingResult.confidence || 0);
      }
    }

    return res.status(200).json({
      plate: bestPlate,
      confidence: bestConfidence,
      method: "platerecogniser",
      allResults: results, // Debug: return all results
    });
  } catch (error) {
    console.error("[ANPR] PlateRecogniser error:", error.message);

    // If PlateRecogniser fails, return error but don't crash
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Invalid PlateRecogniser API key",
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: "PlateRecogniser rate limit exceeded. Try again later.",
      });
    }

    return res.status(500).json({
      error: error.message || "Plate recognition failed",
    });
  }
};

export default { scanPlate };
