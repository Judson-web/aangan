# Aangan

A considered marketplace for Indian craft, thoughtful objects and the people who make them.

## Stack
React 19 · TypeScript (strict) · Vite · Lucide · responsive CSS.

## Getting started
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

## Cloudflare production deployment

The Worker is configured for the permanent Cloudflare account and deploys as `aangan` on its `workers.dev` subdomain. GitHub Actions deploys on pushes to `main` after type-checking, linting, tests and a production build. Add a repository Actions secret named `CLOUDFLARE_API_TOKEN` with permission to edit Workers Scripts in this account before the first production deployment. The workflow deliberately does not use `wrangler deploy --temporary`.

## Included
Product discovery, category filtering, search, product details, wishlist interactions, a persistent local shopping bag, responsive navigation and newsletter form feedback.

Product catalogue content is illustrative. Checkout, payments, inventory, customer accounts and newsletter delivery require a connected commerce backend and are not represented as live services.

All application logic and configuration are authored in TypeScript. HTML and CSS remain the browser document and styling layers.