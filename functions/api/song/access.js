import { json, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

const encodePath = value => String(value).split("/").map(encodeURIComponent).join("/");

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) return json({ error: "Secure audio access is not configured." }, 503);
    const body = await request.json();
    const songId = String(body.songId || "").trim();
    const storagePath = String(body.storagePath || "").trim();
    const provider = String(body.provider || "").trim().toLowerCase();
    if (!/^\d+$/.test(songId) || !storagePath || storagePath.includes("..") || storagePath.startsWith("/") || !["supabase","cloudflare_r2","backblaze_b2"].includes(provider)) {
      return json({ error: "Invalid song audio access request." }, 400);
    }
    const url = new URL(supabaseBase(env) + "/rest/v1/vh_songs");
    url.search = new URLSearchParams({
      id: "eq." + songId,
      is_published: "eq.true",
      storage_provider: "eq." + provider,
      storage_path: "eq." + storagePath,
      select: "id"
    }).toString();
    const response = await fetch(url, { headers: supabaseAdminHeaders(env) });
    if (!response.ok) return json({ error: "Published song could not be verified." }, 403);
    const rows = await response.json();
    if (!rows.length) return json({ error: "This audio file is not attached to a published song." }, 404);

    if (provider === "backblaze_b2" || provider === "cloudflare_r2") {
      const signed = provider === "backblaze_b2"
        ? await presignB2(env, "GET", storagePath, "", 21600)
        : await presignR2(env, "GET", storagePath, "", 21600);
      return json({ url: signed.url, expiresIn: 21600 });
    }
    const base = supabaseBase(env);
    const signResponse = await fetch(base + "/storage/v1/object/sign/vh-private-media/" + encodePath(storagePath), {
      method: "POST",
      headers: supabaseAdminHeaders(env),
      body: JSON.stringify({ expiresIn: 21600 })
    });
    const signData = await signResponse.json().catch(() => ({}));
    if (!signResponse.ok || !signData.signedURL) return json({ error: signData.message || "Private audio URL could not be generated." }, 502);
    return json({ url: signData.signedURL.startsWith("http") ? signData.signedURL : base + signData.signedURL, expiresIn: 21600 });
  } catch (error) {
    return json({ error: error.message || "Secure song playback failed." }, 503);
  }
}
