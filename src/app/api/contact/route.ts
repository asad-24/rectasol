import { createContactHandler } from "@/lib/server/contact-handler";
import { saveInquiry } from "@/lib/server/inquiries";
import { SITE_URL } from "@/lib/site-url";

export const runtime = "nodejs";
export const POST = createContactHandler(saveInquiry, SITE_URL);
