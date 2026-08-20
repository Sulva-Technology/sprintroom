import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Recurring task materialiser.
//
// Invoked on a schedule (pg_cron via pg_net, or the dashboard scheduler) with
// `Authorization: Bearer <CRON_SECRET>` — see config.toml, verify_jwt is off.
//
// IMPORTANT: the live `tasks` schema is migrations 0002 + 0004, NOT the legacy
// supabase/schema.sql. `tasks` has no `user_id` column (authorship is
// `created_by`, assignment is `owner_id`), `priority` is text, and `project_id`
// is NOT NULL. Writing `user_id` here made every insert fail with PGRST204.

function isAuthorized(req: Request) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  return req.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

/** `task_recurrence_rules.priority` is an int scale; `tasks.priority` is text. */
function toTaskPriority(priority: unknown): string {
  const value = typeof priority === "number" ? priority : 0;
  if (value <= -1) return "low";
  if (value === 0) return "medium";
  if (value === 1) return "high";
  return "urgent";
}

/**
 * Advance `next_run_at` until it is in the future. A rule whose schedule was
 * missed (function down, secret unset) would otherwise stay in the past and
 * re-fire on every tick, creating a duplicate task each time.
 */
function computeNextRun(from: Date, frequency: string, now: Date): Date {
  const next = new Date(from);
  let guard = 0;

  do {
    if (frequency === "weekly") {
      next.setDate(next.getDate() + 7);
    } else if (frequency === "monthly") {
      // Clamp to the end of the target month so the 31st does not roll into
      // the following month (Jan 31 -> Mar 3).
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    } else {
      next.setDate(next.getDate() + 1);
    }
    guard += 1;
  } while (next <= now && guard < 500);

  return next;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();

    const { data: rulesToProcess, error: fetchError } = await supabase
      .from("task_recurrence_rules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString());

    if (fetchError) {
      console.error("Error fetching rules:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!rulesToProcess || rulesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, tasksCreated: 0, skipped: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // `tasks.project_id` is NOT NULL, so a rule without a project cannot
    // materialise. Resolve the project's workspace up front: the
    // set_task_workspace_id trigger falls back to auth.uid(), which is NULL
    // under the service role, so we set workspace_id explicitly.
    const projectIds = Array.from(
      new Set(rulesToProcess.map((rule: any) => rule.project_id).filter(Boolean)),
    );

    const workspaceByProject = new Map<string, string>();

    if (projectIds.length > 0) {
      const { data: projects, error: projectError } = await supabase
        .from("projects")
        .select("id, workspace_id")
        .in("id", projectIds);

      if (projectError) {
        console.error("Error resolving rule projects:", projectError);
        return new Response(JSON.stringify({ error: projectError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const project of projects || []) {
        workspaceByProject.set(project.id, project.workspace_id);
      }
    }

    let tasksCreated = 0;
    let skipped = 0;

    for (const rule of rulesToProcess as any[]) {
      if (!rule.project_id || !workspaceByProject.has(rule.project_id)) {
        console.warn(
          `Skipping rule ${rule.id}: no reachable project (project_id=${rule.project_id}).`,
        );
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("tasks").insert({
        project_id: rule.project_id,
        workspace_id: workspaceByProject.get(rule.project_id),
        title: rule.template_title,
        description: rule.template_description || "",
        status: rule.target_status || "backlog",
        priority: toTaskPriority(rule.priority),
        // Authorship, not assignment: `tasks` has no user_id column.
        created_by: rule.user_id,
        owner_id: rule.user_id,
        estimate_pomodoros: 0,
      });

      if (insertError) {
        // Leave next_run_at alone so the rule is retried on the next tick.
        console.error(`Error creating task for rule ${rule.id}:`, insertError);
        skipped += 1;
        continue;
      }

      tasksCreated += 1;

      const nextRun = computeNextRun(new Date(rule.next_run_at), rule.frequency, now);

      const { error: updateError } = await supabase
        .from("task_recurrence_rules")
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", rule.id);

      if (updateError) {
        console.error(`Error updating rule ${rule.id}:`, updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rulesToProcess.length,
        tasksCreated,
        skipped,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Unexpected error in process-recurring-tasks:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
