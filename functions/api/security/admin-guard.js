import {
  json,
  requireUser,
  verifyAccessToken,
  clientIp,
  recordSecurityEvent,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  hasValidAdminSession,
  constantTimeEqual,
  supabaseBase
} from "../../_shared/auth.js";

const STAFF_ROLES = ["admin", "sub_admin", "content_editor", "moderator"];
const MAX_FAILURES = 5;
const WINDOW_SECONDS = 1800;
const BLOCK_SECONDS = 1800;

async function failureSummary(db, ip) {
  return db.prepare(
    "SELECT COUNT(*) AS attempts, COALESCE(MAX(started_at),0) AS latest " +
    "FROM vh_admin_login_attempts WHERE ip_address=? AND status IN ('failed','denied') AND started_at > unixepoch()-?"
  ).bind(ip, WINDOW_SECONDS).first();
}

async function markBlocked(request, env, retryAt, attempts) {
  await env.VH_SECURITY_DB.prepare(
    "INSERT INTO vh_security_events (event_type,ip_address,user_agent,page_path) " +
    "SELECT 'admin_login_blocked',?,?,? WHERE NOT EXISTS (" +
    "SELECT 1 FROM vh_security_events WHERE event_type='admin_login_blocked' AND ip_address=? AND created_at > unixepoch()-300)"
  ).bind(
    clientIp(request),
    String(request.headers.get("user-agent") || "").slice(0, 512),
    new URL(request.url).pathname,
    clientIp(request)
  ).run();
  return json({
    blocked: true,
    attempts,
    retryAt: retryAt * 1000,
    error: "Too many failed Admin sign-in attempts. Access is temporarily blocked for this IP."
  }, 429, {
    "retry-after": String(Math.max(1, retryAt - Math.floor(Date.now() / 1000)))
  });
}

