# Contributing

Small app, small league. The rules are light — but `main` is protected, so
everything lands through a pull request.

## Setting up

```bash
git clone https://github.com/dylanschultz93/ff-league-parlay.git
cd ff-league-parlay
npm install
npm run dev
```

That gets you a running app. It will show a database error at the top of the
board until you have a connection string — see below.

## The database, and the one thing to be careful about

Storage is Neon Postgres, provisioned through Vercel. If you have access to the
Vercel project:

```bash
vercel login
vercel link
vercel env pull .env.development.local
npm run db:init          # applies schema.sql, safe to re-run
```

> [!WARNING]
> **Development, Preview and Production currently share one database.** Anything
> you insert or delete locally is what the league sees on the live site. Don't
> seed junk data, and clean up after yourself if you do. If you're doing work
> that needs real test data, ask Dylan for a separate Neon branch first.

If you don't have Vercel access, you can still work on anything that isn't
storage — the board renders and the odds math runs without a database.

## Making a change

1. Branch off `main`. Name it for what it does: `fix/picker-dismiss`,
   `feat/past-weeks`.
2. Make the change. Match the surrounding code rather than introducing a new
   style — this codebase is small enough to stay consistent.
3. Run the same checks CI runs:
   ```bash
   npm run lint && npm run typecheck && npm run build
   ```
4. Open a PR. Fill in the template — especially how you tested it.
5. CI has to pass and someone has to approve before it merges.

## Things worth knowing

- **It's mobile-first.** Most people submit legs from a phone on Sunday morning.
  Check your change on a narrow viewport before opening the PR.
- **The design is in `prototype/`.** That's an exported Claude Design bundle and
  the source of truth for how the UI should look. Design tokens are lifted into
  `src/app/globals.css` — reuse those rather than hardcoding colors.
- **Odds math lives in `src/lib/odds.ts`.** It's pure and easy to reason about.
  If you touch it, work an example by hand and say so in the PR — a wrong
  conversion is not obvious by eye.
- **`src/lib/league.ts`** holds the roster, week, and who's paying. Updating the
  week each week is a config change, not a code change.
- **There's no auth.** Anyone with the link can submit, edit, or delete as
  anyone. That's a deliberate tradeoff for a 14-person league — just don't build
  on the assumption that a request is trustworthy.

## Repo rules

`main` requires a pull request, a passing CI run, at least one approval, and
resolved review comments. Force-pushing and deleting `main` are blocked.

Dylan is repo admin and can bypass in a pinch — that exists for emergencies, not
for routine work.
