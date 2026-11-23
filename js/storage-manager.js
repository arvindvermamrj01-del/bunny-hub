/* Admin-only storage preference manager. Provider credentials belong in server-side secrets, never in this file. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const $ = id => document.getElementById(id);
  async function getProviderStatus() {
    try {
      const response=await fetch("/api/media/status",{cache:"no-store"});
      if(!response.ok)return null;
      return await response.json();
    } catch(_) { return null; }
  }
  const providers = ["backblaze_b2", "cloudflare_r2", "supabase", "terabox", "mega", "degoo", "google_drive", "mediafire", "pcloud", "box", "icedrive", "koofr", "internxt", "telegram"];
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
      const user = await isAdmin();
      const { data, error } = await db.from("vh_storage_settings").select("default_provider").eq("id", 1).maybeSingle();
      if (error) throw error;
      let provider = providers.includes(data?.default_provider) ? data.default_provider : "backblaze_b2";
      const capabilities = await getProviderStatus();
      if (provider === "backblaze_b2" && capabilities && !capabilities.backblazeB2?.configured) {
        const status = $("storageSettingsStatus");
        if (status) status.textContent = "Backblaze B2 credentials are missing in Cloudflare Pages. Add B2_KEY_ID and B2_APPLICATION_KEY before uploading.";
      } else if (provider === "cloudflare_r2" && capabilities && !capabilities.cloudflareR2?.configured) {
        const status = $("storageSettingsStatus");
        if (status) status.textContent = "Cloudflare R2 credentials are missing in Pages secrets.";
      }
      window.VH_STORAGE_DEFAULT = provider;
      const defaultSelect = $("defaultStorageProvider");
      if (defaultSelect) defaultSelect.value = provider;
      const songSelect=$("songStorageProvider");
      if(songSelect&&["backblaze_b2","cloudflare_r2"].includes(provider))songSelect.value=provider;
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
            ? " R2 secrets missing: add the R2 account, bucket and access key secrets in Cloudflare Pages."
            : "";
        const signingWarning = missingServiceRole
          ? " SUPABASE_SERVICE_ROLE_KEY is missing; private media signing, playback, deletion and secure downloads are unavailable."
          : "";
        status.textContent = "Current default: " + provider.replace("_", " ") + "." + providerWarning + signingWarning;
      }
    } catch (error) {
      const status = $("storageSettingsStatus");
      if (status) status.textContent = /vh_storage_settings_default_provider_check|check constraint/i.test(error.message || "") ? "Database migration required: run supabase/bunnyhub-backblaze-b2-provider-upgrade.sql in Supabase SQL Editor, then save again." : (error.message || "Storage settings could not be loaded.");
      console.warn("Storage settings unavailable:", error.message);
    }
  }
  window.saveStorageSettings = async function(event) {
    event?.preventDefault();
    const button = event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const user = await isAdmin();
      const provider = $("defaultStorageProvider")?.value || "backblaze_b2";
      if (!providers.includes(provider)) throw new Error("Invalid storage provider.");
      const capabilities = await getProviderStatus();
      if (provider === "backblaze_b2" && capabilities && !capabilities.backblazeB2?.configured) throw new Error("B2 secrets missing: configure B2_KEY_ID and B2_APPLICATION_KEY in Cloudflare Pages before selecting Backblaze B2.");
      if (provider === "cloudflare_r2" && capabilities && !capabilities.cloudflareR2?.configured) throw new Error("R2 secrets missing: configure R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in Cloudflare Pages.");
      const { error } = await db.from("vh_storage_settings").upsert({
        id: 1, default_provider: provider, updated_by: user.id, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (error) throw error;
      window.VH_STORAGE_DEFAULT = provider;
      const songSelect=$("songStorageProvider");
      if(songSelect&&["backblaze_b2","cloudflare_r2"].includes(provider))songSelect.value=provider;
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
  document.addEventListener("DOMContentLoaded", () => {
    const adminPage = document.getElementById("page-admin");
    if (adminPage) new MutationObserver(() => { if (adminPage.classList.contains("active")) loadSettings(); })
      .observe(adminPage, {attributes:true, attributeFilter:["class"]});
    loadSettings();
  });
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) loadSettings(); });
})();