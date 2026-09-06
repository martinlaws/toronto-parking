<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Toronto Parking

A companion site for a four-copy 3D-printed run of the sliding-car puzzle Nob Yoshigahara called Tokyo Parking. The site is the deck of cards, not a playable game: setup and par in v1, with the full solution stored per card so hints and playback are UI-only later.

The decision record is a private spec; what follows is everything a change here needs to respect.

## Decisions, not up for reopening

- **Name: Toronto Parking.** One descriptive mention of Rush Hour on the About page, credited to Yoshigahara/ThinkFun, plus the trademark line. Never in the title, domain, manifest or card headers.
- **A curated, finite, numbered deck** of 60, five tiers of 12. Not an endless generator; endless mode is issue 9.
- **Pylons are fixed 1x1 obstacles**, 15 of the 60 cards, never in the exit row right of the hero.
- **V1 shows setup and par only.** The per-card solution is stored from day one but never rendered.
- **Per-board personalization, no accounts.** Four boards, four QR codes to `/b/<code>`.
- **Public repo, private people.**

## Never commit

Recipient names, dedications and board codes. They live in the store, in the environment, or in `boards.local.json`, which is gitignored. `boards.example.json` carries placeholders. This applies to commit messages, issue comments, PR bodies and every example in this file or the README.

## The deck is generated

`data/deck.json` is the only artefact of `pnpm deck:build` and is never hand-edited. The build is deterministic: no `Math.random`, no `Date`, two runs byte-identical, sha256 `fe31aa9a478ab285b76a0d9fc39398f2b2054a5fa552e596c83a2149208d2418`. `scripts/prototype/` holds the python that defines it; where the TypeScript and the python disagree, the python is right. `rush.txt` (115 MB) is gitignored and lives beside the repo; point `RUSH_TXT` at it.

## Server and client

`src/lib/deck.ts` starts with `import 'server-only'`. Client code takes `DECK_SIZE`, tier names and bands from `src/lib/tiers.ts`, which never imports `deck.json`, so sixty solutions stay out of the browser bundle. `grep -rl '"solution"' .next/static` must return nothing after a build.

## The store prefix rule

One Upstash database serves dev, preview and production. Every key goes through `k()` in `src/lib/store.ts`, which prefixes `tp:prod:` when `VERCEL_ENV === "production"` and `tp:dev:` otherwise, unset counting as dev. `scripts/seed-boards.ts` decides the prefix from `--production` alone, set before `store.ts` is imported, so nothing in `.env.local` or the shell can flip it. Writes to `tp:prod:` are Martin's call, never an agent's.

## Stack negatives

No `output: 'export'`, no `runtime = 'edge'`, no service worker in v1, no `images` block, React Compiler off. Cache Components need the Node runtime, and so do the store and the OG image routes. Route handlers, not Server Actions, for the mirror: the client is a sync engine with an outbox and needs HTTP status codes.

One `proxy.ts`, and only the one. `src/proxy.ts` rewrites `/cards/<n>` outside 1..60 to a real 404. The spec forbids a proxy, but the bundled 16.3.4 docs overrule it on both halves of the mechanism it assumed: `dynamicParams` is rejected outright under Cache Components, and a `notFound()` that runs after the shell has streamed can no longer set a status code. Since a 404 on `/cards/61` is a non-negotiable check, the proxy is what buys it. Nothing else goes in that file: no store, no deck.

## Board geometry

Cell = 100, interior 600x600, frame band 40, margin 20, viewBox `0 0 720 720`, square in every orientation. Pieces inset 8 per side: car 184x84 `rx=22`, truck 284x84, pylon in an 84x84 box. `renderBoard()` in `src/lib/board-svg.ts` returns a string built from template literals, never React: metadata image routes compile in Next's `rsc` layer, where `react-dom/server` throws.

## Copy rules

Warm and direct. No emoji (the glyphs ⚠ ★ ✓ ✗ → • are fine). No exclamation marks. Never the word "fortnight". At most one em-dash per paragraph. Never hard-wrap prose. "Martin", never "Marty". Tier names are never hardcoded in copy; they come from `src/lib/tiers.ts`.

## Docs precedence

For Next.js API shapes, the bundled docs in `node_modules/next/dist/docs` win over everything, including this file.
