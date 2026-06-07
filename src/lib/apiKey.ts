/**
 * Lightweight write-protection for the public REST write endpoints used by the
 * BurgerGo MCP. When `BURGERGO_API_KEY` is set in the server env, those writes
 * require a matching `x-api-key` header; when it is unset the endpoints stay
 * open — matching the app's deliberate no-auth posture for everything else.
 * Reads are always public.
 */
export function isWriteAuthorized(req: Request): boolean {
  const key = process.env.BURGERGO_API_KEY;
  if (!key) return true; // no key configured → open
  return req.headers.get('x-api-key') === key;
}
