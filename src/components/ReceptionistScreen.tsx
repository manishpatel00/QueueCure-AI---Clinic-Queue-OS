/**
 * Receptionist workflow for QueueCure AI.
 *
 * This screen is optimized for speed and mistake-proofing: keyboard-first
 * patient entry, a big call-next action, and a live queue list that mirrors the
 * patient screen immediately.
 *
 * Advanced dashboard layout inspired by modern clinic management UIs with
 * glassmorphism, gradient accents, and micro-animations.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { clampMinutes, formatMinutes, formatToken, type QueueInsights, type QueueState } from "@/lib/queue";

interface ReceptionistScreenProps {
  state: QueueState;
  insights: QueueInsights;
  isBusy: boolean;
  pendingAction: "add-patient" | "call-next" | "set-avg" | null;
  error: string | null;
  onAddPatient: (name: string) => Promise<void>;
  onCallNext: () => Promise<void>;
  onSetAvgTime: (minutes: number) => Promise<void>;
  onClearError: () => void;
}

export function ReceptionistScreen({
  state,
  insights,
  isBusy,
  pendingAction,
  error,
  onAddPatient,
  onCallNext,
  onSetAvgTime,
  onClearError,
}: ReceptionistScreenProps) {
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [manualMinutes, setManualMinutes] = useState(state.manualAvgTime);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    setManualMinutes(state.manualAvgTime);
  }, [state.manualAvgTime]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusNonce]);

  const canCallNext = state.queue.length > 0 && !isBusy;
  const showRealAverage = state.isRealAverage;
  const averageSummary = showRealAverage ? `Based on ${state.dataPoints} completed consultations` : "Estimated";

  const queueRows = state.queue;
  const waitingRows = queueRows.filter(p => p.status === "waiting");
  const servingPatient = queueRows.find(p => p.status === "serving") ?? null;

  // Count stats
  const completedCount = state.history.length;
  const missedCount = state.history.filter(h => !h.counted && h.durationMinutes < 1).length;
  const emergencyCount = 0; // Placeholder for future emergency feature

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onAddPatient(draftName);
      setDraftName("");
      setDraftPhone("");
      setFocusNonce((value) => value + 1);
      onClearError();
    } catch {
      inputRef.current?.focus();
    }
  }

  async function handleAvgChange(nextValue: number) {
    const clampedValue = clampMinutes(nextValue);
    setManualMinutes(clampedValue);
    await onSetAvgTime(clampedValue);
  }

  function getWaitTime(index: number): string {
    return `~${Math.round((index + 1) * state.avgTime)} min`;
  }

  return (
    <section className="animate-float-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Receptionist Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage your clinic queue efficiently
          </p>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Add Patient Button */}
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] hover:shadow-emerald-900/30"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Patient
        </button>

        {/* Call Next Button */}
        <button
          type="button"
          onClick={() => void onCallNext()}
          disabled={!canCallNext}
          className="btn-call-next text-sm"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          {pendingAction === "call-next" ? "Calling..." : "Call Next"}
        </button>

        {/* QR Code Button */}
        <button
          type="button"
          onClick={() => setShowQR(!showQR)}
          className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] ${
            showQR
              ? "bg-violet-500/20 text-violet-300 border border-violet-400/30"
              : "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-900/20"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
          </svg>
          QR Code
        </button>

        {/* Analytics Button */}
        <button
          type="button"
          onClick={() => setShowAnalytics(!showAnalytics)}
          className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] ${
            showAnalytics
              ? "bg-pink-500/20 text-pink-300 border border-pink-400/30"
              : "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-900/20"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Analytics
        </button>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* Current Patient Card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <span className="badge badge-serving text-[11px]">Current Patient</span>
          </div>

          {servingPatient ? (
            <div className="mt-4">
              <p
                className="gradient-text text-4xl font-extrabold animate-token-pulse"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Token {servingPatient.token}
              </p>
              <p className="mt-2 text-base font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                {servingPatient.name}
              </p>
              {draftPhone && (
                <p className="mt-0.5 text-xs text-slate-400 font-mono">{draftPhone}</p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => void onCallNext()}
                  disabled={!canCallNext}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Complete
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm font-medium text-rose-300 transition-all hover:bg-rose-500/25"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-500" style={{ fontFamily: "var(--font-display)" }}>
                --
              </p>
              <p className="mt-2 text-sm text-slate-400">No patient being served</p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => void onCallNext()}
                  disabled={!canCallNext}
                  className="btn-call-next w-full text-sm py-2.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {pendingAction === "call-next" ? "Calling..." : "Call Next"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Queue Stats Card */}
        <div className="glass-card p-5">
          <h3
            className="text-sm font-semibold tracking-wide text-slate-300"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Queue Stats
          </h3>

          <div className="mt-4 space-y-2.5">
            {[
              { label: "Waiting", value: insights.waitingCount, color: "text-sky-400", border: "border-l-sky-400" },
              { label: "Completed", value: completedCount, color: "text-emerald-400", border: "border-l-emerald-400" },
              { label: "Missed", value: missedCount, color: "text-rose-400", border: "border-l-rose-400" },
              { label: "Emergency", value: emergencyCount, color: "text-amber-400", border: "border-l-amber-400" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-4 py-3 border-l-2 ${stat.border} transition-all hover:bg-white/5`}
              >
                <span className="text-sm text-slate-300">{stat.label}</span>
                <span className={`text-lg font-bold ${stat.color}`} style={{ fontFamily: "var(--font-mono)" }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Consultation Time Card */}
        <div className="glass-card p-5">
          <h3
            className="text-sm font-semibold tracking-wide text-slate-300"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Consultation Time
          </h3>

          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-6">
            <p className="text-xs uppercase tracking-widest text-slate-400">Average Duration</p>
            <p
              className="mt-2 text-4xl font-extrabold text-emerald-400"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatMinutes(state.avgTime)}
            </p>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            {averageSummary}
          </p>

          {/* Slider */}
          <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Manual estimate</span>
              <span className="text-xs font-medium text-slate-300" style={{ fontFamily: "var(--font-mono)" }}>
                {manualMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={manualMinutes}
              onChange={(event) => void handleAvgChange(Number(event.target.value))}
              className="mt-2 w-full"
              aria-label="Fallback consultation minutes"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>1 min</span>
              <span>{showRealAverage ? "Fallback" : "Active"}</span>
              <span>60 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Patient Form */}
      <div className="glass-card p-5">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3" onSubmit={handleSubmit}>
          <div className="flex-1">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Patient Name
              </span>
              <input
                ref={inputRef}
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Enter patient name"
                className="input-glass"
                aria-describedby="patient-name-help"
              />
            </label>
          </div>
          <div className="w-full sm:w-48">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Phone (optional)
              </span>
              <input
                type="tel"
                value={draftPhone}
                onChange={(event) => setDraftPhone(event.target.value)}
                placeholder="Phone number"
                className="input-glass"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isBusy || !draftName.trim()}
            className="btn-primary min-h-[50px] px-6 whitespace-nowrap"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {pendingAction === "add-patient" ? "Adding..." : "Add to Queue"}
          </button>
        </form>
        <p id="patient-name-help" className="mt-2 text-xs text-slate-500">
          Type a name, press Enter. Token is auto-generated and the input re-focuses.
        </p>
      </div>

      {/* Waiting Queue */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div>
            <h3
              className="text-lg font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Waiting Queue ({waitingRows.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">Patients waiting to be called</p>
          </div>
          <span className="badge badge-live">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {insights.queueStatusLabel}
          </span>
        </div>

        {waitingRows.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center">
            <svg className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-400">No patients waiting</p>
            <p className="mt-1 text-xs text-slate-500">Add the next patient and they will appear here instantly.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {waitingRows.map((patient, index) => (
              <li
                key={patient.id}
                className="animate-slide-up glass-card-inner flex items-center justify-between gap-4 px-5 py-4"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sm font-bold text-sky-400" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatToken(patient.token)}
                  </div>
                  <div>
                    <p className="font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                      Token {patient.token}: {patient.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Waiting for {Math.round((Date.now() - patient.addedAt) / 60000)} minutes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-300" style={{ fontFamily: "var(--font-mono)" }}>
                    {getWaitTime(index)}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-400 transition-all hover:text-rose-300"
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Completions */}
      {insights.recentHistory.length > 0 && (
        <div className="glass-card p-5">
          <h3
            className="text-sm font-semibold tracking-wide text-slate-300"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recent Completions
          </h3>
          <ul className="mt-4 space-y-2">
            {insights.recentHistory.map((entry) => (
              <li key={`${entry.id}-${entry.endedAt}`} className="glass-card-inner px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-bold text-emerald-400" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatToken(entry.token)}
                    </span>
                    <span className="text-sm font-medium text-white">{entry.name}</span>
                  </div>
                  <span className={`text-sm font-semibold ${entry.counted ? "text-emerald-400" : "text-amber-400"}`} style={{ fontFamily: "var(--font-mono)" }}>
                    {formatMinutes(entry.durationMinutes)}
                  </span>
                </div>
                <p className="mt-1.5 pl-11 text-xs text-slate-500">{entry.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="glass-card animate-soft-pop p-6 text-center">
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Patient Queue QR Code
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Patients can scan this to view their live queue position
          </p>
          <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-2xl border border-white/10 bg-white p-4">
            <svg className="h-36 w-36 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
              <rect x="10" y="10" width="10" height="10" />
              <rect x="20" y="10" width="10" height="10" />
              <rect x="30" y="10" width="10" height="10" />
              <rect x="10" y="20" width="10" height="10" />
              <rect x="30" y="20" width="10" height="10" />
              <rect x="10" y="30" width="10" height="10" />
              <rect x="20" y="30" width="10" height="10" />
              <rect x="30" y="30" width="10" height="10" />
              <rect x="50" y="10" width="10" height="10" />
              <rect x="60" y="10" width="10" height="10" />
              <rect x="70" y="10" width="10" height="10" />
              <rect x="80" y="10" width="10" height="10" />
              <rect x="60" y="20" width="10" height="10" />
              <rect x="80" y="20" width="10" height="10" />
              <rect x="60" y="30" width="10" height="10" />
              <rect x="70" y="30" width="10" height="10" />
              <rect x="80" y="30" width="10" height="10" />
              <rect x="50" y="50" width="10" height="10" />
              <rect x="10" y="60" width="10" height="10" />
              <rect x="20" y="60" width="10" height="10" />
              <rect x="30" y="60" width="10" height="10" />
              <rect x="10" y="70" width="10" height="10" />
              <rect x="30" y="70" width="10" height="10" />
              <rect x="10" y="80" width="10" height="10" />
              <rect x="20" y="80" width="10" height="10" />
              <rect x="30" y="80" width="10" height="10" />
              <rect x="60" y="60" width="10" height="10" />
              <rect x="80" y="70" width="10" height="10" />
              <rect x="60" y="80" width="10" height="10" />
              <rect x="80" y="80" width="10" height="10" />
            </svg>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Opens patient view at: {window.location.origin}/?view=patient
          </p>
          <button
            type="button"
            onClick={() => setShowQR(false)}
            className="btn-secondary mt-4 text-xs"
          >
            Close
          </button>
        </div>
      )}

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="glass-card animate-soft-pop p-5">
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Queue Analytics
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="stat-card text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Total Served</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>{completedCount}</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Avg Wait Time</p>
              <p className="mt-2 text-3xl font-bold text-sky-400" style={{ fontFamily: "var(--font-display)" }}>{formatMinutes(state.avgTime)}</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Queue Length</p>
              <p className="mt-2 text-3xl font-bold text-violet-400" style={{ fontFamily: "var(--font-display)" }}>{state.queue.length}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalytics(false)}
            className="btn-secondary mt-4 text-xs"
          >
            Close Analytics
          </button>
        </div>
      )}

      {/* Error */}
      {error ? (
        <div className="animate-soft-pop flex items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200 backdrop-blur-xl" role="alert">
          <svg className="h-5 w-5 flex-shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      ) : null}
    </section>
  );
}
