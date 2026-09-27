import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

async function hasEmptyBody(request: Request): Promise<boolean> {
  if (request.signal.aborted || request.bodyUsed) return false;
  if (request.body === null) return true;

  // Read bytes directly: no cloning, decoding or accumulated payload buffers.
  // getReader can throw for a locked stream; the handler sanitizes that too.
  const reader = request.body.getReader();
  let stop = () => {};
  const interrupted = new Promise<false>(resolve => { stop = () => resolve(false); });
  const timer = setTimeout(stop, 1000);
  request.signal.addEventListener("abort", stop, { once: true });
  try {
    if (request.signal.aborted) return false;
    const read = async () => {
      // Bound even synchronous empty chunks, which could otherwise starve timers.
      for (let chunks = 0; chunks < 16; chunks++) {
        const { done, value } = await reader.read();
        if (request.signal.aborted) return false;
        if (done) return true;
        if (!(value instanceof Uint8Array) || value.byteLength !== 0) return false;
      }
      return false;
    };
    return await Promise.race([read(), interrupted]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", stop);
    // Cancellation itself can stall or fail. Never wait for the sender to finish.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createEmailHandler(secret: () => string, run: () => Promise<unknown>) {
  return async (request: Request) => {
    const respond = (status: number, message: string) => Response.json({ message }, {
      status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
    let expected;
    try { expected = secret(); } catch { return respond(503, "Email processing unavailable."); }
    const authorization = request.headers.get("authorization") || "";
    if (authorization.length > 256 || !timingSafeEqual(
      createHash("sha256").update(authorization).digest(),
      createHash("sha256").update(`Bearer ${expected}`).digest(),
    )) return respond(401, "Unauthorized.");
    // No job IDs, recipients, templates, query parameters or request body accepted.
    if (request.method !== "POST" || new URL(request.url).search) {
      return respond(400, "An empty POST request is required.");
    }
    try {
      if (!await hasEmptyBody(request)) return respond(400, "An empty POST request is required.");
    } catch { return respond(400, "An empty POST request is required."); }
    try { await run(); return respond(200, "Processing completed."); }
    catch { return respond(503, "Email processing unavailable."); }
  };
}
