import { json, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

const text = value => String(value || "").replace(/[&<>]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]));
async function sendMessage(env, chatId, message) {
  const response = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram message delivery failed.");
  return result;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Telegram bot is not configured." }, 503);
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Webhook authentication failed." }, 401);
    const update = await request.json();
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const command = String(message?.text || "").trim().split(/\s+/)[0].toLowerCase().split("@")[0];
    if (!chatId || !command) return json({ ok: true });
    const site = "https://bunnyhub.pages.dev";
    if (command === "/start" || command === "/help") {
      await sendMessage(env, chatId,
        "Welcome to BunnyHub.\n\n/start or /help — commands\n/latest — latest published titles\n/search title — search the published catalog\n/genres — browse categories\n/request — submit a title request\n/channel — official community\n/status — admin status\n\nWebsite: " + site);
    } else if (command === "/search") {
      const query = String(message.text || "").replace(/^\/search(?:@\w+)?/i, "").trim().replace(/[,*%()\\"]/g, " ").slice(0, 80);
      if (query.length < 2) {
        await sendMessage(env, chatId, "Usage: /search movie name");
      } else {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Catalog service is not configured.");
        const url = new URL(supabaseBase(env) + "/rest/v1/vh_content");
        url.search = new URLSearchParams({ published: "eq.true", title: "ilike.*" + query + "*", select: "title,content_type,release_year", order: "created_at.desc", limit: "5" }).toString();
        const response = await fetch(url, { headers: supabaseAdminHeaders(env) });
        if (!response.ok) throw new Error("Catalog search is temporarily unavailable.");
        const rows = await response.json();
        const list = rows.length ? rows.map((item, index) => (index + 1) + ". " + item.title + " (" + item.content_type + (item.release_year ? ", " + item.release_year : "") + ")").join("\n") : "No matching published titles found.";
        await sendMessage(env, chatId, "Search results for: " + query + "\n" + list + "\n\n" + site);
      }
    } else if (command === "/genres") {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Catalog service is not configured.");
      const url = new URL(supabaseBase(env) + "/rest/v1/vh_categories");
      url.search = new URLSearchParams({ is_active: "eq.true", select: "name", order: "name", limit: "40" }).toString();
      const response = await fetch(url, { headers: supabaseAdminHeaders(env) });
      if (!response.ok) throw new Error("Categories could not be loaded.");
      const rows = await response.json();
      await sendMessage(env, chatId, rows.length ? "Browse genres and categories:\n" + rows.map(item => "• " + item.name).join("\n") + "\n\n" + site : "No categories are published yet.");
    } else if (command === "/request") {
      await sendMessage(env, chatId, "Submit a movie or series request here: " + site + "/#request");
    } else if (command === "/channel") {
      await sendMessage(env, chatId, "Official BunnyHub channel: " + (env.TELEGRAM_CHANNEL_URL || "https://t.me/BunnyHub_official"));
    } else if (command === "/latest") {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Catalog service is not configured.");
      const url = new URL(supabaseBase(env) + "/rest/v1/vh_content");
      url.search = new URLSearchParams({ published: "eq.true", select: "title,content_type,release_year", order: "created_at.desc", limit: "5" }).toString();
      const response = await fetch(url, { headers: supabaseAdminHeaders(env) });
      if (!response.ok) throw new Error("Latest catalog could not be loaded.");
      const rows = await response.json();
      const list = rows.length ? rows.map((item, index) => (index + 1) + ". " + item.title + " (" + item.content_type + (item.release_year ? ", " + item.release_year : "") + ")").join("\n") : "No published titles yet.";
      await sendMessage(env, chatId, "Latest on BunnyHub:\n" + list + "\n\n" + site);
    } else if (command === "/status") {
      if (!env.TELEGRAM_ADMIN_CHAT_ID || String(chatId) !== String(env.TELEGRAM_ADMIN_CHAT_ID)) {
        await sendMessage(env, chatId, "This command is available to the BunnyHub administrator only.");
      } else {
        const base = supabaseBase(env), headers = supabaseAdminHeaders(env);
        const countHeaders = { ...headers, Prefer: "count=exact" };
        const [contentResponse, requestResponse] = await Promise.all([
          fetch(base + "/rest/v1/vh_content?select=id&published=eq.true", { method: "HEAD", headers: countHeaders }),
          fetch(base + "/rest/v1/vh_requests?select=id&status=eq.pending", { method: "HEAD", headers: countHeaders })
        ]);
        if (!contentResponse.ok || !requestResponse.ok) throw new Error("Admin status could not be loaded.");
        const count = response => Number((response.headers.get("content-range") || "").split("/").pop()) || 0;
        await sendMessage(env, chatId, "BunnyHub status\nPublished titles: " + count(contentResponse) + "\nPending requests: " + count(requestResponse));
      }
    } else {
      await sendMessage(env, chatId, "Unknown command. Send /help to see available commands.");
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "Telegram webhook failed." }, 500);
  }
}
