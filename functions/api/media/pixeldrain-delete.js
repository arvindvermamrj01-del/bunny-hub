import { json, requireRole } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const apiKey = String(env.PIXELDRAIN_API_KEY || "").trim();
    if (!apiKey) return json({ error: "PIXELDRAIN_API_KEY is not configured in Cloudflare Pages secrets." }, 503);
    const body = await request.json().catch(() => ({}));
    const storagePath = String(body.storagePath || "");
    const match = storagePath.match(/^pixeldrain:\/\/([A-Za-z0-9_-]{4,64})$/);
    if (!match) return json({ error: "Only PixelDrain files uploaded through BunnyHub can be deleted here." }, 400);
    const response = await fetch("https://pixeldrain.com/api/file/" + encodeURIComponent(match[1]), {
      method: "DELETE",
      headers: { "Authorization": "Basic " + btoa(":" + apiKey) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      return json({ error: result.message || result.value || "PixelDrain could not delete this file." }, response.status >= 400 ? response.status : 502);
    }
    return json({ success: true, id: match[1] });
  } catch (error) {
    const message = error.message || "PixelDrain delete failed.";
    const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503;
    return json({ error: message }, status);
  }
}
