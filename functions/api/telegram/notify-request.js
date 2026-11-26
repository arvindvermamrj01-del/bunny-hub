import { json, requireUser, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireUser(request, env);
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) return json({ ok: false, skipped: true });
    const body = await request.json();
    const id = String(body.requestId || "").trim();
    if (!/^\d+$/.test(id)) return json({ error: "Invalid request ID." }, 400);
    const url = new URL(supabaseBase(env) + "/rest/v1/vh_requests");
    url.search = new URLSearchParams({ id: "eq." + id, requester_id: "eq." + user.id, select: "request_title,content_type,release_year,preferred_language,created_at" }).toString();
    const lookup = await fetch(url, { headers: supabaseAdminHeaders(env) });
    if (!lookup.ok) return json({ error: "Request could not be verified." }, 403);
    const rows = await lookup.json();
    if (!rows.length) return json({ error: "Request does not belong to this account." }, 404);
    const item = rows[0];
    const message = "New BunnyHub request\nTitle: " + item.request_title + "\nType: " + item.content_type + "\nYear: " + (item.release_year || "Not specified") + "\nLanguage: " + (item.preferred_language || "Not specified");
    const sent = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text: message, disable_web_page_preview: true })
    });
    const result = await sent.json().catch(() => ({}));
    if (!sent.ok || !result.ok) return json({ error: result.description || "Telegram notification failed." }, 502);
    return json({ ok: true });
  } catch (error) {
    const message = error.message || "Request notification failed.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
