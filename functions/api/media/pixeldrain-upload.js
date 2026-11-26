import { json, requireRole } from "../../_shared/auth.js";

const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;

function safeName(value) {
  return String(value || "bunnyhub-video")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(-180) || "bunnyhub-video";
}

export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const apiKey = String(env.PIXELDRAIN_API_KEY || "").trim();
    if (!apiKey) {
      return json({ error: "PixelDrain is not connected yet. Add PIXELDRAIN_API_KEY as a Cloudflare Pages secret, then retry." }, 503);
    }

    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    const declaredSize = Number(request.headers.get("x-vh-file-size") || 0);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (!contentType.startsWith("video/")) return json({ error: "Only video files are accepted." }, 400);
    if (!request.body || !Number.isFinite(declaredSize) || declaredSize <= 0) {
      return json({ error: "The video upload body or file size is missing." }, 400);
    }
    if (declaredSize > MAX_UPLOAD_BYTES || (contentLength > 0 && contentLength > MAX_UPLOAD_BYTES)) {
      return json({ error: "PixelDrain uploads through BunnyHub are limited to 90 MiB. Use B2/R2 for large movie files." }, 413);
    }
    if (contentLength > 0 && contentLength !== declaredSize) {
      return json({ error: "Uploaded file size did not match the selected file." }, 400);
    }

    let originalName = "bunnyhub-video.mp4";
    try { originalName = decodeURIComponent(request.headers.get("x-vh-file-name") || originalName); } catch (_) {}
    const name = safeName(originalName);
    const authorization = "Basic " + btoa(":" + apiKey);
    const upstream = await fetch("https://pixeldrain.com/api/file/" + encodeURIComponent(name), {
      method: "PUT",
      headers: { "Authorization": authorization, "Content-Type": contentType },
      body: request.body
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || result.success === false || !result.id) {
      const message = String(result.message || result.value || "PixelDrain rejected this upload. Check your subscription, transfer limit and file restrictions.");
      const status = upstream.status === 413 ? 413 : upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
      return json({ error: message }, status);
    }

    const id = String(result.id);
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return json({ error: "PixelDrain returned an invalid file identifier." }, 502);
    return json({
      success: true,
      id,
      name: String(result.name || name),
      size: Number(result.size || declaredSize),
      url: "https://pixeldrain.com/api/file/" + encodeURIComponent(id),
      shareUrl: "https://pixeldrain.com/u/" + encodeURIComponent(id)
    }, 201);
  } catch (error) {
    const message = error.message || "PixelDrain upload failed.";
    const status = /Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503;
    return json({ error: message }, status);
  }
}
