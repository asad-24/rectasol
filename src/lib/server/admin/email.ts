import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin/guard";
import { hasCurrentCapability } from "@/lib/server/admin/permissions";
import { identifierSchema } from "@/lib/admin/validation";
import type { PermissionGrant } from "@/lib/admin/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

const clientsReadAll: PermissionGrant = { capability: "clients.read", scope: "all" };

async function ensureCanReadInquiries(client: SupabaseClient, isOwner: boolean) {
  if (isOwner) return;
  const allowed = await hasCurrentCapability(client, clientsReadAll);
  if (!allowed) throw new Error("Email delivery status unavailable.");
}

export async function getInquiryEmailStatus(id: string) {
  const { client, isOwner } = await requireAdmin();
  await ensureCanReadInquiries(client, isOwner);
  if (!identifierSchema.safeParse(id).success) return [];
  const { data, error } = await client.from("email_outbox")
    .select("kind,status,attempts,sent_at").eq("inquiry_id", id).order("kind");
  if (error) throw new Error("Email delivery status unavailable.");
  return z.array(z.object({
    kind: z.enum(["inquiry_client_v1", "inquiry_admin_v1"]),
    status: z.enum(["pending", "processing", "sent", "failed"]),
    attempts: z.number().int().min(0).max(6), sent_at: z.string().nullable(),
  })).max(2).parse(data);
}
