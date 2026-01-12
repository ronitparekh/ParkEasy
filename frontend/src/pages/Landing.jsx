import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/15" />
            <div>
              <p className="text-sm font-semibold tracking-tight">Park-Easy</p>
              <p className="text-xs text-white/60">Smart parking, made simple</p>
            </div>
          </div>

          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white/90"
          >
            Sign in
          </Link>
        </header>

        <main className="mt-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live availability • instant booking
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                Find parking nearby.
                <span className="block text-white/80">Book in seconds.</span>
              </h1>

              <p className="mt-4 max-w-xl text-base text-white/70">
                Search trusted parking spots, compare pricing, get directions, and pay—without wasting time circling the block.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white/90"
                >
                  Get started
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  List your space
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Transparent pricing</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Real-time distance</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Fast checkout</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10">
              <div className="grid gap-4">
                <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <p className="text-sm font-semibold">What you get</p>
                  <p className="mt-1 text-sm text-white/65">
                    A clean dashboard to search, filter by distance, and book the best spot.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                    <p className="text-sm font-semibold">Nearby spots</p>
                    <p className="mt-1 text-sm text-white/65">Uses your location to sort by distance.</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                    <p className="text-sm font-semibold">Instant directions</p>
                    <p className="mt-1 text-sm text-white/65">One tap to open Google Maps.</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <p className="text-sm font-semibold">Simple payments</p>
                  <p className="mt-1 text-sm text-white/65">Confirm total and save it to your history.</p>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-14">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10">
                <p className="text-sm font-semibold">Search</p>
                <p className="mt-2 text-sm text-white/65">Find parking by name or area, then filter by distance.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10">
                <p className="text-sm font-semibold">Book</p>
                <p className="mt-2 text-sm text-white/65">Pick a time window and see your total instantly.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10">
                <p className="text-sm font-semibold">Go</p>
                <p className="mt-2 text-sm text-white/65">Get directions and keep receipts in your history.</p>
              </div>
            </div>
          </section>

          <section className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-8 ring-1 ring-white/10">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Ready to park smarter?</h2>
                <p className="mt-2 text-sm text-white/70">Create an account to start booking or list your space as an owner.</p>
              </div>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white/90"
              >
                Continue
              </Link>
            </div>
          </section>
        </main>

        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-white/50">
          © {2025} Park-Easy. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
