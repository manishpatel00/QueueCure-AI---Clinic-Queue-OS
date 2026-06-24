/**
 * QueueCure AI — Clinic Queue OS
 *
 * The app presents a premium landing page with role selection (Receptionist /
 * Patient), then opens into the corresponding dashboard. All queue logic is
 * preserved exactly as-is through the useQueue hook and lib/queue.ts.
 */

import { useEffect, useMemo, useState } from "react";
import { PatientScreen } from "@/components/PatientScreen";
import { ReceptionistScreen } from "@/components/ReceptionistScreen";
import { useQueue } from "@/hooks/useQueue";

type ViewMode = "landing" | "split" | "receptionist" | "patient";

function readViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return "landing";
  }

  const view = new URLSearchParams(window.location.search).get("view");

  if (view === "receptionist" || view === "patient" || view === "split") {
    return view;
  }

  return "landing";
}

function writeViewMode(viewMode: ViewMode) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", viewMode);
  window.history.replaceState({}, "", url.toString());
}

/* ── Animated orbit decorations for landing page ── */
function OrbitDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Top gradient orb */}
      <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-br from-sky-500/20 via-violet-500/10 to-transparent blur-3xl" />

      {/* Right accent orb */}
      <div className="absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/3 rounded-full bg-violet-500/8 blur-3xl" />

      {/* Bottom left glow */}
      <div className="absolute -bottom-20 left-0 h-[300px] w-[500px] -translate-x-1/4 rounded-full bg-cyan-500/6 blur-3xl" />

      {/* Subtle grid/dot pattern */}
      <div className="dot-pattern absolute inset-0 opacity-30" />
    </div>
  );
}

/* ── Logo with gradient AI sparkle ── */
function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const textSize = size === "lg" ? "text-5xl sm:text-6xl lg:text-7xl" : "text-xl";
  const sparkleSize = size === "lg" ? "text-4xl sm:text-5xl" : "text-lg";

  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`${sparkleSize} gradient-text font-bold`} style={{ fontFamily: "var(--font-display)" }}>
        ✦
      </span>
      <h1
        className={`${textSize} font-extrabold tracking-tight text-white`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        Queue<span className="gradient-text">Cure</span>{" "}
        <span className="gradient-text-warm">AI</span>
      </h1>
    </div>
  );
}

