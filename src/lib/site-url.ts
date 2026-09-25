import "server-only";

export function getSiteUrl() {
  const configured = process.env.SITE_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL must be configured for production builds and runtime.");
  }
  const url = new URL(configured || "http://localhost:3000");
  if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      (process.env.NODE_ENV === "production" && (url.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("SITE_URL must be an origin; production requires HTTPS.");
  }
  return url.origin;
}

export const SITE_URL = getSiteUrl();
