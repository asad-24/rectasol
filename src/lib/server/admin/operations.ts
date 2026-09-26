import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/server/admin/access";
import { loginSchema, statusUpdateSchema, type AdminFeedback } from "@/lib/admin/validation";

export async function authenticateAdmin(client: SupabaseClient, input: unknown): Promise<AdminFeedback> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { ok: false, message: "Sign-in was unsuccessful. Check your details or try again later." };
    const access = await getAdminAccess(client);
    if (access.kind !== "authorized") {
      await client.auth.signOut({ scope: "local" });
      return { ok: false, message: "Sign-in was unsuccessful. Contact your administrator if you need access." };
    }
    return { ok: true, message: "Signed in." };
  } catch { return { ok: false, message: "Sign-in is temporarily unavailable. Please try again." }; }
}

export async function changeInquiryStatus(client: SupabaseClient, input: unknown): Promise<AdminFeedback> {
  const access = await getAdminAccess(client);
  if (access.kind !== "authorized") return {
    ok: false, message: access.kind === "unavailable" ? "The service is temporarily unavailable." : "Your session does not have admin access. Sign in again.",
  };
  const parsed = statusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid status request. Reload the inquiry and try again." };
  try {
    const { data, error } = await client.rpc("admin_change_inquiry_status", {
      p_id: parsed.data.id, p_status: parsed.data.status, p_revision: parsed.data.revision,
    });
    if (error) return { ok: false, message: "The change could not be confirmed. Reload the inquiry before trying again." };
    switch (data?.outcome) {
      case "updated": return { ok: true, message: "Status updated and recorded in the audit trail." };
      case "unchanged": return { ok: true, message: "This inquiry already has that status." };
      case "conflict": return { ok: false, message: "Another update occurred. Review the refreshed status before trying again." };
      case "not_found": return { ok: false, message: "This inquiry is no longer available." };
      default: return { ok: false, message: "The change could not be confirmed. Reload the inquiry." };
    }
  } catch { return { ok: false, message: "The change could not be confirmed. Reload the inquiry before trying again." }; }
}
