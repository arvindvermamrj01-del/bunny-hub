/* BunnyHub responsive navigation: auto-collapsing desktop rail + manual mobile dock (no forced auto-scroll). */
(() => {
  "use strict";
  const mobileQuery = () => window.matchMedia("(max-width:760px)").matches;
  let sidebarCollapseTimer = null;

  const items = [
    { page: "home", label: "Home", icon: "fa-house" },
    { page: "movies", label: "Movies", icon: "fa-clapperboard" },
    { page: "series", label: "Web Series", icon: "fa-tv" },
    { page: "shows", label: "Shows", icon: "fa-star" },
    { page: "songs", label: "Songs", icon: "fa-music" },
    { page: "shorts", label: "Shorts", icon: "fa-bolt" },
    { page: "watchlist", label: "Watchlist", icon: "fa-bookmark" },
    { page: "request", label: "Request", icon: "fa-paper-plane" },
    { action: "donate", label: "Support", icon: "fa-heart" },
    { page: "feedback", label: "Feedback", icon: "fa-comment-dots" },
    { page: "community", label: "Community", icon: "fa-users" },
    { action: "settings", label: "Theme", icon: "fa-gear" }
  ];

  const makeButton = item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vh-mobile-nav-item";
    button.setAttribute("aria-label", item.label);
    button.title = item.label;
    if (item.page) button.dataset.vhPage = item.page;
    if (item.action) button.dataset.vhAction = item.action;
    const icon = document.createElement("i");
    icon.className = "fas " + item.icon;
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = item.label;
    button.append(icon, label);
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      execute(button);
    });
    return button;
  };

  function sync(name) {
    const page = String(name || "home").replace(/^page-/, "");
    document.querySelectorAll("#vhAppSidebar [data-vh-nav]").forEach(button => {
      const active = button.dataset.vhNav === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll(".vh-mobile-dock [data-vh-page]").forEach(button => {
      const active = button.dataset.vhPage === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function routePage(page) {
    const requested = String(page || "").replace(/^page-/, "");
    if (!requested) return false;
    try {
      if (typeof window.showPage === "function") window.showPage(requested);
    } catch (error) {
      console.error("BunnyHub page router failed:", error);
    }
    let resolved = requested;
    if (["login", "register", "reset-password", "profile"].includes(requested)) resolved = "home";
    if (requested === "admin" && !window.VH_IS_ADMIN) resolved = "admin-login";
    const target = document.getElementById("page-" + resolved);
    if (!target) return false;
    document.querySelectorAll(".page").forEach(section => {
      const active = section === target;
      section.classList.toggle("active", active);
      section.style.setProperty("display", active ? "block" : "none", "important");
    });
    const privatePages = ["admin-login", "admin"];
    document.body.classList.toggle("vh-sidebar-hidden", privatePages.includes(resolved));
    document.getElementById("navLinks")?.classList.remove("open");
    if (document.getElementById("movieModal")?.classList.contains("open")) window.closeModalBtn?.();
    sync(resolved);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
    return true;
  }

  function execute(button) {
    const page = button.dataset.vhPage || button.dataset.vhNav;
    const action = button.dataset.vhAction;
    const donationModal = document.getElementById("donationModal");
    if (donationModal?.classList.contains("open")) {
      window.closeDonationPanel?.();
      if (action === "donate") return;
    }
    if (mobileQuery()) {
      try { button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch (_) {}
    } else if (button.classList.contains("vh-sidebar-button")) {
      revealSidebar();
    }
    if (action === "donate") { window.openDonationPanel?.(); return; }
    if (action === "settings") { window.toggleThemePanel?.(); return; }
    if (page) routePage(page);
  }

  function createDock() {
    if (document.querySelector(".vh-mobile-dock")) return;
    const dock = document.createElement("nav");
    dock.className = "vh-mobile-dock";
    dock.setAttribute("aria-label", "All BunnyHub sections");
    items.forEach(item => dock.appendChild(makeButton(item)));
    document.body.appendChild(dock);
  }

  function clearSidebarCollapse() {
    if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
  }

  function setSidebarExpanded(expanded) {
    if (mobileQuery()) {
      document.body.classList.remove("vh-sidebar-expanded");
      clearSidebarCollapse();
      return;
    }
    document.body.classList.toggle("vh-sidebar-expanded", !!expanded);
    const sidebar = document.getElementById("vhAppSidebar");
    sidebar?.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function scheduleSidebarCollapse(delay = 3000) {
    clearSidebarCollapse();
    if (mobileQuery() || document.hidden) return;
    sidebarCollapseTimer = setTimeout(() => {
      const sidebar = document.getElementById("vhAppSidebar");
      const focused = document.activeElement;
      if (sidebar?.contains(focused) && focused?.matches?.(":focus-visible")) {
        scheduleSidebarCollapse(3000);
        return;
      }
      setSidebarExpanded(false);
    }, Math.max(0, delay));
  }

  function revealSidebar() {
    if (mobileQuery()) return;
    setSidebarExpanded(true);
    scheduleSidebarCollapse(3000);
  }

  function bindDesktopSidebar() {
    const sidebar = document.getElementById("vhAppSidebar");
    if (!sidebar || sidebar.dataset.bound === "1") return;
    sidebar.dataset.bound = "1";
    sidebar.setAttribute("aria-expanded", "false");
    sidebar.addEventListener("pointerenter", revealSidebar, { passive: true });
    sidebar.addEventListener("pointermove", () => {
      if (!document.body.classList.contains("vh-sidebar-expanded")) setSidebarExpanded(true);
      scheduleSidebarCollapse(3000);
    }, { passive: true });
    sidebar.addEventListener("pointerdown", revealSidebar, { passive: true });
    sidebar.addEventListener("pointerleave", () => scheduleSidebarCollapse(3000), { passive: true });
    sidebar.addEventListener("focusin", () => { clearSidebarCollapse(); setSidebarExpanded(true); });
    sidebar.addEventListener("focusout", () => {
      requestAnimationFrame(() => { if (!sidebar.contains(document.activeElement)) scheduleSidebarCollapse(3000); });
    });
    sidebar.querySelectorAll("button[data-vh-nav],button[data-vh-action]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        execute(button);
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearSidebarCollapse();
      else if (!mobileQuery()) scheduleSidebarCollapse(3000);
    });
    window.addEventListener("resize", () => {
      if (mobileQuery()) { clearSidebarCollapse(); setSidebarExpanded(false); }
      else scheduleSidebarCollapse(3000);
    }, { passive: true });
    if (!mobileQuery()) {
      setSidebarExpanded(true);
      scheduleSidebarCollapse(3000);
    }
  }

  function initRubikCube() {
    const cube = document.getElementById("vhRubikCube");
    if (!cube) return;
    const palettes = [
      ["#00f0ff", "#ff2a85", "#ffbe0b", "#38ef7d", "#f8fafc", "#7c3aed"],
      ["#e5a93c", "#dc2626", "#f59e0b", "#334155", "#f1f5f9", "#991b1b"],
      ["#a855f7", "#14b8a6", "#ec4899", "#22d3ee", "#f8fafc", "#6366f1"],
      ["#f59e0b", "#ea580c", "#fbbf24", "#10b981", "#fef3c7", "#0284c7"],
      ["#60a5fa", "#38bdf8", "#818cf8", "#2dd4bf", "#f0f9ff", "#1d4ed8"]
    ];
    let pIndex = 0;
    const applyPalette = () => {
      const p = palettes[pIndex % palettes.length];
      p.forEach((c, i) => cube.style.setProperty("--vh-cube-" + (i + 1), c));
      pIndex++;
    };
    applyPalette();
    setInterval(() => {
      cube.classList.add("is-scrambled");
      setTimeout(() => {
        cube.classList.remove("is-scrambled");
        cube.classList.add("is-solving");
        applyPalette();
        setTimeout(() => cube.classList.remove("is-solving"), 700);
      }, 1400);
    }, 5200);
  }

  function init() {
    createDock();
    bindDesktopSidebar();
    initRubikCube();
    document.addEventListener("BunnyHub:page-changed", event => sync(event.detail?.name || "home"));
    window.addEventListener("hashchange", () => sync(location.hash.replace(/^#/, "") || "home"));
    const hash = location.hash.replace(/^#/, "");
    sync(hash.startsWith("movie-") ? "home" : (hash || "home"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
