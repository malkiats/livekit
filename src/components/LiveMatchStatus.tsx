"use client";

import { useEffect, useMemo, useState } from "react";

type LiveMatchMode = "dashboard" | "searching" | "connected";

interface LiveStats {
  waitingCount: number;
}

interface LiveMatchStatusProps {
  mode: LiveMatchMode;
  secondsWaiting?: number;
  className?: string;
}

const SEARCHING_MESSAGES = [
  "Matching you now...",
  "Finding someone near your interests...",
  "Checking for the best available match...",
  "Almost there...",
];

const DASHBOARD_MESSAGES = [
  "Matching you now...",
  "Join in seconds and start a real conversation.",
  "New people are connecting right now.",
];

export default function LiveMatchStatus({
  mode,
  secondsWaiting = 0,
  className = "",
}: LiveMatchStatusProps) {
  const [stats, setStats] = useState<LiveStats>({
    waitingCount: 0,
  });
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/live-stats", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as LiveStats;
        if (active) {
          setStats(data);
        }
      } catch {
        // Keep the last known real stats if fetching fails.
      }
    };

    fetchStats();
    const intervalId = window.setInterval(fetchStats, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const messages = mode === "dashboard" ? DASHBOARD_MESSAGES : SEARCHING_MESSAGES;
    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 2400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mode]);

  const activeMessages = mode === "dashboard" ? DASHBOARD_MESSAGES : SEARCHING_MESSAGES;
  const activeMessage = activeMessages[messageIndex % activeMessages.length];

  const heading = useMemo(() => {
    if (mode === "searching") {
      return `Searching for ${secondsWaiting}s...`;
    }

    if (mode === "connected") {
      return "You are live now";
    }

    return "Meet someone new in seconds";
  }, [mode, secondsWaiting]);

  return (
    <div className={`rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-xl ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
          <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
          Live matching
        </div>
        <div className="text-sm font-medium text-slate-100">{heading}</div>
      </div>

      <p className="mt-3 min-h-6 text-sm text-slate-300 transition-opacity duration-500">
        {mode === "connected" ? "You are connected with a new person." : activeMessage}
      </p>

      <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/40 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">People waiting</p>
        <p className="mt-1 text-2xl font-bold text-white">{stats.waitingCount.toLocaleString()}</p>
        <p className="text-xs text-slate-400">Real-time queue count from this app instance</p>
      </div>
    </div>
  );
}