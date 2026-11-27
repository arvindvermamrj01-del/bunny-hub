(() => {
  "use strict";

  const url = window.VH_SUPABASE_URL;
  const key = window.VH_SUPABASE_PUBLISHABLE_KEY;

  if (!window.supabase || !url || !key) {
    console.error("Supabase configuration missing.");
    return;
  }

  const db = window.supabase.createClient(url, key);
  window.VH_SUPABASE = db;
  window.VH_IS_ADMIN = false;

  const STAFF_ROLES = ["admin", "sub_admin", "content_editor", "moderator"];
  const el = id => document.getElementById(id);

  function msg(message) {
    if (typeof window.toast === "function") {
      window.toast(message);
    } else {
      alert(message);
    }
  }

  async function securityRequest(path, payload, accessToken, method = "POST") {
    const headers = {};
    if (method !== "GET") headers["content-type"] = "application/json";
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      ...(method !== "GET" ? { body: JSON.stringify(payload || {}) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Security service unavailable.");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function verifyServerAdminCookie(user) {
    try {
      const { data: { session } } = await db.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken || session?.user?.id !== user?.id) return false;
      const status = await securityRequest("/api/security/admin-guard", null, accessToken, "GET");
      return status?.active === true && STAFF_ROLES.includes(status.role);
    } catch (_) {
      return false;
    }
  }

  function showPage(id) {
    const pageName = String(id || "").replace(/^page-/, "");
    if (typeof window.showPage === "function") {
      window.showPage(pageName);
      return;
    }
    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.id === "page-" + pageName);
      page.classList.toggle("hidden", page.id !== "page-" + pageName);
    });
  }

  function showSignedOut() {
    window.VH_SECURE_ADMIN_SESSION_READY = false;
    window.VH_ADMIN_LOGIN_IN_PROGRESS = false;
    window.VH_UNAUTHORISED_STAFF_SESSION = false;
    window.VH_IS_ADMIN = false;
    window.VH_ROLE = "guest";
    window.VH_USER_ID = null;
    window.dispatchEvent(new Event("vh-auth-state-changed"));
    el("adminNav")?.classList.add("hidden");
  }

  async function showSignedIn(user, verifiedAdminInFlow = false) {
    window.VH_USER_ID = user.id;
    window.VH_ROLE = "guest";
    window.VH_IS_ADMIN = false;

    const { data: profile, error } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Profile role lookup failed; failing closed:", error.message);
      window.VH_ROLE = "unverified";
      window.VH_IS_ADMIN = false;
      el("adminNav")?.classList.add("hidden");
      window.dispatchEvent(new Event("vh-auth-state-changed"));
      return false;
    }

    window.VH_USER_ID = user.id;
    window.VH_ROLE = profile?.role || "guest";
    window.VH_IS_ADMIN = STAFF_ROLES.includes(window.VH_ROLE);

    if (!window.VH_IS_ADMIN) {
      el("adminNav")?.classList.add("hidden");
      window.dispatchEvent(new Event("vh-auth-state-changed"));
      return false;
    }

    // Strictly verify the server-side HttpOnly VH_ADMIN_SESSION cookie instead of client storage.
    const serverVerified = verifiedAdminInFlow || (await verifyServerAdminCookie(user));
    if (!serverVerified) {
      window.VH_REJECTED_STAFF_ROLE = window.VH_ROLE;
      window.VH_UNAUTHORISED_STAFF_SESSION = true;
      window.VH_IS_ADMIN = false;
      window.VH_SECURE_ADMIN_SESSION_READY = false;
      el("adminNav")?.classList.add("hidden");
      window.dispatchEvent(new Event("vh-auth-state-changed"));
      return false;
    }

    window.dispatchEvent(new Event("vh-auth-state-changed"));
    const roleBadge = el("adminRoleBadge");
    if (roleBadge) roleBadge.textContent = window.VH_ROLE.replaceAll("_", " ");

    window.VH_REJECTED_STAFF_ROLE = null;
    window.VH_UNAUTHORISED_STAFF_SESSION = false;
    window.VH_SECURE_ADMIN_SESSION_READY = true;
    el("adminNav")?.classList.remove("hidden");
    const rootOnly = ["users-admin", "team-admin", "settings", "storage-manager", "categories", "songs", "reports", "dashboard", "login-activity"];
    const allowed = window.VH_ROLE === "admin" ? null :
      window.VH_ROLE === "moderator" ? ["requests-admin"] :
      window.VH_ROLE === "content_editor" ? ["add-movie", "manage", "posts", "episodes"] :
      ["add-movie", "add-shorts", "manage", "posts", "episodes", "requests-admin"];
    document.querySelectorAll("#page-admin .admin-nav-btn").forEach(button => {
      const match = button.getAttribute("onclick")?.match(/adminTab\('([^']+)'/);
      const tab = match?.[1];
      if (tab) button.classList.toggle("hidden", !!allowed && !allowed.includes(tab));
      if (tab && allowed && rootOnly.includes(tab)) button.classList.add("hidden");
    });
    const firstTab = allowed?.[0] || "dashboard";
    if (allowed) {
      document.querySelectorAll("#page-admin .admin-nav-btn").forEach(button => button.classList.remove("active"));
      document.querySelectorAll("#page-admin .admin-tab").forEach(tab => tab.classList.remove("active"));
      const nav = document.querySelector("#page-admin .admin-nav-btn[onclick*=\"'" + firstTab + "'\"]");
      nav?.classList.add("active");
      el("tab-" + firstTab)?.classList.add("active");
    }

    return true;
  }

  /* Double-layer server-enforced Admin Sign-in: Layer 1 (Supabase Auth + Role) + Layer 2 (Server Security PIN + HttpOnly HMAC Session Cookie). */
  window.adminLogin = async function (e) {
    e?.preventDefault();
    window.VH_REJECTED_STAFF_ROLE = null;
    const identifier = el("adminUser")?.value?.trim() || "";
    const password = el("adminPass")?.value || "";
    const securityPin = el("adminSecurityPin")?.value?.trim() || "";
    const btn = el("adminSubmitBtn");
    if (!identifier || !password || !securityPin) {
      return msg("Username/Email, Password aur Security PIN teeno zaroori hain.");
    }
    if (btn) btn.disabled = true;
    window.VH_ADMIN_LOGIN_IN_PROGRESS = true;

    try {
      await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
      const result = await securityRequest("/api/security/admin-guard", {
        action: "authenticate",
        identifier,
        password,
        securityPin
      });

      if (!result?.authenticated || !result?.session?.access_token || !result?.session?.refresh_token) {
        throw new Error("Two-layer verification incomplete.");
      }

      const { data, error } = await db.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token
      });
      if (error || !data?.user) {
        throw new Error(error?.message || "Could not establish verified session.");
      }

      const roleVerified = await showSignedIn(data.user, true);
      if (!roleVerified || !window.VH_IS_ADMIN) {
        await db.auth.signOut({ scope: "local" }).catch(() => null);
        await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
        showSignedOut();
        msg("Admin role verification failed. Access denied.");
        return;
      }

      if (el("adminPass")) el("adminPass").value = "";
      if (el("adminSecurityPin")) el("adminSecurityPin").value = "";
      window.dispatchEvent(new Event("vh-secure-admin-session-ready"));
      showPage("page-admin");
      msg("Two-Layer Secure Control Center login successful.");
    } catch (err) {
      console.error("Secure Admin sign-in failed:", err);
      await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
      await db.auth.signOut({ scope: "local" }).catch(() => null);
      showSignedOut();
      if (err.status === 429) {
        const retry = err.data?.retryAt ? new Date(err.data.retryAt).toLocaleTimeString() : "";
        msg("Admin access temporarily blocked. Try again after " + (retry || "cooldown") + ".");
      } else {
        msg(err.message || "Secure Admin sign-in could not be completed.");
      }
    } finally {
      window.VH_ADMIN_LOGIN_IN_PROGRESS = false;
      if (btn) btn.disabled = false;
    }
  };

  async function signOutAndReset(scope, successMessage, eventType = "user_logout") {
    try {
      await window.VHLoginActivity?.log(eventType);
      await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
      const { error } = await db.auth.signOut({ scope });
      if (error) throw error;
      showSignedOut();
      showPage("page-home");
      msg(successMessage);
    } catch (err) {
      console.error("Sign out failed:", err);
      msg(err.message || "Logout failed. Please try again.");
    }
  }

  window.logoutUser = () => signOutAndReset("local", "Session ended.", "admin_logout");
  window.logoutAllDevices = () => signOutAndReset("global", "Signed out on all devices.", "admin_logout");
  window.adminLogout = () => {
    window.VH_IS_ADMIN = false;
    return signOutAndReset("local", "Admin session ended.", "admin_logout");
  };

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      if (window.VH_ADMIN_LOGIN_IN_PROGRESS) return;
      setTimeout(async () => {
        if (window.VH_ADMIN_LOGIN_IN_PROGRESS) return;
        const allowed = await showSignedIn(session.user, false);
        if (!allowed && !window.VH_ADMIN_LOGIN_IN_PROGRESS) {
          await db.auth.signOut({ scope: "local" }).catch(() => null);
          showSignedOut();
          window.showPage?.("home");
        }
      }, 0);
    } else {
      showSignedOut();
    }
  });

  db.auth.getSession().then(async ({ data }) => {
    if (data.session?.user) {
      if (window.VH_ADMIN_LOGIN_IN_PROGRESS) return;
      const allowed = await showSignedIn(data.session.user, false);
      if (!allowed && !window.VH_ADMIN_LOGIN_IN_PROGRESS) {
        await db.auth.signOut({ scope: "local" }).catch(() => null);
        showSignedOut();
        window.showPage?.("home");
      }
    } else {
      showSignedOut();
    }
  });
})();
