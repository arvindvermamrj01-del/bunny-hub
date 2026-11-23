const encoder = new TextEncoder();
const encode = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
async function sha256(value) { return crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value); }
async function hmac(key, value) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(value));
}
export async function presignB2(env, method, key, contentType = "", expires = 900, responseContentDisposition = "") {
  const endpoint = String(env.B2_ENDPOINT || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const bucket = env.B2_BUCKET_NAME;
  const accessKey = env.B2_KEY_ID;
  const secretKey = env.B2_APPLICATION_KEY;
  const region = endpoint.split(".")[1] || "";
  if (![endpoint, bucket, accessKey, secretKey, region].every(Boolean)) throw new Error("Backblaze B2 secrets are not configured.");
  const host = endpoint;
  const uri = "/" + encode(bucket) + "/" + String(key).split("/").map(encode).join("/");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/" + region + "/s3/aws4_request";
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": accessKey + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(60, Math.min(604800, Number(expires) || 900))),
    "X-Amz-SignedHeaders": contentType ? "content-type;host" : "host"
  };
  if (responseContentDisposition) params["response-content-disposition"] = responseContentDisposition;
  const canonicalQuery = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => encode(name) + "=" + encode(value)).join("&");
  const canonicalHeaders = contentType ? "content-type:" + contentType.trim() + "\nhost:" + host + "\n" : "host:" + host + "\n";
  const signedHeaders = contentType ? "content-type;host" : "host";
  const canonicalRequest = [method.toUpperCase(), uri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hex(await sha256(canonicalRequest))].join("\n");
  const dateKey = await hmac(encoder.encode("AWS4" + secretKey), dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, "s3");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  return { url: "https://" + host + uri + "?" + canonicalQuery + "&X-Amz-Signature=" + signature, headers: contentType ? { "Content-Type": contentType } : {} };
}
