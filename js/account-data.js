/* Per-account browser cache isolation for watchlists and playback progress. */
(() => {
  "use strict";
  const watchlistKey = userId => userId ? "vh_watchlist_user_" + String(userId) : "vh_watchlist";
  const progressKey = (contentId, userId) => userId
    ? "vh_progress_user_" + String(userId) + "_" + String(contentId)
    : "vh_progress_guest_" + String(contentId);

  function readWatchlist(userId) {
    try {
      const value = JSON.parse(localStorage.getItem(watchlistKey(userId)) || "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch (_) { return []; }
  }

  function writeWatchlist(items, userId) {
    const clean = Array.isArray(items) ? [...new Set(items.map(String))] : [];
    localStorage.setItem(watchlistKey(userId), JSON.stringify(clean));
    return clean;
  }

  function getProgress(contentId, userId) {
    try { return Number(localStorage.getItem(progressKey(contentId, userId)) || 0) || 0; }
    catch (_) { return 0; }
  }

  function setProgress(contentId, seconds, userId) {
    const value = Math.max(0, Number(seconds) || 0);
    try { localStorage.setItem(progressKey(contentId, userId), String(value)); }
    catch (_) { /* Cloud progress remains the source of truth for signed-in users. */ }
  }

  function migrateLegacy(userId) {
    if (!userId) return false;
    const marker = "vh_account_cache_migrated_v1_" + String(userId);
    try {
      if (localStorage.getItem(marker) === "1") return true;

      // Move the old device-wide list into this signed-in account exactly once.
      const existing = readWatchlist(userId);
      let legacy = [];
      try {
        const parsed = JSON.parse(localStorage.getItem("vh_watchlist") || "[]");
        if (Array.isArray(parsed)) legacy = parsed.map(String);
      } catch (_) { /* An invalid legacy cache is ignored, never trusted. */ }
      if (legacy.length) writeWatchlist([...existing, ...legacy], userId);
      if (localStorage.getItem("vh_watchlist") !== null) localStorage.removeItem("vh_watchlist");

      // Older releases used vh_progress_<contentId>, shared across browser accounts.
      const oldPrefix = "vh_progress_";
      const oldKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(oldPrefix) &&
            !key.startsWith("vh_progress_user_") &&
            !key.startsWith("vh_progress_guest_")) oldKeys.push(key);
      }
      oldKeys.forEach(oldKey => {
        const contentId = oldKey.slice(oldPrefix.length);
        const nextKey = progressKey(contentId, userId);
        if (localStorage.getItem(nextKey) === null) {
          const oldValue = localStorage.getItem(oldKey);
          if (oldValue !== null) localStorage.setItem(nextKey, oldValue);
        }
        localStorage.removeItem(oldKey);
      });

      localStorage.setItem(marker, "1");
      return true;
    } catch (error) {
      console.warn("Account cache migration could not finish:", error?.message || error);
      return false;
    }
  }

  window.VH_ACCOUNT_DATA = Object.freeze({
    watchlistKey, progressKey, readWatchlist, writeWatchlist,
    getProgress, setProgress, migrateLegacy
  });
})();