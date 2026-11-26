import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";
import { presignR2 } from "../../_shared/r2.js";
import { presignB2 } from "../../_shared/b2.js";

const encodePath = value => String(value).split("/").map(encodeURIComponent).join("/");

export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    const body = await request.json();
    const songId = String(body.songId || "").trim();
    if (!/^\d+$/.test(songId)) return json({ error: "Invalid song ID." }, 400);
    const base = supabaseBase(env), headers = supabaseAdminHeaders(env);
    const lookup = new URL(base + "/rest/v1/vh_songs");
    lookup.search = new URLSearchParams({ id: "eq." + songId, select: "id,storage_provider,storage_path" }).toString();
    const lookupResponse = await fetch(lookup, { headers });
    if (!lookupResponse.ok) return json({ error: "Song record could not be verified." }, 502);
    const rows = await lookupResponse.json();
    if (!rows.length) return json({ error: "Song not found." }, 404);
    const song = rows[0], provider = String(song.storage_provider || "direct").toLowerCase(), path = String(song.storage_path || "");
    if (path) {
      if (path.includes("..") || path.startsWith("/")) return json({ error: "Invalid stored audio path." }, 400);
      if (provider === "backblaze_b2" || provider === "cloudflare_r2") {
        const signed = provider === "backblaze_b2"
          ? await presignB2(env, "DELETE", path, "", 300)
          : await presignR2(env, "DELETE", path, "", 300);
        const result = await fetch(signed.url, { method: "DELETE" });
        if (!result.ok && result.status !== 404) return json({ error: "Cloud audio file could not be deleted; song record was kept." }, 502);
      } else if (provider === "supabase") {
        const result = await fetch(base + "/storage/v1/object/vh-private-media/" + encodePath(path), { method: "DELETE", headers });
        if (!result.ok && result.status !== 404) return json({ error: "Private audio file could not be deleted; song record was kept." }, 502);
      }
    }
    const deletion = await fetch(base + "/rest/v1/vh_songs?id=eq." + encodeURIComponent(songId), { method: "DELETE", headers });
    if (!deletion.ok) return json({ error: "Song record could not be deleted." }, 502);
    return json({ success: true });
  } catch (error) {
    const message = error.message || "Song deletion failed.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
