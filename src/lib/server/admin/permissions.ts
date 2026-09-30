import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isPermissionGrant, type PermissionGrant } from "@/lib/admin/permissions";

const projectionSchema = z.strictObject({
  user_id: z.string().uuid(),
  active: z.boolean(),
  is_owner: z.boolean(),
  grants: z.array(z.strictObject({ capability: z.string(), scope: z.string() })
    .refine(value => isPermissionGrant(value.capability, value.scope))).max(24),
});

export type CurrentPermissions =
  | { kind: "authorized"; userId: string; isOwner: boolean; grants: PermissionGrant[] }
  | { kind: "unauthenticated" | "forbidden" | "unavailable" };

/** Use the session-aware client, never the inquiry service-role client.
 * No cross-request cache; the database rechecks current active membership.
 * This is an entitlement snapshot, not authorization for a record mutation.
 */
export async function getCurrentPermissions(client: SupabaseClient): Promise<CurrentPermissions> {
  try {
    const { data: identity, error: authError } = await client.auth.getUser();
    if (authError) return { kind: !authError.status || authError.status >= 500 ? "unavailable" : "unauthenticated" };
    if (!identity.user) return { kind: "unauthenticated" };
    const { data, error } = await client.rpc("phase5_current_permissions");
    if (error) return { kind: "unavailable" };
    const parsed = projectionSchema.safeParse(data);
    if (!parsed.success || parsed.data.user_id !== identity.user.id) return { kind: "unavailable" };
    if (!parsed.data.active) return { kind: "forbidden" };
    return { kind: "authorized", userId: identity.user.id, isOwner: parsed.data.is_owner,
      grants: parsed.data.grants as PermissionGrant[] };
  } catch { return { kind: "unavailable" }; }
}

/** Always requires an explicit scope. Assigned scope still needs a DB record check. */
export async function hasCurrentCapability(client: SupabaseClient, required: PermissionGrant): Promise<boolean> {
  if (!isPermissionGrant(required?.capability, required?.scope)) return false;
  const access = await getCurrentPermissions(client);
  return access.kind === "authorized" && access.grants.some(grant =>
    grant.capability === required.capability && (grant.scope === required.scope || grant.scope === "all"));
}
