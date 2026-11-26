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

  function authErrorMessage(error, flow) {
    const code = String(error?.code || "").toLowerCase();
    const raw = String(error?.message || "");
    if (code === "email_not_confirmed") return "Email verify nahi hua hai. Inbox mein BunnyHub ka confirmation email kholkar pehle email confirm karein.";
    if (code === "email_address_not_authorized" || code === "over_email_send_rate_limit") return "Public signup email send nahi ho pa raha. Supabase mein custom SMTP configure karna hoga.";
    if (code === "email_provider_disabled") return "Supabase mein Email provider disabled hai. Auth > Providers mein Email enable karein.";
    if (code === "email_exists") return "Is email se account pehle se bana hua hai. Sign In ya Forgot Password use karein.";
    if (code === "weak_password") return "Password Supabase ki security requirements ko meet nahi karta.";
    if (code === "redirect_to_not_allowed" || /redirect.*not allowed|not allowed.*redirect/i.test(raw)) return "Supabase Auth URL Configuration mein https://bunny-hub.pages.dev/** ko Redirect URLs mein add karein.";
    if (code === "invalid_credentials" && flow === "login") return "Email ya password galat hai, ya account email abhi confirm nahi hua hai.";
    return raw || (flow === "signup" ? "Account create nahi ho paya." : "Sign-in nahi ho paya.");
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
    el("authNav")?.classList.remove("hidden");
    el("userNav")?.classList.add("hidden");
    el("adminNav")?.classList.add("hidden");
  }

  async function showSignedIn(user, verifiedAdminInFlow = false) {
    el("authNav")?.classList.add("hidden");
    el("userNav")?.classList.add("hidden");

    let name =
      user.user_metadata?.full_name ||
      user.user_metadata?.fullname ||
      user.email ||
      "User";

    const initial = name.trim().charAt(0).toUpperCase();
    ["userAvatar", "profileAvatar"].forEach(id => {
      if (el(id)) el(id).textContent = initial;
    });
    if (el("profileName")) el("profileName").textContent = name;
    if (el("profileEmail")) el("profileEmail").textContent = user.email || "";

    window.VH_USER_ID = user.id;
    window.VH_ROLE = "user";
    window.VH_IS_ADMIN = false;
    window.dispatchEvent(new Event("vh-auth-state-changed"));

    const { data: profile, error } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Profile role lookup failed; failing closed:", error.message);
      window.VH_ROLE = "unverified";
      window.VH_IS_ADMIN = false;
      el("userNav")?.classList.add("hidden");
      el("adminNav")?.classList.add("hidden");
      window.dispatchEvent(new Event("vh-auth-state-changed"));
      return false;
    }

    if (profile?.fullname) {
      name = profile.fullname;
      if (el("profileName")) el("profileName").textContent = name;
      if (el("userProfileName")) el("userProfileName").value = name;
    } else if (el("userProfileName")) {
      el("userProfileName").value = user.user_metadata?.full_name || "";
    }
    if (el("statJoined")) {
      el("statJoined").textContent = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—";
    }

    window.VH_USER_ID = user.id;
    window.VH_ROLE = profile?.role || "user";
    window.VH_IS_ADMIN = STAFF_ROLES.includes(window.VH_ROLE);

    if (window.VH_IS_ADMIN) {
      // Strictly verify the server-side HttpOnly VH_ADMIN_SESSION cookie instead of client storage.
      const serverVerified = verifiedAdminInFlow || (await verifyServerAdminCookie(user));
      if (!serverVerified) {
        window.VH_REJECTED_STAFF_ROLE = window.VH_ROLE;
        window.VH_UNAUTHORISED_STAFF_SESSION = true;
        window.VH_IS_ADMIN = false;
        window.VH_SECURE_ADMIN_SESSION_READY = false;
        el("userNav")?.classList.add("hidden");
        el("adminNav")?.classList.add("hidden");
        window.dispatchEvent(new Event("vh-auth-state-changed"));
        return false;
      }
    }

    window.dispatchEvent(new Event("vh-auth-state-changed"));
    const roleBadge = el("adminRoleBadge");
    if (roleBadge) roleBadge.textContent = window.VH_ROLE.replaceAll("_", " ");

    if (window.VH_IS_ADMIN) {
      window.VH_REJECTED_STAFF_ROLE = null;
      window.VH_UNAUTHORISED_STAFF_SESSION = false;
      window.VH_SECURE_ADMIN_SESSION_READY = true;
      el("userNav")?.classList.add("hidden");
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
    } else {
      el("adminNav")?.classList.add("hidden");
      el("userNav")?.classList.remove("hidden");
    }

    return true;
  }

  window.loginUser = async function (event) {
    const form = event?.currentTarget;
    event?.preventDefault();
    window.VH_REJECTED_STAFF_ROLE = null;
    const email = el("userLoginEmail")?.value?.trim().toLowerCase();
    const password = el("userLoginPassword")?.value || "";
    const button = form?.querySelector('[type="submit"]');
    if (!email || !password) return msg("Email and password are required.");
    if (button) button.disabled = true;
    let authSucceeded = false;
    try {
      await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      authSucceeded = true;
      const roleVerified = await showSignedIn(data.user, false);
      if (!roleVerified || window.VH_IS_ADMIN) {
        const staffAccount = window.VH_UNAUTHORISED_STAFF_SESSION || STAFF_ROLES.includes(window.VH_REJECTED_STAFF_ROLE);
        if (staffAccount) await window.VHLoginActivity?.log("admin_login_wrong_entry");
        await db.auth.signOut({ scope: "local" });
        showSignedOut();
        msg(staffAccount
          ? "Admin aur staff accounts ko Secure Admin Sign-in panel (Ctrl + Shift + A) + Security PIN se login karna hoga."
          : "Aapka account role verify nahi ho paaya. Dobara try karein.");
        window.VH_REJECTED_STAFF_ROLE = null;
        return;
      }
      await window.VHLoginActivity?.record(data.user, "user_login_success");
      showPage("home");
      msg("Welcome back to BunnyHub.");
    } catch (error) {
      if (!authSucceeded) await window.VHLoginActivity?.log("user_login_failed");
      msg(authErrorMessage(error, "login"));
    } finally {
      if (button) button.disabled = false;
    }
  };

  window.registerUser = async function (event) {
    const form = event?.currentTarget;
    event?.preventDefault();
    const name = el("userRegisterName")?.value?.trim();
    const email = el("userRegisterEmail")?.value?.trim().toLowerCase();
    const password = el("userRegisterPassword")?.value || "";
    const confirm = el("userRegisterConfirm")?.value || "";
    const button = form?.querySelector('[type="submit"]');
    if (!name || !email) return msg("Name and email are required.");
    if (password.length < 8) return msg("Use a password with at least 8 characters.");
    if (password !== confirm) return msg("The two passwords do not match.");
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
      form?.reset();
      if (data.session?.user) {
        const roleVerified = await showSignedIn(data.user, false);
        if (!roleVerified || window.VH_IS_ADMIN) {
          await db.auth.signOut({ scope: "local" });
          showSignedOut();
          msg("Staff accounts must sign in through the Secure Admin panel.");
          return;
        }
        await window.VHLoginActivity?.record(data.user, "user_signup");
        showPage("home");
        msg("Your BunnyHub account is ready.");
      } else {
        await window.VHLoginActivity?.log("user_signup_requested");
        msg("Account created. Check your email to confirm the address, then sign in.");
        showPage("login");
      }
    } catch (error) {
      msg(authErrorMessage(error, "signup"));
    } finally {
      if (button) button.disabled = false;
    }
  };

  window.resetUserPassword = async function () {
    const email = el("userLoginEmail")?.value?.trim().toLowerCase();
    if (!email) return msg("Enter your email address first.");
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#reset-password" });
      if (error) throw error;
      msg("Password reset email sent. Check your inbox.");
    } catch (error) { msg(authErrorMessage(error, "reset")); }
  };

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

  window.logoutUser = () => signOutAndReset("local", "You have been logged out.");
  window.logoutAllDevices = () => signOutAndReset("global", "You have been logged out on all devices.");
  window.adminLogout = () => {
    window.VH_IS_ADMIN = false;
    return signOutAndReset("local", "Admin session ended.", "admin_logout");
  };

  window.completePasswordReset = async function (event) {
    const form = event?.currentTarget;
    event?.preventDefault();
    const password = el("resetNewPassword")?.value || "";
    const confirm = el("resetConfirmPassword")?.value || "";
    const button = form?.querySelector('[type="submit"]');
    if (password.length < 8) return msg("Use a password with at least 8 characters.");
    if (password !== confirm) return msg("The two passwords do not match.");
    if (button) button.disabled = true;
    try {
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      form?.reset();
      showPage("home");
      msg("Your password has been reset successfully.");
    } catch (error) {
      msg(error.message || "Password reset could not be completed. Open the latest reset email.");
    } finally { if (button) button.disabled = false; }
  };

  document.addEventListener("DOMContentLoaded", () => {
    el("userLoginForm")?.addEventListener("submit", window.loginUser);
    el("userRegisterForm")?.addEventListener("submit", window.registerUser);
    el("userResetPasswordForm")?.addEventListener("submit", window.completePasswordReset);
    el("forgotPasswordLink")?.addEventListener("click", event => { event.preventDefault(); window.resetUserPassword(); });
  });

  db.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      if (window.VH_ADMIN_LOGIN_IN_PROGRESS) {
        if (event === "PASSWORD_RECOVERY") setTimeout(() => showPage("reset-password"), 0);
        return;
      }
      setTimeout(async () => {
        if (window.VH_ADMIN_LOGIN_IN_PROGRESS) return;
        const allowed = await showSignedIn(session.user, false);
        if (!allowed && !window.VH_ADMIN_LOGIN_IN_PROGRESS) {
          await db.auth.signOut({ scope: "local" }).catch(() => null);
          showSignedOut();
          window.showPage?.("home");
        }
      }, 0);
      if (event === "PASSWORD_RECOVERY") setTimeout(() => showPage("reset-password"), 0);
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
