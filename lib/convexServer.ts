/** The shared secret for server-only Convex functions (MOS-87). Server code only. */
export function serverSecret(): string {
  const s = process.env.CONVEX_SERVER_SECRET;
  if (!s) throw new Error("CONVEX_SERVER_SECRET is not set");
  return s;
}
