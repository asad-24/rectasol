import { createEmailHandler } from "@/lib/server/email/handler";
import { getEmailWorkerSecret } from "@/lib/server/email/config";
import { runEmailWorker } from "@/lib/server/email/worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createEmailHandler(getEmailWorkerSecret, runEmailWorker);
