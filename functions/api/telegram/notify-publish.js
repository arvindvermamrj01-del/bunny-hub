import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const { user, profile } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_CHAT_ID) return json({ ok: false, skipped: true });
    const body = await request.json();
    const id = String(body.contentId || "").trim();
    if (!/^\d+$/.test(id)) return json({ error: "Invalid content ID." }, 400);
    const url = new URL(supabaseBase(env) + "/rest/v1/vh_content");
    url.search = new URLSearchParams({ id: "eq." + id, published: "eq.true", select: "id,title,content_type,release_year,created_by" }).toString();
    const lookup = await fetch(url, { headers: supabaseAdminHeaders(env) });
    if (!lookup.ok) return json({ error: "Published content could not be verified." }, 403);
    const rows = await lookup.json();
    if (!rows.length) return json({ error: "Published content was not found." }, 404);
    const item = rows[0];
    if (profile?.role === "content_editor" && item.created_by !== user.id) return json({ error: "You cannot announce another editor's content." }, 403);
    const message = "🎬 New on BunnyHub\n" + item.title + "\n" + item.content_type + (item.release_year ? " · " + item.release_year : "") + "\n\nWatch on BunnyHub: https://bunnyhub.pages.dev/";
    const sent = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_CHAT_ID, text: message, disable_web_page_preview: true })
    });
    const result = await sent.json().catch(() => ({}));
    if (!sent.ok || !result.ok) return json({ error: result.description || "Telegram channel announcement failed." }, 502);
    return json({ ok: true });
  } catch (error) {
    const message = error.message || "Telegram publish notification failed.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
