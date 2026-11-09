# Thrilokha Shilpa

Thrilokha Shilpa is an editorial Indian craft and lifestyle marketplace. It pairs a familiar, easy-to-shop commerce structure with an art-directed visual identity: warm earthy colours, tactile textures, expressive Bodoni-inspired typography and maker-led photography.

## Storefront experience

- **Multi-page routing:** Home, Shop, category collections, individual product pages, saved pieces, shopping bag, Journal, Our Story and Help.
- **Commerce discovery:** category navigation, catalogue search, sorting, product detail pages and quick add-to-bag actions.
- **Saved pieces and bag:** guest data stays in the browser; signed-in cart and wishlist data sync to Cloudflare D1 across devices, with quantity controls and subtotal summary.
- **Editorial storytelling:** photographic collection stories, craft notes and maker-led brand pages.
- **Responsive navigation:** desktop category ribbon, mobile navigation dock, menu drawer and search.
- **Human verification:** Cloudflare Turnstile managed challenge enforced at the Worker document boundary. The Worker verifies Siteverify success and the expected hostname, then issues a signed, HttpOnly, Secure, SameSite cookie that remembers a successful verification for 30 days. Unverified document requests receive the challenge page before the storefront HTML is served.

The storefront does not seed fake products, prices, orders or customer activity. The catalogue starts empty and is populated by an administrator. Product records, customer profiles, email verification codes, sessions, cart lines, wishlists, coupons, admin audit events and uploaded product images are persisted in Cloudflare D1. Uploaded images are limited to 1 MB each while the account's R2 service remains disabled; enable R2 before accepting a large image catalogue. Checkout is intentionally a preview only: no payment is taken, and orders, revenue, fulfilment and shipping workflows are not represented as live.

## Design direction

The storefront uses the existing warm neutral, olive and natural-texture palette, with a more dramatic editorial serif inspired by fashion-magazine typography. The layout borrows familiar shopping conventions from large marketplaces without copying their branding or exact interface.

## Stack

- React 19 and TypeScript (strict)
- Vite
- Cloudflare Workers and Workers Static Assets
- Cloudflare Turnstile
- Lucide React

## Getting started

Requires a current Node.js LTS release.

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Cloudflare configuration

The production Worker is named `aangan` and serves the storefront at `https://aangan.ks-redeemer.workers.dev`.

1. In Cloudflare, open **Turnstile** and confirm the widget named **Thrilokha Shilpa storefront human verification**. Its allowed hostname is `aangan.ks-redeemer.workers.dev`, and its mode is Managed.
2. Add the widget's secret key to the `aangan` Worker as a secret named `TURNSTILE_SECRET_KEY`. Do not put the secret in source control or a `VITE_*` variable.
3. The public site key is configured in `src/App.tsx`. If the widget is ever recreated, update `TURNSTILE_SITE_KEY` there with its new public site key.
4. Production deploys are handled by the connected Cloudflare Workers Builds pipeline on pushes to `main`. The Worker intercepts browser document requests before serving the storefront. Visitors without a valid signed session receive a Cloudflare Turnstile managed challenge. The Worker verifies each token against Cloudflare Siteverify, checks the expected hostname, and issues a signed 30-day HttpOnly cookie. The browser cannot mint or edit this cookie. Static asset requests remain cacheable and do not need a separate challenge.

To add the Worker secret with Wrangler:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste the Turnstile secret when prompted. The Worker also needs the `ASSETS` binding configured in `wrangler.jsonc`; it is already declared in this repository.

Cloudflare Workers Builds watches the repository's `main` branch and runs `npm run build` followed by `npx wrangler deploy` using its Cloudflare-managed build token. Pull-request preview deployments are disabled for this production Worker.

## Project structure

- `src/App.tsx`: routed storefront, catalogue interactions and verification UI.
- `src/catalog.ts`: illustrative categories and products.
- `src/worker.ts`: server-enforced Turnstile gate, email-code authentication, HttpOnly sessions, role-checked admin APIs, Cloudflare D1 persistence and product media delivery.
- `src/styles.css`: responsive visual system.
- `wrangler.jsonc`: Worker entry point and static asset binding.
- `.github/workflows/`: CI and production deployment.

## Commerce backend setup

The production Worker is bound to the Cloudflare D1 database `thrilokha-commerce`. Its schema includes products, profiles, email verification codes, sessions, cart items, wishlist items, coupons, admin audit events and product media. The catalogue intentionally starts empty.

Configure these Worker secrets before enabling customer sign-in and administrator access:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put AUTH_FROM_EMAIL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_EMAILS
```

`AUTH_FROM_EMAIL` must be a sender address verified by the Resend account. `SESSION_SECRET` should be a long random secret. `ADMIN_EMAILS` is a comma-separated server-side allowlist of email addresses that receive the administrator role when they verify their email. It is never editable from the customer-facing app. Existing roles can also be granted directly in D1 by the owner. Never add administrator role controls to a public profile form.

The private `/admin` route is only a user interface boundary. Every admin API independently checks the authenticated session and database role before reading or changing store data. The dashboard refreshes product, customer, coupon and audit statistics every 30 seconds. Orders and revenue are explicitly shown as unavailable until a payment provider and order pipeline are implemented.

Product image uploads currently use a bounded D1 BLOB table because R2 has not been enabled on this Cloudflare account. The upload API accepts JPG, PNG, WebP and AVIF up to 1 MB. For a production-scale media library, enable R2 in the Cloudflare dashboard, create a bucket, and bind it to the Worker before increasing upload limits.

## Launch scope

Before accepting real orders, connect authoritative product and inventory data, customer identity, checkout and payment processing, order management, shipping fulfilment, returns and newsletter delivery.

---

Craft · Culture · Consideration.
