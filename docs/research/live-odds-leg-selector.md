# Feature B — a real leg selector backed by live sportsbook odds

Research document, not a plan of record. Written 2026-09-16 against `main` at
`claude/gallant-tesla-91racq`. Nothing here has been implemented.

**Goal as stated:** instead of typing `"Mahomes over 249.5 pass yards"` and
`-115` by hand, a league member browses the week's actual markets in the app,
taps the leg they want, and the app records it with real odds — and those odds
refresh as the book moves them, right up until the parlay locks.

**Budget constraint:** $0/month. Paid tiers are a footnote.

---

## Verdict

Feasible, but not as stated — and the gap is entirely about quota, not about
coverage. Player props *are* reachable for free: The Odds API's free plan is not
market-gated, and NFL props (`player_pass_yds`, `player_anytime_td`, and friends)
come back from the same event-odds endpoint a paying customer uses. What is not
reachable for free is **volume**. At 500 credits/month and a documented cost of
`[unique markets returned] x [regions]` *per event*, one full-slate snapshot of
ten NFL prop markets across sixteen games costs 160 credits — so the free month
buys **three full-slate prop refreshes, total**. A naive implementation that
fetched on page load would exhaust the month on the third person to open the
screen.

What survives that arithmetic is a good feature, just a smaller one: a searchable
**snapshot** of the week's props, refreshed once or twice a week and lazily
per-game, with prices **frozen at submit time** rather than tracking the book.
That still kills the two things that actually hurt today — typing the pick as
prose and fat-fingering the odds — and it is worth building. The "odds refresh
until lock" half of the goal should be dropped on the free tier and revisited if
the league ever spends $30/month, where the same design gets 40x the headroom and
becomes comfortable.

