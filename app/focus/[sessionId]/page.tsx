import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FocusTimer } from "@/components/focus/focus-timer";
import { CompleteFocusForm } from "@/components/focus/complete-focus-form";
import { Button } from "@/components/ui/button";
import { markSessionAbandoned } from "@/app/actions/focus";

export default async function FocusSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("focus_sessions")
    .select("*, tasks(*, projects(name))")
    .eq("id", resolvedParams.sessionId)
    .single();

  if (!session) return notFound();

  // Prevent other users from viewing the session
  if (session.user_id !== user.id) return notFound();

  const task = session.tasks as any;
  const project = task?.projects as any;

  if (session.status !== "active") {
    // Already completed or cancelled: go back to the board (or Home for an
    // instant session with no task). `projects(name)` has no id, so use the
    // task's project_id.
    redirect(task?.project_id ? `/dashboard/projects/${task.project_id}` : "/dashboard");
  }

  // Check if abandoned (duration + 2 hours)
  const startedAt = new Date(session.started_at).getTime();
  const now = new Date().getTime();
  const durationMs = session.duration_minutes * 60 * 1000;
  const abandonedThreshold = durationMs + 2 * 60 * 60 * 1000;

  if (now - startedAt > abandonedThreshold) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="w-full max-w-md bg-white border rounded-3xl p-8 shadow-sm text-center">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            Session Abandoned?
          </h2>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm">
            It looks like this focus session was left running for a long time.
            Did you complete some work, or should we mark it as abandoned?
          </p>

          <div className="space-y-3">
            <CompleteFocusForm
              sessionId={session.id}
              isAbandonedRecovery={true}
            />

            <form
              action={async () => {
                "use server";
                await markSessionAbandoned(session.id);
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-700 font-semibold rounded-xl h-11"
              >
                Mark Abandoned
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const backHref = task?.project_id ? `/dashboard/projects/${task.project_id}` : "/dashboard";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-gradient-to-b from-slate-50 to-white font-sans">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Focus mode</span>
        <span className="w-[76px]" aria-hidden="true" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-10 md:gap-12">
        <div className="max-w-2xl text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            {project?.name || (task ? "Project" : "Quick focus")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {task?.title || "Deep work"}
          </h1>
        </div>

        <FocusTimer
          sessionId={session.id}
          startedAt={session.started_at}
          durationMinutes={session.duration_minutes}
          distractionsCount={session.distractions_count || 0}
          pausedAt={session.paused_at ?? null}
          totalPausedSeconds={session.total_paused_seconds ?? 0}
        />
      </main>
    </div>
  );
}
