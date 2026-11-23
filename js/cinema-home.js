/* Cinema4U-style catalogue experience for BunnyHub.
   Uses only BunnyHub's published catalogue and verified media asset metadata. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const safeText = value => String(value ?? "").trim();
  let activeCategory = "all";
  let searchTerm = "";
  const catalog = () => (window.BUNNY_HUB_DATA || []).filter(item =>
    item && item.type !== "Short" && item.type !== "Episode"
  );
  const videoAssets = item => (item.media_assets || []).filter(asset =>
    asset && (!asset.asset_type || asset.asset_type === "video")
  );
  const qualityLabel = value => {
    const raw = safeText(value);
    const key = raw.toLowerCase();
    if (key === "4k" || key === "2160p") return "4K UHD";
    if (key === "2k" || key === "1440p") return "2K";
    if (key === "1080p") return "1080p FHD";
    if (key === "720p") return "720p HD";
    if (key === "480p") return "480p SD";
    return raw || "Original";
  };
  const qualities = item => {
    const values = videoAssets(item).map(asset => safeText(asset.resolution)).filter(Boolean);
    if (!values.length && item.video_url) values.push("Original");
    return [...new Set(values)];
  };
  const audioLanguages = item => {
    const values = [safeText(item.language), ...videoAssets(item).map(asset => safeText(asset.language))].filter(Boolean);
    return [...new Set(values.flatMap(value => value.split(/[,/|+]+/).map(part => part.trim()).filter(Boolean)))];
  };
  const genres = item => safeText(item.genre).split(/[,/|]+/).map(value => value.trim()).filter(Boolean);
  const hasDualAudio = item => /dual/i.test(safeText(item.language)) || audioLanguages(item).length > 1;
  const qualityMatch = (item, filter) => {
    const list = qualities(item).map(value => value.toLowerCase());
    if (filter === "4k") return list.some(value => value === "4k" || value === "4k uhd" || value === "2160p");
    if (filter === "1080p") return list.some(value => value === "1080p" || value === "1080p fhd");
    if (filter === "dual") return hasDualAudio(item);
    return true;
  };
  const sortItems = (items, sort) => [...items].sort((a, b) => {
    if (sort === "popular") return Number(b.view_count || 0) - Number(a.view_count || 0) ||
      Number(b.rating || 0) - Number(a.rating || 0);
    if (sort === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
    return (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()) ||
      Number(b.year || 0) - Number(a.year || 0);
  });
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const addBadge = (host, text, variant) => {
    if (!text) return;
    host.appendChild(make("span", "cinema-badge" + (variant ? " " + variant : ""), text));
  };

  function openDetails(item, download) {
    window.openMovie?.(item.id);
    if (download) window.downloadMovie?.();
  }

  function createPosterCard(item, index, compact = false) {
    const article = make("article", compact ? "cinema-trend-card" : "cinema-catalog-card");
    article.dataset.contentId = String(item.id);
    const posterButton = make("button", "cinema-poster");
    posterButton.type = "button";
    posterButton.setAttribute("aria-label", "Open details for " + safeText(item.title));
    if (item.poster) {
      const image = make("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.src = item.poster;
      image.alt = safeText(item.title) + " poster";
      image.onerror = () => {
        image.remove();
        posterButton.appendChild(make("span", "cinema-poster-fallback", safeText(item.title).slice(0, 2).toUpperCase()));
      };
      posterButton.appendChild(image);
    } else {
      posterButton.appendChild(make("span", "cinema-poster-fallback", safeText(item.title).slice(0, 2).toUpperCase()));
    }
    const posterOverlay = make("span", "cinema-poster-overlay");
    posterOverlay.appendChild(make("i", "fas fa-arrow-up-right-from-square"));
    posterButton.appendChild(posterOverlay);
    posterButton.addEventListener("click", () => openDetails(item, false));
    article.appendChild(posterButton);

    if (compact) {
      const rank = make("span", "cinema-rank", "#" + (index + 1));
      article.appendChild(rank);
      const region = safeText(item.industry);
      if (region && region !== "All") article.appendChild(make("span", "cinema-region", region.toUpperCase()));
    }

    const body = make("div", "cinema-card-body");
    const badgeRow = make("div", "cinema-card-badges");
    const available = qualities(item);
    addBadge(badgeRow, available.length ? qualityLabel(available[0]) : (item.video_url ? "ORIGINAL" : "DETAILS"), "quality");
    if (item.rating !== "" && item.rating != null && Number.isFinite(Number(item.rating))) {
      addBadge(badgeRow, "★ " + Number(item.rating).toFixed(1) + " IMDb", "rating");
    }
    body.appendChild(badgeRow);

    body.appendChild(make("h3", "cinema-card-title", safeText(item.title) || "Untitled"));
    const info = [item.year, item.duration, item.type === "Web Series" ? "Series" : "Movie"].filter(Boolean).join(" · ");
    body.appendChild(make("p", "cinema-card-meta", info || "BunnyHub catalogue"));
    const languages = audioLanguages(item);
    if (languages.length) {
      const audioLabel = hasDualAudio(item) ? "Dual audio · " + languages.join(" + ") : "Audio · " + languages.join(" + ");
      body.appendChild(make("p", "cinema-card-audio", "◖♫◗ " + audioLabel));
    }

    const actions = make("div", "cinema-card-actions");
    const details = make("button", "cinema-card-details", "View details");
    details.type = "button";
    details.addEventListener("click", () => openDetails(item, false));
    const download = make("button", "cinema-card-download");
    download.type = "button";
    download.setAttribute("aria-label", "View available resolutions for " + safeText(item.title));
    download.appendChild(make("i", "fas fa-download"));
    download.addEventListener("click", () => openDetails(item, true));
    actions.append(details, download);
    body.appendChild(actions);
    article.appendChild(body);
    return article;
  }

  function fillGenreOptions(items) {
    const select = $("cinemaGenreFilter");
    if (!select) return;
    const current = select.value || "All";
    const allGenres = [...new Set(items.flatMap(genres))].sort((a, b) => a.localeCompare(b));
    select.replaceChildren(new Option("All genres", "All"));
    allGenres.forEach(value => select.add(new Option(value, value)));
    select.value = allGenres.includes(current) ? current : "All";

    const qualitySelect = $("cinemaQualityFilter");
    if (qualitySelect) {
      const selectedQuality = qualitySelect.value || "All";
      const actualQualities = [...new Set(items.flatMap(qualities).map(value => value.toLowerCase()))];
      const options = [["All", "All qualities"]];
      if (actualQualities.some(value => ["4k","4k uhd","2160p"].includes(value))) options.push(["4k","4K UHD"]);
      if (actualQualities.some(value => ["1080p","1080p fhd"].includes(value))) options.push(["1080p","1080p Full HD"]);
      if (items.some(hasDualAudio)) options.push(["dual","Dual audio"]);
      qualitySelect.replaceChildren(...options.map(([value,label]) => new Option(label,value)));
      qualitySelect.value = options.some(([value]) => value === selectedQuality) ? selectedQuality : "All";
    }
  }

  function renderTrending(items) {
    const host = $("cinemaTrendingGrid");
    if (!host) return;
    host.replaceChildren();
    const featured = items.filter(item => item.is_featured);
    const ranked = sortItems(featured.length ? featured : items, "popular").slice(0, 8);
    if (!ranked.length) {
      const empty = make("div", "cinema-empty", "");
      empty.append(make("strong", "", "No featured titles yet"), make("span", "", "Published movies and series will appear here"));
      host.appendChild(empty);
      return;
    }
    ranked.forEach((item, index) => host.appendChild(createPosterCard(item, index, true)));
  }

  function renderCatalog() {
    const host = $("homeCatalogGrid");
    if (!host) return;
    const all = catalog();
    fillGenreOptions(all);
    const genre = $("cinemaGenreFilter")?.value || "All";
    const quality = $("cinemaQualityFilter")?.value || "All";
    const sort = $("cinemaSortFilter")?.value || "newest";
    const selected = sortItems(all.filter(item => {
      const text = [item.title,item.description,item.cast,item.director,item.genre,item.language,item.industry,item.year].map(safeText).join(" ").toLowerCase();
      const categoryMatch =
        activeCategory === "all" ||
        activeCategory === "new" ||
        (activeCategory === "series" && item.type === "Web Series") ||
        (activeCategory === "bollywood" && safeText(item.industry).toLowerCase() === "bollywood") ||
        (activeCategory === "hollywood" && safeText(item.industry).toLowerCase() === "hollywood") ||
        (activeCategory === "south" && safeText(item.industry).toLowerCase().includes("south"));
      return categoryMatch &&
        (!searchTerm || text.includes(searchTerm)) &&
        (genre === "All" || genres(item).some(value => value.toLowerCase() === genre.toLowerCase())) &&
        qualityMatch(item, quality);
    }), activeCategory === "new" ? "newest" : sort);
    host.replaceChildren();
    if (!selected.length) {
      const empty = make("div", "cinema-empty", "");
      empty.append(make("strong", "", all.length ? "No titles match these filters" : "Your catalogue is getting ready"),
        make("span", "", all.length ? "Choose another genre or quality." : "Once authorised content is published in Control Center, it will appear here."));
      host.appendChild(empty);
      const count = $("cinemaCatalogCount");
      if (count) count.textContent = "0 titles";
      return;
    }
    selected.forEach((item, index) => host.appendChild(createPosterCard(item, index, false)));
    const count = $("cinemaCatalogCount");
    if (count) count.textContent = selected.length + (selected.length === 1 ? " title" : " titles");
  }

  function renderAll() {
    const items = catalog();
    renderTrending(items);
    renderCatalog();
    document.querySelectorAll("[data-cinema-category]").forEach(button => {
      const active = button.dataset.cinemaCategory === activeCategory;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setCategory(category) {
    activeCategory = category || "all";
    if (activeCategory === "watchlist") {
      activeCategory = "all";
      renderAll();
      window.showPage?.("watchlist");
      return;
    }
    if (activeCategory === "bollywood" || activeCategory === "hollywood" || activeCategory === "south") {
      window.filterByIndustry?.(activeCategory === "south" ? "South" : activeCategory[0].toUpperCase() + activeCategory.slice(1));
    }
    renderAll();
    $("homeCatalogGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function decorateMovieModal(item) {
    const host = $("cinemaMovieBadges");
    if (!host || !item) return;
    host.replaceChildren();
    if (item.rating !== "" && item.rating != null) addBadge(host, "★ " + Number(item.rating).toFixed(1) + " IMDb", "rating");
    addBadge(host, item.type === "Web Series" ? "WEB SERIES" : "MOVIE", "type");
    const available = qualities(item);
    available.forEach(value => addBadge(host, qualityLabel(value), "quality"));
    const languages = audioLanguages(item);
    if (languages.length) addBadge(host, (hasDualAudio(item) ? "DUAL AUDIO · " : "AUDIO · ") + languages.join(" + "), "audio");
  }

  function init() {
    $("cinemaGenreFilter")?.addEventListener("change", renderCatalog);
    $("cinemaQualityFilter")?.addEventListener("change", renderCatalog);
    $("cinemaSortFilter")?.addEventListener("change", renderCatalog);
    $("cinemaQuickSearch")?.addEventListener("input", event => {
      searchTerm = safeText(event.target.value).toLowerCase();
      renderCatalog();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) {
        event.preventDefault();
        $("cinemaQuickSearch")?.focus();
      }
    });
    document.querySelectorAll("[data-cinema-category]").forEach(button => {
      button.addEventListener("click", () => setCategory(button.dataset.cinemaCategory));
    });
    document.addEventListener("BunnyHub:content-loaded", renderAll);
    const originalRender = window.renderBunnyHub;
    if (typeof originalRender === "function" && !originalRender.__cinemaWrapped) {
      const wrapped = function (...args) {
        const result = originalRender.apply(this, args);
        renderAll();
        return result;
      };
      wrapped.__cinemaWrapped = true;
      window.renderBunnyHub = wrapped;
    }
    const originalOpen = window.openMovie;
    if (typeof originalOpen === "function" && !originalOpen.__cinemaWrapped) {
      const wrappedOpen = function (id, ...args) {
        const result = originalOpen.call(this, id, ...args);
        const item = catalog().find(entry => String(entry.id) === String(id));
        if (item) decorateMovieModal(item);
        return result;
      };
      wrappedOpen.__cinemaWrapped = true;
      window.openMovie = wrappedOpen;
    }
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
