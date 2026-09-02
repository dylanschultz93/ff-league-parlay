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

## How it's put together

- `src/lib/odds.ts` — American ↔ decimal odds conversion and parlay math.
- `src/lib/league.ts` — roster, current week, and who's paying. Placeholder
  values for now.
- `src/lib/store.ts` — leg storage.
- `src/app/api/legs/` — `GET`/`POST` the week's legs, `PATCH`/`DELETE` one leg.
- `src/components/ParlayBoard.tsx` — the single screen.

One leg per person: submitting again under the same name replaces that person's
existing leg.

## Known limitation: storage is in-memory

`src/lib/store.ts` keeps legs in a `Map` in the server process. That is fine
locally, but **on Vercel each serverless instance holds its own copy, so legs
will appear and disappear between requests**. This is deliberate for the walking
skeleton — the next step is swapping that one file for a real datastore
(Neon Postgres via the Vercel integration, or Upstash Redis). Nothing outside
`store.ts` needs to change.

Also still to come: no auth (anyone with the link can submit or delete as
anyone), a single hardcoded week with no history, and no way to record whether
the parlay actually won.
