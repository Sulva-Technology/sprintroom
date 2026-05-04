"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { incrementDistraction, cancelFocusSession } from "@/app/actions/focus";
import { CompleteFocusForm } from "./complete-focus-form";
import { Pause, Play, Square, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FocusTimer({
  sessionId,
  startedAt,
  durationMinutes,
  distractionsCount,
}: {
  sessionId: string;
  startedAt: string;
  durationMinutes: number;
  distractionsCount: number;
}) {
  const [timeLeftMs, setTimeLeftMs] = useState(durationMinutes * 60 * 1000);
  const [distractions, setDistractions] = useState(distractionsCount);
  const [isFinished, setIsFinished] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const target = start + durationMinutes * 60 * 1000;

    const updateTimer = () => {
      const now = new Date().getTime();
      const remaining = target - now;

      if (remaining <= 0) {
        setTimeLeftMs(0);
        setIsFinished(true);
      } else {
        setTimeLeftMs(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  const handleDistraction = async () => {
    setDistractions((prev) => prev + 1);
    await incrementDistraction(sessionId);
  };

  const handleEndEarly = () => {
    setIsFinished(true);
  };

  const handleCancel = async () => {
    if (confirm("Cancel this focus session? No progress will be saved.")) {
      setIsCancelling(true);
      await cancelFocusSession(sessionId);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isFinished) {
    return (
      <div className="w-full max-w-lg bg-white border rounded-[2rem] p-8 shadow-sm animate-in zoom-in-95 duration-500 text-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Focus Complete
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            Capture your progress to finish the session.
          </p>
        </div>

        <CompleteFocusForm
          sessionId={sessionId}
          finalDistractions={distractions}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center animate-in zoom-in-95 duration-700">
      <div className="relative flex justify-center items-center mb-12">
        <div className="absolute inset-0 bg-primary/5 rounded-full scale-150 blur-3xl -z-10 animate-pulse" />

        <svg viewBox="0 0 100 100" className="absolute w-[240px] h-[240px] md:w-[320px] md:h-[320px] -rotate-90 pointer-events-none">
          <circle
            cx="50" cy="50" r="45"
            stroke="currentColor"
            strokeWidth="1" fill="none"
            className="text-slate-100"
          />
          <circle
            cx="50" cy="50" r="45"
            stroke="currentColor"
            strokeWidth="2" fill="none"
            className="text-primary"
            strokeDasharray="282.74"
            strokeDashoffset={282.74 - (282.74 * (timeLeftMs / (durationMinutes * 60 * 1000))) }
            strokeLinecap="round"
          />
        </svg>

        <div
          className="text-[120px] md:text-[160px] font-bold font-mono tracking-tighter text-slate-900 leading-none tabular-nums relative z-10"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatTime(timeLeftMs)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={handleDistraction}
          className="rounded-full h-14 px-6 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-sm font-bold shadow-sm transition-all"
        >
          <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
          Log Distraction
          {distractions > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-xs">
              {distractions}
            </span>
          )}
        </Button>

        <Button
          size="lg"
          onClick={handleEndEarly}
          className="rounded-full h-14 px-8 text-sm font-bold shadow-md bg-slate-900 hover:bg-slate-800 hover:-translate-y-0.5 transition-all text-white"
        >
          End Early
        </Button>

        <Button
          variant="ghost"
          size="lg"
          onClick={handleCancel}
          disabled={isCancelling}
          className="rounded-full h-14 w-14 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
          title="Cancel session"
        >
          {isCancelling ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
