/* Edge security middleware: blocks exposure of internal repository files and enforces strict same-origin API checks. */

const BLOCKED_PREFIXES = [
  "/supabase/",
  "/cloudflare/",
  "/scripts/",
  "/docs/",
  "/.git",
  "/.github",
  "/.vscode"
];

const BLOCKED_EXACT = new Set([
  "/wrangler.json",
  "/package.json",
  "/package-lock.json",
  "/setup.md",
  "/readme.md",
  "/.gitignore"
]);

function isBlockedInternalPath(pathname) {
  const lower = pathname.toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return true;
  if (BLOCKED_PREFIXES.some(prefix => lower.startsWith(prefix))) return true;
  if (lower.endsWith(".sql") || lower.endsWith(".md") || lower.endsWith(".bak") || lower.endsWith(".env")) {
    return true;
  }
  return false;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Block direct HTTP exposure of internal SQL schemas, scripts, docs, and config files.
  if (isBlockedInternalPath(path)) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  }

  // 2. Enforce same-origin checks on state-changing /api/* calls (except external Telegram webhook).
  if (path.startsWith("/api/") && path !== "/api/telegram/webhook") {
    const method = request.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return new Response(JSON.stringify({ error: "Cross-origin state-changing request blocked." }), {
          status: 403,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }
      const secFetchSite = (request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
      if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
        return new Response(JSON.stringify({ error: "Untrusted cross-site request blocked." }), {
          status: 403,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
