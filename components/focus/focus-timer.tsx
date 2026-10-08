"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  incrementDistraction,
  cancelFocusSession,
  pauseFocusSession,
  resumeFocusSession,
} from "@/app/actions/focus";
import { CompleteFocusForm } from "./complete-focus-form";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useFocusSound } from "@/hooks/use-focus-sound";
import { useFocusNotifications } from "@/hooks/use-focus-notifications";
import { useTicking } from "@/hooks/use-ticking";
import { cn } from "@/lib/utils";
import { Pause, Play, Square, AlertCircle, Loader2, Volume2, VolumeX, Timer, TimerOff } from "lucide-react";

export function FocusTimer({
  sessionId,
  startedAt,
  durationMinutes,
  distractionsCount,
  pausedAt: initialPausedAt = null,
  totalPausedSeconds: initialTotalPausedSeconds = 0,
}: {
  sessionId: string;
  startedAt: string;
  durationMinutes: number;
  distractionsCount: number;
  pausedAt?: string | null;
  totalPausedSeconds?: number;
}) {
  const [distractions, setDistractions] = useState(distractionsCount);
  const [endedEarly, setEndedEarly] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Local pause state, seeded from the server session and kept in sync optimistically.
  const [pausedAt, setPausedAt] = useState<string | null>(initialPausedAt);
  const [bankedPausedSeconds, setBankedPausedSeconds] = useState(initialTotalPausedSeconds);
  const [isPausePending, startPauseTransition] = useTransition();

  const { playSound, soundEnabled, toggleSound } = useFocusSound();
  const { showNotification } = useFocusNotifications();
  const hasPlayedComplete = useRef(false);
  const hasPlayedWarning = useRef(false);

  const {
    remainingSeconds,
    elapsedSeconds,
    formattedTime,
    isComplete,
    isPaused,
    hasOneMinuteWarningPassed,
  } = useFocusTimer({
    startedAt,
    durationMinutes,
    status: "active",
    pausedAt,
    totalPausedSeconds: bankedPausedSeconds,
  });

  const isFinished = isComplete || endedEarly;

  // A ticking clock while the session runs (master sound switch still wins).
  const { tickEnabled, toggleTick } = useTicking({
    elapsedSeconds,
    running: soundEnabled && !isPaused && !isFinished,
  });

  // Fire warning + completion feedback once each.
  useEffect(() => {
    if (isComplete && !hasPlayedComplete.current) {
      hasPlayedComplete.current = true;
      playSound("focus-complete");
      showNotification("Focus complete", "Capture your progress to finish the session.");
    }
    if (hasOneMinuteWarningPassed && !hasPlayedWarning.current) {
      hasPlayedWarning.current = true;
      playSound("warning");
      showNotification("One minute left", "Almost done with this focus block.");
    }
  }, [isComplete, hasOneMinuteWarningPassed, playSound, showNotification]);

  const handleDistraction = async () => {
    setDistractions((prev) => prev + 1);
    await incrementDistraction(sessionId);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      // Resume: bank the elapsed pause locally, then persist.
      const added = pausedAt
        ? Math.max(0, Math.round((Date.now() - new Date(pausedAt).getTime()) / 1000))
        : 0;
      setBankedPausedSeconds((prev) => prev + added);
      setPausedAt(null);
      startPauseTransition(() => {
        resumeFocusSession(sessionId);
      });
    } else {
      setPausedAt(new Date().toISOString());
      startPauseTransition(() => {
        pauseFocusSession(sessionId);
      });
    }
  };

  const handleEndEarly = () => {
    hasPlayedComplete.current = true;
    playSound("focus-complete");
    setEndedEarly(true);
  };

  const handleCancel = async () => {
    if (confirm("Cancel this focus session? No progress will be saved.")) {
      setIsCancelling(true);
      await cancelFocusSession(sessionId);
    }
  };

  if (isFinished) {
    return (
      <div className="w-full max-w-lg bg-white border rounded-[2rem] p-8 shadow-sm animate-in zoom-in-95 duration-500 text-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Focus Complete</h2>
          <p className="text-slate-500 mt-2 font-medium">
            Capture your progress to finish the session.
          </p>
        </div>

        <CompleteFocusForm sessionId={sessionId} finalDistractions={distractions} />
      </div>
    );
  }

  const remainingFraction = remainingSeconds / (durationMinutes * 60);
  const CIRCUMFERENCE = 2 * Math.PI * 46;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8 md:gap-10 animate-in zoom-in-95 duration-700">
      {/* Clock: the digits live INSIDE the ring and scale with it, so nothing
          spills past the circle at any screen width. */}
      <div className="relative aspect-square w-[min(78vw,24rem)]">
        <div className="absolute inset-[12%] -z-10 rounded-full bg-primary/10 blur-3xl" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-200" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - remainingFraction)}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear",
              isPaused ? "text-amber-400" : "text-indigo-500"
            )}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono font-bold leading-none tracking-tight tabular-nums text-[clamp(3rem,15vw,5.5rem)]",
              isPaused ? "text-amber-500" : "text-slate-900"
            )}
            role="timer"
            aria-live="off"
          >
            {formattedTime}
          </span>
          <span
            className={cn(
              "mt-3 text-[11px] font-semibold uppercase tracking-[0.2em]",
              isPaused ? "text-amber-500" : "text-slate-400"
            )}
          >
            {isPaused ? "Paused" : `Focus · ${durationMinutes} min`}
          </span>
        </div>
      </div>

      {/* Primary controls */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <Button
          size="lg"
          onClick={handleTogglePause}
          disabled={isPausePending}
          className="h-12 rounded-full text-sm font-bold shadow-sm"
        >
          {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
          {isPaused ? "Resume" : "Pause"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleEndEarly}
          className="h-12 rounded-full bg-white text-sm font-bold"
        >
          End early
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleDistraction}
          className="h-12 rounded-full bg-white text-sm font-bold hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
        >
          <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
          Distracted
          {distractions > 0 && (
            <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{distractions}</span>
          )}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={handleCancel}
          disabled={isCancelling}
          className="h-12 rounded-full text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
          Cancel
        </Button>
      </div>

      {/* Sound settings */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          Sound {soundEnabled ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={toggleTick}
          disabled={!soundEnabled}
          aria-pressed={tickEnabled}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          {tickEnabled ? <Timer className="h-3.5 w-3.5" /> : <TimerOff className="h-3.5 w-3.5" />}
          Ticking {tickEnabled ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