/* Verify existing HttpOnly two-layer admin session cookie on page reload. */
export async function onRequestGet({ request, env }) {
  try {
    const identity = await requireUser(request, env);
    if (!identity.profile || !STAFF_ROLES.includes(identity.profile.role)) {
      return json({ active: false, error: "Not a staff account." }, 403);
    }
    const valid = await hasValidAdminSession(request, env, identity);
    if (!valid) {
      return json({ active: false, error: "Two-layer Admin session expired or unverified." }, 401);
    }
    return json({ active: true, role: identity.profile.role });
  } catch (error) {
    return json({ active: false, error: error.message || "Admin session invalid." }, 401);
  }
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid security request." }, 400);
  const action = String(body.action || "");

  if (action === "logout") {
    return json({ cleared: true }, 200, { "Set-Cookie": clearAdminSessionCookie() });
  }

  if (!env.VH_SECURITY_DB || !env.VH_ADMIN_SESSION_SECRET || !env.ADMIN_SECURITY_PIN) {
    return json({
      error: "Double-layer Admin security gate is not fully configured (requires VH_SECURITY_DB, VH_ADMIN_SESSION_SECRET, ADMIN_SECURITY_PIN)."
    }, 503);
  }

  const ip = clientIp(request);
  const db = env.VH_SECURITY_DB;

  try {
    await db.prepare("DELETE FROM vh_admin_login_attempts WHERE started_at < unixepoch()-7776000").run();
    await db.prepare("DELETE FROM vh_security_events WHERE created_at < unixepoch()-7776000").run();

    const summary = await failureSummary(db, ip);
    const recentAttempts = Number(summary?.attempts || 0);
    if (recentAttempts >= MAX_FAILURES) {
      return await markBlocked(request, env, Number(summary.latest || 0) + BLOCK_SECONDS, recentAttempts);
    }

    if (action === "authenticate") {
      const identifier = String(body.identifier || "").trim().toLowerCase();
      const password = String(body.password || "");
      const securityPin = String(body.securityPin || "").trim();

      if (!identifier || !password || password.length > 256 || !securityPin || securityPin.length > 128) {
        return json({ error: "Email/username, password, and Security PIN are all required." }, 400);
      }

      const attemptId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO vh_admin_login_attempts (attempt_id,ip_address,status,started_at) VALUES (?,?,'pending',unixepoch())"
      ).bind(attemptId, ip).run();

      // Layer 2 check first (constant-time comparison against server secret PIN)
      const pinMatches = await constantTimeEqual(securityPin, String(env.ADMIN_SECURITY_PIN).trim());
      if (!pinMatches) {
        await db.prepare(
          "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch() WHERE attempt_id=? AND ip_address=?"
        ).bind(attemptId, ip).run();
        await recordSecurityEvent(request, env, "admin_login_failed", null, { pagePath: "/control-center" });
        const after = await failureSummary(db, ip);
        if (Number(after?.attempts || 0) >= MAX_FAILURES) {
          return await markBlocked(request, env, Number(after.latest || 0) + BLOCK_SECONDS, Number(after.attempts));
        }
        return json({ error: "Invalid Admin credentials or Security PIN." }, 401);
      }

      // Resolve owner alias server-side only when ADMIN_OWNER_EMAIL is configured in secrets
      const resolvedEmail = identifier === "admin" && env.ADMIN_OWNER_EMAIL
        ? String(env.ADMIN_OWNER_EMAIL).trim().toLowerCase()
        : identifier;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
        await db.prepare(
          "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch() WHERE attempt_id=? AND ip_address=?"
        ).bind(attemptId, ip).run();
        await recordSecurityEvent(request, env, "admin_login_failed", null, { pagePath: "/control-center" });
        return json({ error: "Invalid Admin credentials or Security PIN." }, 401);
      }

      // Layer 1 check: Supabase password authentication performed server-side
      const base = supabaseBase(env);
      if (!base || !env.SUPABASE_ANON_KEY) {
        return json({ error: "Authentication backend is not configured." }, 503);
      }
      const authResponse = await fetch(base + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({ email: resolvedEmail, password })
      });
      const authData = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok || !authData.access_token || !authData.refresh_token) {
        await db.prepare(
          "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch(),account_email=? WHERE attempt_id=? AND ip_address=?"
        ).bind(resolvedEmail, attemptId, ip).run();
        await recordSecurityEvent(request, env, "admin_login_failed", { email: resolvedEmail }, { pagePath: "/control-center" });
        const after = await failureSummary(db, ip);
        if (Number(after?.attempts || 0) >= MAX_FAILURES) {
          return await markBlocked(request, env, Number(after.latest || 0) + BLOCK_SECONDS, Number(after.attempts));
        }
        return json({ error: "Invalid Admin credentials or Security PIN." }, 401);
      }

      // Verify staff role from profiles table
      const identity = await verifyAccessToken(authData.access_token, env);
      if (!identity.profile || !STAFF_ROLES.includes(identity.profile.role)) {
        await db.prepare(
          "UPDATE vh_admin_login_attempts SET status='denied',finished_at=unixepoch(),user_id=?,account_email=?,user_role=? WHERE attempt_id=? AND ip_address=?"
        ).bind(identity.user.id, identity.user.email || null, identity.profile?.role || "user", attemptId, ip).run();
        await recordSecurityEvent(request, env, "admin_login_denied", identity, { pagePath: "/control-center" });
        return json({ error: "This account is not authorised for the Secure Admin panel." }, 403);
      }

      const cookie = await createAdminSessionCookie(identity, request, env);
      await db.prepare(
        "UPDATE vh_admin_login_attempts SET status='success',finished_at=unixepoch(),user_id=?,account_email=?,user_role=? WHERE attempt_id=? AND ip_address=?"
      ).bind(identity.user.id, identity.user.email || null, identity.profile.role, attemptId, ip).run();
      await db.prepare(
        "DELETE FROM vh_admin_login_attempts WHERE ip_address=? AND status IN ('failed','denied') AND started_at > unixepoch()-?"
      ).bind(ip, WINDOW_SECONDS).run();
      await recordSecurityEvent(request, env, "admin_login_success", identity, { pagePath: "/control-center" });

      return json({
        authenticated: true,
        role: identity.profile.role,
        session: {
          access_token: authData.access_token,
          refresh_token: authData.refresh_token
        }
      }, 200, { "Set-Cookie": cookie });
    }

    return json({ error: "Unsupported Admin security action." }, 400);
  } catch (error) {
    const message = error.message || "Admin security check failed.";
    const status = error.status || (/Authentication|required|invalid or expired/i.test(message) ? 401 :
      /permission|authorised/i.test(message) ? 403 : 503);
    return json({ error: message }, status);
  }
}
