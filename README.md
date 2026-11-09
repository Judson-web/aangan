# Aangan

Aangan is an editorial, craft-led shopping experience celebrating thoughtful objects, independent makers and contemporary Indian design.

The storefront combines a warm, image-rich visual identity with familiar modern commerce patterns: clear discovery paths, curated collections, product cards, saved pieces and a persistent shopping bag.

## Experience

- **Editorial discovery:** large photographic stories introduce collections and guide shoppers into curated categories.
- **Shop by category:** browse Home, Wear, Jewellery and Art.
- **Product discovery:** search by product, maker, category or origin; filter collections and sort by featured, price or name.
- **Product details:** view descriptions, materials, maker and place of origin.
- **Wishlist:** save and revisit favourite pieces.
- **Shopping bag:** add products, adjust quantities, remove items and see the subtotal and complimentary-shipping progress.
- **Responsive navigation:** desktop navigation, mobile quick-navigation dock, search and slide-in shopping bag.
- **Maker-led storytelling:** editorial content and brand notes foreground craft and the people behind each piece.

The current catalogue and product imagery are illustrative. Cart and wishlist state are stored locally in the shopper's browser. Checkout is a preview only: payments, inventory, customer accounts, order management and newsletter delivery are not connected to a commerce backend.

## Design direction

Aangan uses an earthy, editorial art direction: warm neutrals, olive accents, expressive serif typography, generous whitespace and photography-led layouts. The experience is designed to feel like a curated lifestyle marketplace rather than a plain product grid, while keeping shopping actions easy to find.

## Stack

- React 19
- TypeScript (strict)
- Vite
- Lucide React
- Responsive CSS

## Getting started

Requires a current Node.js LTS release.

```bash
npm install
npm run dev
```

## Quality checks

Run the same checks used by GitHub Actions before submitting changes:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Production deployment

Aangan is deployed as the `aangan` Cloudflare Worker on the permanent account's `workers.dev` hostname.

GitHub Actions runs the quality checks and deploys the production Worker on pushes to `main`. The deployment workflow uses Wrangler and the repository Actions secret `CLOUDFLARE_API_TOKEN`. The token should be scoped to the Aangan Worker with the minimum required Workers edit permissions. Temporary Cloudflare deployments are not used for production.

To deploy manually after authenticating Wrangler with the appropriate Cloudflare account:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npx wrangler deploy
```

## Project structure

- `src/App.tsx`: storefront layout, discovery interactions, product details, wishlist and bag.
- `src/catalog.ts`: illustrative category and product catalogue.
- `src/styles.css`: responsive visual system and component styling.
- `wrangler.jsonc`: Cloudflare Worker and static asset configuration.
- `.github/workflows/`: CI and production deployment workflows.

## Scope and next steps

This repository currently delivers the storefront experience and client-side shopping interactions. A production commerce launch still needs a backend for authoritative catalogue and inventory data, checkout and payment processing, order management, customer identity, and newsletter subscriptions. Those services should be integrated before accepting real orders.

---

Made with meaning, in India.
