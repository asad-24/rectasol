import "server-only";
import { createInquiryClient } from "@/lib/server/supabase";
import { getSiteUrl } from "@/lib/site-url";
import { getEmailConfig } from "@/lib/server/email/config";
import { createBrevoProvider } from "@/lib/server/email/brevo";
import { processEmailDelivery, type EmailRpc } from "@/lib/server/email/processor";

export async function runEmailWorker() {
  // Missing/malformed configuration must not consume attempts or claim jobs.
  const config = getEmailConfig();
  const siteUrl = getSiteUrl();
  const client = createInquiryClient();
  const rpc: EmailRpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("Email state unavailable.");
    return data;
  };
  return processEmailDelivery(rpc, createBrevoProvider(config.apiKey), { ...config, siteUrl });
}