The biggest risk is not technical. It is that the free tier's real terms could
not be verified from this session — every odds-provider domain is blocked by this
environment's egress proxy, so the 500-credit figure rests on secondary sources
that contradict each other (see [Data sources](#data-sources)). **Phase 0 of the
build is a single free API call that settles it.** Do not write Phase 1 until
that call has been made.

---

## Data sources

### Method, and its limits — read this before trusting any number below

Every odds-provider host is blocked by this environment's egress policy. Verified
by `curl` and by the proxy's own status endpoint:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"
  "recentRelayFailures": [
    { "kind": "connect_rejected", "host": "api.the-odds-api.com:443",
      "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)" },
    ...
  ]
```

Blocked (403 on CONNECT, confirmed individually): `the-odds-api.com`,
`api.the-odds-api.com`, `theoddsapi.com`, `sportsgameodds.com`,
`api.sportsgameodds.com`, `docs.sportsgameodds.com`, `opticodds.com`,
`developer.opticodds.com`, `odds-api.io`, `oddspapi.io`, `sharpapi.io`,
`docs.sharpapi.io`, `oddsjam.com`, `api-sports.io`, `rapidapi.com`,
`sportsapis.dev`, `cran.r-project.org`, `vercel.com`, `github.com` (HTML),
`site.api.espn.com`, `api.sportsdata.io`.

Reachable, and used instead: `raw.githubusercontent.com` (200), the GitHub code
search API, and web search. So:

- **Endpoint semantics and quota formulas** below are quoted from a verbatim
  mirror of The Odds API's own v4 docs checked into a public repo
  (`maxemileffort/quanticon`, `quant_bet/ext_api_docs/odds_api.md`), cross-checked
  against The Odds API's **own** sample code in their `the-odds-api` GitHub org.
  I consider these high confidence — they are the vendor's words, just fetched
  sideways. The mirror is undated, so treat it as "correct as of when it was
  copied"; the formulas match the vendor's live sample code, which is the best
  corroboration available here.
- **Prices and plan quotas** are from web search summaries of vendor pricing
  pages I could not open. **Lower confidence.** Where sources conflict I say so.
- **Response shapes** are real 2026 NFL data pulled from public repos that archive
  API responses, not from my own calls. Provenance is given in the
  [appendix](#appendix-raw-endpoint-samples-and-citations).

I had no API key, did not sign up for anything, and did not make a single call to
any provider.

### The Odds API (the-odds-api.com) — the recommendation

The oldest, best-documented, most widely-integrated of the self-serve options,
with an official GitHub org publishing working sample code
(<https://github.com/the-odds-api>). Host: `https://api.the-odds-api.com`.

**Free plan quota — CONFLICTED, must be verified.**

| Claim | Source | Confidence |
|---|---|---|
| Free plan = **500 credits/month**, no card | multiple, incl. search of the-odds-api.com's own pages and <https://apis.io/plans/the-odds-api/the-odds-api-plans-pricing/> | moderate — the consensus figure |
| Free plan covers **all sports, all bookmakers, all markets incl. player props**; only *historical* endpoints are paid-gated | search of the-odds-api.com's own pages; corroborated by the v4 docs, which mark only the three `/historical/*` endpoints "only available on paid usage plans" | moderate–good |
| Free plan is **"25 requests/day, NBA and MLB, h2h only"** | <https://oddspapi.io/blog/the-odds-api-free-tier-limits/> and <https://oddspapi.io/blog/odds-api-pricing-2026-comparison/> | **low — this is a direct competitor's marketing blog**, and it contradicts both the vendor's own pages and the v4 docs, which gate nothing but history |
| Free plan limited to "~40 soft books, no sharp data" | competitor blog, same caveat | low |

The competitor claim is the only thing that would kill the feature outright, and
it comes from the party with the strongest incentive to say it. **Resolve it in
one free call** — see [Phase 0](#build-phases-and-effort).

Paid plans, for the footnote: 20K credits/mo for $30, 100K for $59, 5M for $119,
15M for $249 (search of the-odds-api.com pricing; also reported by
<https://oddspapi.io/blog/odds-api-pricing-2026-comparison/>). All plans reportedly
give the same sport/market/bookmaker access; paid adds historical snapshots back
to June 2020.

**Endpoints and their credit cost.** Quoted from the v4 docs mirror
(<https://the-odds-api.com/liveapi/guides/v4/>):

| Endpoint | Cost | Notes |
|---|---|---|
| `GET /v4/sports` | **0** | "This endpoint does not count against the usage quota." Returns `x-requests-remaining` anyway — which is why it settles the quota question for free. |
| `GET /v4/sports/{sport}/events` | **0** | "Odds are not included in the response. This endpoint does not count against the usage quota." Gives event id, home/away team, `commence_time`. |
| `GET /v4/sports/{sport}/events/{id}/markets` | **1** | Which market keys each book currently has open for that game. No prices. |
| `GET /v4/sports/{sport}/odds` | `markets x regions` | Whole slate in one call, but **featured markets only** — `h2h`, `spreads`, `totals`, `outrights`. No props. |
| `GET /v4/sports/{sport}/events/{id}/odds` | `[unique markets returned] x [regions]` | **One event at a time.** This is the only way to get player props. |
| `GET /v4/sports/{sport}/scores` | 1, or **2** with `daysFrom` | Live and recently-completed scores. |
| `GET /v4/historical/...` | `10 x markets x regions` | Paid plans only. |

Three details that matter a great deal for the design, all verbatim from the docs:

- *"Responses with empty data do not count towards the usage quota."* A miss is
  free.
- *"When calculating the market component of usage quota costs, a count of unique
  markets in the API response is used. For example if you specify 5 different
  markets and 1 region in the API call, and data is only available for 2 markets,
  the cost will be [2 markets] x [1 region] = 2."* Asking for markets a book has
  not posted yet is free. Early-week fetches are cheaper than Sunday-morning ones.
- *"Every group of 10 bookmakers is the equivalent of 1 region. For example,
  specifying up to 10 bookmakers counts as 1 region."* So `bookmakers=fanduel`
  costs **exactly the same** as `regions=us`. Pinning to one book buys a smaller
  payload and an unambiguous price, but **not** a cheaper call. Do not design
  around a discount that does not exist.

Every response carries `x-requests-remaining`, `x-requests-used`,
`x-requests-last`. `x-requests-last` is the actual charge for the call just made —
this is the number to write into the ledger, not a number you compute yourself.

**NFL coverage.** Props are live and real. A realistic NFL market key set, taken
from a working public integration
(`vinnybarbs/Cray_Cray_Parlay_App`, `config/sports-config.js`):

```
player_pass_tds, player_pass_yds, player_pass_completions, player_pass_attempts,
player_pass_interceptions, player_rush_yds, player_rush_attempts,
player_receptions, player_reception_yds, player_anytime_td
```

Milestone ("2+ TDs") markets exist as `*_alternate` keys. Books carried in the
`us` region include DraftKings, FanDuel, BetMGM, Caesars, BetRivers, Fanatics.
NFL **preseason** explicitly has no prop coverage — irrelevant now, relevant if
this ships and then sits idle until August.

Rate limit: 30 req/s documented on paid plans, with a warning that 429s happen
below it anyway. Irrelevant at our volume.

### SportsGameOdds (sportsgameodds.com) — the interesting alternative, badly documented publicly

Billing is by **objects**, not credits: *"each API response item counts as one
object, so if you request 10 events, that's 10 objects."*

Free "Amateur" plan, and the sources disagree:

| Claim | Source |
|---|---|
| 2,500 objects/month, 10 req/min | search of sportsgameodds.com's own `/pricing` and `/docs/info/rate-limiting` |
| 1,000 objects/month, 10 req/min | <https://oddspapi.io/blog/odds-api-pricing-2026-comparison/> (competitor) |
| Free tier = 9 bookmakers, 10-minute delay, props gated to paid | competitor blog |
| Free tier = same 80+ books and 30+ sports as paid, props included, within the object cap | sportsgameodds.com's own comparison pages |

**Either number kills it for this use case, and that is the point worth taking
away.** Object billing is brutal for a prop browser. Look at the real response in
the [appendix](#appendix-raw-endpoint-samples-and-citations): a *single* NFL game
from *one* book, with four prop markets, returns 35 outcome rows. A full slate of
16 games x one book x ten markets is comfortably 3,000–6,000 outcome rows. If an
"object" is an outcome, one snapshot exceeds the entire free month. If an object
is a market, one snapshot is ~640 objects and the month buys four. Either way it
is worse than The Odds API's 500 credits, and the ambiguity itself is a reason to
stay away — you cannot budget against a unit you cannot pin down without a key.

Paid: $99–$499/month. Well outside a $0 budget.

### OpticOdds (opticodds.com) — dismiss

No free tier, no public trial, no published pricing; sales-gated, reportedly
~$5,000/month/sport, aimed at operators and media companies. Not a candidate.

### odds-api.io — dismiss, on a technicality

Free tier is generous in shape: 100 requests/hour (≈500/day), no monthly credit
cap, 2 bookmakers (swappable via a `/bookmakers` endpoint), player props included
at the same depth as paid. That would carry this feature easily.

But: **"new free API keys are paused indefinitely"** (<https://odds-api.io/pricing/free>,
via search). Existing keys keep working; new signups cannot get one. We have no
key. So this is unavailable to us in practice. Worth re-checking at build time —
if signups reopen, it moves to the top of the list.

### OddsPapi (oddspapi.io) — dismiss on volume

Free tier: **250 requests/month**, but with a flat "1 request = 1 request" model
(no market x region multiplier) and historical data included. The flat model is
genuinely nicer than credits, and 250 flat requests is roughly equivalent to 250
single-market event fetches — but that is *half* The Odds API's effective
headroom for the per-event pattern we need, and OddsPapi is a much younger vendor
whose public presence is almost entirely SEO blog posts attacking competitors.
Not a first choice. A reasonable second key to hold in reserve, since a free 250
requests is a free 250 requests.

### SharpAPI (sharpapi.io) — the one that would solve this, if it is real

Claimed free tier: **12 requests/minute, no monthly cap** (≈17,280/day),
DraftKings + FanDuel only, all major US sports, player props included, 60-second
data delay, no credit card. Paid from $79/mo.

If those terms hold, this is the only free tier found that comfortably supports
the feature **as originally stated**, live refresh included. It is also the one I
trust least:

- Every claim traces to sharpapi.io's own comparison pages. Web search surfaced
  **zero** independent developer reports.
- Name collision: there is an unrelated `sharpapi.com` (AI text-processing APIs)
  whose SDK repos pollute searches for this one. Be careful you are evaluating
  the right product.
- A vendor giving away 17,280 calls/day of real-time sportsbook data for free is
  either very well funded, very new, or about to change its terms.

**Recommendation:** do not build on it first, but do build behind a provider
interface (`src/lib/odds-provider.ts`) so it is a drop-in if The Odds API's quota
turns out to be the binding constraint it looks like. Evaluating it costs one
signup and one afternoon.

### Free non-odds sources — out of scope but worth knowing

`api-sports.io` offers 100 requests/day free forever across its APIs, but its
american-football product is fixtures/stats/standings with pre-match odds on
main markets; there is no evidence of player props. ESPN's undocumented
`site.api.espn.com` endpoints carry scores, schedules and rosters but not prop
prices — useful later for **grading**, not for selection. Both hosts are blocked
here, so neither was verified directly.

### Scraping FanDuel directly — briefly, honestly, and no

The user originally asked for FanDuel and has since said any book is fine, which
removes the only reason to consider this. For completeness:

FanDuel has no public developer API. Its web app talks to undocumented endpoints
under `https://sbapi.fanduel.com/api/` — principally
`GET /api/event-page?eventId=...` for one game and
`GET /api/content-managed-page?page=SPORT_HOME&...` for the lobby. People do
scrape them.

Why it is a bad idea here, in rough order of how fast it bites:

1. **It breaks.** Undocumented endpoints change without notice. This app has
   fourteen users and no on-call; a silent breakage on a Sunday morning is exactly
   the failure this feature is supposed to prevent.
2. **Geofencing.** `sbapi.*.sportsbook.fanduel.com` uses DNS-based geolocation and
   per-state IP restrictions. A Vercel function's egress IP is not in a
   FanDuel-licensed state in any predictable way. You would be building a feature
   whose correctness depends on which datacenter the function landed in.
3. **Bot detection.** Cloudflare JS challenges and aggressive IP reputation
   checks; FanDuel is reported as among the hardest books to scrape in 2026.
   Beating it means a headless browser and residential proxies — which cost money,
   defeating the entire premise.
4. **Terms of service.** Scraping the endpoints violates them. For a private
   league app this is a small practical risk and a real one on principle.

A legal, documented aggregator gives the same prices for the same $0. Use one.
Revisit only if every aggregator fails, which they do not.

---

## Free-tier quota math

This is the section that decides the feature. All arithmetic against The Odds
API's free plan at **500 credits/month**.

### The inputs

| Quantity | Value | Why |
|---|---|---|
| Free credits / month | 500 | see [Data sources](#the-odds-api-the-odds-apicom--the-recommendation) — unverified, verify in Phase 0 |
| NFL games in a regular-season week | 13–16; use **16** worst case, 15 typical | byes thin it out from week 5 |
| League members submitting | 14, one leg each | `participants` seed in `schema.sql` |
| Submission window | Wed → Sun ~1:00pm, ≈72h | `LEAGUE.locksAt` is "locks Sunday 1:00" (copy only) |
| Game weeks per calendar month | ≈4.3; budget for **4** | 500 / 4 = **125 credits per week** |
| Prop market set | 10 keys (full) or 4 keys (narrow: anytime TD, pass yds, rush yds, reception yds) | the 4 cover what a fantasy league actually bets |
| Regions | 1 (`us`, or equivalently `bookmakers=fanduel,draftkings`) | groups of 10 books = 1 region, so this is the floor |

Cost of one full-slate prop snapshot:

```
16 events x 10 markets x 1 region = 160 credits     (full market set)
16 events x  4 markets x 1 region =  64 credits     (narrow market set)
```

Cost of one full-slate **featured** snapshot (`/odds`, one call, whole slate):

```
3 markets x 1 region = 3 credits
```

Props are **53x** more expensive than spreads-and-totals per refresh. Everything
below follows from that ratio.

### Scenario 1 — the naive implementation (fetch per page load)

Every time someone opens the leg picker, fetch props for the whole slate.

```
per page load                    = 160 credits
free month / 160                 = 3.1 page loads
```

**The free month is gone on the third person to open the screen.** Not "gone in
the first week" — gone in the first ten minutes of the first Sunday. This is the
implementation to make structurally impossible, not merely to avoid.

Even the narrow 4-market set at 64 credits gives 7.8 page loads/month. With 14
people opening the screen ~3 times each over a weekend (42 loads), a naive
implementation needs **2,688 credits/week** narrow, or **6,720/week** full —
21x to 54x the entire monthly allowance, every week.

### Scenario 2 — one shared cached snapshot, refreshed on a timer

Everyone reads one cached snapshot; a timer refreshes it.

| Market set | Cost/refresh | Refreshes the free month buys | Cadence that fits 4 weeks |
|---|---|---|---|
| 10 markets | 160 | 3.1 | **less than one per week** |
| 4 markets | 64 | 7.8 | **1.95/week** — i.e. one Saturday + one Sunday, and that alone is 512/mo, already over |
| 4 markets, 1/week | 64 | — | 256/mo. Fits, with room. **One snapshot per week.** |

So on the free tier, "the week's prop board" is a **weekly snapshot**, not a feed.
There is no cadence at which a full-slate prop cache refreshes more than about
twice a week without going over.

### Scenario 3 — lazy per-event, only games somebody actually opens

The real saver. `/events` is free, so the game list, teams and kickoff times cost
nothing — you can render the browser's first screen for free, forever. You only
spend when someone drills into a game.

```
cost per game opened (cache miss) = 4 markets x 1 region = 4 credits
```

Realistic week: the league collectively opens ~10 distinct games (people cluster
on the early Sunday slate and the primetime games), with a 24h TTL so most games
get fetched once, a few twice:

```
10 distinct games x 1.5 fetches x 4 markets = 60 credits/week
                                            = 240 credits/month
```

With the full 10-market set: `10 x 1.5 x 10 = 150/week = 600/month` — **over**.
The 4-market restriction is what makes lazy fetching fit.

### Scenario 4 — re-pricing at lock

Worth calling out because it is the cheap part and it is intuitively the
expensive part. Re-fetching the price of the 14 legs actually on the ticket:

- Worst case, 14 legs in 14 different games each needing a different market:
  `14 events x 1 market = 14 credits`.
- Typical, 14 legs clustered into ~10 games with ~2 distinct markets each:
  `10 events x 2 markets = 20 credits`.
- **≈20 credits/week, 80/month.** Affordable.

Browsing is expensive. Locking is nearly free. Design accordingly.

### The recommended weekly budget

125 credits/week is the ceiling. A budget that fits, with the featured markets
kept fresh because they are nearly free:

| Line item | Cadence | Cost/week |
|---|---|---|
| `/events` — the game list | every read | **0** |
| `/odds` featured (h2h + spreads + totals, whole slate) | every 8h across the 72h window = 9 refreshes | 9 x 3 = **27** |
| Props, lazy per-event, 4-market set, 24h TTL, hard cap 15 event-fetches/week | on demand | ≤ 15 x 4 = **60** |
| Re-price at lock | once | **20** |
| Slack for retries, a second look, a manual refresh | — | **18** |
| **Total** | | **125/week → 500/month** |

That is the entire allowance, spent exactly. There is no headroom for a bug that
loops. **A credit ledger with a hard circuit breaker is not a nice-to-have; it is
the only thing standing between one bad `useEffect` and a dead feature for the
rest of the month.**

### For contrast: the $30/month plan

20,000 credits/month = 160 full-slate 10-market prop refreshes/month = **five per
day**, every day, all season, with the whole slate and every market. Every
constraint in this document evaporates. If this feature is ever judged worth
$30/month, do not micro-optimise — just buy the plan and build the obvious thing.

---

## Market coverage vs. what the league bets

The good news first: **the free tier is not market-gated.** Player props come
from the same `/events/{id}/odds` endpoint on the free plan as on the $249 one.
The v4 docs gate only the three `/historical/*` endpoints. This was the thing
most likely to gut the feature, and it does not.

What the API covers well, for NFL:

- **Featured** — moneyline, spreads, totals, team totals, quarter/half lines.
  Cheap (whole slate, 3 credits). Not what a fantasy league bets, mostly.
- **Player props** — passing/rushing/receiving yards, receptions, attempts,
  completions, interceptions, pass TDs, anytime TD. Plus `*_alternate` keys for
  milestone ("2+ TDs") lines. **This is the league's bread and butter and it is
  there.**

What it does not cover, and what the free-text escape hatch is therefore load-bearing for:

- **Anything a book does not post as a discrete market.** Same-game parlays,
  novelty and correlated props, "first drive is a three-and-out", "a kicker
  scores a touchdown" — legs a fantasy league invents on a Saturday night.
- **Markets a book posts but the aggregator does not carry.** Coverage of
  non-featured markets is explicitly described as "limited to selected bookmakers
  and sports, and expanding over time". You will find gaps.
- **Late-opening markets.** The `/events/{id}/markets` doc says the endpoint
  "only returns recently seen market keys… As an event's commence time
  approaches, this endpoint will return more market keys as bookmakers open more
  markets." A Wednesday cache is genuinely thinner than a Sunday one. People who
  submit early will see fewer options — and if we can only afford one refresh a
  week, the cache should be refreshed **late**, not early.
- **Non-NFL.** The league might want a college game or a Monday soccer leg.
  Adding a sport multiplies the per-event cost by the number of extra events.

And the one that matters most: **player-prop settlement is not available at all.**
The `/scores` endpoint gives team scores, not player stat lines. Grading props
stays a hand job, exactly as it is today. This feature improves *entry*, not
*grading* — worth saying out loud, because "it knows the odds" invites the
assumption that "it knows who won".

Net: roughly 80% of what this league puts on a ticket is selectable from free
data. The remaining 20% is exactly the fun stuff, and it needs free text.

---

## Codebase fit

The app is unusually well-shaped for this. Two properties do most of the work:

1. **`legs.pick` is prose and `legs.odds` is an integer, and everything downstream
   reads only those two.** `summarizeParlay` takes `number[]`. `LegCard` renders a
   string and a number. `archive.ts`, `/history`, `/stats` all key off the same
   pair. A structured selection that *also* writes `pick` and `odds` changes
   nothing downstream. The feature can be almost entirely additive.
2. **Every write already carries its guard in SQL, not in the UI.** `upsertLeg`,
   `updateLeg`, `deleteLeg` all embed `not exists (… weeks.locked_at is not null)`.
   That idiom extends directly to the cache-refresh stampede guard and to the
   credit circuit breaker. Follow it; do not invent a JS mutex.

What exists, file by file, and what would change:

| File | Today | Change |
|---|---|---|
| `schema.sql` | `legs`, `weeks`, `participants`, `league_state` | **Adds** nullable provenance columns on `legs` and three cache tables. See [Schema changes](#schema-changes). Re-runnability constraints below are sharp. |
| `src/lib/schema.ts` | applies `schema.sql` once per process; splits on `;` after stripping `--` comments | **No change**, but it constrains the SQL you may write — no `do $$ … $$`, no semicolons inside string literals. |
| `src/lib/db.ts` | lazy Neon client, `describeDbError`, `isUuid` | **No change.** New stores go through `db()` like everything else. |
| `src/lib/odds.ts` | pure American-odds math | **No change.** The API returns American integers when `oddsFormat=american`, which is exactly what `legs.odds` already holds. `isValidAmericanOdds` is the right validator for a fetched price too. |
| `src/lib/store.ts` | leg/parlay/participant/archive queries | `Leg` type gains optional provenance fields; `NewLeg` gains them; `upsertLeg`/`updateLeg`/`toLeg` carry them. The `Row` type and `toLeg` are the only real surgery — everything else is column list edits. |
| **new** `src/lib/odds-provider.ts` | — | The only file that knows a vendor exists. `listEvents()`, `fetchEventOdds(eventId, markets)`, returning normalised rows + the credit cost from `x-requests-last`. Swap-a-vendor boundary. |
| **new** `src/lib/markets.ts` | — | Cache reads/writes, TTL logic, stampede guard, credit ledger. Mirrors `store.ts` in style. |
| **new** `src/app/api/markets/route.ts` | — | `GET` the cached market board for the week. |
| `src/app/api/legs/route.ts` | validates `{name, pick, odds}` | Accepts `{name, offerKey}` as an alternative to `{name, pick, odds}`, resolves the offer server-side, and derives `pick`/`odds` from it. **Never trust a client-supplied price** — the app has no auth, and a hand-typed price is at least honest about being hand-typed. Keep the existing free-text branch untouched. |
| `src/components/AddLegView.tsx` | one-screen form: name + textarea + odds input + "What this does" | Becomes multi-step. The "What this does" panel and the submit footer survive verbatim; the textarea and odds input move behind a "Type it myself" path. This is the bulk of the UI work. |
| `src/components/NamePicker.tsx` | listbox with deliberate Safari-tap handling | **Reuse the pattern** for market/selection lists. The comment at the top of that file is a hard-won bug fix — new pickers must use real `<button>`s and `pointerdown` dismissal for the same reasons. |
| `src/components/LegCard.tsx` | name, pick, `OddsChip`, footer | Optional book badge and "line moved" chip. `OddsChip` is already exported and reusable in the browser's selection rows. |
| `src/components/ParlayBoard.tsx` | owns leg state, `submitLeg(name, pick, odds)` | `submitLeg` signature widens. Otherwise untouched. |
| `src/app/manage/page.tsx`, `ManageBoard.tsx` | week, payer, roster | Natural home for a manual **"Refresh odds"** button and a credits-used readout. Fits the app's existing philosophy — the week is set by hand, the lock is pressed by hand, so the odds refresh being pressable by hand is consistent, not a cop-out. |
| `next.config.ts` | `outputFileTracingIncludes` for `schema.sql` | **No change.** |
| `prototype/` | artboards 1a–1h (`Parlay Pool.dc.html`) | Needs new artboards. See [UI changes](#ui-changes). |
| — | **no tests anywhere**; CI is `lint && typecheck && build` | The response normaliser is the first thing in this repo that genuinely wants a test — it parses an external payload with optional fields and one-sided markets. Flagging it; adding a test runner is a scope decision for the user, not this feature. |

Three constraints that will bite if forgotten:

- **`schema.sql` re-runs on every deploy and on every cold start.** Every statement
  must be idempotent *and* safe to lose a race (`src/lib/schema.ts` swallows
  `42P07`, `42710`, `23505`). Cache tables are fine; seeding them is not — cache
  population belongs in application code.
- **`splitStatements` splits on `;` after stripping `--` to end of line.** No
  dollar-quoted blocks, no functions, no triggers, no semicolons or `--` inside
  string literals. Plain DDL only.
- **`schema.sql` has "no notion of ordering or history"** (CONTRIBUTING.md). Cache
  pruning must live in the refresh code, not in the schema file.

And one non-technical one: **there is no auth.** Anyone with the link can submit
as anyone. That is a deliberate tradeoff, but it means the API key must be
server-side only (`ODDS_API_KEY`, never `NEXT_PUBLIC_*`), and it means an
unauthenticated endpoint must never be able to trigger an unbounded number of
paid upstream calls. The circuit breaker is a security control here, not just a
budget one.

---

## Schema changes

Written in `schema.sql`'s voice and constraints: idempotent, `if not exists`,
`drop constraint if exists` before `add constraint`, no dollar-quoting, no
semicolons in literals.

```sql
-- ---------------------------------------------------------------------------
-- Selected legs, and the market cache behind them.
--
-- A leg is still a line of prose and a number — `pick` and `odds` are what the
-- board, the archive and the parlay math read, and nothing below changes that.
-- What is new is where those two came from. A leg picked off the market browser
-- carries the book's own identifiers alongside the prose, so the app can tell
-- "Christian McCaffrey anytime TD" from a leg that merely says so.
--
-- Every column here is nullable and every one is null on a hand-typed leg. Free
-- text is not a legacy path being phased out: it is the escape hatch for the
-- legs a book does not post as a market, and for the Sundays the odds provider
-- is down or out of credits.
-- ---------------------------------------------------------------------------

-- 'manual' — someone typed it, the way the app has always worked.
-- 'book'   — chosen from the market browser, priced from the cache below.
alter table legs
  add column if not exists source text not null default 'manual';

alter table legs
  drop constraint if exists legs_source_valid;
alter table legs
  add constraint legs_source_valid check (source in ('manual', 'book'));

-- The cached offer this leg was taken from. A loose reference, like legs.name is
-- to participants: the cache is pruned week to week and a settled leg has to
-- outlive it, so no foreign key. Null on a hand-typed leg.
alter table legs
  add column if not exists offer_key text;

-- The parts of the selection, kept in columns rather than only inside the prose
-- so a later screen can group a season's legs by market or by player without
-- parsing English.
alter table legs
  add column if not exists event_id   text;      -- the book's game id
alter table legs
  add column if not exists market_key text;      -- e.g. 'player_reception_yds'
alter table legs
  add column if not exists selection  text;      -- 'Over', 'Under', 'Yes', or a team
alter table legs
  add column if not exists player     text;      -- the outcome's description, verbatim
alter table legs
  add column if not exists line       numeric(6,1);  -- the point. Null on one-sided
                                                     -- markets like anytime TD.
alter table legs
  add column if not exists book       text;      -- bookmaker key the price came from

-- A leg that claims to come from a book has to say which one, and where from.
-- A hand-typed leg carries none of it. Anything in between is a bug in the
-- writer, and this is where it should stop.
alter table legs
  drop constraint if exists legs_book_leg_complete;
alter table legs
  add constraint legs_book_leg_complete check (
    (source = 'manual' and offer_key is null and event_id is null)
    or
    (source = 'book' and offer_key is not null and event_id is not null
       and market_key is not null and selection is not null and book is not null)
  );

-- What the price was doing when the ticket was actually placed. Written once, at
-- lock, purely for the record — the parlay math never reads it. `odds` stays the
-- price the person saw and accepted when they submitted, so a line that moved
-- overnight cannot quietly rewrite what someone put up.
alter table legs
  add column if not exists closing_odds integer;

-- ---------------------------------------------------------------------------
-- The market cache.
--
-- The app must never call the odds provider once per user per page load: the
-- free plan is 500 credits a month and a single slate of player props costs 160
-- of them. Everything the browser renders comes out of these three tables, and
-- exactly one request in a refresh window is allowed upstream.
-- ---------------------------------------------------------------------------

-- The week's games. The provider's events endpoint is free, so this table can be
-- refilled as often as anyone likes — it is the only part of the browser that
-- costs nothing.
create table if not exists odds_events (
  event_id      text        primary key,
  season        integer     not null,
  week          integer     not null,
  sport_key     text        not null,
  home_team     text        not null,
  away_team     text        not null,
  commence_time timestamptz not null,
  fetched_at    timestamptz not null default now()
);

-- Games are only ever listed a week at a time, in kickoff order.
create index if not exists odds_events_by_week
  on odds_events (season, week, commence_time);

-- One row per thing a person could tap: a game, a book, a market, and a side.
--
-- `offer_key` is built by the app rather than by the database — the provider has
-- no id for an individual outcome, and a composite key over columns that are
-- half nullable (`player` and `line` are both absent on some markets) would need
-- coalescing in every index and every join. One opaque string is what the UI
-- posts back and what a leg holds, and re-fetching the same selection produces
-- the same key with a new price.
create table if not exists odds_offers (
  offer_key   text        primary key,
  event_id    text        not null,
  book        text        not null,
  market_key  text        not null,
  selection   text        not null,
  player      text,
  line        numeric(6,1),
  price       integer     not null check (abs(price) >= 100),
  -- The provider's own timestamp for the market, not ours. It moves on the
  -- book's schedule, which is the thing worth showing next to a price.
  last_update timestamptz,
  fetched_at  timestamptz not null default now()
);

-- The browser's two reads: everything on offer for one game, and a search for a
-- player across the whole slate. The search index is on lower(player) because
-- nobody types "De'Von Achane" with the right capitalisation on a phone.
create index if not exists odds_offers_by_event
  on odds_offers (event_id, market_key);
create index if not exists odds_offers_by_player
  on odds_offers (lower(player));

-- Every upstream call, and what it cost. Two jobs in one table.
--
-- First, the refresh guard: a row is claimed before a fetch and released after,
-- so two people opening the same game at the same moment produce one request and
-- not two. The claim is an UPDATE with a `where` on the timestamp, so it is the
-- database that decides the winner — the same way every write in store.ts already
-- settles a race, rather than trusting a process that might not be the only one.
--
-- Second, the ledger: `credits` is the provider's own x-requests-last header for
-- the call, summed per month and checked before every fetch. The free plan has no
-- overdraft and no warning — the month simply stops — so the app has to keep its
-- own count and stop first.
create table if not exists odds_fetches (
  -- What is being refreshed: 'events', 'featured', or 'event:<event_id>'.
  scope        text        primary key,
  claimed_at   timestamptz,
  completed_at timestamptz,
  credits      integer     not null default 0,
  -- Null when the last attempt succeeded. The browser shows it rather than
  -- pretending the prices are current.
  last_error   text,
  updated_at   timestamptz not null default now()
);

-- The month's running total, one row per (year, month). Separate from the
-- per-scope rows above because the budget is a property of the billing period,
-- not of any one fetch, and because a month that is spent has to stay spent even
-- after every scope row has been pruned.
create table if not exists odds_budget (
  period     text        primary key,   -- 'YYYY-MM', matching the provider's reset
  credits    integer     not null default 0,
  updated_at timestamptz not null default now()
);
```

Notes on choices a reviewer will ask about:

- **Why keep `pick` and `odds` at all on a selected leg?** Because they are what
  the board, `SummaryCard`, `archive.ts`, `/history` and `/stats` read, and
  because a settled leg must stay legible forever after the cache row it came from
  is pruned. The structured columns are provenance; the prose is the record.
  Denormalisation here is the point, not an oversight.
- **Why no foreign key from `legs.offer_key` to `odds_offers`?** The cache is
  transient and a leg is permanent. The codebase already does exactly this with
  `legs.name` against `participants` — and `removeParticipant` shows the shape of
  the consequence it accepts. Consistency beats referential purity here.
- **Why `numeric(6,1)` for `line`?** Lines are halves and quarters (`225.5`,
  `0.5`, `35.5`). A float would make `line = 225.5` a coin flip; an integer of
  tenths would make every read do arithmetic.
- **Why is `source` `not null default 'manual'`?** So existing rows backfill
  themselves on the `alter`, with no data migration — which `schema.sql`
  explicitly cannot do.
- **Pruning** (`delete from odds_offers where event_id in (select … where
  commence_time < now() - interval '7 days')`) belongs in the refresh path, not
  here. CONTRIBUTING is clear that `schema.sql` is schema-only.

---

## Caching and runtime architecture

### The constraint that shapes everything

There are no background jobs today, and adding a real one is harder than it looks:

- **Next.js 16's `use cache` is in-memory by default**, and the docs are explicit
  about what that means on Vercel: *"Serverless — Cache entries typically don't
  persist across requests (each request can be a different instance)."* A
  `use cache` wrapper around the provider call would **not** stop one fetch per
  user per page load. It is the wrong tool for this.
- **`use cache: remote`** does give a shared, durable cache — but it requires
  `cacheComponents: true` in `next.config.ts` (a repo-wide behavioural change to
  an app that currently has none) and a platform-provided cache handler, which
  the docs note *"typically incurs platform fees."* $0/month rules it out.
- **Vercel cron on Hobby is once per day, with hour-granularity timing** — a job
  scheduled for 1:00am may fire any time before 2:00. Any `vercel.json` schedule
  firing more than daily fails at deploy time. (Per-project cron *count* was
  lifted to 100 on all plans in January 2026; it is the cadence, not the count,
  that binds.) If the project is on Pro this relaxes — **confirm which plan
  before designing around it**.

So: **Postgres is the cache**, and the refresh is **lazy, triggered by reads**.
This is not a workaround. Given a weekly budget of ~125 credits, a timer that
fires whether or not anyone is looking is strictly worse than a trigger that only
spends when someone actually wants to see something.

### The shape

```
GET /api/markets?event=<id>
  │
  ├─ read odds_events + odds_offers for the current week        (always, always cheap)
  │
  ├─ fresh (fetched_at within TTL)?  → return it. Done. No upstream call.
  │
  ├─ stale but present?              → return it immediately, with an "as of"
  │                                     timestamp, then after(() => refresh(scope))
  │
  └─ absent?                         → try to claim the scope; if claimed, fetch
                                        inline and return; if someone else holds
                                        the claim, return empty with "loading"
```

`after()` from `next/server` is available in Next 16 and works in Route Handlers:
*"allows you to schedule work to be executed after a response… is finished."* It
runs within the route's `maxDuration`, which is ample for one upstream call. This
gives stale-while-revalidate without a queue, without a cron, and without a
platform feature that costs money.

### The stampede guard, in SQL

Same idiom as `lockParlay` and `upsertLeg` — the database decides the winner, so
two cold instances arriving together cannot both spend credits:

```sql
update odds_fetches
   set claimed_at = now(),
       updated_at = now()
 where scope = $1
   and (claimed_at is null or claimed_at < now() - interval '90 seconds')
returning scope
```

No row back means someone else is already fetching; serve stale and return.
The 90-second expiry is the crash recovery — an instance that dies mid-fetch
releases its claim by timing out rather than by unwinding.

### The circuit breaker

Before every upstream call, in the same transaction shape:

```sql
update odds_budget
   set credits = credits + $2,
       updated_at = now()
 where period = $1
   and credits + $2 <= $3          -- $3 = the month's self-imposed cap
returning credits
```

Reserve the *estimated* cost before the call, then reconcile against the actual
`x-requests-last` after it. No row back means the budget is spent: **do not
fetch**, serve stale, and say so in the UI. Set the cap to 450, not 500 — leave
headroom for the reconciliation being wrong and for one manual refresh at the end
of a bad month.

Keep a one-line readout of `odds_budget.credits` on `/manage`. Fourteen people
and one admin; a number on a screen is a better monitoring system than an alert
nobody configured.

### Refresh cadence and TTLs

| Scope | TTL | Cost | Notes |
|---|---|---|---|
| `events` (game list) | 6h | 0 | Free. Refresh whenever. |
| `featured` (h2h/spreads/totals, whole slate) | 8h | 3 | 27/week. Cheap enough to feel live. |
| `event:<id>` (props, 4 markets) | 24h | 4 | Lazy. Hard cap 15/week. |

Plus **one daily Vercel cron** (allowed on Hobby) at a fixed hour to warm `events`
and `featured` — 3 credits/day, 21/week, and it means the first person to open the
browser on Sunday morning is not the one who pays the latency. Guard it with
`CRON_SECRET` per Vercel's documented pattern.

And a manual **"Refresh odds"** button on `/manage`. On a once-a-week prop budget,
the ability to say "refresh now, we're about to lock" is worth more than any
schedule — and it matches how this app already works.

### Where the key lives

`ODDS_API_KEY` as a Vercel environment variable on Production and Preview, read
only inside `src/lib/odds-provider.ts`. Never `NEXT_PUBLIC_`. The client sees
normalised offers from our own database and never the provider's response. Follow
`src/lib/db.ts`'s lazy-connect pattern: a missing key should fail on first use
with a sentence that says what to do, not at import time during `next build`.

---

## Odds movement and lock semantics

**Recommendation: freeze the price at submit. Do not track the book.**

The case for freezing:

1. **It is what actually happened.** Someone looked at `-115` and said yes to it.
   A price that silently becomes `-135` overnight rewrites what a person agreed
   to, and `/stats` will eventually report that as their record.
2. **The board's headline number would move under people.** `SummaryCard`'s
   combined odds is the emotional centre of this app. Fourteen legs each drifting
   independently means the number changes every time anyone reloads, for reasons
   nobody can see. That is worse than slightly stale.
3. **It is not the real price anyway.** The ticket is placed by a human at a book
   at lock time. The pre-lock combined number has always been a forecast. Tracking
   the aggregator more closely does not make it a quote.
4. **It costs credits we do not have.** Per the [quota math](#free-tier-quota-math),
   keeping fourteen legs continuously re-priced is exactly the pattern the free
   tier cannot fund.
5. **It is reversible.** Freezing and later adding tracking is easy. Tracking and
   later freezing means explaining why the number stopped moving.

The case for tracking — worth stating fairly — is that the whole pitch of the
feature is "real odds", and a leg showing `+240` when the book now says `+180`
makes the app a liar at the moment it matters most. That is a real objection, and
the answer is not to track the price but to **show the drift**:

- The cache is refreshing anyway for other people's browsing. When a leg's
  `offer_key` is present in `odds_offers` with a different `price`, `LegCard`
  shows a small chip: `-115 → -135` , or `moved` if the delta is small. No extra
  credits — it is a join against data already in the table.
- If the cached offer has disappeared entirely (market pulled, book took it down),
  the chip says `off the board` and the card keeps its price. The leg is still a
  leg; the human placing the bet will find out.

**What locking should snapshot.** At the moment `lockParlay()` runs:

- `legs.pick` and `legs.odds` — **already frozen**, by virtue of being stored
  columns. Nothing to do. This is the quiet benefit of the existing
  denormalisation.
- `legs.closing_odds` — write the cached price as of lock, for every leg whose
  offer is still in the cache. Record only; the parlay math never reads it.
  Optionally spend the ~20 credits to re-price the ticket's legs first, since that
  is the one fetch that is genuinely worth paying for.
- `weeks.locked_at` — unchanged.
- **Not** the market cache. It is week-scoped and disposable; a settled leg's
  record lives on the leg.

One consequence to design for deliberately: after the lock, the drift chip should
**stop updating**. Once the ticket is placed, the board is a record of what
happened, not a live view of a market nobody is betting into any more. That
mirrors the existing rule that unlocking is refused once anything has been graded.

---

## UI changes

### The flow

Today `AddLegView` is one screen: name, a textarea, an odds field, and the "What
this does" panel. It becomes a small stack, with the textarea path preserved
intact at the bottom of it.

```
  Your leg  (header unchanged: Cancel · title · Week N)
    │
    ├─ 1. Who's this          NamePicker, unchanged
    │
    ├─ 2. Find your pick      ← the default, and the screen that matters
    │      ┌──────────────────────────────────────┐
    │      │  🔍  Search a player or team         │   one input, autofocus
    │      └──────────────────────────────────────┘
    │      results, grouped by player:
    │        Christian McCaffrey  · SF v MIA · Sun 4:25
    │          Anytime TD                      -235
    │          Rushing yards   o 72.5          -115
    │          Receiving yards o 35.5          -135
    │      …
    │      [ Browse by game ]     [ Type it myself ]
    │
    ├─ 2b. Browse by game      16 rows, free to render:
    │        MIA @ SF · Sun 4:25
    │      → markets for that game:
    │        Anytime TD · Passing yards · Rushing yards · Receiving yards
    │        Moneyline · Spread · Total
    │      → selections within that market, with prices
    │
    ├─ 2c. Type it myself     TODAY'S SCREEN, VERBATIM. textarea + odds input.
    │
    └─ 3. Confirm             the selection rendered as the prose that will be
                              stored, the OddsChip, the book badge, and the
                              existing "What this does" panel unchanged.
                              [ Lock it in ]
```

**Search-first, not browse-first.** A fantasy player knows the player, not the
game. "Browse by game" is the fallback, not the front door — and it is also the
cheap one, since `/events` is free and `odds_offers` is already in Postgres.

### Component-level notes

- **`AddLegView.tsx`** — the "What this does" panel (before → after combined odds,
  `$10 would pay …`) is the best thing in this screen and must survive untouched
  on the confirm step. The footer (`Lock it in` / `Cancel`, `h-[54px]`) survives
  too. The `OddsError` decimal-odds helper stays on the "Type it myself" path,
  where it is still exactly right.
- **New `MarketPicker` / `OfferList`** — build on `NamePicker.tsx`'s pattern, and
  read its header comment first. Real `<button>` elements, not clickable `<li>`s;
  `pointerdown` for outside-dismissal, never `blur`. Those two decisions are
  load-bearing on iOS Safari and were clearly paid for once already.
- **`LegCard.tsx`** — add a muted book badge (`FanDuel`) and the line where one
  exists, plus the drift chip. `OddsChip` and `ResultChip` are already exported
  and reusable in the picker's rows, which keeps the price treatment (green for
  positive, cool blue for negative) identical everywhere.
- **Staleness, shown not hidden.** A footnote on the browser: `prices as of Sat
  9:14pm · FanDuel`. On a once-a-week prop refresh this is not a detail, it is the
  contract with the user. If the budget is spent, say that too:
  `prices are from Saturday — out of refreshes until the 1st`.
- **Mobile first.** Per CONTRIBUTING, most people submit from a phone on Sunday
  morning. The search results list is the screen to get right at 390px: one
  tappable row per selection, price right-aligned, `min-h-[44px]`.

### The prototype

`prototype/Parlay Pool.dc.html` is the exported Claude Design source and the
stated source of truth for how the UI should look. It holds eight artboards:

```
1a MAIN MOBILE, 6 LEGS   1b EMPTY          1c ADD LEG FILLED   1d ADD LEG ERROR
1e HISTORY               1f LOCKED 10/10   1g SINGLE LEG       1h DESKTOP
```

There is no market-browsing artboard. Designing these in the prototype first is
the right order — the design tokens in `src/app/globals.css` are lifted verbatim
from that file, and inventing new UI straight in React is how a codebase stops
matching its design source. New artboards needed:

- **market search, empty** — the input, the two escape-hatch buttons, a hint
- **market search, results** — grouped by player, prices right-aligned
- **game list** — 16 rows, kickoff times
- **market list for a game** — props above featured
- **selection list** — over/under pairs and one-sided (anytime TD) rows, which
  look different and need to be drawn as such
- **confirm** — selection + "What this does"
- **degraded** — provider down or budget spent; stale banner; free-text still there
- **leg card with a moved line** — the drift chip in situ, alongside 1a

That is a meaningful chunk of design work — call it a session of its own, and
worth doing before Phase 2 rather than after.

---

## Failure modes

| Failure | Detection | Behaviour |
|---|---|---|
| **Provider down / 5xx / timeout** | non-200, or a fetch that throws | Serve the cache with its `fetched_at`. Write `odds_fetches.last_error`. **Never block submission** — free text is always one tap away. Match `page.tsx`'s existing posture: render the board anyway so the failure is legible instead of a crash. |
| **Quota exhausted** | `odds_budget` refuses the reservation; or a 401/429 from upstream | Same as above, plus honest copy: "out of refreshes until the 1st". The browser still works off cache — a week-old prop board is still better than a textarea. |
| **Budget miscounted** | reconciliation of `x-requests-last` against the reserved estimate drifts | Trust `x-requests-remaining` over our own sum — it is the provider's number. Correct `odds_budget` to `cap - remaining` on every response. This is why the cap is 450, not 500. |
| **Market pulled or suspended between browse and submit** | `offer_key` no longer in `odds_offers` at POST time | **Accept the submit anyway**, using the price the user saw, and mark the leg. The app does not place bets; a human does. Refusing here would be the app pretending to an authority it does not have. Show `off the board` on the card. |
| **Line moved between browse and submit** | cached `price` differs from the posted one | Accept, store what the user saw (see [lock semantics](#odds-movement-and-lock-semantics)), show the drift chip. Do **not** silently substitute the new price — that is the one behaviour guaranteed to make someone feel cheated. |
| **The league wants a market the API doesn't carry** | user can't find it | Free text. This is the designed answer, which is why "Type it myself" is a peer of the search box and not buried in a menu. |
| **Player name differs between books** ("C. McCaffrey" vs "Christian McCaffrey") | — | Store the book's `description` verbatim; do not normalise. If more than one book is shown, group by market rather than by name. Attempting a canonical player table is a much larger feature wearing this one's clothes. |
| **Stale event list across a week boundary** | `league_state` moves on `/manage` but `odds_events` still holds last week's games | Scope cache reads to `(season, week)` from `league_state` exactly as `store.ts` already does, and prune on week change. A market browser showing last week's games is worse than showing none. |
| **Two cold instances refresh at once** | — | The SQL claim in `odds_fetches` decides; loser serves stale. |
| **Runaway client loop hits `/api/markets`** | budget drains | The circuit breaker is the backstop. Because there is no auth, assume this *will* happen once — a bad `useEffect` in a preview deploy pointed at the same key would do it. Consider a separate, smaller cap for Preview, or a distinct key. |
| **Provider changes its response shape** | normaliser throws | Catch per-market, not per-response: a payload with one unexpected market should still yield the other nine. Log and skip. |
| **Cache table growth** | — | Prune offers for events older than 7 days in the refresh path. At 16 games x ~400 offers/week this is small, but it is unbounded without it. |
| **Someone edits a selected leg** | `PATCH /api/legs/:id` with `pick`/`odds` | Editing a book leg by hand should demote it to `source = 'manual'` and null the provenance, or the columns will lie. The `legs_book_leg_complete` check enforces that at the database. |

---

## Build phases and effort

In units of a focused session. Estimates assume someone who has read this document
and the codebase, working with the repo's existing conventions.

### Phase 0 — settle the quota question · **0.5 session**

No code ships. Sign up for a free key and make three calls:

```bash
# free — and returns the real quota in a header
curl -s -D- -o/dev/null "https://api.the-odds-api.com/v4/sports?apiKey=$KEY" | grep -i x-requests
# free — the week's slate
curl -s "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?apiKey=$KEY"
# costs 1 credit — and x-requests-last says exactly how much
curl -s -D- "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/$EVENT/odds?apiKey=$KEY&bookmakers=fanduel&markets=player_anytime_td&oddsFormat=american"
```

Answers, for a total spend of 1 credit: is the free plan 500 credits or 25
requests/day? Are NFL props actually returned? Is the per-event cost what the docs
say? Write it down. **If the free plan turns out to be h2h-only, stop here and
report back** — the feature as scoped is dead and the decision is the user's.

### Phase 1 — the pipe, with no UI · **1 session**

`schema.sql` additions · `src/lib/odds-provider.ts` (fetch + normalise +
`x-requests-last`) · `src/lib/markets.ts` (cache reads/writes, claim, budget) ·
`GET /api/markets` · a "Refresh odds" button and a credits readout on `/manage`.

Nothing on the board changes. Verifiable by pressing the button and looking at
`odds_offers` in the database. Ships safely because it is purely additive.

### Phase 2 — the browser · **2 sessions**

`AddLegView` becomes the stack above · new picker components following
`NamePicker`'s pattern · `legs` provenance columns wired through `store.ts` ·
`POST /api/legs` accepting `{ name, offerKey }` and resolving the price
server-side · free text preserved as a peer path.

**End of Phase 2 is the end of "minimum viable".** Everything after is polish.

### Phase 3 — make the refresh not stupid · **1 session**

Stale-while-revalidate via `after()` · TTLs per scope · the daily Vercel cron warm
with `CRON_SECRET` · budget reconciliation against `x-requests-remaining` ·
degraded-mode copy everywhere it belongs.

### Phase 4 — drift and lock · **0.5–1 session**

The moved-line chip on `LegCard` · `closing_odds` written at lock · "prices as
of" footnotes · the off-the-board state.

### Phase 5 — design · **1 session, and it should really come before Phase 2**

The eight new artboards in `prototype/`, plus any token additions lifted into
`globals.css`.

**Total: 6–7 sessions.**

### The thinnest version that delivers real value · **≈2 sessions**

Phase 1, plus a cut-down Phase 2:

- One weekly snapshot of **four** prop markets (anytime TD, pass yards, rush
  yards, reception yards) for the whole slate, from **one** book, refreshed by
  hand from `/manage`. 64 credits a week, comfortably inside the free plan, and
  it needs no cron, no `after()`, no TTL logic and no circuit breaker beyond a
  hard "refuse if this month is over 450".
- One **search box** on `AddLegView`, above the existing form. Type a player,
  tap a result, and it **fills in** today's `pick` textarea and `odds` field
  rather than replacing them. Submit is unchanged. The provenance columns can
  come later or not at all.
- Free text untouched and unmoved.

That skips the multi-screen browser, skips odds movement entirely, and still kills
both of the things that actually hurt on a Sunday morning: writing the pick as
prose and typing `-115` wrong. If only one thing gets built, build that.

---

## Open questions

1. **Is the free plan 500 credits/month with all markets, or 25 requests/day with
   h2h only?** The two claims are irreconcilable and the answer decides whether
   this feature exists. One free call settles it. Everything in this document
   assumes the former.
2. **Is the Vercel project on Hobby or Pro?** Hobby caps cron at once a day with
   hour-granularity timing. Pro would allow a proper refresh loop and would change
   the architecture recommendation from "lazy, read-triggered" to "scheduled".
3. **Which book does the league actually place the ticket with?** It pins the
   `bookmakers=` parameter. It costs nothing either way (groups of 10 books = 1
   region), but showing a price from a book nobody uses is worse than showing no
   price.
4. **Does the league bet anything other than player props?** Spreads and totals
   for the whole slate cost 3 credits against 160. If a meaningful share of legs
   are team markets, those should be permanently fresh and the props rationed —
   which is what the recommended budget assumes, on a guess.
5. **Is a once-a-week prop snapshot acceptable?** This is the honest free-tier
   ceiling and it should be put to the user before Phase 2, not discovered after.
   "The prices are from Saturday night" may be perfectly fine for a $10 ticket, or
   it may be the thing that makes the feature feel fake.
6. **Should a selected leg record which book priced it, and does the person
   placing the bet have to use that book?** Affects whether the drift chip is
   informative or misleading.
7. **Does `/history` and `/stats` want the structured columns?** They are
   wireframes today. "Your record on anytime-TD legs" becomes trivial once
   `market_key` is stored, which may argue for storing provenance in the thin
   version after all.
8. **Grading.** `/scores` costs 1–2 credits and could auto-grade team markets —
   but **not** player props, which have no settlement data in any free source.
   Adjacent, cheap, and explicitly out of scope here; worth its own note.
9. **Testing.** The response normaliser is the first thing in this repo that
   really wants a unit test (optional `point`, one-sided markets, missing books).
   CI runs `lint && typecheck && build` only. Adding a test runner is a repo-wide
   decision, not this feature's to make.

---

## Appendix: raw endpoint samples and citations

### A note on how these were obtained

**I could not call any odds API from this session.** Every provider host is
blocked by the egress proxy (403 on CONNECT — see the
[method note](#method-and-its-limits--read-this-before-trusting-any-number-below)).
TLS verification was never disabled and no proxy was bypassed. The samples below
are real API responses archived in public GitHub repositories, fetched via
`raw.githubusercontent.com` (which is reachable), plus the vendor's own docs
mirrored into a public repo. Provenance is given for each. Treat them as accurate
in **shape**; re-verify prices and quotas against a live key in Phase 0.

### A1 — real NFL player-prop response, 2026 season

`GET /v4/sports/americanfootball_nfl/events/{eventId}/odds?bookmakers=fanatics&markets=player_anytime_td,player_pass_yds,player_reception_yds,player_rush_yds&oddsFormat=american`

Captured 2026-09-15, archived at
`https://raw.githubusercontent.com/jayhen225/Vig/main/parlay/data/odds_raw/20260915T034822Z/68bc55903f50af4af4766adcc89fcc61.json`.
Trimmed to the first three outcomes per market; the full file is 5.7 KB for
**one book, one game, four markets** — 35 outcomes.

```json
{
  "id": "68bc55903f50af4af4766adcc89fcc61",
  "sport_key": "americanfootball_nfl",
  "sport_title": "NFL",
  "commence_time": "2026-09-20T20:25:00Z",
  "home_team": "San Francisco 49ers",
  "away_team": "Miami Dolphins",
  "bookmakers": [
    {
      "key": "fanatics",
      "title": "Fanatics",
      "markets": [
        {
          "key": "player_anytime_td",
          "last_update": "2026-09-15T03:47:26Z",
          "outcomes": [
            { "name": "Yes", "description": "No Scorer",           "price": 10000 },
            { "name": "Yes", "description": "Demarcus Robinson",   "price": 450 },
            { "name": "Yes", "description": "Christian McCaffrey", "price": -235 }
          ]
        },
        {
          "key": "player_pass_yds",
          "last_update": "2026-09-15T03:47:26Z",
          "outcomes": [
            { "name": "Over",  "description": "Brock Purdy", "price": -115, "point": 225.5 },
            { "name": "Under", "description": "Brock Purdy", "price": -115, "point": 225.5 }
          ]
        },
        {
          "key": "player_rush_yds",
          "last_update": "2026-09-15T03:47:26Z",
          "outcomes": [
            { "name": "Over",  "description": "De'Von Achane", "price": -140, "point": 45.5 },
            { "name": "Under", "description": "De'Von Achane", "price": 105,  "point": 45.5 }
          ]
        }
      ]
    }
  ]
}
```

Everything the schema needs is here and nothing is missing:

| Column | Source |
|---|---|
| `event_id` | `.id` |
| `book` | `.bookmakers[].key` |
| `market_key` | `.bookmakers[].markets[].key` |
| `selection` | `.outcomes[].name` — `"Over"`, `"Under"`, `"Yes"` |
| `player` | `.outcomes[].description` |
| `line` | `.outcomes[].point` — **absent on one-sided markets**; the normaliser must handle it as optional, not as `0` |
| `price` | `.outcomes[].price` — already American when `oddsFormat=american`, directly compatible with `legs.odds` and `isValidAmericanOdds` |
| `last_update` | `.bookmakers[].markets[].last_update` — per-market, not per-book |

Two shape hazards worth the normaliser's attention: `player_anytime_td` is
one-sided (every outcome is `"Yes"`, no `"No"`, no `point`), and it includes a
`"No Scorer"` pseudo-player at `+10000` that should almost certainly be filtered
out of a picker.

### A2 — event list (free endpoint), from the vendor's own docs

`GET /v4/sports/americanfootball_nfl/events?apiKey=…` — *"Odds are not included
in the response. This endpoint does not count against the usage quota."*

```json
[
  {
    "id": "a512a48a58c4329048174217b2cc7ce0",
    "sport_key": "americanfootball_nfl",
    "sport_title": "NFL",
    "commence_time": "2023-01-01T18:00:00Z",
    "home_team": "Atlanta Falcons",
    "away_team": "Arizona Cardinals"
  }
]
```

This is the whole "browse by game" screen, for free.

### A3 — event-odds quota costs, verbatim from the v4 docs

> **Usage Quota Costs** — The usage quota cost depends on the number of markets
> and regions used in the request.
>
> `cost = [number of unique markets returned] x [number of regions specified]`
>
> - 1 market, 1 region → Cost: 1
> - 3 markets, 1 region → Cost: 3
> - 1 market, 3 regions → Cost: 3
> - 3 markets, 3 regions → Cost: 9
>
> **More info**
> - Responses with empty data do not count towards the usage quota.
> - When calculating the market component of usage quota costs, a count of unique
>   markets in the API response is used. For example if you specify 5 different
>   markets and 1 region in the API call, and data is only available for 2
>   markets, the cost will be [2 markets] x [1 region] = 2

And from the `bookmakers` parameter description:

> Every group of 10 bookmakers is the equivalent of 1 region. For example,
> specifying up to 10 bookmakers counts as 1 region. Specifying between 11 and 20
> bookmakers counts as 2 regions.

Mirrored at
`https://raw.githubusercontent.com/maxemileffort/quanticon/main/quant_bet/ext_api_docs/odds_api.md`;
original at <https://the-odds-api.com/liveapi/guides/v4/>.

### A4 — the vendor's own sample code, on cost and on props

From <https://github.com/the-odds-api/samples-python> (`odds.py`, `event_odds.py`):

```python
# The usage quota cost = [number of markets specified] x [number of regions specified]
# For examples of usage quota costs, see https://the-odds-api.com/liveapi/guides/v4/#usage-quota-costs

# Note only featured markets (h2h, spreads, totals) are available with the odds endpoint.
MARKETS = 'h2h_q1,player_points,player_rebounds'   # event_odds.py — props go through /events/{id}/odds

print('Total credits remaining', odds_response.headers['x-requests-remaining'])
print('Total credits used',      odds_response.headers['x-requests-used'])
```

### A5 — endpoint quota table, independently restated

From the SportsDataverse Python package's Odds API tutorial
(`sportsdataverse/sportsdataverse-py`, `docs/versioned_docs/*/tutorials/12_odds_intro.md`),
which marks each wrapper free or paid:

```
toa_sports              Every in-season sport/league key                 free
toa_sports_events       Upcoming + live event list (grab event_ids here) free
toa_event_markets       Which markets a game has on offer                free*
toa_sports_scores       Live + recently-completed scores                 free
toa_sports_participants Teams / participants for a sport                 free
toa_sports_odds         Current odds for a sport (featured markets)      paid
toa_event_odds          Odds for a single game, including player props   paid
toa_*_history           Historical snapshots                             paid
```

*The v4 docs say `/events/{id}/markets` "costs 1 usage credit"; this table calls
it free. Minor discrepancy — assume 1 credit and budget accordingly.

### A6 — realistic NFL market key set

From a working public integration,
`https://raw.githubusercontent.com/vinnybarbs/Cray_Cray_Parlay_App/main/config/sports-config.js`:

```js
const PROP_MARKETS = {
  americanfootball_nfl: [
    'player_pass_tds', 'player_pass_yds', 'player_pass_completions',
    'player_pass_attempts', 'player_pass_interceptions', 'player_rush_yds',
    'player_rush_attempts', 'player_receptions', 'player_reception_yds',
    'player_anytime_td'
  ],
};
```

### Citations

**The Odds API**
- Docs v4 — <https://the-odds-api.com/liveapi/guides/v4/> (blocked here; read via
  the `maxemileffort/quanticon` mirror)
- Betting markets list — <https://the-odds-api.com/sports-odds-data/betting-markets.html>
- Bookmakers by region — <https://the-odds-api.com/sports-odds-data/bookmaker-apis.html>
- NFL coverage — <https://the-odds-api.com/sports/nfl-odds.html>
- Plans — <https://the-odds-api.com/#get-access>; FAQs — <https://the-odds-api.com/manage/faqs.html>
- Official samples — <https://github.com/the-odds-api/samples-python>, <https://github.com/the-odds-api/apps-script>
- Third-party plan summary — <https://apis.io/plans/the-odds-api/the-odds-api-plans-pricing/>

**Alternatives**
- SportsGameOdds pricing — <https://sportsgameodds.com/pricing>; rate limits — <https://sportsgameodds.com/docs/info/rate-limiting>; NFL — <https://sportsgameodds.com/leagues/nfl-odds-api>
- OpticOdds pricing — <https://opticodds.com/pricing>; API reference — <https://developer.opticodds.com/reference/getting-started>
- odds-api.io free tier — <https://odds-api.io/pricing/free>
- OddsPapi free tier and comparisons — <https://oddspapi.io/blog/odds-api-pricing-2026-comparison/>, <https://oddspapi.io/blog/the-odds-api-free-tier-limits/> *(competitor marketing — treat claims about The Odds API as adversarial)*
- SharpAPI pricing — <https://sharpapi.io/pricing>; free tier comparison — <https://sharpapi.io/compare/free-sports-odds-api>; NFL — <https://sharpapi.io/odds/nfl> *(all vendor self-reporting; no independent corroboration found)*
- API-Sports — <https://api-sports.io/>
- Directory — <https://sportsapis.dev/free-odds-api>

**FanDuel scraping**
- <https://dataresearchtools.com/how-to-scrape-fanduel-odds-2026/> (endpoint names, 2026 defences)
- <https://www.netify.ai/resources/hostnames/sbapi.in.sportsbook.fanduel.com> (DNS-based geolocation)
- <https://www.scrapingbee.com/scrapers/fanduel-api/> (a vendor selling the workaround — read accordingly)

**Platform**
- Next.js 16 docs, read locally from `node_modules/next/dist/docs/`:
  `01-app/03-api-reference/01-directives/use-cache.md` (in-memory default;
  serverless entries "typically don't persist across requests"),
  `use-cache-remote.md` (requires `cacheComponents`, "typically incurs platform
  fees"), `01-app/01-getting-started/15-route-handlers.md` (handlers uncached by
  default), `01-app/03-api-reference/04-functions/after.md`,
  `01-app/03-api-reference/03-file-conventions/route.md` (segment config)
- Vercel cron — <https://vercel.com/docs/cron-jobs>, <https://vercel.com/docs/cron-jobs/usage-and-pricing>, <https://vercel.com/docs/cron-jobs/manage-cron-jobs> (`CRON_SECRET` pattern), <https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan>, <https://vercel.com/docs/limits> *(vercel.com blocked here; read via search and the Vercel documentation tool)*
- Hobby cadence limits corroborated by <https://steadycron.com/guides/vercel-cron-limits/> and <https://crontap.com/blog/vercel-cron-hourly-limit-and-how-to-beat-it>
