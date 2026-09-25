import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getInquiryConfig } from "@/lib/server/inquiry-config";

export function createInquiryClient() {
  const { url, key } = getInquiryConfig();
  // Never attach browser cookies or user Authorization headers to this client.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
