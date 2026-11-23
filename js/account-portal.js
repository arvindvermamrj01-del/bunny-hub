(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);

  async function requireSession() {
    if (!db) throw new Error("Account service is not configured.");
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) throw new Error("Please sign in to manage your account.");
    return data.session.user;
  }

  async function saveProfile(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    const name = $("userProfileName")?.value.trim();
    if (!name) return toast("Display name is required.");
    if (button) button.disabled = true;
    try {
      const user = await requireSession();
      const { error: authError } = await db.auth.updateUser({ data: { full_name: name } });
      if (authError) throw authError;
      let profileUpdate = await db.from("profiles").update({ fullname: name }).eq("id", user.id);
      if (profileUpdate.error && /fullname|PGRST204|42703/i.test(profileUpdate.error.message || "")) {
        profileUpdate = await db.from("profiles").update({ full_name: name }).eq("id", user.id);
      }
      if (profileUpdate.error) throw profileUpdate.error;
      if ($("profileName")) $("profileName").textContent = name;
      if ($("userAvatar")) $("userAvatar").textContent = name.charAt(0).toUpperCase();
      if ($("profileAvatar")) $("profileAvatar").textContent = name.charAt(0).toUpperCase();
      toast("Profile updated successfully.");
    } catch (error) {
      toast(error.message || "Profile could not be updated.");
    } finally { if (button) button.disabled = false; }
  }

  async function changePassword(event) {
    const form=event.currentTarget;
    event.preventDefault();
    const current = $("userCurrentPassword")?.value || "";
    const next = $("userNewPassword")?.value || "";
    const confirm = $("userConfirmPassword")?.value || "";
    if (next.length < 12) return toast("New password must contain at least 12 characters.");
    if (next !== confirm) return toast("New password and confirmation do not match.");
    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const user = await requireSession();
      if (!user.email) throw new Error("Account email is unavailable. Use password reset.");
      const { error: verifyError } = await db.auth.signInWithPassword({ email: user.email, password: current });
      if (verifyError) throw new Error("Current password is incorrect.");
      const { error } = await db.auth.updateUser({ password: next });
      if (error) throw error;
      form.reset();
      toast("Password changed successfully.");
    } catch (error) {
      toast(error.message || "Password could not be changed.");
    } finally { if (button) button.disabled = false; }
  }

  function renderProfileWatchlist() {
    const target = $("profileWatchlistGrid");
    const source = $("watchlistGrid");
    if (target && source) target.innerHTML = source.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("userProfileForm")?.addEventListener("submit", saveProfile);
    $("userPasswordForm")?.addEventListener("submit", changePassword);
    const watchlist = $("watchlistGrid");
    if (watchlist) new MutationObserver(renderProfileWatchlist).observe(watchlist, { childList: true, subtree: true });
    db?.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      if ($("userProfileName") && !$("userProfileName").value) {
        $("userProfileName").value = session.user.user_metadata?.full_name || "";
      }
    });
  });
})();