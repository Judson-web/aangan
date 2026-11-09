interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  TURNSTILE_SECRET_KEY: string;
  DB: D1Database;
  RESEND_API_KEY?: string;
  AUTH_FROM_EMAIL?: string;
  SESSION_SECRET?: string;
  ADMIN_EMAILS?: string;
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

const AUTH_COOKIE = "thrilokha_session";
const AUTH_TTL = 60 * 60 * 24 * 30;
const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
async function digest(value: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }
function cookieValue(request: Request, name: string) {
  return (request.headers.get("Cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="))?.slice(name.length + 1) ?? "";
}
async function currentUser(request: Request, env: Env) {
  const token = cookieValue(request, AUTH_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare("SELECT p.id,p.email,p.display_name,p.role FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash, Math.floor(Date.now()/1000)).first<{id:string;email:string;display_name:string;role:string}>();
  return row ?? null;
}
function authCookie(token: string, maxAge = AUTH_TTL) {
  return `${AUTH_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
async function sendLoginCode(email: string, code: string, env: Env) {
  if (!env.RESEND_API_KEY || !env.AUTH_FROM_EMAIL) throw new Error("Email sign-in is not configured yet. The store administrator must configure the verified sender address and email provider.");
  const response = await fetch("https://api.resend.com/emails", {method:"POST",headers:{"Authorization":`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.AUTH_FROM_EMAIL,to:[email],subject:"Your Thrilokha Shilpa sign-in code",html:`<div style="font-family:Georgia,serif;color:#292b24"><p style="letter-spacing:3px">THRILOKHA SHILPA</p><h1 style="font-weight:400">Your sign-in code</h1><p style="font-size:32px;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`})});
  if (!response.ok) throw new Error("We could not send your sign-in email. Please try again later.");
}
async function api(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/human-status" || url.pathname === "/api/verify-human") return null;
  const method = request.method;
  if (method === "OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":url.origin,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"}});
  const user = await currentUser(request,env);
  const body = async () => await request.json() as Record<string, unknown>;
  if (url.pathname === "/api/auth/me" && method === "GET") return json({user});
  if (url.pathname === "/api/auth/request-code" && method === "POST") {
    const data=await body(); const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return json({error:"Enter a valid email address."},400);
    const recent=await env.DB.prepare("SELECT created_at FROM auth_codes WHERE email=?").bind(email).first<{created_at:number}>();
    if (recent && Date.now()/1000-recent.created_at<60) return json({error:"Please wait a minute before requesting another code."},429);
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
    const codeHash=await digest(code+ (env.SESSION_SECRET??env.TURNSTILE_SECRET_KEY));
    await env.DB.prepare("INSERT INTO auth_codes(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at").bind(email,codeHash,Math.floor(Date.now()/1000)+600,Math.floor(Date.now()/1000)).run();
    try { await sendLoginCode(email,code,env); } catch(e) { return json({error:e instanceof Error?e.message:"Email service unavailable."},503); }
    return json({sent:true});
  }
  if (url.pathname === "/api/auth/verify-code" && method === "POST") {
    const data=await body(); const email=typeof data.email==="string"?data.email.trim().toLowerCase():""; const code=typeof data.code==="string"?data.code.trim():"";
    const record=await env.DB.prepare("SELECT code_hash,expires_at,attempts FROM auth_codes WHERE email=?").bind(email).first<{code_hash:string;expires_at:number;attempts:number}>();
    if (!record || record.expires_at<Math.floor(Date.now()/1000) || record.attempts>=5 || !/^\d{6}$/.test(code) || await digest(code+(env.SESSION_SECRET??env.TURNSTILE_SECRET_KEY))!==record.code_hash) {
      if(record) await env.DB.prepare("UPDATE auth_codes SET attempts=attempts+1 WHERE email=?").bind(email).run();
      return json({error:"That code is invalid or expired. Request a fresh one and try again."},400);
    }
    await env.DB.prepare("DELETE FROM auth_codes WHERE email=?").bind(email).run();
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO profiles(id,email,display_name) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING").bind(id,email,typeof data.name==="string"?data.name.trim().slice(0,80):"").run();
    const adminEmails=(env.ADMIN_EMAILS??"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
    if(adminEmails.includes(email)) await env.DB.prepare("UPDATE profiles SET role='admin',updated_at=CURRENT_TIMESTAMP WHERE email=?").bind(email).run();
    const profile=await env.DB.prepare("SELECT id,email,display_name,role FROM profiles WHERE email=?").bind(email).first<{id:string;email:string;display_name:string;role:string}>();
    if(!profile) return json({error:"Account could not be created."},500);
    const token=crypto.randomUUID()+crypto.randomUUID(); const expires=Math.floor(Date.now()/1000)+AUTH_TTL;
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await digest(token),profile.id,expires,Math.floor(Date.now()/1000)).run();
    return json({user:profile},200,{"Set-Cookie":authCookie(token)});
  }
  if (url.pathname === "/api/auth/logout" && method === "POST") {
    const token=cookieValue(request,AUTH_COOKIE); if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"Set-Cookie":authCookie("",0)});
  }
  if(url.pathname==="/api/profile" && method==="PUT"){
    if(!user) return json({error:"Sign in to update your profile."},401);
    const d=await body(); const displayName=typeof d.displayName==="string"?d.displayName.trim().slice(0,80):"";
    await env.DB.prepare("UPDATE profiles SET display_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(displayName,user.id).run();
    return json({user:{...user,display_name:displayName}});
  }
  if (url.pathname === "/api/products" && method === "GET") {
    const result=await env.DB.prepare("SELECT id,slug,name,description,category,price,compare_at_price,image_url,stock FROM products WHERE active=1 ORDER BY created_at DESC").all();
    return json({products:result.results});
  }
  if (url.pathname.startsWith("/api/admin/")) {
    if(!user || user.role!=="admin") return json({error:"Administrator access required."},403);
    if(url.pathname==="/api/admin/products" && method==="GET"){
      const result=await env.DB.prepare("SELECT id,slug,name,description,category,price,compare_at_price,image_url,stock,active,created_at,updated_at FROM products ORDER BY created_at DESC").all();
      return json({products:result.results});
    }
    if(url.pathname==="/api/admin/coupons" && method==="GET"){
      const result=await env.DB.prepare("SELECT id,code,discount_type,discount_value,min_order_value,max_uses,used_count,starts_at,expires_at,active,created_at FROM coupons ORDER BY created_at DESC").all();
      return json({coupons:result.results});
    }
    if(url.pathname==="/api/admin/media" && method==="POST"){
      const contentLength=Number(request.headers.get("Content-Length")??0);
      if(contentLength>1200000) return json({error:"Image uploads are limited to 1 MB."},413);
      let form:FormData; try { form=await request.formData(); } catch { return json({error:"Upload a valid image file."},400); }
      const file=form.get("file");
      if(!(file instanceof File)) return json({error:"Choose an image to upload."},400);
      const allowed=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
      if(!allowed.has(file.type)) return json({error:"Use a JPG, PNG, WebP or AVIF image."},415);
      if(file.size<1 || file.size>1048576) return json({error:"Images must be 1 MB or smaller. Resize or compress the image and try again."},413);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO product_media(id,mime_type,data,byte_size) VALUES(?,?,?,?)").bind(id,file.type,new Uint8Array(await file.arrayBuffer()),file.size).run();
      await env.DB.prepare("INSERT INTO admin_events(id,admin_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,"uploaded","media",id).run();
      return json({id,url:"/media/"+id},201);
    }
    if(url.pathname==="/api/admin/stats" && method==="GET"){
      const [productsCount,customers,orders,coupons,activity]=await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM profiles WHERE role='customer'").first(),
        env.DB.prepare("SELECT 0 AS count").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM coupons WHERE active=1").first(),
        env.DB.prepare("SELECT action,entity_type,created_at FROM admin_events ORDER BY created_at DESC LIMIT 8").all()
      ]);
      return json({products:productsCount?.count??0,customers:customers?.count??0,orders:0,revenue:0,paymentsEnabled:false,activeCoupons:coupons?.count??0,recentActivity:activity.results});
    }
    if(url.pathname==="/api/admin/products" && method==="POST"){
      const d=await body(); const id=crypto.randomUUID(); const name=String(d.name??"").trim(); const price=Number(d.price);
      if(!name || !Number.isSafeInteger(price) || price<0) return json({error:"Product name and a valid price are required."},400);
      const slug=String(d.slug??name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).slice(0,120);
      await env.DB.prepare("INSERT INTO products(id,slug,name,description,category,price,compare_at_price,image_url,stock) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,slug,name,String(d.description??""),String(d.category??"General"),price,Number.isSafeInteger(Number(d.compareAtPrice))?Number(d.compareAtPrice):null,String(d.imageUrl??""),Math.max(0,Math.min(100000,Number(d.stock??0)))).run();
      await env.DB.prepare("INSERT INTO admin_events(id,admin_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,"created","product",id).run();
      return json({id},201);
    }
    if(url.pathname.startsWith("/api/admin/products/") && method==="PUT"){
      const id=decodeURIComponent(url.pathname.split("/").pop()??""); const d=await body(); const price=Number(d.price);
      if(!String(d.name??"").trim() || !Number.isSafeInteger(price) || price<0) return json({error:"Product name and a valid price are required."},400);
      await env.DB.prepare("UPDATE products SET name=?,description=?,category=?,price=?,compare_at_price=?,image_url=?,stock=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(d.name),String(d.description??""),String(d.category??"General"),price,Number.isSafeInteger(Number(d.compareAtPrice))?Number(d.compareAtPrice):null,String(d.imageUrl??""),Math.max(0,Math.min(100000,Number(d.stock??0))),d.active===false?0:1,id).run();
      await env.DB.prepare("INSERT INTO admin_events(id,admin_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,"updated","product",id).run();
      return json({ok:true});
    }
    if(url.pathname.startsWith("/api/admin/coupons/") && method==="PUT"){
      const id=decodeURIComponent(url.pathname.split("/").pop()??"");
      const d=await body();
      await env.DB.prepare("UPDATE coupons SET active=?,discount_type=?,discount_value=?,min_order_value=?,max_uses=?,expires_at=? WHERE id=?").bind(d.active===false?0:1,d.discountType==="fixed"?"fixed":"percent",Math.max(1,Number(d.discountValue??1)),Math.max(0,Number(d.minimumOrder??0)),Number.isSafeInteger(Number(d.maxUses))?Number(d.maxUses):null,typeof d.expiresAt==="string"?d.expiresAt:null,id).run();
      await env.DB.prepare("INSERT INTO admin_events(id,admin_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,"updated","coupon",id).run();
      return json({ok:true});
    }
    if(url.pathname==="/api/admin/coupons" && method==="POST"){
      const d=await body(); const code=String(d.code??"").trim().toUpperCase(); const type=d.discountType==="fixed"?"fixed":"percent"; const value=Number(d.discountValue);
      if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!Number.isSafeInteger(value)||value<=0||(type==="percent"&&value>100)) return json({error:"Enter a valid coupon and discount."},400);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO coupons(id,code,discount_type,discount_value,min_order_value,max_uses,expires_at) VALUES(?,?,?,?,?,?,?)").bind(id,code,type,value,Math.max(0,Number(d.minimumOrder??0)),Number.isSafeInteger(Number(d.maxUses))?Number(d.maxUses):null,typeof d.expiresAt==="string"?d.expiresAt:null).run();
      await env.DB.prepare("INSERT INTO admin_events(id,admin_user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),user.id,"created","coupon",id).run();
      return json({id},201);
    }
    return json({error:"Not found"},404);
  }
  if(url.pathname==="/api/cart" && method==="GET") {
    if(!user) return json({items:[],guest:true});
    const result=await env.DB.prepare("SELECT product_id AS productId,quantity FROM cart_items WHERE user_id=?").bind(user.id).all();
    return json({items:result.results});
  }
  if(url.pathname==="/api/cart" && method==="PUT") {
    if(!user) return json({error:"Sign in to sync your bag across devices."},401);
    const d=await body(); const items=Array.isArray(d.items)?d.items.slice(0,100):[];
    const stmts=[env.DB.prepare("DELETE FROM cart_items WHERE user_id=?").bind(user.id)];
    for(const item of items){if(typeof item.productId==="string"&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=99) stmts.push(env.DB.prepare("INSERT INTO cart_items(user_id,product_id,quantity) VALUES(?,?,?)").bind(user.id,item.productId,item.quantity));}
    await env.DB.batch(stmts); return json({ok:true});
  }
  if(url.pathname==="/api/wishlist" && method==="GET") {
    if(!user) return json({items:[],guest:true});
    const result=await env.DB.prepare("SELECT product_id AS productId FROM wishlist_items WHERE user_id=?").bind(user.id).all();
    return json({items:result.results});
  }
  if(url.pathname==="/api/wishlist" && method==="PUT") {
    if(!user) return json({error:"Sign in to sync saved pieces across devices."},401);
    const d=await body(); const items=Array.isArray(d.items)?d.items.slice(0,200):[];
    const stmts=[env.DB.prepare("DELETE FROM wishlist_items WHERE user_id=?").bind(user.id)];
    for(const item of items){if(typeof item==="string") stmts.push(env.DB.prepare("INSERT INTO wishlist_items(user_id,product_id) VALUES(?,?)").bind(user.id,item));}
    await env.DB.batch(stmts); return json({ok:true});
  }
  return json({error:"Not found"},404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if(url.pathname.startsWith("/media/") && request.method==="GET"){
      const id=decodeURIComponent(url.pathname.slice("/media/".length));
      if(!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found",{status:404});
      const media=await env.DB.prepare("SELECT mime_type,data FROM product_media WHERE id=?").bind(id).first<{mime_type:string;data:ArrayBuffer}>();
      if(!media) return new Response("Not found",{status:404});
      return new Response(media.data,{headers:{"Content-Type":media.mime_type,"Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"}});
    }
    const apiResponse = await api(request, env, url);
    if (apiResponse) return apiResponse;
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
