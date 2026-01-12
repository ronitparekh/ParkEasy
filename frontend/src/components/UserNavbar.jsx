import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UserNavbar() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    setOpen(false);
    logout();
  }

  return (
    <nav className="bg-[#0f172a] border-b border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/user/dashboard" className="text-xl font-bold text-white">
            Park-Easy
          </Link>

          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="user-nav-menu"
            aria-label="Toggle navigation"
          >
            {open ? "Close" : "Menu"}
          </button>

          {/* Desktop */}
          <div className="hidden md:flex gap-6 items-center">
            <Link to="/user/dashboard" className="text-gray-300 hover:text-white">
              Dashboard
            </Link>
            <Link to="/user/history" className="text-gray-300 hover:text-white">
              History
            </Link>
            <button
              onClick={handleLogout}
              className="bg-white text-black px-4 py-2 rounded-xl hover:bg-gray-200"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div
          id="user-nav-menu"
          className={
            (open ? "block" : "hidden") +
            " md:hidden mt-4 rounded-2xl border border-white/10 bg-black/20 p-3"
          }
        >
          <div className="flex flex-col gap-2">
            <Link
              to="/user/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 text-gray-200 hover:bg-white/5"
            >
              Dashboard
            </Link>
            <Link
              to="/user/history"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 text-gray-200 hover:bg-white/5"
            >
              History
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 w-full rounded-xl bg-white px-4 py-2 text-black hover:bg-gray-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
