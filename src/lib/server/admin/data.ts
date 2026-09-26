import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin/guard";
import { statusSchema, identifierSchema, type InquiryQuery } from "@/lib/admin/validation";

const summarySchema = z.object({
  id: identifierSchema, public_reference: z.string(), name: z.string(), email: z.string(),
  company: z.string().nullable(), service: z.string(), budget: z.string().nullable(),
  timeline: z.string().nullable(), status: statusSchema, created_at: z.string(),
});
const detailSchema = summarySchema.extend({
  message: z.string(), updated_at: z.string(), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type InquirySummary = z.infer<typeof summarySchema>;
export type InquiryDetail = z.infer<typeof detailSchema>;

export async function listInquiries(query: InquiryQuery) {
  const { client } = await requireAdmin();
  const { data, error } = await client.rpc("admin_list_inquiries", { p_search: query.q, p_status: query.status, p_page: query.page });
  if (error) throw new Error("Admin inquiry data is unavailable.");
  return z.object({ total: z.number().int().nonnegative(), items: z.array(summarySchema).max(25) }).parse(data);
}

export async function getPipelineCounts() {
  const { client } = await requireAdmin();
  const { data, error } = await client.rpc("admin_inquiry_counts");
  if (error) throw new Error("Admin overview is unavailable.");
  return z.array(z.object({ status: statusSchema, total: z.number().int().nonnegative() })).parse(data);
}

export async function getInquiry(id: string) {
  const { client } = await requireAdmin();
  if (!identifierSchema.safeParse(id).success) return null;
  const { data, error } = await client.from("inquiries")
    .select("id,public_reference,name,email,company,service,budget,timeline,message,status,created_at,updated_at,revision")
    .eq("id",id).maybeSingle();
  if (error) throw new Error("Admin inquiry data is unavailable.");
  return data ? detailSchema.parse(data) : null;
}

export async function getInquiryAudit(id: string) {
  const { client } = await requireAdmin();
  if (!identifierSchema.safeParse(id).success) return [];
  const { data, error } = await client.from("admin_audit_events")
    .select("id,actor_user_id,previous_status,new_status,created_at")
    .eq("entity_type","inquiry").eq("entity_id",id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(25);
  if (error) throw new Error("Admin history is unavailable.");
  return z.array(z.object({
    id: identifierSchema, actor_user_id: identifierSchema, previous_status: statusSchema, new_status: statusSchema, created_at: z.string(),
  })).parse(data);
}
