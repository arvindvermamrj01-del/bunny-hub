import { json, requireUser, clientIp, recordSecurityEvent, createAdminSessionCookie, clearAdminSessionCookie } from "../../_shared/auth.js";

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
  return json({ blocked: true, attempts, retryAt: retryAt * 1000, error: "Too many failed Admin sign-in attempts. Access is temporarily blocked for this IP." }, 429, {
    "retry-after": String(Math.max(1, retryAt - Math.floor(Date.now() / 1000)))
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.VH_SECURITY_DB) return json({ error: "Admin security gate is unavailable. Sign-in has been stopped for safety." }, 503);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid security request." }, 400);
  const action = String(body.action || "");
  const ip = clientIp(request);
  const db = env.VH_SECURITY_DB;

  try {
    await db.prepare("DELETE FROM vh_admin_login_attempts WHERE started_at < unixepoch()-7776000").run();
    await db.prepare("DELETE FROM vh_security_events WHERE created_at < unixepoch()-7776000").run();
    if (action === "logout") {
      return json({ cleared: true }, 200, { "Set-Cookie": clearAdminSessionCookie() });
    }

    if (action === "check") {
      const summary = await failureSummary(db, ip);
      const attempts = Number(summary?.attempts || 0);
      if (attempts >= MAX_FAILURES) {
        return await markBlocked(request, env, Number(summary.latest || 0) + BLOCK_SECONDS, attempts);
      }

      const attemptId = crypto.randomUUID();
      const created = await db.prepare(
        "INSERT INTO vh_admin_login_attempts (attempt_id,ip_address,status,started_at) " +
        "SELECT ?,?,'pending',unixepoch() " +
        "WHERE (SELECT COUNT(*) FROM vh_admin_login_attempts WHERE ip_address=? AND status IN ('failed','denied') AND started_at > unixepoch()-?) < ? " +
        "AND (SELECT COUNT(*) FROM vh_admin_login_attempts WHERE ip_address=? AND status='pending' AND started_at > unixepoch()-120) < 3"
      ).bind(attemptId, ip, ip, WINDOW_SECONDS, MAX_FAILURES, ip).run();
      if (Number(created.meta?.changes || 0) !== 1) {
        const latest = await failureSummary(db, ip);
        const count = Number(latest?.attempts || 0);
        if (count >= MAX_FAILURES) return await markBlocked(request, env, Number(latest.latest || 0) + BLOCK_SECONDS, count);
        return json({ blocked: true, retryAt: (Math.floor(Date.now() / 1000) + 60) * 1000, error: "Another Admin sign-in check is already running. Please retry shortly." }, 429);
      }
      await db.prepare("DELETE FROM vh_admin_login_attempts WHERE started_at < unixepoch()-7776000").run();
      return json({ allowed: true, attemptId });
    }

    const attemptId = String(body.attemptId || "");
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return json({ error: "Invalid sign-in attempt reference." }, 400);

    if (action === "failed") {
      const updated = await db.prepare(
        "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch() " +
        "WHERE attempt_id=? AND ip_address=? AND status='pending'"
      ).bind(attemptId, ip).run();
      if (Number(updated.meta?.changes || 0) !== 1) return json({ error: "Sign-in attempt expired. Start again." }, 409);
      await recordSecurityEvent(request, env, "admin_login_failed", null, { pagePath: new URL(request.url).pathname });
      const summary = await failureSummary(db, ip);
      if (Number(summary?.attempts || 0) >= MAX_FAILURES) {
        return json({ recorded: true, blocked: true, retryAt: (Number(summary.latest) + BLOCK_SECONDS) * 1000, error: "Too many failed attempts. This IP is now temporarily blocked." }, 429);
      }
      return json({ recorded: true, attempts: Number(summary?.attempts || 0) });
    }

    if (action === "success") {
      // Password was accepted by Supabase Auth in the secret panel. Re-check the live staff role before minting the HttpOnly session.
      const identity = await requireUser(request, env);
      if (!identity.profile || !STAFF_ROLES.includes(identity.profile.role)) {
        await db.prepare(
          "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch(),user_id=?,account_email=?,user_role=? " +
          "WHERE attempt_id=? AND ip_address=? AND status='pending'"
        ).bind(identity.user.id, identity.user.email || null, identity.profile?.role || "unknown", attemptId, ip).run();
        await recordSecurityEvent(request, env, "admin_login_denied", identity);
        return json({ error: "This account is not authorised for the Secure Admin panel." }, 403);
      }
      const cookie = await createAdminSessionCookie(identity, env);
      const updated = await db.prepare(
        "UPDATE vh_admin_login_attempts SET status='success',finished_at=unixepoch(),user_id=?,account_email=?,user_role=? " +
        "WHERE attempt_id=? AND ip_address=? AND status='pending'"
      ).bind(identity.user.id, identity.user.email || null, identity.profile.role, attemptId, ip).run();
      if (Number(updated.meta?.changes || 0) !== 1) return json({ error: "Security sign-in check expired. Please sign in again." }, 409);
      await db.prepare("DELETE FROM vh_admin_login_attempts WHERE ip_address=? AND status IN ('failed','denied') AND started_at > unixepoch()-?").bind(ip, WINDOW_SECONDS).run();
      await recordSecurityEvent(request, env, "admin_login_success", identity);
      return json({ recorded: true, role: identity.profile.role }, 200, { "Set-Cookie": cookie });
    }

    if (action === "denied") {
      const identity = await requireUser(request, env);
      await db.prepare(
        "UPDATE vh_admin_login_attempts SET status='failed',finished_at=unixepoch(),user_id=?,account_email=?,user_role=? " +
        "WHERE attempt_id=? AND ip_address=? AND status='pending'"
      ).bind(identity.user.id, identity.user.email || null, identity.profile?.role || "unknown", attemptId, ip).run();
      await recordSecurityEvent(request, env, "admin_login_denied", identity);
      return json({ recorded: true });
    }

    return json({ error: "Unsupported Admin security action." }, 400);
  } catch (error) {
    const message = error.message || "Admin security check failed.";
    const status = error.status || (/Authentication|required|invalid or expired/i.test(message) ? 401 :
      /permission|authorised/i.test(message) ? 403 : 503);
    return json({ error: message }, status);
  }
}
