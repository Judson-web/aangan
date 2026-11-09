interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  TURNSTILE_SECRET_KEY: string;
}
const COOKIE_NAME = "thrilokha_human";
const SESSION_TTL = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function signingKey(secret: string) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode("thrilokha-shilpa"), info: encoder.encode("human-verification-session-v1") }, material, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]);
}
async function createSession(secret: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = String(expires);
  const key = await signingKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}
async function validSession(request: Request, secret: string) {
  const cookie = request.headers.get("Cookie") ?? "";
  const raw = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;
  const [payload, signature, extra] = raw.split(".");
  if (!payload || !signature || extra || !/^\d+$/.test(payload) || Number(payload) <= Math.floor(Date.now() / 1000)) return false;
  try {
    const key = await signingKey(secret);
    return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
  } catch { return false; }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/human-status" && request.method === "GET") {
      return json({ verified: await validSession(request, env.TURNSTILE_SECRET_KEY) });
    }
    if (url.pathname === "/api/verify-human" && request.method === "POST") {
      const contentType = request.headers.get("Content-Type") ?? "";
      if (!contentType.includes("application/json")) return json({ verified: false, error: "Invalid request." }, 415);
      let body: { token?: unknown };
      try { body = await request.json() as { token?: unknown }; } catch { return json({ verified: false, error: "Invalid request." }, 400); }
      if (typeof body.token !== "string" || body.token.length < 10 || body.token.length > 4096) return json({ verified: false, error: "Please complete the verification challenge." }, 400);
      const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: body.token });
      const clientIp = request.headers.get("CF-Connecting-IP");
      if (clientIp) form.set("remoteip", clientIp);
      let verification: { success?: boolean };
      try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
        verification = await response.json() as { success?: boolean };
      } catch { return json({ verified: false, error: "Verification service temporarily unavailable." }, 502); }
      if (!verification.success) return json({ verified: false, error: "Cloudflare could not verify this attempt. Please try again." }, 403);
      const session = await createSession(env.TURNSTILE_SECRET_KEY);
      return json({ verified: true }, 200, { "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax` });
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
