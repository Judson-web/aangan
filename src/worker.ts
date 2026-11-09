interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  TURNSTILE_SECRET_KEY: string;
}
const COOKIE_NAME = "thrilokha_human";
const SESSION_TTL = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const SITE_KEY = "0x4AAAAAAF5jPBnSE5tW7V28";
const EXPECTED_HOSTNAME = "aangan.ks-redeemer.workers.dev";

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
    return await crypto.subtle.verify("HMAC", await signingKey(secret), fromBase64Url(signature), encoder.encode(payload));
  } catch { return false; }
}
function challengePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f4ed"><title>One moment · Thrilokha Shilpa</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#e9e2d3,#f7f4ed 58%);color:#25271f;font-family:'DM Sans',sans-serif}.card{width:min(490px,100%);padding:44px 34px;text-align:center;background:#fbf9f3;border:1px solid #ded8ca;box-shadow:0 25px 90px #292b2412}.mark{font:500 17px 'Bodoni Moda',Georgia,serif;letter-spacing:.16em}.mark small{display:block;font:8px 'DM Sans',sans-serif;letter-spacing:.2em;margin-top:7px;color:#77776d}.art{height:88px;background:#e9e3d6;display:grid;place-content:center;margin:32px 0 25px;color:#74785a}.art b{font:38px Georgia}.art span{font-size:8px;letter-spacing:.2em}.eyebrow{font-size:9px;letter-spacing:.19em;color:#74785a}.title{font:400 clamp(38px,9vw,49px)/1.05 'Bodoni Moda',Georgia,serif;letter-spacing:-.04em;margin:17px 0}.title em{color:#62684d}.copy{font-size:11px;line-height:1.9;color:#77776d;max-width:350px;margin:0 auto}.widget{display:flex;justify-content:center;margin:26px auto 13px;min-height:66px}.error{min-height:18px;font-size:10px;color:#9c463b}.foot{font-size:9px;color:#888678;line-height:1.7}@media(max-width:420px){.card{padding:30px 16px}}</style></head><body><main class="card"><div class="mark">THRILOKHA <span style="font-size:10px;letter-spacing:.3em">SHILPA</span><small>THE ART OF LIVING BEAUTIFULLY</small></div><div class="art"><b>✳</b><span>CRAFTED WITH INTENTION</span></div><div class="eyebrow">A QUICK HUMAN CHECK</div><h1 class="title">A moment before<br><em>the beautiful things.</em></h1><p class="copy">Help us keep this little marketplace welcoming for real people. Complete Cloudflare's secure check to continue.</p><div class="widget"><div class="cf-turnstile" data-sitekey="${SITE_KEY}" data-theme="light" data-callback="onHumanVerified" data-error-callback="onHumanError" data-expired-callback="onHumanExpired"></div></div><div id="error" class="error" role="alert"></div><div class="foot">Your successful verification is remembered securely on this browser for 30 days.</div></main><script>function message(value){document.getElementById('error').textContent=value}async function onHumanVerified(token){message('');try{const response=await fetch('/api/verify-human',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok||!result.verified)throw new Error(result.error||'Verification could not be completed.');location.reload()}catch(error){message(error instanceof Error?error.message:'Please try verification again.')}}function onHumanError(){message('The secure check could not load. Please refresh and try again.')}function onHumanExpired(){message('The challenge expired. Please verify again.')}</script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Content-Type-Options": "nosniff" } });
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
      let verification: { success?: boolean; hostname?: string };
      try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
        verification = await response.json() as { success?: boolean; hostname?: string };
      } catch { return json({ verified: false, error: "Verification service temporarily unavailable." }, 502); }
      if (!verification.success || verification.hostname !== EXPECTED_HOSTNAME) return json({ verified: false, error: "Cloudflare could not verify this attempt. Please try again." }, 403);
      const session = await createSession(env.TURNSTILE_SECRET_KEY);
      return json({ verified: true }, 200, { "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax` });
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    const acceptsHtml = request.method === "GET" && (request.headers.get("Accept") ?? "").includes("text/html");
    if (acceptsHtml && !(await validSession(request, env.TURNSTILE_SECRET_KEY))) return challengePage();
    return env.ASSETS.fetch(request);
  },
};
