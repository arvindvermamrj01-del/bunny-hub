import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

function extractFileId(value) {
  let url;
  try { url = new URL(String(value || "")); } catch (_) { return ""; }
  if (!["drive.google.com", "docs.google.com"].includes(url.hostname.toLowerCase())) return "";
  const pathMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  const id = pathMatch?.[1] || url.searchParams.get("id") || "";
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : "";
}

export async function onRequestPost({ request, env }) {
  try {
    const { user } = await requireRole(request, env, ["admin"]);
    const apiKey = String(env.GOOGLE_DRIVE_API_KEY || "").trim();
    if (!apiKey) return json({ error: "Set GOOGLE_DRIVE_API_KEY in Cloudflare Pages secrets and enable the Google Drive API." }, 503);

    const body = await request.json();
    const fileId = extractFileId(body.driveUrl);
    const title = String(body.title || "").trim().slice(0, 250);
    const contentType = String(body.contentType || "Movie");
    if (!fileId) return json({ error: "Paste a valid Google Drive file share link. Folder links are not supported yet." }, 400);
    if (title.length < 1) return json({ error: "Enter a title for this video." }, 400);
    if (!["Movie", "Web Series"].includes(contentType)) return json({ error: "Unsupported content type." }, 400);

    const metadataUrl = new URL("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId));
    metadataUrl.search = new URLSearchParams({
      key: apiKey,
      fields: "id,name,mimeType,size,webViewLink,capabilities(canDownload),trashed",
      supportsAllDrives: "true"
    }).toString();
    const metadataResponse = await fetch(metadataUrl);
    const metadata = await metadataResponse.json().catch(() => ({}));
    if (!metadataResponse.ok) {
      return json({ error: metadata.error?.message || "Drive file is not publicly accessible. Set General access to Anyone with the link (Viewer)." }, 422);
    }
    if (metadata.trashed || !String(metadata.mimeType || "").startsWith("video/")) {
      return json({ error: "The shared Drive item must be an available video file, not a folder or another file type." }, 422);
    }
    if (metadata.capabilities?.canDownload === false) {
      return json({ error: "This Drive file does not allow downloading or playback." }, 422);
    }

    const directUrl = "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId);
    const previewUrl = "https://drive.google.com/file/d/" + encodeURIComponent(fileId) + "/preview";
    const base = supabaseBase(env);
    const headers = { ...supabaseAdminHeaders(env), Prefer: "return=representation" };
    const duplicateUrl = new URL(base + "/rest/v1/vh_media_assets");
    duplicateUrl.search = new URLSearchParams({ storage_provider: "eq.google_drive", storage_path: "eq." + fileId, select: "content_id", limit: "1" }).toString();
    const duplicateResponse = await fetch(duplicateUrl, { headers: supabaseAdminHeaders(env) });
    if (!duplicateResponse.ok) return json({ error: "Existing Drive imports could not be checked." }, 502);
    const duplicates = await duplicateResponse.json();
    if (duplicates.length) return json({ error: "This Google Drive video is already imported as catalog item #" + duplicates[0].content_id + "." }, 409);
    const contentResponse = await fetch(base + "/rest/v1/vh_content", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        content_type: contentType,
        video_url: directUrl,
        storage_provider: "google_drive",
        published: true,
        created_by: user.id,
        genre: "Uncategorised",
        industry: "All",
        description: "Google Drive shared video: " + String(metadata.name || title).slice(0, 200)
      })
    });
    const createdRows = await contentResponse.json().catch(() => []);
    if (!contentResponse.ok || !createdRows?.[0]?.id) {
      return json({ error: createdRows?.message || createdRows?.details || "Catalog record could not be created." }, 502);
    }
    const created = createdRows[0];
    const assetResponse = await fetch(base + "/rest/v1/vh_media_assets", {
      method: "POST",
      headers,
      body: JSON.stringify({
        content_id: created.id,
        asset_type: "video",
        asset_url: directUrl,
        storage_path: fileId,
        storage_provider: "google_drive",
        is_primary: true
      })
    });
    if (!assetResponse.ok) {
      await fetch(base + "/rest/v1/vh_content?id=eq." + encodeURIComponent(created.id), {
        method: "DELETE",
        headers: supabaseAdminHeaders(env)
      });
      const error = await assetResponse.json().catch(() => ({}));
      return json({ error: error.message || error.details || "Media metadata could not be saved; the catalog record was rolled back." }, 502);
    }
    return json({
      success: true,
      contentId: created.id,
      title,
      driveFileName: metadata.name || title,
      previewUrl,
      directUrl
    });
  } catch (error) {
    const message = error.message || "Google Drive import failed.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
