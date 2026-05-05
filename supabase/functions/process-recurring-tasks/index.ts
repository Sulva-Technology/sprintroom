import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  // Only allow POST requests (e.g. from pg_cron)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create Supabase client with service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // 1. Fetch all active recurrence rules where next_run_at is in the past
    const { data: rulesToProcess, error: fetchError } = await supabase
      .from("task_recurrence_rules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString());

    if (fetchError) {
      console.error("Error fetching rules:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!rulesToProcess || rulesToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No rules to process at this time." }), { status: 200 });
    }

    console.log(`Found ${rulesToProcess.length} recurring tasks to create.`);

    const newTasks = [];
    const rulesToUpdate = [];

    // 2. Process each rule
    for (const rule of rulesToProcess) {
      // Prepare the new task object
      newTasks.push({
        user_id: rule.user_id,
        project_id: rule.project_id,
        title: rule.template_title,
        description: rule.template_description || "",
        status: rule.target_status || "backlog",
        priority: rule.priority || 0,
      });

      // Calculate the next run time
      const nextRun = new Date(rule.next_run_at);

      if (rule.frequency === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (rule.frequency === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7);
      } else if (rule.frequency === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
      } else {
        // Fallback for safety
        nextRun.setDate(nextRun.getDate() + 1);
      }

      // Prepare rule update
      rulesToUpdate.push({
        id: rule.id,
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    // 3. Insert the new tasks
    if (newTasks.length > 0) {
      const { error: insertError } = await supabase
        .from("tasks")
        .insert(newTasks);

      if (insertError) {
        console.error("Error inserting recurring tasks:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create tasks" }), { status: 500 });
      }
    }

    // 4. Update the rules with their new next_run_at times
    for (const ruleUpdate of rulesToUpdate) {
      const { error: updateError } = await supabase
        .from("task_recurrence_rules")
        .update({
          last_run_at: ruleUpdate.last_run_at,
          next_run_at: ruleUpdate.next_run_at,
          updated_at: ruleUpdate.updated_at
        })
        .eq("id", ruleUpdate.id);

      if (updateError) {
        console.error(`Error updating rule ${ruleUpdate.id}:`, updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: rulesToProcess.length,
      tasksCreated: newTasks.length
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Unexpected error in process-recurring-tasks:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});