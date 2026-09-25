import "server-only";

export function getInquiryConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const hashSecret = process.env.INQUIRY_HASH_SECRET;
  if (!url || !key || !hashSecret || hashSecret.length < 32) {
    throw new Error("Inquiry backend configuration is incomplete.");
  }
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" ||
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:" && process.env.NODE_ENV !== "production"))) {
    throw new Error("Invalid Supabase origin configuration.");
  }
  return { url: parsed.origin, key, hashSecret, ipHeader: process.env.INQUIRY_TRUSTED_IP_HEADER?.trim().toLowerCase() };
}
