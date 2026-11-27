/* Apply public-facing site settings stored by the administrator. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const defaults = {
    site_name: "BunnyHub",
    telegram_url: "https://t.me/BunnyHub_official",
    seo_description: "",
    dmca_email: "bunnyhub.proton@gmail.com",
    imagekit_url: ""
  };
  window.vhOptimizeImage = url => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const ik = String(window.VH_IMAGEKIT_URL || "").trim().replace(/\/+$/, "");
    if (!ik || raw.startsWith(ik) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:") return raw;
      return ik + "/tr:f-auto,q-80/" + encodeURI(raw);
    } catch (_) {
      return raw;
    }
  };
  function apply(settings) {
    const siteName = String(settings.site_name || defaults.site_name).trim().slice(0, 80) || defaults.site_name;
    document.querySelectorAll(".brand-name").forEach(node => { node.textContent = siteName; });
    document.title = siteName + " | Movies & Web Series";
    if (settings.seo_description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
      meta.content = String(settings.seo_description).trim().slice(0, 300);
    }
    const dmca = String(settings.dmca_email || defaults.dmca_email).trim() || defaults.dmca_email;
    document.querySelectorAll("[data-vh-dmca-email]").forEach(node => {
      node.href = "mailto:" + dmca;
      node.textContent = node.closest(".footer-links") ? "DMCA: " + dmca : dmca;
    });
    window.VH_IMAGEKIT_URL = String(settings.imagekit_url || "").trim().replace(/\/+$/, "");
    try {
      const link = new URL(settings.telegram_url || defaults.telegram_url);
      if (link.protocol === "https:") {
        document.querySelectorAll("a.telegram-target-link").forEach(anchor => {
          anchor.href = link.href;
          anchor.rel = "noopener noreferrer";
        });
      }
    } catch (_) { /* Keep the safe default Telegram destination. */ }
  }
  window.applyPublicSiteSettings = apply;
  window.addEventListener("vh:site-settings-updated", event => apply(event.detail || {}));
  document.addEventListener("DOMContentLoaded", async () => {
    apply(defaults);
    if (!db) return;
    try {
      const { data, error } = await db.from("vh_site_settings").select("setting_key,setting_value");
      if (error) throw error;
      const settings = { ...defaults };
      (data || []).forEach(row => { settings[row.setting_key] = row.setting_value; });
      apply(settings);
    } catch (error) {
      console.warn("Public site settings could not be loaded:", error.message);
    }
  });
})();
