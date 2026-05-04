import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
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
    // If it's already completed or cancelled, redirect to the project board
    if (project?.id) {
      redirect(`/dashboard/projects/${project.id}`);
    }
    return notFound();
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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-center p-6 md:p-10 shrink-0">
        <div className="text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
            {project?.name || "Unknown Project"}
          </h3>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 max-w-2xl mx-auto">
            {task?.title || "Unknown Task"}
          </h1>
        </div>
      </div>

      {/* Main Timer Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
        <FocusTimer
          sessionId={session.id}
          startedAt={session.started_at}
          durationMinutes={session.duration_minutes}
          distractionsCount={session.distractions_count || 0}
        />
      </div>
    </div>
  );
}
