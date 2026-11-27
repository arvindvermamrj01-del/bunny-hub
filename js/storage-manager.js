/* Admin-only storage preference manager. Only active, implemented providers are exposed. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const $ = id => document.getElementById(id);

  async function getProviderStatus() {
    try {
      const response = await fetch("/api/media/status", { cache: "no-store" });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) { return null; }
  }

  const providers = ["backblaze_b2", "youtube_unlisted", "cloudflare_r2", "supabase", "google_drive", "pixeldrain", "telegram", "terabox", "mega", "dropbox"];

  const isAdmin = async () => {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin") throw new Error("Admin permission required.");
    return user;
  };

  async function loadSettings() {
    if (!document.getElementById("page-admin")?.classList.contains("active")) return;
    try {
      await isAdmin();
      const { data, error } = await db.from("vh_storage_settings").select("default_provider").eq("id", 1).maybeSingle();
      if (error) throw error;
      const provider = providers.includes(data?.default_provider) ? data.default_provider : "backblaze_b2";
      const capabilities = await getProviderStatus();
      window.VH_STORAGE_DEFAULT = provider;
      const defaultSelect = $("defaultStorageProvider");
      if (defaultSelect) defaultSelect.value = provider;
      const songSelect = $("songStorageProvider");
      if (songSelect && ["backblaze_b2", "cloudflare_r2"].includes(provider)) songSelect.value = provider;
      ["addStorageProvider", "shortStorageProvider"].forEach(id => {
        const select = $(id);
        if (select && !select.dataset.userChosen) select.value = provider;
        select?.addEventListener("change", () => { select.dataset.userChosen = "1"; });
      });
      const status = $("storageSettingsStatus");
      if (status) {
        const missingServiceRole = !capabilities?.supabase?.serviceRoleConfigured;
        const b2Missing = provider === "backblaze_b2" && capabilities && !capabilities.backblazeB2?.configured;
        const r2Missing = provider === "cloudflare_r2" && capabilities && !capabilities.cloudflareR2?.configured;
        const providerWarning = b2Missing
          ? " B2 secrets missing: add B2_KEY_ID and B2_APPLICATION_KEY in Cloudflare Pages."
          : r2Missing
            ? " R2 secrets missing: add R2 secrets in Cloudflare Pages."
            : "";
        const signingWarning = missingServiceRole
          ? " SUPABASE_SERVICE_ROLE_KEY is missing; private media signing and deletion are unavailable."
          : "";
        status.textContent = "Current default: " + provider.replace("_", " ") + "." + providerWarning + signingWarning;
      }
    } catch (error) {
      const status = $("storageSettingsStatus");
      if (status) status.textContent = error.message || "Storage settings could not be loaded.";
      console.warn("Storage settings unavailable:", error.message);
    }
  }

  window.saveStorageSettings = async function (event) {
    event?.preventDefault();
    const button = event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const user = await isAdmin();
      const provider = $("defaultStorageProvider")?.value || "backblaze_b2";
      if (!providers.includes(provider)) throw new Error("Invalid storage provider.");
      const capabilities = await getProviderStatus();
      if (provider === "backblaze_b2" && capabilities && !capabilities.backblazeB2?.configured) {
        throw new Error("B2 secrets missing: configure B2_KEY_ID and B2_APPLICATION_KEY in Cloudflare Pages first.");
      }
      if (provider === "cloudflare_r2" && capabilities && !capabilities.cloudflareR2?.configured) {
        throw new Error("R2 secrets missing: configure R2 credentials in Cloudflare Pages first.");
      }
      const { error } = await db.from("vh_storage_settings").upsert({
        id: 1, default_provider: provider, updated_by: user.id, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (error) throw error;
      window.VH_STORAGE_DEFAULT = provider;
      const songSelect = $("songStorageProvider");
      if (songSelect && ["backblaze_b2", "cloudflare_r2"].includes(provider)) songSelect.value = provider;
      ["addStorageProvider", "shortStorageProvider"].forEach(id => {
        const select = $(id);
        if (select && !select.dataset.userChosen) select.value = provider;
      });
      const status = $("storageSettingsStatus");
      if (status) status.textContent = "Saved. Default storage is now " + provider.replace("_", " ") + ".";
      if (typeof window.toast === "function") window.toast("Default storage saved.");
    } catch (error) {
      const status = $("storageSettingsStatus");
      if (status) status.textContent = error.message || "Could not save storage settings.";
    } finally {
      if (button) button.disabled = false;
    }
  };

  window.fixB2Cors = async function () {
    const btn = $("fixB2CorsBtn");
    const status = $("b2CorsFixStatus");
    if (btn) btn.disabled = true;
    if (status) status.textContent = "Updating Backblaze B2 CORS rules (allowing s3_put for browser uploads)…";
    try {
      await isAdmin();
      const { data: { session }, error: sessionError } = await db.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Admin session expired. Sign in again.");
      const response = await fetch("/api/media/fix-b2-cors", {
        method: "POST",
        headers: { "Authorization": "Bearer " + session.access_token, "Content-Type": "application/json" }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Failed to update Backblaze B2 CORS rules.");
      if (status) status.textContent = "✅ " + (result.message || "B2 CORS rules updated! Wait ~60 seconds and try uploading.");
      if (typeof window.toast === "function") window.toast("B2 Upload CORS updated!");
    } catch (error) {
      if (status) status.textContent = "❌ " + (error.message || "B2 CORS update failed.");
      if (typeof window.toast === "function") window.toast(error.message || "B2 CORS update failed.");
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const adminPage = document.getElementById("page-admin");
    if (adminPage) new MutationObserver(() => { if (adminPage.classList.contains("active")) loadSettings(); })
      .observe(adminPage, { attributes: true, attributeFilter: ["class"] });
    loadSettings();
  });
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) loadSettings(); });
})();
