// Path helpers shared by the nav (client) and proxy middleware (edge). Pure — no
// server/runtime deps.

// The Production function's pages (season-scoped) + its hub.
export function isProductionPath(p: string): boolean {
  return (
    p === "/production" ||
    p.startsWith("/production/") ||
    /^\/seasons\/[^/]+\/(production|material-orders)/.test(p)
  );
}

// The Customer Portal (client users).
export function isPortalPath(p: string): boolean {
  return p === "/portal" || p.startsWith("/portal/");
}
