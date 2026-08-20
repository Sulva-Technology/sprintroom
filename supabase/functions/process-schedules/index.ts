import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

// Scheduled focus-session notifier.
//
// Invoked by cron with `Authorization: Bearer <CRON_SECRET>` (verify_jwt is off
// in config.toml).
//
// NOTE: `focus_schedules` and `web_push_subscriptions` share only a user_id
// pointing at auth.users — there is no foreign key between them, so PostgREST
// cannot embed one in the other. Selecting
// `*, web_push_subscriptions(...)` failed the whole query and no schedule
// notification was ever delivered. Subscriptions are fetched separately and
// grouped by user instead.
//
// The auto-start itself lives in the database
// (public.process_due_focus_schedules, migration 20260722110000) so scheduling
// keeps working even if this function is not deployed. This function only sends
// the push notifications.

const vapidPublicKey = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function isAuthorized(req: Request) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  return req.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
};

/** Subscriptions for the given users, grouped by user id. */
async function loadSubscriptionsByUser(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
) {
  const byUser = new Map<string, PushSubscriptionRow[]>();
  if (userIds.length === 0) return byUser;

  const { data, error } = await supabase
    .from("web_push_subscriptions")
    .select("user_id, endpoint, keys_p256dh, keys_auth")
    .in("user_id", Array.from(new Set(userIds)));

  if (error) {
    console.error("Error loading push subscriptions:", error);
    return byUser;
  }

  for (const sub of (data || []) as PushSubscriptionRow[]) {
    const list = byUser.get(sub.user_id) || [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }

  return byUser;
}

/** Returns endpoints the push service reported as gone (404/410). */
async function sendToUser(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string },
) {
  const staleEndpoints: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        JSON.stringify(payload),
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      } else {
        console.error("Failed to push to endpoint:", sub.endpoint, err);
      }
    }
  }

  return staleEndpoints;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({ error: "VAPID keys are not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const warningTime = new Date(now.getTime() + 5 * 60 * 1000);
    const staleEndpoints: string[] = [];
    let warningsSent = 0;
    let startsSent = 0;

    // 1. Five-minute warnings.
    const { data: warningsToProcess, error: warningsError } = await supabase
      .from("focus_schedules")
      .select("id, user_id")
      .eq("status", "pending")
      .lte("start_time", warningTime.toISOString())
      .gt("start_time", now.toISOString());

    if (warningsError) {
      console.error("Error fetching warnings:", warningsError);
    } else if (warningsToProcess && warningsToProcess.length > 0) {
      const subsByUser = await loadSubscriptionsByUser(
        supabase,
        warningsToProcess.map((schedule: any) => schedule.user_id),
      );

      for (const schedule of warningsToProcess as any[]) {
        const subs = subsByUser.get(schedule.user_id) || [];

        if (subs.length > 0) {
          staleEndpoints.push(
            ...(await sendToUser(subs, {
              title: "Upcoming Focus Session",
              body: "Your scheduled Pomodoro starts in 5 minutes.",
              url: "/dashboard/focus",
            })),
          );
          warningsSent += 1;
        }

        await supabase
          .from("focus_schedules")
          .update({ status: "warning_sent" })
          .eq("id", schedule.id);
      }
    }

    // 2. Start notifications for sessions the database just auto-started.
    //    process_due_focus_schedules() flips the schedule to 'started'; we look
    //    for ones it started recently and tell the user about them.
    const startedSince = new Date(now.getTime() - 5 * 60 * 1000);

    const { data: startsToProcess, error: startsError } = await supabase
      .from("focus_schedules")
      .select("id, user_id, notified_started_at")
      .eq("status", "started")
      .is("notified_started_at", null)
      .gte("start_time", startedSince.toISOString())
      .lte("start_time", now.toISOString());

    if (startsError) {
      console.error("Error fetching auto-starts:", startsError);
    } else if (startsToProcess && startsToProcess.length > 0) {
      const subsByUser = await loadSubscriptionsByUser(
        supabase,
        startsToProcess.map((schedule: any) => schedule.user_id),
      );

      for (const schedule of startsToProcess as any[]) {
        const subs = subsByUser.get(schedule.user_id) || [];

        if (subs.length > 0) {
          staleEndpoints.push(
            ...(await sendToUser(subs, {
              title: "Session Started!",
              body: "Your scheduled Pomodoro has begun. Time to focus!",
              url: "/dashboard",
            })),
          );
          startsSent += 1;
        }

        await supabase
          .from("focus_schedules")
          .update({ notified_started_at: now.toISOString() })
          .eq("id", schedule.id);
      }
    }

    if (staleEndpoints.length > 0) {
      await supabase
        .from("web_push_subscriptions")
        .delete()
        .in("endpoint", Array.from(new Set(staleEndpoints)));
    }

    return new Response(
      JSON.stringify({ success: true, warningsSent, startsSent }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
