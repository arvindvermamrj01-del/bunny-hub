const clean = value => String(value || "").replace(/\/+$/, "");
const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

export async function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a ?? ""));
  const right = encoder.encode(String(b ?? ""));
  const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigA = new Uint8Array(await crypto.subtle.sign("HMAC", key, left));
  const sigB = new Uint8Array(await crypto.subtle.sign("HMAC", key, right));
  let diff = left.length ^ right.length;
  for (let i = 0; i < sigA.length; i++) diff |= sigA[i] ^ sigB[i];
  return diff === 0;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value || "")));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function requireUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new Error("Authentication required.");
  return verifyAccessToken(token, env);
}

export async function verifyAccessToken(token, env) {
  const base = clean(env.SUPABASE_URL);
  if (!base || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or publishable key is not configured on the server.");
  }
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) throw new Error("Your session is invalid or expired.");
  const user = await response.json();
  if (!user?.id) throw new Error("Authenticated user could not be verified.");

  const readProfile = async nameField => {
    const profileUrl = new URL(base + "/rest/v1/profiles");
    profileUrl.search = new URLSearchParams({
      id: "eq." + user.id,
      select: "id," + nameField + ",role"
    }).toString();
    return fetch(profileUrl, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
  };
  let profileResponse = await readProfile("fullname");
  if (!profileResponse.ok) profileResponse = await readProfile("full_name");
  if (!profileResponse.ok) throw new Error("Could not verify your BunnyHub role. Check profile read permissions.");
  const rows = await profileResponse.json();
  const profile = rows[0] || null;
  if (profile && !profile.fullname) profile.fullname = profile.full_name || null;
  return { user, profile, token };
}

export function clientIp(request) {
  const value = request.headers.get("CF-Connecting-IP") || "unknown";
  return value.slice(0, 80);
}

export async function recordSecurityEvent(request, env, eventType, identity = null, extra = {}) {
  const db = env.VH_SECURITY_DB;
  if (!db) return null;
  const path = String(extra.pagePath || new URL(request.url).pathname).split("?")[0].slice(0, 300);
  const userAgent = String(request.headers.get("user-agent") || "").slice(0, 512);
  const sessionId = extra.sessionId ? String(extra.sessionId).slice(0, 80) : null;
  const statement = extra.ignoreDuplicate ? "INSERT OR IGNORE" : "INSERT";
  return db.prepare(statement + " INTO vh_security_events (event_type,user_id,account_email,user_role,ip_address,user_agent,page_path,session_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(
      String(eventType).slice(0, 64),
      identity?.user?.id || identity?.id || null,
      identity?.user?.email || identity?.email || null,
      identity?.profile?.role || identity?.role || null,
      clientIp(request),
      userAgent,
      path,
      sessionId
    ).run();
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    if (item.slice(0, index).trim() === name) return item.slice(index + 1).trim();
  }
  return "";
}

export async function createAdminSessionCookie(identity, request, env) {
  const secret = env.VH_ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Secure Admin session signing key is not configured.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const uaHash = (await sha256Hex(request.headers.get("user-agent") || "")).slice(0, 24);
  const claims = {
    sub: identity.user.id,
    role: identity.profile.role,
    ua: uaHash,
    pin: true,
    iat: issuedAt,
    exp: issuedAt + 3600,
    jti: crypto.randomUUID()
  };
  const payload = btoa(JSON.stringify(claims))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  const value = payload + "." + btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return "VH_ADMIN_SESSION=" + value + "; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600";
}

export function clearAdminSessionCookie() {
  return "VH_ADMIN_SESSION=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export async function hasValidAdminSession(request, env, identity) {
  try {
    if (!env.VH_ADMIN_SESSION_SECRET) return false;
    const token = readCookie(request, "VH_ADMIN_SESSION");
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const payload = parts[0];
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    const now = Math.floor(Date.now() / 1000);
    const expectedUa = (await sha256Hex(request.headers.get("user-agent") || "")).slice(0, 24);
    if (!claims?.sub || claims.sub !== identity.user.id ||
        claims.role !== identity.profile?.role ||
        claims.pin !== true ||
        claims.ua !== expectedUa ||
        !Number.isFinite(claims.exp) || claims.exp <= now ||
        !Number.isFinite(claims.iat) || claims.iat > now + 30) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.VH_ADMIN_SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(parts[1]),
      encoder.encode(payload)
    );
  } catch (_) {
    return false;
  }
}

const STAFF_PROTECTED_ROLES = ["admin", "sub_admin", "content_editor", "moderator"];

async function countRecentSecurityFailures(request, env) {
  if (!env.VH_SECURITY_DB) return { attempts: 0, latest: 0 };
  const result = await env.VH_SECURITY_DB.prepare(
    "SELECT COUNT(*) AS attempts, COALESCE(MAX(started_at),0) AS latest " +
    "FROM vh_admin_login_attempts WHERE ip_address=? AND status IN ('failed','denied') AND started_at > unixepoch()-1800"
  ).bind(clientIp(request)).first();
  return { attempts: Number(result?.attempts || 0), latest: Number(result?.latest || 0) };
}

async function recordDeniedStaffAccess(request, env, identity = null) {
  try {
    if (env.VH_SECURITY_DB) {
      await env.VH_SECURITY_DB.prepare(
        "INSERT INTO vh_admin_login_attempts (attempt_id,ip_address,status,started_at) VALUES (?,?, 'failed',unixepoch())"
      ).bind(crypto.randomUUID(), clientIp(request)).run();
    }
    await recordSecurityEvent(request, env, "unauthorized_admin_access", identity, {
      pagePath: new URL(request.url).pathname
    });
  } catch (_) {}
}

export async function requireRole(request, env, roles) {
  const protectsStaff = roles.some(role => STAFF_PROTECTED_ROLES.includes(role));
  if (protectsStaff) {
    const failures = await countRecentSecurityFailures(request, env).catch(() => ({ attempts: 0, latest: 0 }));
    if (failures.attempts >= 5 && failures.latest + 1800 > Math.floor(Date.now() / 1000)) {
      await recordSecurityEvent(request, env, "admin_login_blocked", null).catch(() => null);
      const error = new Error("Admin access is temporarily blocked for this IP after repeated failed or unauthorised attempts.");
      error.status = 429;
      throw error;
    }
  }

  let identity;
  try {
    identity = await requireUser(request, env);
  } catch (error) {
    if (protectsStaff) await recordDeniedStaffAccess(request, env, null);
    throw error;
  }

  if (!identity.profile || !roles.includes(identity.profile.role)) {
    if (protectsStaff) {
      await recordDeniedStaffAccess(request, env, identity);
    } else {
      await recordSecurityEvent(request, env, "unauthorized_admin_access", identity).catch(() => null);
    }
    throw new Error("You do not have permission to perform this action.");
  }
  if (protectsStaff && !(await hasValidAdminSession(request, env, identity))) {
    await recordDeniedStaffAccess(request, env, identity);
    const error = new Error("Two-layer Admin verification required for this protected action.");
    error.status = 401;
    throw error;
  }
  return identity;
}

export function supabaseAdminHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "content-type": "application/json"
  };
}

export function supabaseBase(env) {
  return clean(env.SUPABASE_URL);
}
