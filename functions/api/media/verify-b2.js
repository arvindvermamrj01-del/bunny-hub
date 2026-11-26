import { json, requireRole } from "../../_shared/auth.js";
import { presignB2 } from "../../_shared/b2.js";

// Performs a short-lived S3-compatible write/read/delete probe. The object key is
// random and the probe is removed before a successful response is returned.
export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);

    const required = ["B2_ENDPOINT", "B2_BUCKET_NAME", "B2_KEY_ID", "B2_APPLICATION_KEY"];
    const missing = required.filter(key => typeof env[key] !== "string" || !env[key].trim());
    if (missing.length) {
      return json({ verified: false, stage: "configuration", error: "Backblaze B2 credentials are incomplete.", missing }, 503);
    }

    const endpoint = new URL(String(env.B2_ENDPOINT).includes("://") ? env.B2_ENDPOINT : "https://" + env.B2_ENDPOINT).host;
    const region = endpoint.split(".")[1] || "";
    const key = "__vh_healthcheck__/" + crypto.randomUUID() + ".txt";
    const probe = "bunnyhub-B2-CHECK-" + crypto.randomUUID();
    let uploaded = false;
    let stage = "upload";

    try {
      const put = await presignB2(env, "PUT", key, "text/plain", 300);
      const putResponse = await fetch(put.url, {
        method: "PUT",
        headers: put.headers,
        body: probe
      });
      if (!putResponse.ok) {
        // Surface only the provider's safe diagnostic fields; never return the
        // presigned URL, Authorization data, application key, or raw XML.
        const providerBody = await putResponse.text().catch(() => "");
        const readXmlField = name => {
          const match = providerBody.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">"));
          return match ? match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").slice(0, 240) : "";
        };
        return json({
          verified: false,
          stage,
          httpStatus: putResponse.status,
          providerCode: readXmlField("Code") || undefined,
          providerMessage: readXmlField("Message") || undefined,
          requestId: readXmlField("RequestId") || readXmlField("RequestID") || undefined,
          error: "B2 rejected the temporary test upload. Provider diagnostics are included to identify the exact cause."
        }, 502);
      }
      uploaded = true;

      stage = "read";
      const get = await presignB2(env, "GET", key, "", 300);
      const getResponse = await fetch(get.url);
      if (!getResponse.ok) {
        try {
          const cleanup = await presignB2(env, "DELETE", key, "", 300);
          const cleanupResponse = await fetch(cleanup.url, { method: "DELETE" });
          uploaded = !cleanupResponse.ok;
        } catch (_) { uploaded = true; }
        return json({ verified: false, stage, httpStatus: getResponse.status, cleanupRequired: uploaded, error: "B2 accepted the test upload but the test object could not be read. Check key read permissions." }, 502);
      }
      const actual = await getResponse.text();
      if (actual !== probe) {
        try {
          const cleanup = await presignB2(env, "DELETE", key, "", 300);
          const cleanupResponse = await fetch(cleanup.url, { method: "DELETE" });
          uploaded = !cleanupResponse.ok;
        } catch (_) { uploaded = true; }
        return json({ verified: false, stage, cleanupRequired: uploaded, error: "B2 returned unexpected test-object content." }, 502);
      }

      stage = "delete";
      const del = await presignB2(env, "DELETE", key, "", 300);
      const deleteResponse = await fetch(del.url, { method: "DELETE" });
      if (!deleteResponse.ok) {
        return json({ verified: false, stage, httpStatus: deleteResponse.status, cleanupRequired: true, error: "B2 upload and read passed, but deletion failed. Check delete permission." }, 502);
      }
      uploaded = false;

      return json({
        verified: true,
        bucket: env.B2_BUCKET_NAME,
        endpoint,
        region,
        checks: { credentials: true, upload: true, readBack: true, delete: true },
        message: "B2 S3-compatible access verified. Temporary test object was deleted."
      });
    } catch (error) {
      if (uploaded) {
        try {
          const cleanup = await presignB2(env, "DELETE", key, "", 300);
          await fetch(cleanup.url, { method: "DELETE" });
        } catch (_) {}
      }
      // Do not return signed URLs, credentials, or provider response bodies.
      return json({
        verified: false,
        stage,
        error: "B2 verification failed during " + stage + ". Check the bucket endpoint, key scope and required permissions."
      }, 502);
    }
  } catch (error) {
    const message = error.message || "B2 verification is unavailable.";
    const status = error.status || (/Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
    return json({ verified: false, error: message }, status);
  }
}
