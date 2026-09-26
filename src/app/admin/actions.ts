"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, clearAdminCookies } from "@/lib/server/admin/client";
import { authenticateAdmin, changeInquiryStatus } from "@/lib/server/admin/operations";
import { readActionFields, type AdminFeedback } from "@/lib/admin/validation";
import { SITE_URL } from "@/lib/site-url";

async function validOrigin() {
  return (await headers()).get("origin") === SITE_URL;
}

export async function loginAction(_previous: AdminFeedback, form: FormData): Promise<AdminFeedback> {
  if (!await validOrigin()) return { ok: false, message: "Please sign in from this website." };
  let result: AdminFeedback;
  try {
    const client = await createAdminClient(true);
    result = await authenticateAdmin(client, readActionFields(form));
    if (!result.ok) await clearAdminCookies();
  } catch {
    await clearAdminCookies();
    return { ok: false, message: "Sign-in is temporarily unavailable. Please try again." };
  }
  if (result.ok) redirect("/admin");
  return result;
}

export async function logoutAction() {
  if (!await validOrigin()) return;
  try { await (await createAdminClient(true)).auth.signOut({ scope: "local" }); }
  catch { /* Always clear this device's cookies, even if Auth is unavailable. */ }
  await clearAdminCookies();
  redirect("/admin/login");
}

export async function statusAction(_previous: AdminFeedback, form: FormData): Promise<AdminFeedback> {
  if (!await validOrigin()) return { ok: false, message: "Please submit changes from this website." };
  let result: AdminFeedback;
  try { result = await changeInquiryStatus(await createAdminClient(true), readActionFields(form)); }
  catch { result = { ok: false, message: "The service is temporarily unavailable. Please try again." }; }
  // Also refresh conflicts/timeouts so the UI can recover a transaction that committed.
  revalidatePath("/admin", "layout");
  return result;
}
