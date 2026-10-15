import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/server/admin/client";
import { getCurrentCapabilities } from "@/lib/server/admin/access";

// React cache deduplicates only within one server render, not across users/requests.
export const requireAdmin = cache(async () => {
  const client = await createAdminClient().catch(() => null);
  if (!client) redirect("/admin/login?state=unavailable");
  const access = await getCurrentCapabilities(client);
  if (access.kind === "unauthenticated") redirect("/admin/login");
  if (access.kind === "forbidden") redirect("/admin/access-denied");
  if (access.kind !== "authorized") redirect("/admin/login?state=unavailable");
  const hasWorkspace = access.isOwner || access.grants.some(g => g.capability === "workspace.access" && g.scope === "all");
  if (!hasWorkspace) redirect("/admin/access-denied");
  return { client, ...access };
});
