# Parlay Pool

A small web app for a fantasy league's weekly group parlay. Each league member
submits one leg (free text) plus its American odds; the app combines them into a
single parlay and shows the combined odds, implied win probability, and the
payout on a $10 ticket. Whoever finished last the prior week puts up the $10.

Mobile-first — people submit from their phones.

## Running it

```bash
npm install
npm run dev
```

The UI is built from the Claude Design bundle in `prototype/` — that folder is
the exported design source (artboards for the main screen, empty state, add-leg
form, error state, locked state, history, and desktop). Design tokens are lifted
verbatim into `src/app/globals.css`.

## How it's put together

- `src/lib/odds.ts` — American ↔ decimal odds conversion and parlay math.
- `src/lib/league.ts` — roster, current week, and who's paying. Placeholder
  values for now.
- `src/lib/store.ts` — leg storage.
- `src/app/api/legs/` — `GET`/`POST` the week's legs, `PATCH`/`DELETE` one leg.
- `src/components/ParlayBoard.tsx` — the board: summary, progress, legs, waiting.
- `src/components/AddLegView.tsx` — full-screen submit/edit view.
- `prototype/` — the exported Claude Design bundle the UI is built from.

One leg per person: submitting again under the same name replaces that person's
existing leg.

## Known limitation: storage is in-memory

`src/lib/store.ts` keeps legs in a `Map` in the server process. That is fine
locally, but **on Vercel each serverless instance holds its own copy, so legs
will appear and disappear between requests**. This is deliberate for the walking
skeleton — the next step is swapping that one file for a real datastore
(Neon Postgres via the Vercel integration, or Upstash Redis). Nothing outside
`store.ts` needs to change.

## Also still to come

- **No auth.** Anyone with the link can submit, edit, or delete as anyone.
- **No history.** Artboard 1e (past weeks, record, net) isn't built — it needs a
  data model for settled weeks, which waits on storage.
- **Nothing is enforced.** "locks Sunday 1:00" is copy, not a deadline.
- **`LEAGUE.payer` is null**, so the "whose tab" callout is hidden until we know
  who finished last.
