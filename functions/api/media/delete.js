import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

const encodePath = value => String(value).split("/").map(encodeURIComponent).join("/");

export async function onRequestPost({ request, env }) {
  try {
    const { user, profile } = await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const body = await request.json();
    const userId = user.id;
    const storagePath = String(body.storagePath || "").trim();
    const provider = String(body.provider || "").trim().toLowerCase();
    const contentId = String(body.contentId || "").trim();
    if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) {
      return json({ error: "Invalid storage path." }, 400);
    }
    const base = supabaseBase(env);
    const headers = supabaseAdminHeaders(env);

    // A content deletion must prove that this exact object is attached to the selected title.
    if (contentId) {
      const contentUrl = new URL(base + "/rest/v1/vh_content");
      contentUrl.search = new URLSearchParams({ id: "eq." + contentId, select: "id,content_type,created_by" }).toString();
      const contentResponse = await fetch(contentUrl, { headers });
      if (!contentResponse.ok) return json({ error: "Content permissions could not be verified." }, 502);
      const contentRows = await contentResponse.json();
      if (!contentRows.length) return json({ error: "Content item not found." }, 404);
      if (profile?.role === "content_editor" && contentRows[0].created_by !== userId) {
        return json({ error: "Content Editors can only remove media from content they created." }, 403);
      }
      if (profile?.role === "content_editor" && contentRows[0].content_type === "Short") {
        return json({ error: "Content Editors cannot remove Short videos." }, 403);
      }
      const assetUrl = new URL(base + "/rest/v1/vh_media_assets");
      assetUrl.search = new URLSearchParams({
        content_id: "eq." + contentId,
        storage_provider: "eq." + provider,
        storage_path: "eq." + storagePath,
        select: "id"
      }).toString();
      const assetResponse = await fetch(assetUrl, { headers });
      if (!assetResponse.ok) return json({ error: "Media record could not be verified." }, 502);
      const records = await assetResponse.json();
      if (!records.length) return json({ error: "Media is not attached to this content item." }, 404);
    } else if (!storagePath.startsWith(userId + "/")) {
      return json({ error: "You can only clean up files uploaded by your account." }, 403);
    }

    if (provider === "cloudflare_r2" || provider === "backblaze_b2") {
      const signed = provider === "backblaze_b2"
        ? await presignB2(env, "DELETE", storagePath, "", 300)
        : await presignR2(env, "DELETE", storagePath, "", 300);
      const result = await fetch(signed.url, { method: "DELETE" });
      if (!result.ok && result.status !== 404) return json({ error: "Cloud storage object cleanup failed." }, 502);
      return json({ success: true });
    }
    if (provider === "supabase") {
      const response = await fetch(base + "/storage/v1/object/vh-private-media/" + encodePath(storagePath), {
        method: "DELETE",
        headers
      });
      if (!response.ok && response.status !== 404) return json({ error: "Private storage cleanup failed." }, 502);
      return json({ success: true });
    }
    return json({ error: "Unsupported storage provider." }, 400);
  } catch (error) {
    return json({ error: error.message || "Storage cleanup failed." }, 403);
  }
}