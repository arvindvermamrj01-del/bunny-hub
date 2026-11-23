import { json, requireRole } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    const required = ["ADSENSE_CLIENT_ID", "ADSENSE_CLIENT_SECRET", "ADSENSE_REFRESH_TOKEN", "ADSENSE_ACCOUNT_ID"];
    const missing = required.filter(key => !env[key]);
    if (missing.length) return json({ error: "AdSense reporting credentials are missing in Cloudflare Pages secrets: " + missing.join(", ") }, 503);
    const account = String(env.ADSENSE_ACCOUNT_ID).trim();
    if (!/^accounts\/pub-\d{10,20}$/.test(account)) return json({ error: "ADSENSE_ACCOUNT_ID must use the format accounts/pub-1234567890123456." }, 503);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.ADSENSE_CLIENT_ID,
        client_secret: env.ADSENSE_CLIENT_SECRET,
        refresh_token: env.ADSENSE_REFRESH_TOKEN
      })
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token) return json({ error: token.error_description || "Google OAuth refresh failed. Reconnect AdSense reporting credentials." }, 502);

    const reportUrl = new URL("https://adsense.googleapis.com/v2/" + account + "/reports:generate");
    const requestedRange = new URL(request.url).searchParams.get("range") || "LAST_7_DAYS";
    const allowedRanges = ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"];
    const dateRange = allowedRanges.includes(requestedRange) ? requestedRange : "LAST_7_DAYS";
    reportUrl.searchParams.set("dateRange", dateRange);
    reportUrl.searchParams.set("currencyCode", "INR");
    reportUrl.searchParams.set("limit", "100");
    reportUrl.searchParams.set("orderBy", "-DATE");
    for (const dimension of ["DATE"]) reportUrl.searchParams.append("dimensions", dimension);
    for (const metric of ["ESTIMATED_EARNINGS", "IMPRESSIONS", "CLICKS", "PAGE_VIEWS", "PAGE_VIEWS_RPM"]) reportUrl.searchParams.append("metrics", metric);

    const reportResponse = await fetch(reportUrl, {
      headers: { Authorization: "Bearer " + token.access_token }
    });
    const report = await reportResponse.json().catch(() => ({}));
    if (!reportResponse.ok) return json({ error: report.error?.message || "AdSense report could not be retrieved." }, reportResponse.status === 401 || reportResponse.status === 403 ? 403 : 502);
    return json({
      currencyCode: "INR",
      headers: report.headers || [],
      rows: report.rows || [],
      totals: report.totals || null,
      averages: report.averages || null,
      totalMatchedRows: report.totalMatchedRows ?? null,
      dateRange
    });
  } catch (error) {
    const message = error.message || "AdSense report request failed.";
    return json({ error: message }, /session|authentication/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
  }
}
