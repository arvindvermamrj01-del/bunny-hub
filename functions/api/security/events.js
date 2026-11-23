import { json, requireUser, requireRole, recordSecurityEvent, clientIp } from "../../_shared/auth.js";

const authenticatedTypes = new Set([
  "authenticated_visit",
  "user_login_success",
  "user_signup",
  "user_logout",
  "password_reset_requested",
  "admin_login_wrong_entry",
  "unauthorized_admin_page_access"
]);
const publicTypes = new Set([
  "guest_visit",
  "user_login_failed",
  "user_signup_requested",
  "unauthorized_admin_page_access"
]);

function cleanPath(value) {
  const path = String(value || "/").split("?")[0];
  return path.startsWith("/") ? path.slice(0, 300) : "/";
}

function validSessionId(value) {
  const id = String(value || "");
  return /^[A-Za-z0-9_-]{16,80}$/.test(id) ? id : null;
}

async function cleanup(db) {
  await db.prepare("DELETE FROM vh_security_events WHERE created_at < unixepoch() - 7776000").run();
  await db.prepare("DELETE FROM vh_admin_login_attempts WHERE started_at < unixepoch() - 7776000").run();
}

export async function onRequestGet({ request, env }) {
  try {
    const { profile } = await requireRole(request, env, ["admin"]);
    if (!env.VH_SECURITY_DB) return json({ error: "Security activity storage is not configured." }, 503);
    await cleanup(env.VH_SECURITY_DB);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("limit") || "250", 10) || 250));
    const offset = Math.max(0, Math.min(100000, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0));
    const result = await env.VH_SECURITY_DB.prepare(
      "SELECT id,event_type,user_id,account_email,user_role,ip_address,user_agent,page_path,created_at " +
      "FROM vh_security_events ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    const total = await env.VH_SECURITY_DB.prepare("SELECT COUNT(*) AS total FROM vh_security_events").first();
    return json({ events: result.results || [], total: Number(total?.total || 0), offset, limit, retentionDays: 90, viewerRole: profile.role });
  } catch (error) {
    const status = error.status || (/Authentication|required/i.test(error.message || "") ? 401 : 403);
    return json({ error: error.message || "Main administrator access required." }, status);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.VH_SECURITY_DB) return json({ error: "Security activity storage is not configured." }, 503);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid event payload." }, 400);
    const requestedType = String(body.type || "");
    if (!authenticatedTypes.has(requestedType) && !publicTypes.has(requestedType)) {
      return json({ error: "Unsupported activity event." }, 400);
    }

    const path = cleanPath(body.pagePath);
    const sessionId = validSessionId(body.sessionId);
    let identity = null;
    let eventType = requestedType;

    if (authenticatedTypes.has(requestedType)) {
      const authorization = request.headers.get("Authorization") || "";
      if (authorization.startsWith("Bearer ")) {
        identity = await requireUser(request, env);
      } else if (!publicTypes.has(requestedType)) {
        return json({ error: "Authenticated session required for this event." }, 401);
      } else {
        eventType = requestedType === "user_signup" ? "user_signup_requested" : requestedType;
      }
    }

    if (requestedType === "guest_visit" && !sessionId) {
      return json({ error: "A valid anonymous session identifier is required." }, 400);
    }
    if (requestedType === "authenticated_visit" && !identity) {
      return json({ error: "Authenticated session required." }, 401);
    }

    if (eventType === "unauthorized_admin_page_access" || eventType === "admin_login_wrong_entry") {
      await env.VH_SECURITY_DB.prepare(
        "INSERT INTO vh_admin_login_attempts (attempt_id,ip_address,status,started_at) VALUES (?,?, 'failed',unixepoch())"
      ).bind(crypto.randomUUID(), clientIp(request)).run();
    }
    await recordSecurityEvent(request, env, eventType, identity, {
      pagePath: path,
      sessionId,
      ignoreDuplicate: eventType === "guest_visit"
    });
    await cleanup(env.VH_SECURITY_DB);
    return json({ recorded: true });
  } catch (error) {
    const message = error.message || "Activity could not be recorded.";
    const status = error.status || (/Authentication|required|session is invalid/i.test(message) ? 401 :
      /permission/i.test(message) ? 403 : 503);
    return json({ error: message }, status);
  }
}
