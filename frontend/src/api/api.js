import axios from "axios";

const envBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const baseURL = envBaseUrl
  ? envBaseUrl.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "http://localhost:5000"
    : "";

if (!baseURL) {
  // On Vercel, VITE_* variables are baked at build time.
  // If this triggers in production, set VITE_API_URL in Vercel and redeploy.
  throw new Error("Missing VITE_API_URL. Set it in Vercel project env vars and redeploy.");
}

const api = axios.create({
  baseURL,
});

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
