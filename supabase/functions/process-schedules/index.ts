import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

// Configure web-push with VAPID keys
// These should be set in Supabase edge function secrets
const vapidPublicKey = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

serve(async (req) => {
  // Only allow POST requests (e.g. from pg_cron)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create Supabase client with service role to bypass RLS for system tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    // 5 minutes from now
    const warningTime = new Date(now.getTime() + 5 * 60 * 1000);

    // 1. Process 5-minute warnings
    const { data: warningsToProcess, error: warningsError } = await supabase
      .from("focus_schedules")
      .select("*, web_push_subscriptions(endpoint, keys_p256dh, keys_auth)")
      .eq("status", "pending")
      .lte("start_time", warningTime.toISOString())
      .gt("start_time", now.toISOString());

    if (warningsError) {
      console.error("Error fetching warnings:", warningsError);
    } else if (warningsToProcess && warningsToProcess.length > 0) {
      for (const schedule of warningsToProcess) {
        // Send push notification
        const subs = schedule.web_push_subscriptions || [];
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
              },
              JSON.stringify({
                title: "Upcoming Focus Session",
                body: "Your scheduled Pomodoro starts in 5 minutes.",
                url: "/",
              })
            );
          } catch (err) {
            console.error("Failed to send warning push to endpoint:", sub.endpoint, err);
          }
        }

        // Update schedule status
        await supabase
          .from("focus_schedules")
          .update({ status: "warning_sent" })
          .eq("id", schedule.id);
      }
    }

    // 2. Process Auto-Starts
    const { data: startsToProcess, error: startsError } = await supabase
      .from("focus_schedules")
      .select("*, web_push_subscriptions(endpoint, keys_p256dh, keys_auth)")
      .in("status", ["pending", "warning_sent"])
      .lte("start_time", now.toISOString());

    if (startsError) {
      console.error("Error fetching auto-starts:", startsError);
    } else if (startsToProcess && startsToProcess.length > 0) {
      for (const schedule of startsToProcess) {
        // Create the active focus session
        const { error: insertError } = await supabase
          .from("focus_sessions")
          .insert({
            user_id: schedule.user_id,
            task_id: schedule.task_id,
            workspace_id: schedule.workspace_id,
            project_id: schedule.project_id,
            status: "active",
            duration_minutes: schedule.duration_minutes || 25,
            started_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("Error starting focus session:", insertError);
          continue; // Skip push and updating schedule if insert failed
        }

        // Send push notification
        const subs = schedule.web_push_subscriptions || [];
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
              },
              JSON.stringify({
                title: "Session Started!",
                body: "Your scheduled Pomodoro has begun. Time to focus!",
                url: "/",
              })
            );
          } catch (err) {
            console.error("Failed to send start push to endpoint:", sub.endpoint, err);
          }
        }

        // Update schedule status
        await supabase
          .from("focus_schedules")
          .update({ status: "started" })
          .eq("id", schedule.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
