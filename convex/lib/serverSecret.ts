import { ConvexError } from "convex/values";

/**
 * Gate for functions only our Next.js server may call (MOS-87).
 *
 * Public Convex functions are reachable by anyone holding NEXT_PUBLIC_CONVEX_URL,
 * so "only the webhook calls this" is not a protection. The server passes a
 * secret shared through the CONVEX_SERVER_SECRET env var on both sides.
 */
export function assertServerSecret(secret: string): void {
  const expected = process.env.CONVEX_SERVER_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Server-only function." });
  }
}
