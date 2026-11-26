/* ==========================================================================
   BunnyHub — Cookie Consent Banner & Preferences Modal Engine
   ========================================================================== */

(function () {
  const STORAGE_KEY = "bunnyhub_cookie_consent";

  function getConsent() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(preferences) {
    try {
      const consentRecord = {
        necessary: true,
        analytics: Boolean(preferences.analytics),
        marketing: Boolean(preferences.marketing),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentRecord));
      hideBanner();
      closeModal();
      if (typeof window.toast === "function") {
        window.toast("Cookie preferences updated successfully.");
      }
      window.dispatchEvent(new CustomEvent("bunnyhub-cookie-consent-updated", { detail: consentRecord }));
    } catch (e) {
      console.warn("Could not persist cookie consent:", e);
    }
  }

  function hideBanner() {
    const banner = document.getElementById("bunnyhubCookieBanner");
    if (banner) {
      banner.style.opacity = "0";
      banner.style.transform = "translateY(30px)";
      setTimeout(() => {
        banner.remove();
      }, 350);
    }
  }

  function closeModal() {
    const modal = document.getElementById("bunnyhubCookieModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  function openModal() {
    let modal = document.getElementById("bunnyhubCookieModal");
    if (!modal) {
      createModalDOM();
      modal = document.getElementById("bunnyhubCookieModal");
    }
    const current = getConsent() || { analytics: true, marketing: true };
    const analyticsToggle = document.getElementById("bhCookieAnalyticsToggle");
    const marketingToggle = document.getElementById("bhCookieMarketingToggle");
    if (analyticsToggle) analyticsToggle.checked = current.analytics !== false;
    if (marketingToggle) marketingToggle.checked = current.marketing !== false;

    if (modal) {
      modal.classList.add("active");
    }
  }

  function createBannerDOM() {
    if (document.getElementById("bunnyhubCookieBanner")) return;
    const banner = document.createElement("div");
    banner.id = "bunnyhubCookieBanner";
    banner.className = "bunnyhub-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Cookie Consent");

    banner.innerHTML = `
      <div class="bh-cookie-content">
        <p class="bh-cookie-text">
          By clicking <strong>“Accept All Cookies”</strong>, you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts. View our <a href="/cookie-policy.html">Cookie Policy</a>.
        </p>
        <div class="bh-cookie-actions">
          <button type="button" class="bh-cookie-btn bh-btn-settings" id="bhCookieSettingsBtn">
            <i class="fas fa-sliders-h"></i> Cookies Settings
          </button>
          <button type="button" class="bh-cookie-btn bh-btn-accept" id="bhCookieAcceptAllBtn">
            Accept All Cookies
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Fade-in animation
    setTimeout(() => {
      banner.style.opacity = "1";
      banner.style.transform = "translateY(0)";
    }, 100);

    document.getElementById("bhCookieSettingsBtn")?.addEventListener("click", () => {
      openModal();
    });

    document.getElementById("bhCookieAcceptAllBtn")?.addEventListener("click", () => {
      saveConsent({ analytics: true, marketing: true });
    });
  }

  function createModalDOM() {
    if (document.getElementById("bunnyhubCookieModal")) return;
    const modal = document.createElement("div");
    modal.id = "bunnyhubCookieModal";
    modal.className = "bunnyhub-cookie-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="bh-cookie-modal-backdrop" id="bhCookieModalBackdrop"></div>
      <div class="bh-cookie-modal-box">
        <div class="bh-cookie-modal-header">
          <h3><i class="fas fa-cookie-bite" style="color:var(--accent,#8b5cf6);"></i> Cookies Preferences</h3>
          <button type="button" class="bh-cookie-close-btn" id="bhCookieModalCloseBtn" aria-label="Close modal">&times;</button>
        </div>
        <div class="bh-cookie-modal-body">
          <p style="font-size: 0.88rem; color: #94a3b8; margin-top: 0;">
            Manage how BunnyHub uses cookies to deliver smooth streaming, zero-leak privacy, and optional analytics.
          </p>

          <div class="bh-cookie-item">
            <div class="bh-cookie-info">
              <strong>Strictly Necessary Cookies</strong>
              <small>Required for core navigation, theme preferences, and security shielding.</small>
            </div>
            <span class="bh-badge-always-active">Always Active</span>
          </div>

          <div class="bh-cookie-item">
            <div class="bh-cookie-info">
              <strong>Performance &amp; Analytics</strong>
              <small>Helps analyze playback quality, error prevention, and popular media discovery.</small>
            </div>
            <label class="bh-switch">
              <input type="checkbox" id="bhCookieAnalyticsToggle" checked>
              <span class="bh-slider"></span>
            </label>
          </div>

          <div class="bh-cookie-item">
            <div class="bh-cookie-info">
              <strong>Marketing &amp; Sponsorships</strong>
              <small>Used for Telegram notices, community sponsor badges, and relevant notices.</small>
            </div>
            <label class="bh-switch">
              <input type="checkbox" id="bhCookieMarketingToggle" checked>
              <span class="bh-slider"></span>
            </label>
          </div>
        </div>

        <div class="bh-cookie-modal-footer">
          <button type="button" class="bh-cookie-btn bh-btn-reject" id="bhCookieRejectBtn">Reject Non-Essential</button>
          <button type="button" class="bh-cookie-btn bh-btn-save" id="bhCookieSaveBtn">Save Preferences</button>
          <button type="button" class="bh-cookie-btn bh-btn-accept" id="bhCookieModalAcceptAllBtn">Accept All</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("bhCookieModalCloseBtn")?.addEventListener("click", closeModal);
    document.getElementById("bhCookieModalBackdrop")?.addEventListener("click", closeModal);

    document.getElementById("bhCookieSaveBtn")?.addEventListener("click", () => {
      const analytics = document.getElementById("bhCookieAnalyticsToggle")?.checked;
      const marketing = document.getElementById("bhCookieMarketingToggle")?.checked;
      saveConsent({ analytics, marketing });
    });

    document.getElementById("bhCookieRejectBtn")?.addEventListener("click", () => {
      saveConsent({ analytics: false, marketing: false });
    });

    document.getElementById("bhCookieModalAcceptAllBtn")?.addEventListener("click", () => {
      saveConsent({ analytics: true, marketing: true });
    });
  }

  // Inject Cookie Consent CSS
  function injectStyles() {
    const css = `
      .bunnyhub-cookie-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 900px;
        margin: 0 auto;
        background: linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(9, 13, 24, 0.98));
        border: 1px solid rgba(139, 92, 246, 0.35);
        border-radius: 16px;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.6);
        z-index: 99999;
        padding: 18px 24px;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.35s ease, transform 0.35s ease;
        backdrop-filter: blur(14px);
      }
      .bh-cookie-content {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .bh-cookie-text {
        flex: 1;
        min-width: 280px;
        margin: 0;
        font-size: 0.88rem;
        line-height: 1.5;
        color: #d1d5db;
      }
      .bh-cookie-text strong {
        color: #ffffff;
      }
      .bh-cookie-text a {
        color: #22d3ee;
        text-decoration: underline;
        font-weight: 600;
      }
      .bh-cookie-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .bh-cookie-btn {
        padding: 10px 18px;
        border-radius: 999px;
        font-size: 0.88rem;
        font-weight: 700;
        cursor: pointer;
        border: 0;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .bh-btn-settings {
        background: #1e293b;
        color: #e2e8f0;
        border: 1px solid #334155;
      }
      .bh-btn-settings:hover {
        background: #334155;
        color: #ffffff;
        border-color: #475569;
      }
      .bh-btn-accept {
        background: linear-gradient(135deg, #8b5cf6, #6366f1);
        color: #ffffff;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);
      }
      .bh-btn-accept:hover {
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        transform: translateY(-2px);
      }
      .bh-btn-save {
        background: #22d3ee;
        color: #090d18;
      }
      .bh-btn-save:hover {
        background: #06b6d4;
      }
      .bh-btn-reject {
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
      }
      .bh-btn-reject:hover {
        background: #1e293b;
        color: #f1f5f9;
      }

      /* Modal Styling */
      .bunnyhub-cookie-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 100000;
      }
      .bunnyhub-cookie-modal.active {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bh-cookie-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
      }
      .bh-cookie-modal-box {
        position: relative;
        width: min(92%, 520px);
        background: #111827;
        border: 1px solid #263248;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.65);
        color: #f5f7fb;
        z-index: 1;
      }
      .bh-cookie-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .bh-cookie-modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
      }
      .bh-cookie-close-btn {
        background: none;
        border: 0;
        color: #94a3b8;
        font-size: 1.6rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .bh-cookie-close-btn:hover {
        color: #fff;
      }
      .bh-cookie-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px;
        background: #151e30;
        border: 1px solid #263248;
        border-radius: 12px;
        margin-bottom: 12px;
        gap: 16px;
      }
      .bh-cookie-info strong {
        display: block;
        font-size: 0.95rem;
        color: #ffffff;
      }
      .bh-cookie-info small {
        display: block;
        font-size: 0.78rem;
        color: #94a3b8;
        margin-top: 2px;
      }
      .bh-badge-always-active {
        font-size: 0.72rem;
        font-weight: 700;
        color: #34d399;
        background: rgba(16, 185, 129, 0.15);
        padding: 4px 8px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .bh-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }
      .bh-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .bh-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #334155;
        transition: .3s;
        border-radius: 24px;
      }
      .bh-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
      }
      input:checked + .bh-slider {
        background-color: #8b5cf6;
      }
      input:checked + .bh-slider:before {
        transform: translateX(20px);
      }
      .bh-cookie-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Public helpers
  window.openCookieSettingsModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    openModal();
  };

  // Init on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    const existing = getConsent();
    if (!existing) {
      createBannerDOM();
    }
    // Also support query param: ?cookies=open
    const params = new URLSearchParams(window.location.search);
    if (params.get("cookies") === "open") {
      setTimeout(openModal, 400);
    }
  });
})();
