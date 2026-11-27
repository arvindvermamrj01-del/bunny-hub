import { json, requireRole } from "../../_shared/auth.js";

/* Updates Backblaze B2 bucket CORS rules via B2 Native API so browser S3 PUT uploads succeed. */
export async function onRequestPost({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);

    const bucketName = String(env.B2_BUCKET_NAME || "").trim();
    const keyId = String(env.B2_KEY_ID || "").trim();
    const appKey = String(env.B2_APPLICATION_KEY || "").trim();
    if (!bucketName || !keyId || !appKey) {
      return json({ ok: false, error: "Backblaze B2 secrets (B2_BUCKET_NAME, B2_KEY_ID, B2_APPLICATION_KEY) are missing." }, 503);
    }

    const basicAuth = "Basic " + btoa(keyId + ":" + appKey);
    const authResp = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: { Authorization: basicAuth }
    });
    const authData = await authResp.json().catch(() => ({}));
    if (!authResp.ok || !authData.apiUrl || !authData.authorizationToken || !authData.accountId) {
      return json({
        ok: false,
        stage: "authorize",
        error: authData.message || "Backblaze B2 authorization failed. Check B2_KEY_ID and B2_APPLICATION_KEY."
      }, 502);
    }

    const listResp = await fetch(authData.apiUrl + "/b2api/v2/b2_list_buckets", {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId: authData.accountId,
        bucketName
      })
    });
    const listData = await listResp.json().catch(() => ({}));
    const bucket = (listData.buckets || []).find(b => b.bucketName === bucketName);
    if (!listResp.ok || !bucket?.bucketId) {
      return json({
        ok: false,
        stage: "list_buckets",
        error: listData.message || ("Bucket '" + bucketName + "' not found or key lacks listBuckets permission.")
      }, 502);
    }

    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = Array.from(new Set([
      "https://bunny-hub.pages.dev",
      requestOrigin
    ].filter(origin => /^https?:\/\//i.test(origin))));

    const corsRules = [
      {
        corsRuleName: "bunnyhub-s3-upload",
        allowedOrigins,
        allowedOperations: [
          "s3_put",
          "s3_get",
          "s3_head",
          "s3_post",
          "s3_delete",
          "b2_download_file_by_name",
          "b2_download_file_by_id"
        ],
        allowedHeaders: ["*"],
        exposeHeaders: ["ETag", "x-amz-request-id", "x-bz-content-sha1"],
        maxAgeSeconds: 3600
      }
    ];

    const updateResp = await fetch(authData.apiUrl + "/b2api/v2/b2_update_bucket", {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId: authData.accountId,
        bucketId: bucket.bucketId,
        ifRevisionIs: bucket.revision,
        corsRules
      })
    });
    const updateData = await updateResp.json().catch(() => ({}));
    if (!updateResp.ok || !updateData.bucketId) {
      return json({
        ok: false,
        stage: "update_bucket",
        error: updateData.message || "Could not update Backblaze B2 CORS rules. Ensure the key has writeBuckets capability."
      }, 502);
    }

    return json({
      ok: true,
      bucket: bucketName,
      allowedOrigins,
      message: "B2 CORS rules updated for browser uploads (s3_put enabled). Wait ~60 seconds and try uploading."
    });
  } catch (error) {
    const message = error.message || "Could not update B2 CORS rules.";
    const status = error.status || (/Authentication|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 503);
    return json({ ok: false, error: message }, status);
  }
}
