import { json, requireRole } from "../../_shared/auth.js";

/* Server-side TMDB metadata proxy (Admin/Staff only; keeps TMDB_API_KEY out of client JS). */
export async function onRequestGet({ request, env }) {
  try {
    await requireRole(request, env, ["admin", "sub_admin", "content_editor"]);
    const apiKey = String(env.TMDB_API_KEY || "").trim();
    if (!apiKey) {
      return json({ error: "TMDB_API_KEY is not configured in Cloudflare Pages secrets." }, 503);
    }
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
    const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
    if (query.length < 2) return json({ error: "Search query must be at least 2 characters." }, 400);

    const tmdbUrl = new URL("https://api.themoviedb.org/3/search/" + type);
    tmdbUrl.search = new URLSearchParams({
      api_key: apiKey,
      query,
      include_adult: "false"
    }).toString();

    const response = await fetch(tmdbUrl);
    if (!response.ok) return json({ error: "TMDB lookup failed." }, 502);
    const data = await response.json().catch(() => ({}));
    const results = (data.results || []).slice(0, 8).map(item => ({
      id: item.id,
      title: item.title || item.name || "",
      year: String(item.release_date || item.first_air_date || "").slice(0, 4),
      rating: item.vote_average ? Number(item.vote_average).toFixed(1) : "",
      overview: item.overview || "",
      poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : "",
      backdrop: item.backdrop_path ? "https://image.tmdb.org/t/p/w1280" + item.backdrop_path : ""
    }));
    return json({ results });
  } catch (error) {
    return json({ error: error.message || "TMDB request denied." }, error.status || 403);
  }
}
