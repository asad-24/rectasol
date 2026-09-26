import "server-only";

export function getAdminConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Admin configuration unavailable.");
  const url = new URL(rawUrl);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname)))) {
    throw new Error("Admin configuration unavailable.");
  }
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try { publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { /* Configuration errors never include values. */ }
  }
  if (!publicKey) throw new Error("Admin configuration unavailable.");
  return { url: url.origin, key };
}

export const adminCookieName = "rectasol-admin-auth";
export const adminCookieOptions = {
  path: "/admin",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
