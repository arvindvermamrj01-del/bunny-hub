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

const el = id => document.getElementById(id);

function msg(message) {
if (typeof window.toast === "function") {
window.toast(message);
} else {
alert(message);
}
}


async function securityRequest(path, payload, accessToken) {
  const headers = { "content-type": "application/json" };
  if (accessToken) headers.Authorization = "Bearer " + accessToken;
  const response = await fetch(path, {
    method: "POST", headers, credentials: "same-origin",
    body: JSON.stringify(payload || {})
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

function authErrorMessage(error, flow) {
  const code = String(error?.code || "").toLowerCase();
  const raw = String(error?.message || "");
  if (code === "email_not_confirmed") return "Email verify nahi hua hai. Inbox mein BunnyHub ka confirmation email kholkar pehle email confirm karein.";
  if (code === "email_address_not_authorized" || code === "over_email_send_rate_limit") return "Public signup email send nahi ho pa raha. Supabase mein custom SMTP configure karna hoga; default mail service aam users ko email bhejne ke liye restricted hai.";
  if (code === "email_provider_disabled") return "Supabase mein Email provider disabled hai. Auth > Providers mein Email enable karein.";
  if (code === "email_exists") return "Is email se account pehle se bana hua hai. Sign In ya Forgot Password use karein.";
  if (code === "weak_password") return "Password Supabase ki security requirements ko meet nahi karta.";
  if (code === "redirect_to_not_allowed" || /redirect.*not allowed|not allowed.*redirect/i.test(raw)) return "Supabase Auth URL Configuration mein https://bunnyhub.pages.dev/** ko Redirect URLs mein add karein.";
  if (code === "invalid_credentials" && flow === "login") return "Email ya password galat hai, ya account email abhi confirm nahi hua hai.";
  return raw || (flow === "signup" ? "Account create nahi ho paya." : "Sign-in nahi ho paya.");
}

function showPage(id) {
  // Use the site's own page router so .active and .hidden never conflict.
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
  try { sessionStorage.removeItem("vh-admin-secret-session"); } catch (_) {}
  window.VH_ADMIN_SECRET_SESSION_ACTIVE = 0;
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

async function showSignedIn(user) {
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

if (el("profileEmail")) {
  el("profileEmail").textContent = user.email || "";
}

// A valid Auth session should remain usable even if the profile read is temporarily unavailable.
window.VH_USER_ID = user.id;
window.VH_ROLE = "user";
window.VH_IS_ADMIN = false;
window.dispatchEvent(new Event("vh-auth-state-changed"));

const { data: profile, error } = await db
  .from("profiles")
  .select("id, role")
  .eq("id", user.id)
  .maybeSingle();

// Never silently downgrade an authenticated staff account when its role lookup fails.
// The role is security-critical; fail closed and keep account/admin controls hidden.
if (error) {
  console.warn("Profile role lookup failed; account access is withheld until verification succeeds:", error.message);
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
window.VH_IS_ADMIN = ["admin", "sub_admin", "content_editor", "moderator"].includes(window.VH_ROLE);
const secretAdminSession = Number(window.VH_ADMIN_SECRET_SESSION_ACTIVE || 0) > Date.now() ||
  window.VH_ADMIN_LOGIN_IN_PROGRESS === true ||
  (() => { try { return Number(sessionStorage.getItem("vh-admin-secret-session") || 0) > Date.now(); } catch (_) { return false; } })();
if (window.VH_IS_ADMIN && !secretAdminSession) {
  window.VH_REJECTED_STAFF_ROLE = window.VH_ROLE;
  window.VH_UNAUTHORISED_STAFF_SESSION = true;
  el("userNav")?.classList.add("hidden");
  el("adminNav")?.classList.add("hidden");
  window.dispatchEvent(new Event("vh-auth-state-changed"));
  return false;
}
window.dispatchEvent(new Event("vh-auth-state-changed"));
const roleBadge = el("adminRoleBadge");
if (roleBadge) roleBadge.textContent = window.VH_ROLE.replaceAll("_", " ");

if (window.VH_IS_ADMIN) {
  window.VH_REJECTED_STAFF_ROLE = null;
  window.VH_UNAUTHORISED_STAFF_SESSION = false;
  // Staff accounts use the hidden Secure Admin panel; never display a public account avatar or menu.
  el("userNav")?.classList.add("hidden");
  el("adminNav")?.classList.remove("hidden");
  const rootOnly = ["users-admin", "team-admin", "settings", "storage-manager", "categories", "songs", "reports", "dashboard", "login-activity"];
  const allowed = window.VH_ROLE === "admin" ? null :
    window.VH_ROLE === "moderator" ? ["requests-admin"] :
    window.VH_ROLE === "content_editor" ? ["add-movie", "manage"] :
    ["add-movie", "add-shorts", "manage", "requests-admin"];
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
    const roleVerified = await showSignedIn(data.user);
    if (!roleVerified) {
      const staffAccount = window.VH_UNAUTHORISED_STAFF_SESSION || ["admin", "sub_admin", "content_editor", "moderator"].includes(window.VH_REJECTED_STAFF_ROLE);
      if (staffAccount) await window.VHLoginActivity?.log("admin_login_wrong_entry");
      await db.auth.signOut({ scope: "local" });
      showSignedOut();
      msg(staffAccount
        ? "Admin and staff accounts must use the separate Secure Admin Sign-in panel (Ctrl + Shift + A)."
        : "Your account role could not be verified. Please try again later.");
      window.VH_REJECTED_STAFF_ROLE = null;
      return;
    }
    if (window.VH_IS_ADMIN) {
      await window.VHLoginActivity?.log("admin_login_wrong_entry");
      await db.auth.signOut({ scope: "local" });
      showSignedOut();
      msg("Admin and staff accounts must use the separate Secure Admin Sign-in panel (Ctrl + Shift + A).");
      return;
    }
    await window.VHLoginActivity?.record(data.user, "user_login_success");
    showPage("home");
    msg("Welcome back to BunnyHub.");
  } catch (error) {
    if (!authSucceeded) await window.VHLoginActivity?.log("user_login_failed");
    msg(authErrorMessage(error, "login"));
  } finally { if (button) button.disabled = false; }
};

window.registerUser = async function (event) {
  const form=event?.currentTarget;
  event?.preventDefault();
  const name = el("userRegisterName")?.value?.trim();
  const email = el("userRegisterEmail")?.value?.trim().toLowerCase();
  const password = el("userRegisterPassword")?.value || "";
  const confirm = el("userRegisterConfirm")?.value || "";
  const button = event?.currentTarget?.querySelector('[type="submit"]');
  if (!name || !email) return msg("Name and email are required.");
  if (password.length < 8) return msg("Use a password with at least 8 characters.");
  if (password !== confirm) return msg("The two passwords do not match.");
  if (button) button.disabled = true;
  try {
    const { data, error } = await db.auth.signUp({
      email, password, options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname }
    });
    if (error) throw error;
    form?.reset();
    if (data.session?.user) {
      const roleVerified = await showSignedIn(data.user);
      if (!roleVerified || window.VH_IS_ADMIN) {
        await db.auth.signOut({ scope: "local" });
        showSignedOut();
        msg("Staff accounts must be provisioned and signed in through the Secure Admin panel.");
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
  } finally { if (button) button.disabled = false; }
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

window.adminLogin = async function (e) {
  e?.preventDefault();
  window.VH_REJECTED_STAFF_ROLE = null;
  const username = el("adminUser")?.value?.trim() || "";
  const password = el("adminPass")?.value || "";
  const btn = el("adminSubmitBtn");
  if (btn) btn.disabled = true;
  let attemptId = null;
  let signInStarted = false;
  let failureRecorded = false;

  try {
    // Remove any stale Admin cookie before starting a new secret-panel challenge.
    await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
    let gate;
    try {
      gate = await securityRequest("/api/security/admin-guard", { action: "check" });
    } catch (securityError) {
      const retry = securityError.data?.retryAt ? new Date(securityError.data.retryAt).toLocaleTimeString() : "";
      msg(securityError.status === 429
        ? "Admin access temporarily blocked. Try again after " + (retry || "the security cooldown") + "."
        : "Secure Admin verification is unavailable. Sign-in has been stopped for safety.");
      return;
    }
    attemptId = gate.attemptId;

    const validUsername = username.toLowerCase() === "admin" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
    const validPassword = password.length > 0 && password.length <= 256;
    if (!validUsername || !validPassword) {
      await securityRequest("/api/security/admin-guard", { action: "failed", attemptId });
      failureRecorded = true;
      msg("Incorrect sign-in format. This security attempt has been recorded.");
      return;
    }

    const email = username.toLowerCase() === "admin" ? "admin@bunnyhub.internal" : username.toLowerCase();
    window.VH_ADMIN_LOGIN_IN_PROGRESS = true;
    signInStarted = true;
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      await securityRequest("/api/security/admin-guard", { action: "failed", attemptId });
      failureRecorded = true;
      msg("Admin username or password is incorrect. Repeated failures will temporarily block this IP.");
      return;
    }

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const allowed = ["admin", "sub_admin", "content_editor", "moderator"];
    if (profileError || !profile || !allowed.includes(profile.role)) {
      try {
        await securityRequest("/api/security/admin-guard", { action: "denied", attemptId }, data.session?.access_token);
      } catch (_) {
        await securityRequest("/api/security/admin-guard", { action: "failed", attemptId }).catch(() => null);
      }
      await db.auth.signOut({ scope: "local" });
      showSignedOut();
      failureRecorded = true;
      msg("This account is not authorised for the Secure Admin panel.");
      return;
    }

    const adminSessionExpiry = Date.now() + 3600000;
    try { sessionStorage.setItem("vh-admin-secret-session", String(adminSessionExpiry)); } catch (_) {}
    window.VH_ADMIN_SECRET_SESSION_ACTIVE = adminSessionExpiry;
    // Keep the explicit admin flow marker active until role/UI verification finishes.
    // Auth-state callbacks must not race this authoritative check.
    const roleVerified = await showSignedIn(data.user);
    if (!roleVerified || !window.VH_IS_ADMIN) {
      await db.auth.signOut({ scope: "local" });
      showSignedOut();
      await securityRequest("/api/security/admin-guard", { action: "failed", attemptId }).catch(() => null);
      failureRecorded = true;
      msg("Admin role verification failed. Access was denied.");
      return;
    }

    await securityRequest("/api/security/admin-guard", { action: "success", attemptId }, data.session?.access_token);
    window.VH_SECURE_ADMIN_SESSION_READY = true;
    window.dispatchEvent(new Event("vh-secure-admin-session-ready"));
    showPage("page-admin");
    msg("Secure Control Center login successful.");
  } catch (err) {
    console.error("Secure Admin sign-in failed:", err);
    await securityRequest("/api/security/admin-guard", { action: "logout" }).catch(() => null);
    if (attemptId && signInStarted && !failureRecorded) {
      await securityRequest("/api/security/admin-guard", { action: "failed", attemptId }).catch(() => null);
    }
    await db.auth.signOut({ scope: "local" }).catch(() => null);
    showSignedOut();
    msg(err.message || "Secure Admin sign-in could not be completed.");
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

// Normal logout signs out this browser only. Use the separate button
// when the user explicitly wants to end every active session.
window.logoutUser = function () {
  return signOutAndReset("local", "You have been logged out.");
};

window.logoutAllDevices = function () {
  return signOutAndReset("global", "You have been logged out on all devices.");
};

window.adminLogout = function () {
  window.VH_IS_ADMIN = false;
  return signOutAndReset("local", "Admin session ended.", "admin_logout");
};

window.completePasswordReset = async function (event) {
  const form=event?.currentTarget;
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
  const allowed = await showSignedIn(session.user);
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
  const allowed = await showSignedIn(data.session.user);
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
