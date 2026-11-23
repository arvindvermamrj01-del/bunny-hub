import { json, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

const encodePath = value => String(value).split("/").map(encodeURIComponent).join("/");

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) {
      return json({ error: "Secure media signing is not configured on the server." }, 503);
    }
    const body = await request.json();
    const contentId = String(body.contentId || "").trim();
    const storagePath = String(body.storagePath || "").trim();
    const provider = String(body.provider || "").trim().toLowerCase();
    const downloadName = String(body.downloadName || "").replace(/[\r\n"]/g, "").replace(/[\\/\\\\]/g, "_").replace(/[^A-Za-z0-9._() -]/g, "_").trim().slice(0, 120);
    const contentDisposition = downloadName ? 'attachment; filename="' + downloadName + '"' : "";
    if (!contentId || !storagePath || !["supabase", "cloudflare_r2", "backblaze_b2"].includes(provider)) {
      return json({ error: "Invalid media access request." }, 400);
    }
    const base = supabaseBase(env);
    const headers = supabaseAdminHeaders(env);
    const contentQuery = new URL(base + "/rest/v1/vh_content");
    contentQuery.search = new URLSearchParams({ id: "eq." + contentId, published: "eq.true", select: "id" }).toString();
    const contentResponse = await fetch(contentQuery, { headers });
    if (!contentResponse.ok) return json({ error: "Published content could not be verified." }, 403);
    const contentRows = await contentResponse.json();
    if (!contentRows.length) return json({ error: "This title is not publicly available." }, 404);

    const assetQuery = new URL(base + "/rest/v1/vh_media_assets");
    assetQuery.search = new URLSearchParams({
      content_id: "eq." + contentId,
      storage_provider: "eq." + provider,
      storage_path: "eq." + storagePath,
      select: "id"
    }).toString();
    const assetResponse = await fetch(assetQuery, { headers });
    if (!assetResponse.ok) return json({ error: "Media asset could not be verified." }, 403);
    const assetRows = await assetResponse.json();
    if (!assetRows.length) return json({ error: "This media file is not attached to the published title." }, 404);

    if (provider === "cloudflare_r2" || provider === "backblaze_b2") {
      const signed = provider === "backblaze_b2"
        ? await presignB2(env, "GET", storagePath, "", 21600, contentDisposition)
        : await presignR2(env, "GET", storagePath, "", 21600, contentDisposition);
      return json({ url: signed.url, expiresIn: 21600 });
    }
    const bucket = "vh-private-media";
    const signResponse = await fetch(base + "/storage/v1/object/sign/" + bucket + "/" + encodePath(storagePath), {
      method: "POST",
      headers,
      body: JSON.stringify(downloadName ? { expiresIn: 21600, download: downloadName } : { expiresIn: 21600 })
    });
    const signData = await signResponse.json().catch(() => ({}));
    if (!signResponse.ok || !signData.signedURL) {
      return json({ error: signData.message || signData.error || "Private media URL could not be generated." }, 502);
    }
    const signedURL = signData.signedURL.startsWith("http") ? signData.signedURL : base + signData.signedURL;
    return json({ url: signedURL, expiresIn: 21600 });
  } catch (error) {
    return json({ error: error.message || "Secure media access failed." }, 503);
  }
}