/* ── Landing page ── */
function LandingPage({ onEnter }: { onEnter: (mode: ViewMode) => void }) {
  const features = {
    receptionist: [
      "Add patients in seconds",
      "Auto-generate tokens",
      "Real-time queue view",
      "Emergency prioritization",
      "Live analytics",
    ],
    patient: [
      "View your token number",
      "See patients ahead",
      "Estimated wait time",
      "Live queue updates",
      "Mobile friendly",
    ],
  };

  const openInNewTab = (mode: "receptionist" | "patient") => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <OrbitDecoration />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-12">
        {/* Hero */}
        <div className="animate-float-in flex flex-col items-center gap-5 text-center">
          <Logo size="lg" />

          <p
            className="mt-2 text-lg font-medium tracking-wide text-slate-300 sm:text-xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Clinic Queue OS
          </p>

          <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Replace paper tokens with intelligent digital queuing. Real-time updates,
            predictive wait times, and complete analytics for modern clinics.
          </p>
        </div>

        {/* Role Cards */}
        <div className="animate-slide-up stagger-2 grid w-full gap-6 md:grid-cols-2">
          {/* Receptionist Card */}
          <div className="glass-card group p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
                <svg className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Receptionist
                </h3>
                <p className="text-xs font-medium text-slate-400">Clinic Staff</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Manage the queue, add patients, call next, handle emergencies, and view analytics.
            </p>

            <ul className="mt-5 space-y-2.5">
              {features.receptionist.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => onEnter("receptionist")}
                className="btn-primary w-full py-3.5 text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Enter Dashboard
              </button>
              <button
                onClick={() => openInNewTab("receptionist")}
                className="btn-secondary w-full text-xs"
              >
                Open in new tab ↗
              </button>
            </div>
          </div>

          {/* Patient Card */}
          <div className="glass-card group p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10">
                <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 18h6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Patient
                </h3>
                <p className="text-xs font-medium text-slate-400">Waiting Room View</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Check your queue position, wait time, and see who's being called.
            </p>

            <ul className="mt-5 space-y-2.5">
              {features.patient.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => onEnter("patient")}
                className="btn-secondary w-full border-violet-400/20 py-3.5 text-base hover:border-violet-400/40 hover:bg-violet-400/10"
                style={{ fontFamily: "var(--font-display)" }}
              >
                View Queue
              </button>
              <button
                onClick={() => openInNewTab("patient")}
                className="btn-secondary w-full text-xs"
              >
                Open in new tab ↗
              </button>
            </div>
          </div>
        </div>

        {/* Demo mode strip */}
        <div className="animate-fade-in stagger-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onEnter("split")}
            className="btn-secondary gap-2 text-xs"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Split Demo View
          </button>
        </div>

        {/* Footer branding */}
        <p className="animate-fade-in stagger-6 text-xs text-slate-500">
          Built for modern clinics • Real-time sync • Zero refreshes
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const queue = useQueue();
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);

  useEffect(() => {
    const handlePopState = () => setViewMode(readViewMode());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    writeViewMode(viewMode);
  }, [viewMode]);

  const handleEnter = (mode: ViewMode) => {
    setViewMode(mode);
    writeViewMode(mode);
  };

  const handleBack = () => {
    setViewMode("landing");
    writeViewMode("landing");
  };

  const openView = (mode: Exclude<ViewMode, "split" | "landing">) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const modeButtons = useMemo(
    () => [
      { id: "split" as const, label: "Split View" },
      { id: "receptionist" as const, label: "Receptionist" },
      { id: "patient" as const, label: "Patient" },
    ],
    [],
  );

  if (viewMode === "landing") {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] text-slate-100">
        <LandingPage onEnter={handleEnter} />
      </div>
    );
  }

  return (
    <div className="noise-overlay min-h-screen bg-[var(--bg-deep)] text-slate-100">
      <OrbitDecoration />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Top Nav Bar */}
        <header className="animate-float-in flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="btn-secondary gap-2 text-xs"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Menu
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="gradient-text text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>✦</span>
              <span className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                QueueCure <span className="gradient-text-warm">AI</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Connection status */}
            <div className="badge badge-live">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {queue.connectionLabel}
            </div>

            {/* View mode toggles */}
            <div className="flex gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
              {modeButtons.map((button) => (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => setViewMode(button.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    viewMode === button.id
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {button.label}
                </button>
              ))}
            </div>

            {/* Open in new tab buttons */}
            <button
              type="button"
              onClick={() => openView("receptionist")}
              className="btn-secondary gap-1.5 py-1.5 text-xs"
            >
              Open receptionist tab
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => openView("patient")}
              className="btn-secondary gap-1.5 py-1.5 text-xs"
            >
              Open patient tab
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content area */}
        {viewMode === "split" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <ReceptionistScreen
              state={queue.state}
              insights={queue.insights}
              isBusy={queue.pendingAction !== null}
              pendingAction={queue.pendingAction}
              error={queue.error}
              onAddPatient={queue.addPatient}
              onCallNext={queue.callNext}
              onSetAvgTime={queue.setAvgTime}
              onClearError={queue.clearError}
            />
            <PatientScreen state={queue.state} insights={queue.insights} connectionLabel={queue.connectionLabel} />
          </div>
        ) : viewMode === "receptionist" ? (
          <ReceptionistScreen
            state={queue.state}
            insights={queue.insights}
            isBusy={queue.pendingAction !== null}
            pendingAction={queue.pendingAction}
            error={queue.error}
            onAddPatient={queue.addPatient}
            onCallNext={queue.callNext}
            onSetAvgTime={queue.setAvgTime}
            onClearError={queue.clearError}
          />
        ) : (
          <PatientScreen state={queue.state} insights={queue.insights} connectionLabel={queue.connectionLabel} />
        )}
      </main>
    </div>
  );
}
