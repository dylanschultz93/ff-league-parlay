# Parlay Pool

A small web app for a fantasy league's weekly group parlay. Each league member
submits one leg (free text) plus its American odds; the app combines them into a
single parlay and shows the combined odds, implied win probability, and the
payout on a $10 ticket. Whoever finished last the prior week puts up the $10.

Mobile-first — people submit from their phones.

Contributing? Read [CONTRIBUTING.md](CONTRIBUTING.md) first — `main` is
protected and there's one sharp edge around the shared database.

## Running it

```bash
npm install
vercel env pull .env.development.local   # needs `vercel login` + `vercel link` first
npm run db:init                          # applies schema.sql (safe to re-run)
npm run dev
```

Without a connection string the app still renders — the board shows the database
error instead of crashing, and the API returns 503 with the same message.

The UI is built from the Claude Design bundle in `prototype/` — that folder is
the exported design source (artboards for the main screen, empty state, add-leg
form, error state, locked state, history, and desktop). Design tokens are lifted
verbatim into `src/app/globals.css`.

## How it's put together

- `src/lib/odds.ts` — American ↔ decimal odds conversion and parlay math.
- `src/lib/league.ts` — roster, current week, and who's paying. Placeholder
  values for now.
- `src/lib/store.ts` — leg queries (Neon Postgres).
- `src/lib/db.ts` — lazily-built Neon client and connection-string resolution.
- `schema.sql` — the `legs` table. Applied with `npm run db:init`.
- `src/app/api/legs/` — `GET`/`POST` the week's legs, `PATCH`/`DELETE` one leg.
- `src/components/ParlayBoard.tsx` — the board: summary, progress, legs, waiting.
- `src/components/AddLegView.tsx` — full-screen submit/edit view.
- `prototype/` — the exported Claude Design bundle the UI is built from.

One leg per person: submitting again under the same name replaces that person's
existing leg.

## Storage

Neon Postgres, provisioned through the Vercel Marketplace integration, which
injects the connection string as an environment variable. `src/lib/db.ts` accepts
any of the usual names (`DATABASE_URL`, `POSTGRES_URL`, `STORAGE_URL`, …) since
the integration names it after the prefix chosen at install time.

Development and Preview run against a separate `parlay_dev` database via
`DATABASE_URL_OVERRIDE`, which is set only on those two environments. Production
has no override and uses the integration's `DATABASE_URL` (`neondb`), so local
and preview work cannot touch the league's data.

Rows carry `season` and `week`, and every query is scoped to the current week
from `src/lib/league.ts`. Past weeks accumulate untouched, ready for the history
screen. A unique index on `(season, week, lower(name))` enforces one leg per
person per week and backs the upsert.

## Also still to come

- **No auth.** Anyone with the link can submit, edit, or delete as anyone.
- **No history.** Artboard 1e (past weeks, record, net) isn't built — it needs a
  data model for settled weeks, which waits on storage.
- **Nothing is enforced.** "locks Sunday 1:00" is copy, not a deadline.
- **`LEAGUE.payer` is null**, so the "whose tab" callout is hidden until we know
  who finished last.
