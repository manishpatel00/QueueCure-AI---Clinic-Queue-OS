/**
 * Patient waiting-room view for QueueCure AI.
 *
 * This screen stays passive and event-driven. It never polls; it only reacts
 * to live state pushed from the same shared queue model used by the reception
 * desk.
 *
 * Premium design with glassmorphism, animated token display, and real-time
 * queue position tracking.
 */

import { formatMinutes, formatToken, type QueueInsights, type QueueState } from "@/lib/queue";

interface PatientScreenProps {
  state: QueueState;
  insights: QueueInsights;
  connectionLabel: string;
}

export function PatientScreen({ state, insights, connectionLabel }: PatientScreenProps) {
  const currentTokenLabel = formatToken(state.currentToken);
  const estimatedWaitLabel = insights.queueClear ? "Queue clear" : `~${formatMinutes(insights.estimatedWaitMinutes)}`;

  return (
    <section className="animate-float-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/15">
              <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 18h6" />
              </svg>
            </div>
            <div>
              <h2
                className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Patient View
              </h2>
              <p className="text-xs text-slate-400">Live waiting room display</p>
            </div>
          </div>
        </div>

        <div className="badge badge-live">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          {connectionLabel}
        </div>
      </div>

      {/* Current Token Hero */}
      <div className="glass-card overflow-hidden p-0">
        {/* Accent gradient stripe at top */}
        <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500" />

        <div className="p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Current token being seen
          </p>

          <div className="mt-6 flex flex-col items-center sm:flex-row sm:items-end sm:gap-8">
            {/* Token display */}
            <div
              key={state.currentToken ?? "none"}
              className="animate-soft-pop relative"
            >
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-sky-400/10 via-violet-500/5 to-transparent blur-2xl" />
              <div className="relative flex min-h-28 min-w-40 items-center justify-center rounded-[28px] border border-sky-400/20 bg-gradient-to-br from-sky-400/10 via-violet-400/5 to-transparent px-10 py-4 animate-border-glow">
                <span
                  className="text-6xl font-extrabold text-white animate-token-pulse sm:text-7xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {currentTokenLabel}
                </span>
              </div>
            </div>

            {/* Current patient info */}
            <div className="mt-4 text-center sm:mt-0 sm:text-left">
              {state.currentName ? (
                <>
                  <p className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {state.currentName}
                  </p>
                  <p className="mt-1 text-xs text-emerald-400 font-medium">Currently being served</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No patient is currently being seen</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Tokens Ahead */}
        <div className="glass-card p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/10">
            <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-widest text-slate-400">Tokens Ahead</p>
          <p
            className="mt-1 text-4xl font-extrabold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {insights.tokensAhead}
          </p>
        </div>

        {/* Estimated Wait */}
        <div className="glass-card p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10">
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-widest text-slate-400">Estimated Wait</p>
          <p
            className="mt-1 text-4xl font-extrabold gradient-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {estimatedWaitLabel}
          </p>
        </div>

        {/* Queue Status */}
        <div className="glass-card p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-widest text-slate-400">Status</p>
          <p
            className="mt-1 text-lg font-bold text-emerald-400"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {insights.queueClear ? "Queue Clear" : insights.queueStatusLabel}
          </p>
        </div>
      </div>

      {/* Average Info Bar */}
      <div className="glass-card-inner flex items-center gap-3 px-5 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10">
          <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
        <div className="text-sm">
          <span className="font-medium text-white">{insights.averageLabel}</span>{" "}
          <span className="text-slate-400">({formatMinutes(state.avgTime)} per token, {insights.averageSourceLabel})</span>
        </div>
      </div>

      {/* Upcoming Queue List */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
          <h3
            className="text-lg font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Upcoming Queue
          </h3>
          <span className="badge badge-accent text-[11px]">
            {insights.upcomingPatients.length} in line
          </span>
        </div>

        {insights.upcomingPatients.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10">
              <svg className="h-7 w-7 text-sky-400/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-400">No one is waiting</p>
            <p className="mt-1 text-xs text-slate-500">The next token will appear here instantly.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {insights.upcomingPatients.map((patient, index) => (
              <li
                key={patient.id}
                className="animate-slide-up glass-card-inner flex items-center justify-between gap-4 px-5 py-4"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                      index === 0
                        ? "bg-sky-400/15 text-sky-400"
                        : "bg-white/5 text-slate-400"
                    }`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatToken(patient.token)}
                  </div>
                  <div>
                    <p className="font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                      {patient.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {index === 0 ? "Next in line" : `Position ${index + 1}`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-xs font-medium ${patient.status === "serving" ? "text-violet-400" : "text-slate-400"}`}>
                    {patient.status === "serving" ? "Serving" : "Waiting"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500" style={{ fontFamily: "var(--font-mono)" }}>
                    ETA {formatMinutes((index + 1) * state.avgTime)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Queue status footer */}
      <div className="glass-card-inner px-5 py-3 text-center text-sm text-slate-400">
        {insights.queueClear ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-emerald-400 font-medium">Queue is clear — no wait!</span>
          </div>
        ) : (
          <span>The queue is moving. {insights.queueStatusLabel}.</span>
        )}
      </div>
    </section>
  );
}
