/* Main-admin-only security activity. The server API enforces the role boundary. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rows = () => document.getElementById("vhLoginActivityRows");
  let latestEvents = [];
  let totalCount = 0;
  let isLoading = false;

  async function token() {
    if (!db) return null;
    const result = await db.auth.getSession();
    return result.data?.session?.access_token || null;
  }

  async function send(type, options = {}) {
    const headers = { "content-type": "application/json" };
    const accessToken = options.accessToken || await token();
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch("/api/security/events", {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        type,
        pagePath: location.pathname,
        sessionId: options.sessionId || undefined
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Security activity could not be recorded.");
    return result;
  }

  async function record(user, type = "user_login_success") {
    if (!db || !user?.id) return false;
    try {
      await send(type);
      return true;
    } catch (error) {
      console.warn("BunnyHub security event was not recorded:", error.message);
      return false;
    }
  }

  async function log(type) {
    try {
      await send(type);
      return true;
    } catch (error) {
      console.debug("BunnyHub activity event was not recorded:", error.message);
      return false;
    }
  }

  async function trackVisit() {
    let alreadyTracked = false;
    try { alreadyTracked = sessionStorage.getItem("vh-security-visit-recorded") === "1"; } catch (_) {}
    if (alreadyTracked) return;
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("vh-security-session-id") || "";
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("vh-security-session-id", sessionId);
      }
    } catch (_) { sessionId = crypto.randomUUID(); }

    try {
      const session = await db?.auth.getSession();
      const accessToken = session?.data?.session?.access_token || null;
      await send(accessToken ? "authenticated_visit" : "guest_visit", { accessToken, sessionId });
      try { sessionStorage.setItem("vh-security-visit-recorded", "1"); } catch (_) {}
    } catch (error) {
      console.debug("Visit activity not recorded:", error.message);
    }
  }

  function eventLabel(type) {
    const labels = {
      guest_visit: "Guest visit",
      authenticated_visit: "Signed-in visit",
      user_login_success: "User login successful",
      user_login_failed: "User login failed",
      user_signup: "User signup",
      user_signup_requested: "Signup requested",
      user_logout: "User logout",
      password_reset_requested: "Password reset requested",
      admin_login_success: "Admin login successful",
      admin_login_failed: "Admin login failed",
      admin_login_blocked: "Admin IP temporarily blocked",
      admin_login_denied: "Unauthorised Admin attempt",
      admin_login_wrong_entry: "Admin used user login form",
      admin_logout: "Admin logout",
      unauthorized_admin_page_access: "Unauthorised Control Center page access",
      unauthorized_admin_access: "Unauthorised protected API access"
    };
    return labels[type] || String(type || "Activity").replaceAll("_", " ");
  }

  function render() {
    const body = rows();
    if (!body) return;
    const filter = document.getElementById("vhActivityFilter")?.value || "all";
    const query = (document.getElementById("vhActivitySearch")?.value || "").trim().toLowerCase();
    const events = latestEvents.filter(event => {
      const type = String(event.event_type || "");
      const isGuest = type === "guest_visit" || type === "authenticated_visit";
      const isLogin = type.includes("login") || type.includes("signup") || type.includes("logout");
      const isSecurity = type.includes("blocked") || type.includes("denied") || type.includes("unauthorized") || type.includes("failed");
      if (filter === "visits" && !isGuest) return false;
      if (filter === "logins" && !isLogin) return false;
      if (filter === "security" && !isSecurity) return false;
      const haystack = [event.account_email,event.user_id,event.ip_address,event.user_agent,event.page_path,type].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });

    body.innerHTML = events.length ? events.map(event => {
      const seconds = Number(event.created_at || 0);
      const time = seconds ? new Date(seconds * 1000).toLocaleString() : "Unknown";
      const account = event.account_email || (event.user_id ? String(event.user_id).slice(0, 12) : (event.event_type === "guest_visit" ? "Guest / Visitor" : "Unauthenticated"));
      const role = event.user_role || (event.event_type === "guest_visit" ? "Guest" : "—");
      const agent = String(event.user_agent || "—");
      const browser = agent.length > 90 ? agent.slice(0, 87) + "…" : agent;
      const path = event.page_path || "/";
      return "<tr>" +
        "<td>" + esc(time) + "</td>" +
        "<td><strong>" + esc(eventLabel(event.event_type)) + "</strong></td>" +
        "<td>" + esc(account) + "</td>" +
        "<td>" + esc(role.replaceAll("_", " ")) + "</td>" +
        "<td><code>" + esc(event.ip_address || "—") + "</code></td>" +
        "<td title=\"" + esc(agent) + "\">" + esc(browser) + "</td>" +
        "<td><code>" + esc(path) + "</code></td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="7">No matching security activity found.</td></tr>';

    const total = document.getElementById("vhActivityTotal");
    if (total) total.textContent = "Showing " + latestEvents.length + " of " + totalCount + " events"; 
    const more = document.getElementById("vhLoginActivityMore");
    if (more) more.hidden = latestEvents.length >= totalCount;
    const refreshed = document.getElementById("vhActivityRefreshed");
    if (refreshed) refreshed.textContent = "Updated " + new Date().toLocaleTimeString();
  }

  async function load(append = false) {
    const body = rows();
    if (!body || !db || isLoading) return;
    isLoading = true;
    if (!append) {
      latestEvents = [];
      totalCount = 0;
      body.innerHTML = '<tr><td colspan="7">Loading secure activity…</td></tr>';
    }
    try {
      const { data: { user }, error } = await db.auth.getUser();
      if (error || !user) throw new Error("Main administrator access required.");
      const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profileError || profile?.role !== "admin") throw new Error("Only the Main Admin can view IP and login activity.");
      const accessToken = await token();
      const offset = append ? latestEvents.length : 0;
      const response = await fetch("/api/security/events?limit=250&offset=" + offset, {
        headers: { Authorization: "Bearer " + accessToken },
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Security activity could not be loaded.");
      latestEvents = append ? latestEvents.concat(result.events || []) : (result.events || []);
      totalCount = Number(result.total || 0);
      render();
    } catch (error) {
      body.innerHTML = '<tr><td colspan="7">' + esc(error.message || "Activity could not be loaded.") + "</td></tr>";
    } finally {
      isLoading = false;
    }
  }

  window.VHLoginActivity = { load, record, log, trackVisit };
  document.addEventListener("click", event => {
    if (event.target.closest("#vhLoginActivityNav") || event.target.closest("#vhLoginActivityRefresh")) load(false);
    if (event.target.closest("#vhLoginActivityMore")) load(true);
  });
  document.addEventListener("input", event => {
    if (event.target.matches("#vhActivitySearch")) render();
  });
  document.addEventListener("change", event => {
    if (event.target.matches("#vhActivityFilter")) render();
  });
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("vhLoginActivityNav");
    const panel = document.getElementById("tab-login-activity");
    const updateVisibility = () => {
      const visible = window.VH_ROLE === "admin";
      if (nav) nav.classList.toggle("hidden", !visible);
      if (panel) panel.classList.toggle("hidden", !visible);
    };
    updateVisibility();
    window.addEventListener("vh-auth-state-changed", updateVisibility);
    trackVisit();
  });
})();