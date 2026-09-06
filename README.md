# Toronto Parking

The companion site for a four-copy 3D-printed run of the sliding-car puzzle Nob Yoshigahara called Tokyo Parking. Each box carries a QR code; scanning it opens that board's page at https://cars.mlaws.ca, with a dedication and a numbered deck of 60 layouts to set up on the physical board. The site is the deck of cards, not a playable game: setup and par first, hints and playback later.

## The physical set

A 6x6 peg-and-channel board, white frame, black asphalt, glow-green markings, translucent pieces. The exit is on the right wall, third row from the top. Each set holds four blue, four yellow and four green cars, one blue, two yellow and one green trucks, one red cabriolet, and two yellow traffic pylons that stand in for the walls in Michael Fogleman's database of solved positions, which the deck is drawn from.

The deck is 60 cards in five tiers of 12, ordered so difficulty climbs monotonically with the card number. Par is Fogleman's proven minimum. Fifteen cards carry a pylon, none of them in the first tier.

## The two route shapes

`/cards/<n>` is one card, `n` from 1 to 60. Card URLs are canonical and identical for every board, so "I'm stuck on #31" is a link anyone can open. Anything outside 1..60 is a 404.

`/b/<code>` is one board's home: its dedication, the deck with that board's progress, and a panel showing how far the other three have got. The code is six lowercase characters printed on a card in the box, and it is the only credential — there are no accounts. These pages are `noindex`, and nothing about them reaches page metadata.

`/` is the deck with no board attached, plus a field for a code. It offers a remembered board and never redirects to one.

## Local setup

Node 24 and pnpm 11.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # production build; every /cards/N row should be ○ or ◐, never ƒ
pnpm test           # node:test over tests/**
pnpm lint
pnpm typecheck
```

The store needs Upstash Redis credentials in `.env.local`. `Redis.fromEnv()` takes either pair the Vercel Marketplace injects: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the `KV_REST_API_URL` and `KV_REST_API_TOKEN` aliases. `vercel env pull .env.local --yes` writes them. Without them the pages and the deck still render; only `/b/<code>` and the two API routes need the store.

## Regenerating the deck

`data/deck.json` is generated, committed, and never hand-edited. Rebuilding it needs `rush.txt` (115 MB, sha256 `fca9f04d…`), which is Fogleman's and is not in the repo:

```bash
RUSH_TXT=/path/to/rush.txt pnpm deck:build
shasum -a 256 data/deck.json     # fe31aa9a478ab285b76a0d9fc39398f2b2054a5fa552e596c83a2149208d2418
```

The build asserts the source digest before it reads a row, uses no randomness and no clock, and two runs are byte-identical. `scripts/prototype/` holds the python this is a port of, with a README giving its run order; where the two disagree, the python is the definition. `tests/fixtures/rush1000.txt` is the first 1,000 rows, committed as the solver fixture.

## Seeding a board

Names, dedications and codes live in `boards.local.json`, which is gitignored. `boards.example.json` shows the shape. Every verb writes the `tp:dev:` key prefix unless `--production` is passed.

```bash
pnpm boards:seed              # idempotent; mints a code where one is empty and writes it back
pnpm boards:ls                # n · code · name · solved count · last solve
pnpm boards:reset <code>      # clears that board's solves, keeps its dedication
pnpm boards:rm <code>         # drops a throwaway board entirely
```

## QR codes

```bash
pnpm qr:build                 # out/qr/<code>.svg and .png, error correction H
```

`out/` is gitignored and is deleted after printing. No hosted generator is involved, so no third party ever sees the URLs. The QR lives on an unnumbered intro card in the box, not on the plastic: a code moulded into plastic cannot be reissued.

## Credits

The 60 layouts are drawn from Michael Fogleman's 2018 database of every interesting 6x6 position with up to two walls, each solved to a proven minimum: https://www.michaelfogleman.com/rush/. See `DATA-ATTRIBUTION.md`, which covers the derived data and is deliberately outside the MIT licence on the code.

Nob Yoshigahara brought his wooden Tokyo Parking puzzle to Binary Arts in 1995; the About page tells the rest of that story. RUSH HOUR is a registered trademark of Ravensburger North America, Inc. This project is not affiliated with or endorsed by Ravensburger or ThinkFun.

MIT for the code. The issues are the plan.
