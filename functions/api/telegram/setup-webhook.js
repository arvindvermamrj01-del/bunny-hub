import { json, requireRole } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ error: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in Cloudflare Pages secrets first." }, 503);
    }
    const webhookUrl = new URL("/api/telegram/webhook", request.url).toString();
    const response = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/setWebhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: false
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) return json({ error: result.description || "Telegram webhook setup failed." }, 502);
    return json({ success: true, webhookUrl });
  } catch (error) {
    const message = error.message || "Could not configure Telegram webhook.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
