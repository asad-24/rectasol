import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentPermissions, hasCurrentCapability } from "@/lib/server/admin/permissions";

export type CurrentPermissions = import("@/lib/server/admin/permissions").CurrentPermissions;

export async function getCurrentCapabilities(client: SupabaseClient): Promise<CurrentPermissions> {
  return getCurrentPermissions(client);
}

export { hasCurrentCapability };

/** @deprecated Retained for test compatibility. M3 authorization uses getCurrentCapabilities. */
export async function getAdminAccess(client: SupabaseClient): Promise<{ kind: string; user?: { id: string; email: string }; role?: string }> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { kind: "unauthenticated" };
    const membership = await client.from("admin_memberships").select("role,active").eq("user_id",data.user.id).maybeSingle();
    if (membership.error) return { kind: "unavailable" };
    if (!membership.data?.active || !["admin","super_admin"].includes(membership.data.role)) return { kind: "forbidden" };
    return { kind: "authorized", user: { id: data.user.id, email: data.user.email || "Administrator" }, role: membership.data.role };
  } catch { return { kind: "unavailable" }; }
}
