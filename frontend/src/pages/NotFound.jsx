import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-gray-400 mb-6">
        Page not found
      </p>
      <Link
        to="/"
        className="bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-200"
      >
        Go Home
      </Link>
    </div>
  );
}
