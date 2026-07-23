import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

// Hourly rhythm nudge sender.
//
// Invoked once an hour (pg_cron via pg_net, or the Supabase dashboard
// scheduler). `get_due_rhythm_nudges()` decides who is inside their local
// 06:00-18:00 window with unlogged rhythm tasks; this function does the web
// push and records the dispatch so the slot never fires twice.

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

function buildMessage(titles: string[]) {
  const count = titles.length;
  const listed = titles.slice(0, 3).join(", ");
  const rest = count > 3 ? ` +${count - 3} more` : "";

  return {
    title: count === 1 ? "1 rhythm task still open" : `${count} rhythm tasks still open`,
    body: `Clear them before the day ends: ${listed}${rest}`,
    url: "/dashboard/rhythms",
  };
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

    const { data: due, error: dueError } = await supabase.rpc("get_due_rhythm_nudges");

    if (dueError) {
      console.error("Error loading due nudges:", dueError);
      return new Response(JSON.stringify({ error: dueError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = due || [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from("web_push_subscriptions")
      .select("user_id, endpoint, keys_p256dh, keys_auth")
      .in("user_id", rows.map((row: any) => row.user_id));

    if (subsError) {
      console.error("Error loading push subscriptions:", subsError);
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subsByUser = new Map<string, any[]>();
    for (const sub of subscriptions || []) {
      const list = subsByUser.get(sub.user_id) || [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }

    let notified = 0;
    const staleEndpoints: string[] = [];

    for (const row of rows as any[]) {
      const subs = subsByUser.get(row.user_id) || [];
      if (subs.length === 0) continue;

      const message = buildMessage(row.open_titles || []);
      let delivered = false;

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            JSON.stringify({
              ...message,
              tag: `sprintroom-rhythm-nudge-${row.local_date}`,
            }),
          );
          delivered = true;
        } catch (err) {
          // 404/410 mean the browser dropped the subscription — stop retrying it.
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.error("Failed to push to endpoint:", sub.endpoint, err);
          }
        }
      }

      if (!delivered) continue;

      // Record only after a successful send, so a total delivery failure can be
      // retried on the next tick within the same hour.
      const { error: ledgerError } = await supabase
        .from("rhythm_nudge_dispatches")
        .insert({
          user_id: row.user_id,
          local_date: row.local_date,
          hour: row.local_hour,
          open_task_count: (row.open_titles || []).length,
        });

      if (ledgerError && ledgerError.code !== "23505") {
        console.error("Failed to record nudge dispatch:", ledgerError);
      }

      notified++;
    }

    if (staleEndpoints.length > 0) {
      await supabase
        .from("web_push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ success: true, notified }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
