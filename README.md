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
error instead of crashing, and the API returns 503 with the same message. If the
board reports a missing table or column, the database is behind the code: run
`npm run db:init` again.

The app also applies `schema.sql` itself, once per process, before its first
query — so a deploy that lands before anyone runs the script heals itself on the
first request rather than showing a missing-table error and refusing writes. The
script stays for applying a change deliberately, ahead of the deploy:

```bash
npm run db:init:prod   # applies schema.sql to the league's live database
```

That skips `DATABASE_URL_OVERRIDE` and uses the integration's `DATABASE_URL`.
Both scripts print the database they are about to touch before they touch it.

The UI is built from the Claude Design bundle in `prototype/` — that folder is
the exported design source (artboards for the main screen, empty state, add-leg
form, error state, locked state, history, and desktop). Design tokens are lifted
verbatim into `src/app/globals.css`.

## How it's put together

- `src/lib/odds.ts` — American ↔ decimal odds conversion and parlay math.
- `src/lib/league.ts` — the app's name and the deadline copy. That's all that's
  left in code: the roster, the payer, and the current week are in the database,
  all three set on `/manage`.
- `src/lib/store.ts` — leg and lock queries (Neon Postgres).
- `src/lib/parlay.ts` — whether the ticket is open, live, won, or lost.
- `src/lib/db.ts` — lazily-built Neon client and connection-string resolution.
- `schema.sql` — the `legs` and `weeks` tables. Applied with `npm run db:init`.
- `src/app/api/legs/` — `GET`/`POST` the week's legs, `PATCH`/`DELETE` one leg.
  `PATCH` also grades a leg (`{ "result": "won" | "lost" | null }`).
- `src/app/api/parlay/` — `GET` the week's lock state and payer, `PATCH` to
  lock/unlock or to set the payer (`{ "payer": "Chat", "payerReason": "…" }`,
  or `{ "payer": null }` to clear it).
- `src/app/api/participants/` — `GET`/`POST` the roster, `PATCH` one person's
  `active` flag, `DELETE` to take them off the list.
- `src/app/api/league/` — `GET` the current week, `PATCH` to move it
  (`{ "season": 2026, "week": 2 }`; either field alone is fine).
- `src/components/ParlayBoard.tsx` — the board: summary, progress, legs, waiting.
- `src/components/AddLegView.tsx` — full-screen submit/edit view.
- `src/components/LockControls.tsx` — locking the ticket, and taking it back.
- `src/components/AppHeader.tsx` / `NavTabs.tsx` — the bar and tabs every screen
  sits under. `PageShell.tsx` pairs the header with the body the non-board
  screens share.
- `src/app/manage/` + `src/components/ManageBoard.tsx` — setting the week's
  payer and managing the roster. Both write to the database.
- `src/app/history/`, `src/app/stats/` — past weeks and participant records.
  **Wireframes so far** — they render from `src/lib/wireframe.ts` and nothing
  on them writes anything.
- `prototype/` — the exported Claude Design bundle the UI is built from.

One leg per person: submitting again under the same name replaces that person's
existing leg.

## Locking and grading

Once the bet is actually placed with a book, someone hits **Lock the parlay**
(two taps — it freezes everyone's leg). After that nothing can be added, edited,
or removed, and each leg gets **Mark won** / **Mark lost** instead of Edit and
Remove.

A parlay pays only if every leg hits, so the first `lost` leg settles the whole
ticket — the board flips to a dead ticket without waiting on the rest. The
remaining legs can still be graded for the record.

Unlocking works only while nothing has been graded, which covers the misclick;
after that, clear the results first. The rules live in SQL rather than only in
the UI — every write carries a guard on the week's lock state, so a lock landing
mid-request can't let a late leg through.

## Storage

Neon Postgres, provisioned through the Vercel Marketplace integration, which
injects the connection string as an environment variable. `src/lib/db.ts` accepts
any of the usual names (`DATABASE_URL`, `POSTGRES_URL`, `STORAGE_URL`, …) since
the integration names it after the prefix chosen at install time.

Development and Preview run against a separate `parlay_dev` database via
`DATABASE_URL_OVERRIDE`, which is set only on those two environments. Production
has no override and uses the integration's `DATABASE_URL` (`neondb`), so local
and preview work cannot touch the league's data.

`npm run db:init` applies `schema.sql` to whichever database the connection
string points at — `parlay_dev` locally, and `neondb` with `db:init:prod`. It is
re-runnable, so it doubles as the migration step for a schema change.

Rows carry `season` and `week`, and every query is scoped to the current week.
That lives in `league_state`, a single row read by a subquery inside each
week-scoped statement — so moving the week is one write, takes effect on the
next request everywhere, and costs no extra round trip. `weeks` holds one row
per week, created the first time
anyone locks the parlay or names a payer — so the row existing does not mean the
week is locked, only a non-null `locked_at` does.

`participants` is the roster, and `league_state` is the current week. Both seed
themselves from `schema.sql` — the roster with the names that used to be
hardcoded, the week with where the code had it — once, guarded so a re-run
against populated tables does nothing. That guard matters: `schema.sql` re-runs
on every deploy and on the first query of every cold start, and without it a
restart would quietly drag the league back to week 1. Benched people (`active` false)
keep their legs but drop off the week's waiting list.
Past weeks accumulate untouched, ready for the history screen. A unique index on `(season, week, lower(name))` enforces one leg per
person per week and backs the upsert.

## Also still to come

- **No auth.** Anyone with the link can submit, edit, or delete as anyone.
- **`/history` and `/stats` are drawings.** They have the navigation and the
  layout but no data behind them — every number comes from
  `src/lib/wireframe.ts` and every control is inert. Wiring them up means a
  settled week's bookkeeping on the `weeks` table and a per-person record,
  neither of which is stored yet.
- **The deadline isn't enforced.** "locks Sunday 1:00" is still copy — locking
  is a button someone presses, not a clock. The week works the same way: it is
  set by hand on `/manage`, deliberately, rather than derived from the date.
- **Nobody's on the hook until someone says so.** The payer starts null each
  week and the "whose tab" callout stays hidden until it's set on `/manage`.
