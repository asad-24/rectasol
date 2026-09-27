import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin/guard";
import { identifierSchema } from "@/lib/admin/validation";

export async function getInquiryEmailStatus(id: string) {
  const { client } = await requireAdmin();
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
