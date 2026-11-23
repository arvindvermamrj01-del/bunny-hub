/* Enforce the administrator-controlled maintenance switch on public pages. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const overlay = () => document.getElementById("maintenanceOverlay");
  async function isAdmin() {
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return false;
      const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
      return ["admin","sub_admin","content_editor","moderator"].includes(profile?.role);
    } catch (_) { return false; }
  }
  async function refreshMaintenance() {
    const panel = overlay();
    if (!panel) return;
    const activePage = document.querySelector(".page.active")?.id || "";
    const adminRoute = activePage === "page-admin-login" || activePage === "page-admin";
    if (adminRoute || await isAdmin()) {
      panel.classList.add("hidden");
      return;
    }
    try {
      const { data, error } = await db.from("vh_site_settings")
        .select("setting_value").eq("setting_key", "maintenance_mode").maybeSingle();
      if (error) throw error;
      panel.classList.toggle("hidden", String(data?.setting_value || "off").toLowerCase() !== "on");
    } catch (error) {
      // Fail open if the public settings lookup is unavailable; do not lock visitors out.
      console.warn("Maintenance setting could not be checked:", error.message);
      panel.classList.add("hidden");
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    refreshMaintenance();
    document.querySelectorAll(".page").forEach(page => {
      new MutationObserver(refreshMaintenance).observe(page, {attributes:true, attributeFilter:["class"]});
    });
    db.auth.onAuthStateChange(() => setTimeout(refreshMaintenance, 0));
  });
})();
