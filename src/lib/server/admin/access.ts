import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAccess =
  | { kind: "authorized"; user: { id: string; email: string }; role: "admin" | "super_admin" }
  | { kind: "unauthenticated" | "forbidden" | "unavailable" };

export async function getAdminAccess(client: SupabaseClient): Promise<AdminAccess> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error && (!error.status || error.status >= 500)) return { kind: "unavailable" };
    if (error || !data.user) return { kind: "unauthenticated" };
    const membership = await client.from("admin_memberships").select("role,active").eq("user_id",data.user.id).maybeSingle();
    if (membership.error) return { kind: "unavailable" };
    if (!membership.data?.active || !["admin","super_admin"].includes(membership.data.role)) return { kind: "forbidden" };
    return { kind: "authorized", user: { id: data.user.id, email: data.user.email || "Administrator" }, role: membership.data.role };
  } catch { return { kind: "unavailable" }; }
}
