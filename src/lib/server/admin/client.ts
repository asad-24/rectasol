import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminCookieName, adminCookieOptions, getAdminConfig } from "@/lib/server/admin/config";

export async function createAdminClient(writable = false) {
  const config = getAdminConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { name: adminCookieName, ...adminCookieOptions },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        // Proxy refreshes read-only render requests; actions must persist changes.
        if (writable) values.forEach(({name,value,options}) => jar.set(name,value,{...options,...adminCookieOptions}));
      },
    },
  });
}

export async function clearAdminCookies() {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name === adminCookieName || name.startsWith(adminCookieName + ".")) {
      jar.set(name, "", { ...adminCookieOptions, maxAge: 0 });
    }
  }
}
