import { json, requireRole } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Invalid JSON request body." }, 400);
    }
    const kind = ["audio", "image"].includes(body.kind) ? body.kind : "video";
    const fileName = String(body.fileName || kind).slice(0, 180);
    const reportedContentType = String(body.contentType || "").trim().toLowerCase();
    const videoMimeByExtension = {
      mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime",
      mkv: "video/x-matroska", webm: "video/webm", avi: "video/x-msvideo",
      mpg: "video/mpeg", mpeg: "video/mpeg", "3gp": "video/3gpp",
      "3g2": "video/3gpp2", ts: "video/mp2t", ogv: "video/ogg",
      wmv: "video/x-ms-wmv", flv: "video/x-flv"
    };
    const extension = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
    const contentType = kind === "video" && !reportedContentType.startsWith("video/")
      ? (videoMimeByExtension[extension] || reportedContentType)
      : reportedContentType;
    const fileSize = Number(body.fileSize || 0);
    const allowedAudioTypes = ["audio/mpeg","audio/mp4","audio/aac","audio/ogg","audio/wav","audio/x-wav","audio/flac","audio/x-flac","audio/webm","audio/opus"];
    const allowedImageTypes = ["image/jpeg","image/png","image/webp"];
    const validType = kind === "audio" ? allowedAudioTypes.includes(contentType) : kind === "image" ? allowedImageTypes.includes(contentType) : contentType.startsWith("video/");
    const maxSize = kind === "audio" ? 1024 * 1024 * 1024 : kind === "image" ? 15 * 1024 * 1024 : 5 * 1024 * 1024 * 1024;
    if (!validType) return json({ error: kind === "audio" ? "Only supported audio uploads are accepted." : kind === "image" ? "Only JPG, PNG and WebP images are accepted." : "Only video uploads are accepted." }, 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxSize) {
      return json({ error: kind === "audio" ? "Audio file must be between 1 byte and 1 GB." : kind === "image" ? "Image must be between 1 byte and 15 MB." : "Video file must be between 1 byte and 5 GB. Larger files need multipart upload." }, 400);
    }
    const safeName = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^-+|-+$/g, "").slice(-100) || kind;
    const key = user.id + "/" + (kind === "audio" ? "audio/" : kind === "image" ? "images/" : "") + crypto.randomUUID() + "-" + safeName;
    const provider = String(body.provider || "backblaze_b2").toLowerCase();
    const uploadExpiry = kind === "audio" ? 3600 : 900;
    if (provider === "backblaze_b2") {
      const signed = await presignB2(env, "PUT", key, contentType, uploadExpiry);
      return json({ provider, key, kind, uploadUrl: signed.url, headers: signed.headers, expiresIn: uploadExpiry });
    }
    if (provider !== "cloudflare_r2") return json({ error: "Unsupported upload provider." }, 400);
    const signed = await presignR2(env, "PUT", key, contentType, uploadExpiry);
    return json({ provider, key, kind, uploadUrl: signed.url, headers: signed.headers, expiresIn: uploadExpiry });
  } catch (error) {
    const message = error.message || "Could not create secure upload URL.";
    const status = error.status || (/Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
    return json({ error: message }, status);
  }
}