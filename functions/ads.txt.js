import { supabaseAdminHeaders, supabaseBase } from "./_shared/auth.js";

/* Serve the publisher declaration from the value saved in Admin > Platform Settings. */
export async function onRequestGet({ env }) {
  try {
    let raw = String(env.ADSENSE_PUBLISHER_ID || "").trim();
    if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_URL) {
      const url = new URL(supabaseBase(env) + "/rest/v1/vh_site_settings");
      url.search = new URLSearchParams({
        setting_key: "eq.adsense_publisher_id",
        select: "setting_value",
        limit: "1"
      }).toString();
      const response = await fetch(url, { headers: supabaseAdminHeaders(env) });
      if (response.ok) {
        const rows = await response.json();
        if (rows?.[0]?.setting_value) raw = String(rows[0].setting_value).trim();
      }
    }
    const publisher = raw.replace(/^ca-/, "");
    if (!/^pub-\d{10,20}$/.test(publisher)) {
      return new Response("AdSense publisher is not configured.\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return new Response("google.com, " + publisher + ", DIRECT, f08c47fec0942fa0\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" }
    });
  } catch (_) {
    return new Response("AdSense publisher declaration is temporarily unavailable.\n", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
