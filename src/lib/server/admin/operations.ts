import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentCapabilities, type CurrentPermissions } from "@/lib/server/admin/access";
import { loginSchema, statusUpdateSchema, type AdminFeedback } from "@/lib/admin/validation";

const workspaceAccess = { capability: "workspace.access", scope: "all" } as const;
const clientsStage = { capability: "clients.stage", scope: "all" } as const;
const clientsConvert = { capability: "clients.convert", scope: "all" } as const;

function hasGrant(access: CurrentPermissions, required: { capability: string; scope: string }): boolean {
  if (access.kind !== "authorized") return false;
  if (access.isOwner) return true;
  return access.grants.some(grant =>
    grant.capability === required.capability && (grant.scope === required.scope || grant.scope === "all")
  );
}

async function ensureWorkspaceAccess(client: SupabaseClient, access: CurrentPermissions): Promise<boolean> {
  if (access.kind !== "authorized") return false;
  if (access.isOwner) return true;
  const access2 = await getCurrentCapabilities(client);
  return hasGrant(access2, workspaceAccess);
}

async function ensureCanStageInquiries(_client: SupabaseClient, access: CurrentPermissions): Promise<boolean> {
  if (access.kind !== "authorized") return false;
  if (access.isOwner) return true;
  return hasGrant(access, clientsStage);
}

async function ensureCanConvert(_client: SupabaseClient, access: CurrentPermissions): Promise<boolean> {
  if (access.kind !== "authorized") return false;
  if (access.isOwner) return true;
  return hasGrant(access, clientsConvert);
}

export async function authenticateAdmin(client: SupabaseClient, input: unknown): Promise<AdminFeedback> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { ok: false, message: "Sign-in was unsuccessful. Check your details or try again later." };
    const access = await getCurrentCapabilities(client);
    const allowed = await ensureWorkspaceAccess(client, access);
    if (!allowed) {
      await client.auth.signOut({ scope: "local" });
      return { ok: false, message: "Sign-in was unsuccessful. Contact your administrator if you need access." };
    }
    return { ok: true, message: "Signed in." };
  } catch { return { ok: false, message: "Sign-in is temporarily unavailable. Please try again." }; }
}

export async function changeInquiryStatus(client: SupabaseClient, input: unknown): Promise<AdminFeedback> {
  const access = await getCurrentCapabilities(client);
  const allowed = await ensureCanStageInquiries(client, access);
  if (!allowed) return {
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
  } catch { return { ok: false, message: "The change could not be confirmed. Reload the inquiry." }; }
}

export async function convertInquiry(client: SupabaseClient, input: unknown): Promise<AdminFeedback> {
  const access = await getCurrentCapabilities(client);
  const allowed = await ensureCanConvert(client, access);
  if (!allowed) return {
    ok: false, message: access.kind === "unavailable" ? "The service is temporarily unavailable." : "Your session does not have access to convert inquiries.",
  };
  const parsed = z.object({ inquiry_id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid inquiry request. Reload the inquiry and try again." };
  try {
    const { data, error } = await client.rpc("convert_inquiry_to_crm", {
      p_inquiry_id: parsed.data.inquiry_id,
    });
    if (error) return { ok: false, message: "Conversion failed. Reload the inquiry before trying again." };
    switch (data?.outcome) {
      case "converted": return { ok: true, message: "Inquiry converted to CRM contact." };
      case "already_converted": return { ok: true, message: "This inquiry is already linked to a CRM contact." };
      case "not_found": return { ok: false, message: "This inquiry is no longer available." };
      case "no_email": return { ok: false, message: "This inquiry does not have a valid email address and cannot be converted." };
      case "archived_conflict": return { ok: false, message: "A CRM contact with this email already exists but is archived. Resolve the conflict manually before converting." };
      default: return { ok: false, message: "Conversion failed. Reload the inquiry." };
    }
  } catch { return { ok: false, message: "Conversion is temporarily unavailable. Please try again." }; }
}
