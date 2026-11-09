# Thrilokha Shilpa

Thrilokha Shilpa is an editorial Indian craft and lifestyle marketplace. It pairs a familiar, easy-to-shop commerce structure with an art-directed visual identity: warm earthy colours, tactile textures, expressive Bodoni-inspired typography and maker-led photography.

## Storefront experience

- **Multi-page routing:** Home, Shop, category collections, individual product pages, saved pieces, shopping bag, Journal, Our Story and Help.
- **Commerce discovery:** category navigation, catalogue search, sorting, product detail pages and quick add-to-bag actions.
- **Saved pieces and bag:** browser-persisted wishlist and shopping bag, quantity controls and subtotal summary.
- **Editorial storytelling:** photographic collection stories, craft notes and maker-led brand pages.
- **Responsive navigation:** desktop category ribbon, mobile navigation dock, menu drawer and search.
- **Human verification:** Cloudflare Turnstile managed challenge enforced at the Worker document boundary. The Worker verifies Siteverify success and the expected hostname, then issues a signed, HttpOnly, Secure, SameSite cookie that remembers a successful verification for 30 days. Unverified document requests receive the challenge page before the storefront HTML is served.

The current catalogue, pricing and product imagery are illustrative. Cart and wishlist are stored locally in the shopper's browser. Checkout is a preview only: payments, inventory, customer accounts, order management, shipping fulfilment and newsletter delivery are not connected to a commerce backend.

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
4. Deploy the Worker with the production GitHub Actions workflow. The Worker intercepts browser document requests before serving the storefront. Visitors without a valid signed session receive a Cloudflare Turnstile managed challenge. The Worker verifies each token against Cloudflare Siteverify, checks the expected hostname, and issues a signed 30-day HttpOnly cookie. The browser cannot mint or edit this cookie. Static asset requests remain cacheable and do not need a separate challenge.

To add the Worker secret with Wrangler:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste the Turnstile secret when prompted. The Worker also needs the `ASSETS` binding configured in `wrangler.jsonc`; it is already declared in this repository.

GitHub Actions uses the repository secret `CLOUDFLARE_API_TOKEN` for permanent production deployments. Temporary deployments are not used for production.

## Project structure

- `src/App.tsx`: routed storefront, catalogue interactions and verification UI.
- `src/catalog.ts`: illustrative categories and products.
- `src/worker.ts`: server-enforced Turnstile gate, Siteverify endpoint, signed verification session and static asset handler.
- `src/styles.css`: responsive visual system.
- `wrangler.jsonc`: Worker entry point and static asset binding.
- `.github/workflows/`: CI and production deployment.

## Launch scope

Before accepting real orders, connect authoritative product and inventory data, customer identity, checkout and payment processing, order management, shipping fulfilment, returns and newsletter delivery.

---

Craft · Culture · Consideration.
