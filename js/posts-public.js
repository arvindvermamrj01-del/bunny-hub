/* Public Posts Studio feed. Uses the server-side public API; no Supabase secrets are exposed. */
(() => {
  "use strict";

  const section = document.getElementById("publicPostsSection");
  const host = document.getElementById("publicPostsGrid");
  if (!section || !host) return;

  let inFlight = null;
  let activeDialog = null;
  let lastLoadedAt = 0;
  const refreshAfterMs = 30 * 60 * 1000;

  function httpsUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function addPlaceholder(parent) {
    const placeholder = document.createElement("div");
    placeholder.className = "vh-public-post-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "▶";
    parent.appendChild(placeholder);
  }

  function createPreview(post) {
    const preview = document.createElement("div");
    preview.className = "vh-public-post-media";

    const mediaUrl = httpsUrl(post.media_url);
    const thumbnailUrl = httpsUrl(post.thumbnail_url);
    const type = String(post.post_type || "").toLowerCase();

    if (type === "video" && mediaUrl) {
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      if (thumbnailUrl) video.poster = thumbnailUrl;
      video.src = mediaUrl;
      video.setAttribute("aria-label", "Play " + String(post.title || "published video"));
      preview.appendChild(video);
    } else {
      const imageUrl = thumbnailUrl || (type === "photo" ? mediaUrl : "");
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = String(post.title || "Published post");
        image.loading = "lazy";
        image.decoding = "async";
        preview.appendChild(image);
      } else {
        addPlaceholder(preview);
      }
    }
    return preview;
  }

  function createCard(post) {
    const card = document.createElement("article");
    card.className = "movie-card vh-public-post-card";
    card.appendChild(createPreview(post));

    const body = document.createElement("div");
    body.className = "movie-info";

    const title = document.createElement("h3");
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "vh-public-post-title";
    titleButton.textContent = String(post.title || "Untitled post");
    titleButton.setAttribute("aria-label", "Open " + String(post.title || "published post"));
    titleButton.addEventListener("click", () => openPostDialog(post, titleButton));
    title.appendChild(titleButton);

    const type = String(post.post_type || "post").toLowerCase();
    const typeLabel = type === "video" ? "Video" : type === "song" ? "Audio" : type === "photo" ? "Photo" : "Post";
    const meta = document.createElement("p");
    meta.className = "vh-public-post-meta";
    const createdAt = post.created_at ? new Date(post.created_at) : null;
    const dateLabel = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
      : "";
    meta.textContent = [typeLabel, String(post.category || "").trim(), dateLabel].filter(Boolean).join(" · ");

    body.append(title, meta);

    const descriptionText = String(post.description || "").trim();
    if (descriptionText) {
      const description = document.createElement("p");
      description.className = "vh-public-post-description";
      description.textContent = descriptionText;
      body.appendChild(description);
    }

    if (type === "song") {
      const audioUrl = httpsUrl(post.media_url);
      if (audioUrl) {
        const audio = document.createElement("audio");
        audio.className = "vh-public-post-audio";
        audio.controls = true;
        audio.preload = "none";
        audio.src = audioUrl;
        audio.setAttribute("aria-label", "Play " + String(post.title || "published audio"));
        body.appendChild(audio);
      }
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "vh-public-post-open";
    openButton.textContent = "Open post →";
    openButton.addEventListener("click", () => openPostDialog(post, openButton));
    body.appendChild(openButton);

    card.appendChild(body);
    card.addEventListener("click", event => {
      if (event.target.closest("video, audio, button, a")) return;
      openPostDialog(post, card);
    });
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", "Open post: " + String(post.title || "published post"));
    card.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target === card) {
        event.preventDefault();
        openPostDialog(post, card);
      }
    });
    return card;
  }

  function closePostDialog() {
    if (!activeDialog) return;
    const { backdrop, keyHandler, returnFocus } = activeDialog;
    document.removeEventListener("keydown", keyHandler);
    backdrop.remove();
    activeDialog = null;
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus({ preventScroll: true });
  }

  function openPostDialog(post, trigger) {
    if (activeDialog) closePostDialog();
    const mediaUrl = httpsUrl(post.media_url);
    const thumbnailUrl = httpsUrl(post.thumbnail_url);
    const type = String(post.post_type || "").toLowerCase();

    const backdrop = document.createElement("div");
    backdrop.className = "vh-public-post-modal";
    const dialog = document.createElement("section");
    dialog.className = "vh-public-post-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "vhPublicPostDialogTitle");

    const header = document.createElement("div");
    header.className = "vh-public-post-dialog-header";
    const heading = document.createElement("h2");
    heading.id = "vhPublicPostDialogTitle";
    heading.textContent = String(post.title || "Published post");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "vh-public-post-dialog-close";
    closeButton.setAttribute("aria-label", "Close post");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", closePostDialog);
    header.append(heading, closeButton);
    dialog.appendChild(header);

    const mediaHost = document.createElement("div");
    mediaHost.className = "vh-public-post-dialog-media";
    const hint = document.createElement("p");
    hint.className = "vh-public-post-dialog-hint";

    if (type === "video" && mediaUrl) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      if (thumbnailUrl) video.poster = thumbnailUrl;
      video.src = mediaUrl;
      video.setAttribute("aria-label", "Play " + String(post.title || "published video"));
      video.addEventListener("playing", () => { hint.textContent = ""; });
      video.addEventListener("error", () => {
        hint.textContent = "वीडियो लोड नहीं हो पाया। Refresh करके फिर Play करें।";
      });
      mediaHost.appendChild(video);
      hint.textContent = "वीडियो शुरू न हो तो नीचे Play दबाएँ।";
      dialog.appendChild(mediaHost);
      dialog.appendChild(hint);
      const descriptionText = String(post.description || "").trim();
      if (descriptionText) {
        const description = document.createElement("p");
        description.className = "vh-public-post-dialog-description";
        description.textContent = descriptionText;
        dialog.appendChild(description);
      }
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
      const keyHandler = event => { if (event.key === "Escape") closePostDialog(); };
      activeDialog = { backdrop, keyHandler, returnFocus: trigger || null };
      document.addEventListener("keydown", keyHandler);
      closeButton.focus({ preventScroll: true });
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => { hint.textContent = "वीडियो चलाने के लिए Play दबाएँ।"; });
      }
      return;
    }

    if (type === "song" && mediaUrl) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = mediaUrl;
      audio.setAttribute("aria-label", "Play " + String(post.title || "published audio"));
      mediaHost.appendChild(audio);
    } else {
      const imageUrl = thumbnailUrl || (type === "photo" ? mediaUrl : "");
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = String(post.title || "Published post");
        image.decoding = "async";
        mediaHost.appendChild(image);
      } else {
        const message = document.createElement("p");
        message.textContent = "इस पोस्ट का मीडिया उपलब्ध नहीं है।";
        mediaHost.appendChild(message);
      }
    }
    dialog.appendChild(mediaHost);
    const descriptionText = String(post.description || "").trim();
    if (descriptionText) {
      const description = document.createElement("p");
      description.className = "vh-public-post-dialog-description";
      description.textContent = descriptionText;
      dialog.appendChild(description);
    }
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const keyHandler = event => { if (event.key === "Escape") closePostDialog(); };
    activeDialog = { backdrop, keyHandler, returnFocus: trigger || null };
    document.addEventListener("keydown", keyHandler);
    closeButton.focus({ preventScroll: true });
  }

  function render(posts) {
    if (activeDialog) closePostDialog();
    host.replaceChildren();
    if (!posts.length) {
      section.classList.add("hidden");
      return;
    }
    posts.forEach(post => {
      if (post && typeof post === "object") host.appendChild(createCard(post));
    });
    section.classList.toggle("hidden", host.childElementCount === 0);
  }

  async function load(force = false) {
    if (inFlight) return inFlight;
    if (!force && lastLoadedAt && Date.now() - lastLoadedAt < refreshAfterMs) return;

    inFlight = (async () => {
      const response = await fetch("/api/posts/public", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Public posts request failed (" + response.status + ").");
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.posts)) throw new Error("Public posts response is invalid.");
      render(payload.posts);
      lastLoadedAt = Date.now();
    })().catch(error => {
      console.warn("Public posts feed is unavailable:", error.message);
    }).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function observeHomePage() {
    const home = document.getElementById("page-home");
    if (!home || typeof MutationObserver !== "function") return;
    new MutationObserver(() => {
      if (home.classList.contains("active")) load();
    }).observe(home, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      load();
      observeHomePage();
    }, { once: true });
  } else {
    load();
    observeHomePage();
  }

  window.addEventListener("focus", () => load());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
})();
