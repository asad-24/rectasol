import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, adminCookieOptions, getAdminConfig } from "@/lib/server/admin/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const { url, key } = getAdminConfig();
    const client = createServerClient(url, key, {
      cookieOptions: { name: adminCookieName, ...adminCookieOptions },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({name,value}) => request.cookies.set(name,value));
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          values.forEach(({name,value,options}) => response.cookies.set(name,value,{...options,...adminCookieOptions}));
        },
      },
    });
    await client.auth.getClaims();
  } catch {
    // Fail closed in the page/data/action guards. Never log session material.
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
