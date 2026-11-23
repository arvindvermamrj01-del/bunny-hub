import { json, requireRole, supabaseAdminHeaders, supabaseBase } from "../../_shared/auth.js";

const allowedRoles = ["sub_admin", "content_editor", "moderator"];

export async function onRequestGet({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    const base = supabaseBase(env) + "/rest/v1/profiles";
    const readTeam = async nameField => {
      const url = new URL(base);
      url.search = new URLSearchParams({ role: "in.(" + allowedRoles.join(",") + ")", select: "id," + nameField + ",role,created_at", order: "created_at.desc" }).toString();
      return fetch(url, { headers: supabaseAdminHeaders(env) });
    };
    let response = await readTeam("fullname");
    if (!response.ok) response = await readTeam("full_name");
    const data = await response.json().catch(() => []);
    if (!response.ok) return json({ error: "Team list could not be loaded." }, 502);
    return json({ team: (data || []).map(profile => ({ ...profile, fullname: profile.fullname || profile.full_name || "" })) });
  } catch (error) {
    return json({ error: error.message || "Admin permission required." }, 403);
  }
}

export async function onRequestPost({ request, env }) {
  let createdUserId = null;
  try {
    await requireRole(request, env, ["admin"]);
    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid staff name and email address." }, 400);
    if (password.length < 12) return json({ error: "Sub-admin passwords must contain at least 12 characters." }, 400);
    if (!allowedRoles.includes(role)) return json({ error: "Choose a valid staff permission role." }, 400);

    const base = supabaseBase(env);
    const headers = supabaseAdminHeaders(env);
    const createResponse = await fetch(base + "/auth/v1/admin/users", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      })
    });
    const created = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok || !created.id) {
      return json({ error: created.msg || created.message || created.error_description || "Supabase could not create the staff account." }, 502);
    }
    createdUserId = created.id;
    const profileUrl = base + "/rest/v1/profiles?on_conflict=id";
    const profileHeaders = { ...headers, Prefer: "resolution=merge-duplicates,return=representation" };
    let profileResponse = await fetch(profileUrl, {
      method: "POST",
      headers: profileHeaders,
      body: JSON.stringify({ id: createdUserId, fullname: name, role })
    });
    if (!profileResponse.ok) {
      const firstError = await profileResponse.text();
      if (/fullname|PGRST204|42703/i.test(firstError)) {
        profileResponse = await fetch(profileUrl, {
          method: "POST",
          headers: profileHeaders,
          body: JSON.stringify({ id: createdUserId, full_name: name, role })
        });
      } else {
        // Preserve the provider error below without attempting a second insert.
        profileResponse = new Response(firstError, { status: 502 });
      }
    }
    if (!profileResponse.ok) {
      await fetch(base + "/auth/v1/admin/users/" + createdUserId, { method: "DELETE", headers });
      const detail = await profileResponse.text();
      return json({ error: "Account was rolled back because its profile permissions could not be saved: " + detail.slice(0, 240) }, 502);
    }
    return json({ success: true, user: { id: createdUserId, fullname: name, role } }, 201);
  } catch (error) {
    return json({ error: error.message || "Sub-admin creation failed." }, 403);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    await requireRole(request, env, ["admin"]);
    const body = await request.json();
    const userId = String(body.userId || "").trim();
    if (!userId) return json({ error: "Staff user ID is required." }, 400);
    const url = new URL(supabaseBase(env) + "/rest/v1/profiles");
    url.search = new URLSearchParams({ id: "eq." + userId, role: "in.(" + allowedRoles.join(",") + ")" }).toString();
    const response = await fetch(url, {
      method: "PATCH",
      headers: { ...supabaseAdminHeaders(env), Prefer: "return=representation" },
      body: JSON.stringify({ role: "user" })
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return json({ error: "Could not revoke staff permissions." }, 502);
    if (!rows.length) return json({ error: "Staff account not found." }, 404);
    return json({ success: true, message: "Staff permissions were revoked. The sign-in account remains intact." });
  } catch (error) {
    return json({ error: error.message || "Admin permission required." }, 403);
  }
}