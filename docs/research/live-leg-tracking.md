# Live leg tracking from a free NFL data feed

Research notes, 2026-09-16. Feature A: once the parlay is locked and games kick
off, each leg shows live progress and flips to won/lost on its own instead of
someone tapping **Mark won**.

Nothing here is implemented. This is the warm start for the session that builds
it. Written for someone who has not seen this research and should not have to
re-do it.

**A note on what was and was not verified.** This sandbox's egress proxy allows
GitHub and almost nothing else. Every ESPN, NFL.com and commercial-API host was
denied at CONNECT with a 403 (organization policy, not a bad URL — see the
appendix for the denial list). So:

- Everything said about **nflverse** below was measured first-hand, today, with
  `curl` and `git log` against real 2026 season data. Treat it as fact.
- Everything said about **ESPN** is from third-party sources — the endpoint
  schema is cross-checked against a widely-used R package's parser and two
  independent documentation projects, but **no ESPN response was observed
  here**. Treat it as strong hearsay that a build session must verify in its
  first ten minutes. Vercel has no such egress restriction, so these endpoints
  will be reachable from the deployed app and from any normal dev machine.

---

## Verdict

Feasible, but not in the shape the feature request imagines, and the two halves
of it have very different price tags. **Automatic settlement is easy, free, and
low-risk** — nflverse publishes final scores within roughly 5–15 minutes of each
game's final whistle and full player box scores within an hour of each window
closing, all as plain CSV on GitHub with no key and no terms-of-service problem.
That alone kills the Sunday-night chore of grading fourteen legs by hand.
**Live in-game progress is a different feature** — no free source that this
research could verify gives live player yardage, and the only credible free
option for it (ESPN's undocumented public JSON) is unverifiable from here,
carries real ToS and stability risk, and cannot be polled by Vercel Cron on a
Hobby plan, which caps cron at once per day. The honest recommendation: build
auto-settlement first on nflverse, ship it, and treat live progress as a
separate, optional, ESPN-dependent phase that you can delete without losing
anything. And be clear that all of this only works if legs stop being free text
— which is the real cost of the feature, and it lands on the submit form, not
on the feed.

---

## Data sources

### nflverse / nflfastR (GitHub release assets) — VERIFIED, recommended

The nflverse project publishes NFL data as release assets on
`github.com/nflverse/nflverse-data`. No key, no signup, plain HTTPS, CSV and
parquet. Everything in this section was fetched today.

**Exact URLs** (all `GET`, all returned HTTP 200 here):

| Asset | URL |
|---|---|
| Schedules + final scores + closing lines | `https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv` |
| Weekly player box scores | `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv` |
| Play-by-play | `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv` |
| Player ID crosswalk | `https://github.com/nflverse/nflverse-data/releases/download/players/players.csv` |

These redirect (302) to `release-assets.githubusercontent.com` with a signed,
short-lived URL. `curl -L` handles it; so does `fetch` with default redirect
following. Sizes measured today: `games.csv` 2.1 MB, `stats_player_week_2026.csv`
499 KB, `play_by_play_2026.csv` 5.5 MB, `players.csv` 7.3 MB.

**Auth:** none. **Rate limits:** none documented; these are GitHub release
downloads served from a CDN. Polling a 2 MB file every 60 seconds would be
antisocial, but a few requests per minute is nothing. Use conditional requests —
`Last-Modified` and `ETag` are both served, so `If-Modified-Since` gets you a
cheap 304.

**ToS / stability risk: low.** This is a public open-data project that *wants*
to be consumed this way; its own README says "If you would like to read directly
from URLs, linking to nflverse-data release URLs is now the best way to do so."
The URLs have been stable for years. The realistic risk is a workflow breaking
for a week, not the data disappearing.

#### How live is it, actually?

**It is not live.** This was the single most important thing to pin down, and
the answer is unambiguous from two independent measurements.

*First*, the update schedule is in the workflow file at
`nflverse/nflverse-pbp/.github/workflows/update_data.yaml`, quoted verbatim:

```yaml
on:
  schedule:
  # Every day at 9:00 UTC/5:00 ET
   - cron:  '3 9 * 1,2,9-12 *'
  # TNF 5:30 AM UTC / 12:30 AM ET
   - cron:  '33 5 * 1,2,9-12 5'
  # Early window: 10:00 PM UTC / 5:00 PM ET
   - cron:  '3 22 * 1,2,9-12 0'
  # Late window: 0:00 UTC / 8:00 ET
   - cron:  '7 0 * 1,2,9-12 1'
  # SNF/MNF: 5:30 UTC / 12:30 ET
   - cron:  '33 5 * 1,2,9-12 1'
   - cron:  '33 5 * 1,2,9-12 2'
```

Every trigger fires *after* a window of games has finished. There is no trigger
during a game. Play-by-play and player stats are a post-window batch, by design.

*Second*, the data agrees. Today is Wednesday 2026-09-16; Week 1 ended with
Monday night's DEN@KC on 09-14. As of now:

- `play_by_play_2026.csv` — `Last-Modified: Tue, 15 Sep 2026 14:20:02 GMT`,
  2,756 plays, **week 1 only**, 16 games, game dates 2026-09-09 → 2026-09-14.
- `stats_player_week_2026.csv` — `Last-Modified: Tue, 15 Sep 2026 14:21:38 GMT`,
  1,118 player-week rows, **week 1 only**.

So: complete Week 1 player stats were available Tuesday morning, and per the
cron, the early-window games' stats would have been available Sunday ~5:03 pm ET.

**Worth knowing:** `nflfastR` itself is no longer a live scraper. Its
`fetch_raw()` reads from `raw_pbp_urls()`, which is literally
`https://github.com/nflverse/nflverse-pbp/releases/download/raw_pbp_{season}/{game_id}.rds`
(`nflfastR/R/utils.R:341`). There is no NFL.com request left in the package. If
you were hoping to copy nflfastR's live path, there isn't one.

#### The part that *is* fast: `games.csv`

`games.csv` is a separate pipeline (Lee Sharpe's `nflverse/nfldata`, released by
`.github/workflows/release_games.yml`, which fires on every push to
`data/games.rds`). It is updated **continuously, roughly every 10–30 minutes,
around the clock**. Today's asset carried `Last-Modified: Wed, 16 Sep 2026
13:06:29 GMT` — seven minutes before I checked.

I walked the git history of `nfldata/data/games.csv` across Sunday 2026-09-13 to
find out whether that frequency means live scores. **It does not** — score
fields stay empty until a game is final, then populate all at once:

```
commit 66dc458  2026-09-13 16:45 UTC   2026_01_BUF_HOU  away=     home=     result=
commit b6d86c7  2026-09-13 19:15 UTC   2026_01_BUF_HOU  away=     home=     result=      <- mid-game, still empty
commit 89f1b73  2026-09-13 20:05 UTC   2026_01_BUF_HOU  away=     home=     result=
commit ecc8cf9  2026-09-13 20:23 UTC   2026_01_BUF_HOU  away=  36 home=  31 result=  -5  <- final, all at once
```

Per-game, the first commit carrying a score:

| Game | Slot | Score first present (UTC) | ≈ local |
|---|---|---|---|
| `2026_01_TB_CIN` | Sun 1:00 pm ET | 2026-09-13 20:10 | 4:10 pm ET |
| `2026_01_BUF_HOU` | Sun 1:00 pm ET | 2026-09-13 20:23 | 4:23 pm ET |
| `2026_01_CHI_CAR` | Sun 1:00 pm ET | 2026-09-13 20:40 | 4:40 pm ET |
| `2026_01_NO_DET` | Sun 1:00 pm ET | 2026-09-13 20:49 | 4:49 pm ET |
| `2026_01_GB_MIN` | Sun 4:25 pm ET | 2026-09-13 23:47 | 7:47 pm ET |
| `2026_01_DAL_NYG` | SNF | 2026-09-14 03:32 | 11:32 pm ET Sun |
| `2026_01_DEN_KC` | MNF | 2026-09-15 03:20 | 11:20 pm ET Mon |

That is essentially "within minutes of the final whistle, per game". This is the
single most useful free fact in this document: **game-level markets (spread,
total, moneyline) can be settled automatically, per game, within ~15 minutes of
that game ending, from one 2 MB CSV, with no ToS risk at all.**

`games.csv` also carries the closing line and, crucially, `espn` — the ESPN
event id — which is the free bridge to ESPN's live endpoints if you build that
phase. And `players.csv` is a name → `gsis_id` → `espn_id` crosswalk (24,824
rows), so one file resolves a structured leg's player to both feeds. Verified:
`Puka Nacua` → `gsis_id=00-0039075`, `espn_id=4426515`;
`Chris Olave` → `gsis_id=00-0037239`, `espn_id=4361370`.

**Stat corrections:** the daily 09:03 UTC run means corrections do flow in, but
on a one-day lag. A leg auto-settled Sunday evening can disagree with the
Tuesday file. See *Failure modes*.

### ESPN public JSON (`site.api.espn.com`, `sports.core.api.espn.com`, `cdn.espn.com`) — NOT VERIFIED HERE

**This sandbox cannot reach ESPN.** Both `curl` and `WebFetch` were refused:

```
$ curl -sS "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
curl: (56) CONNECT tunnel failed, response 403
# proxy status: site.api.espn.com:443 — connect_rejected (organization policy)
```

This is an egress-policy denial in *this* environment, not evidence about ESPN.
Vercel functions have unrestricted outbound HTTPS, so these endpoints should be
reachable from the deployed app. **A build session must confirm this before
committing to the live phase.**

What third-party sources say, as of 2026: the endpoints are still public, still
unauthenticated, still undocumented. The old ESPN Developer Center and its
`apikey` parameter were retired years ago and any code still passing one is
ignored. No shutdown or auth wall as of 2026. Sourced from
[pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API) (whose
README notes it was mapped from ESPN's own WADL at
`sports.core.api.espn.com/v2/application.wadl`, with CDN asset patterns
"live-verified (HTTP 200) on 2026-07-04"), [aaronweldy/espn-openapi](https://github.com/aaronweldy/espn-openapi),
and [nntrn's endpoint gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c).

**Endpoints that matter here:**

| Purpose | URL |
|---|---|
| Live scoreboard, all games | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` |
| One game, incl. player box score | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={EVENT_ID}` |
| Boxscore only, CDN-optimised | `https://cdn.espn.com/core/nfl/boxscore?xhr=1&gameId={EVENT_ID}` |
| Real play-by-play | `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{EVENT_ID}/competitions/{EVENT_ID}/plays?limit=300` |
| Current situation (down/distance) | `.../competitions/{EVENT_ID}/situation` |
| One athlete's stats in one game | `.../competitions/{EVENT_ID}/competitors/{TEAM_ID}/roster/{ATHLETE_ID}/statistics/0` |

`{EVENT_ID}` is exactly the `espn` column in nflverse's `games.csv`, so you get
it for free and never have to scrape a schedule.

**Granularity — is there a real play-by-play?** Yes, `.../plays` is a genuine
drive-and-play feed, and the `summary` endpoint carries a full player box score.
The box score shape is not a guess; it is pinned down by the parser in
`espnscrapeR::get_nfl_boxscore_players`, which calls exactly
`site.api.espn.com/apis/site/v2/sports/football/nfl/summary` with
`event` and `enable=ranks,odds,linescores,logos`, and then walks:

```
boxscore.players[]              -> { team, statistics[] }
  statistics[]                  -> { name, labels[], descriptions[], totals[], athletes[] }
    name                        == "passing" | "rushing" | "receiving" | "fumbles"
                                   | "defensive" | "interceptions" | "kickReturns"
                                   | "puntReturns" | "kicking" | "punting"
    athletes[]                  -> { athlete: { id, uid, guid, firstName, lastName,
                                                displayName }, stats[] }
      stats[]                   positional, aligned index-for-index with labels[]
```

The parser's renames tell you the label vocabulary: receiving is `REC / YDS /
AVG / TD / LONG / TGTS`, rushing is `CAR / YDS / ...`, passing carries a
`C/ATT` pair it splits on `/` and a `SACKS` pair it splits on `-`. **Note the
stats are strings, positionally aligned to `labels`** — parse by looking up the
label index, never by a fixed offset, because ESPN has changed column order
before.

**Update latency during a live game:** unverified. The community consensus is
that `cdn.espn.com/core/nfl/...?xhr=1` is what espn.com's own scoreboard polls
and updates within seconds-to-tens-of-seconds of a play, and that `summary`
box-score numbers track a few plays behind. **Do not design against a specific
number until someone has watched it during an actual game.** A build session
should sit on one game for ten minutes and log the deltas.

**Rate limits:** none published. The only guidance anywhere is "be respectful —
no official limits published, but excessive requests may be blocked." Budget one
request per game per 30–60 seconds and cache aggressively.

**ToS / stability risk: real, and worth saying plainly.** These are private
endpoints powering ESPN's own apps. There is no agreement permitting their use,
no deprecation policy, no status page, and no support. They can change shape or
start requiring auth on any Tuesday with no notice. For a fourteen-person
private league with a $10 ticket, the practical risk is that the feature breaks,
not that anyone gets sued — but the design has to assume it *will* break, which
is exactly why the manual override below is non-negotiable.

### NFL.com (`www.nfl.com`, `feeds.nfl.com`, `api.nfl.com`) — NOT VERIFIED, and probably a dead end

Also blocked here (`www.nfl.com:443 — connect_rejected`, `feeds.nfl.com:443 —
connect_rejected`). More importantly, the historical reason to care about
NFL.com was that nflfastR scraped it — and as shown above, it no longer does.
The old `nfl.com/liveupdate/game-center/...` JSON has been gone for years and
the modern `api.nfl.com` path requires an OAuth token minted by NFL's own apps.
Not recommended. If ESPN ever closes, this is the next thing to investigate, not
the thing to build on now.

### Free tiers of commercial APIs — not recommended, listed for completeness

All blocked here, so nothing below is verified; from 2026 search results:

- **Highlightly** — free Basic tier, ~100 requests/day, live scores and
  play-by-play events. 100/day does not survive one Sunday of polling.
- **Big Balls Sports Data** — free tier ~1,000 requests/day (2,000 linked to
  GitHub), but play-by-play is reported to be behind a Pro key.
- **MySportsFeeds** — free for personal/non-commercial use, includes
  play-by-play; requires signup and approval.
- **Tank01 (via RapidAPI)** — live in-game stats and player props, freemium.

These all need an account, a key in env, and quota management, and every one of
them can change its free tier. Against ESPN — no key, no quota, no signup — they
are worse on every axis except the piece of paper. The one that might be worth a
look if ESPN falls over is MySportsFeeds, because personal use is explicitly
permitted.

### The odds themselves

Out of scope but worth noting so nobody goes looking: nothing free gives live
player-prop *lines*. `games.csv` carries closing spread/total/moneyline
(`spread_line`, `total_line`, `away_moneyline`, `home_moneyline`, `over_odds`,
`under_odds`) — see the appendix. That is enough to sanity-check a team-market
leg's odds, but the app takes odds from the submitter anyway, so this is a nice
-to-have at most.

---

## What can and cannot be auto-settled

"The league actually bets" column is the realistic menu for a fourteen-person
fun parlay. Two verdict columns because the two sources have very different
reach.

| Leg type | nflverse (free, post-game) | ESPN (free, live — unverified) | Notes |
|---|---|---|---|
| **Spread** (`Chiefs -3.5`) | ✅ Full, ~5–15 min after that game ends | ✅ Live, plus running margin | `games.csv` `home_score`/`away_score`/`result`. Easiest thing in this document. |
| **Total** (`over 44.5`) | ✅ Full, same latency | ✅ Live | `games.csv` `total`. |
| **Moneyline** | ✅ Full, same latency | ✅ Live | Handle ties: `result == 0`. |
| **Passing yards O/U** | ✅ After the window (~5 pm ET for 1 pm games) | ✅ Live | `stats_player_week` `passing_yards`; ESPN `statistics[name="passing"]`. |
| **Rushing yards O/U** | ✅ After the window | ✅ Live | `rushing_yards`. |
| **Receiving yards O/U** | ✅ After the window | ✅ Live | `receiving_yards`. Attribution is clean in both — see below. |
| **Receptions O/U** | ✅ After the window | ✅ Live | `receptions` / ESPN `REC`. |
| **Passing/rushing/receiving TDs O/U** | ✅ After the window | ✅ Live | `passing_tds`, `rushing_tds`, `receiving_tds`. |
| **Anytime TD scorer** | ✅ After the window | ✅ Live | `rushing_tds + receiving_tds > 0`. Miss case: a defensive or special-teams TD by a skill player — check `special_teams_tds` too. |
| **First TD scorer** | ⚠️ Derivable from pbp only | ⚠️ Derivable from `plays[]` only | Not a column anywhere. You must scan plays in time order for the first `touchdown == 1` **across the whole slate**, not just one game, if the bet was slate-wide. Fiddly. Punt to manual. |
| **Player longest reception / rush** | ⚠️ pbp only | ✅ ESPN `LONG` label | nflverse weekly stats have `receiving_40` style buckets, not a max. |
| **Player 2+ TDs, 100+ yard game** | ✅ After the window | ✅ Live | Same columns, different comparison. |
| **Team total points** | ✅ | ✅ | From the same score fields. |
| **Alt lines / "to record a sack" / defensive props** | ⚠️ Partial | ⚠️ Partial | nflverse has `def_tackles_solo`, `def_sacks` etc.; ESPN has a `defensive` block. Doable but a long tail of mappings for very few real legs. |
| **SGP-style combos** (`Mahomes 250+ yds AND Chiefs win`) | ❌ | ❌ | Not a single market. Would need a leg to hold multiple conditions. Out of scope — see *Open questions*. |
| **Anything genuinely weird** (`a coach gets a Gatorade bath`) | ❌ | ❌ | This is why manual grading stays forever. |

**On the ugly ones, specifically:**

*Is receiving yardage live and correctly attributed?* In nflverse, yes and it is
clean — the play-by-play carries `receiver_player_id`, `receiver_player_name`
and `receiving_yards` per play, and `stats_player_week` carries the summed
`receiving_yards` keyed on a stable `gsis_id`. Verified against real Week 1 data:
Chris Olave, `player_id=00-0037239`, `receptions=10 targets=13
receiving_yards=182`, and summing his individual plays out of the pbp file gives
the same 182 across 10 catches. There are separate `lateral_receiver_player_id` /
`lateral_receiving_yards` columns for the rare lateral, which means a naive sum
of `receiving_yards` alone slightly undercounts a lateral play — use
`stats_player_week`, which already handles it, rather than rolling your own from
pbp. For ESPN, attribution is by numeric `athlete.id` in the box score, which is
also unambiguous; the risk there is not attribution but whether the box score has
caught up with the broadcast.

*Stat corrections after the fact.* Real and unavoidable. The NFL revises box
scores for days — a catch reclassified as a lateral, a yard moved between rusher
and receiver. nflverse re-runs daily at 09:03 UTC and picks these up, so a leg
settled from Sunday's file can disagree with Wednesday's. For a 62.5-yard line
this basically never matters; for a leg sitting on exactly the line it will
eventually bite someone. The design answer is not to chase it — it is that a
human can always overwrite, and that the app records *which* source settled a
leg so a dispute is legible.

*A player who doesn't play.* Both feeds simply omit an inactive player from the
box score. Absence is indistinguishable from "hasn't touched the ball yet". A
receiving-yards over on an inactive player should settle *lost*, but you cannot
tell that from zero rows alone until the game is final. Resolve it on the final
snapshot, not during the game — and note ESPN exposes `.../injuries` if you ever
want to pre-empt it.

---

## Codebase fit

The app today, as it bears on this feature:

- **`schema.sql`** — `legs` is `(id, season, week, name, pick, odds, result,
  created_at, updated_at)`. `pick` is free text, `not null`. `result` is
  `text check (result in ('won','lost'))`, null meaning ungraded. `weeks` holds
  `locked_at`. `league_state` is a one-row table naming the current
  `(season, week)`, read by a subquery inside every week-scoped statement.
- **`src/lib/store.ts`** — every query, as Neon tagged templates. `listLegs`,
  `setLegResult`, `lockParlay`, plus the archive reads. All week-scoping is
  `where (season, week) = (select season, week from league_state)`.
  `setLegResult` only writes while the week is locked; that guard is in the SQL,
  not the caller.
- **`src/lib/parlay.ts`** — `parlayStatus(legs, locked)` → `open | live | won |
  lost`, derived purely from `leg.result` and the lock. One `lost` settles the
  ticket.
- **`src/lib/odds.ts`** — pure American-odds math. Untouched by this feature.
- **`src/app/api/legs/[id]/route.ts`** — `PATCH` with `{result}` grades a leg;
  `PATCH` with `{pick, odds}` edits one. It already refuses a body carrying
  both, on the grounds that editing and grading are opposite sides of the lock.
- **`src/components/ParlayBoard.tsx`** — a client component holding `legs` and
  `parlay` in `useState`, seeded from the server component at
  `src/app/page.tsx`. Grading is an optimistic local update plus a `PATCH`.
  There is no polling and no refetch anywhere in the app today.
- **`src/components/LegCard.tsx`** — renders `leg.pick` as a string and, when
  locked, shows **Mark won** / **Mark lost** / **Clear**.
- **`src/components/LockControls.tsx`** — the lock button and the unlock escape
  hatch. Unlock is refused once anything is graded.

There is **no auth, no cron, no background job, no test suite, and not a single
outbound HTTP call in the codebase**. This feature introduces the first three of
those. That is the real weight of it.

**What must change, file by file:**

| File | Change | Size |
|---|---|---|
| `schema.sql` | Structured-leg columns on `legs`; `leg_tracking` table; `feed_state` throttle table. | Medium |
| `src/lib/store.ts` | Read/write the new columns; `listLegs` returns tracking; new `recordAutoResult`, `saveTracking`, `claimFeedPoll`. | Medium |
| `src/lib/markets.ts` | **New.** The market vocabulary, and `settle(market, line, side, stats)` → `won | lost | null`. Pure, like `odds.ts`. | Medium |
| `src/lib/feeds/nflverse.ts` | **New.** Fetch + parse `games.csv`, `stats_player_week`, `players.csv`. Conditional requests. | Medium |
| `src/lib/feeds/espn.ts` | **New, phase 3 only.** `summary?event=` → per-athlete stats. | Medium |
| `src/lib/tracking.ts` | **New.** Orchestration: which legs are trackable, fetch, settle, persist. | Medium |
| `src/app/api/tracking/route.ts` | **New.** `POST` refreshes (throttled), `GET` reads. | Small |
| `src/app/api/legs/route.ts` | Accept the optional structured fields on `POST`. | Small |
| `src/app/api/legs/[id]/route.ts` | Mark manual grades as manual; accept structure on edit. | Small |
| `src/components/AddLegView.tsx` | **The big one.** Market picker, player search, line input, over/under. | Large |
| `src/components/LegCard.tsx` | Live progress row; auto/manual provenance; override affordance. | Medium |
| `src/components/ParlayBoard.tsx` | Poll while live; merge tracking into state; "last updated" line. | Medium |
| `src/lib/parlay.ts` | Unchanged — it reads `leg.result`, and auto-settlement writes `leg.result`. | None |
| `src/lib/odds.ts`, `archive.ts` | Unchanged. | None |
| `vercel.json` | **New.** One daily cron (see below). | Tiny |

**What structured legs cost, concretely.** The brief says legs may change
format. They should — but *additively*, not as a replacement, and this is the
single most important design decision in the document:

- **`legs.pick` stays, stays `not null`, and stays the thing rendered.** It is
  what a human wrote and what the board should show. For a structured leg, the
  submit form composes it ("Puka Nacua over 75.5 receiving yards") and stores it
  alongside the structure.
- **Every new column is nullable.** A leg with no structure is exactly today's
  leg: free text, manually graded, works forever. This is the escape hatch for
  "Ravens/Chiefs both score in every quarter" and it costs nothing to keep.
- **Legs already in the database need no migration.** They have null structure,
  so they are untracked, so they behave as they do today. No backfill, no data
  loss, no `db:init` risk. Given `schema.sql` re-runs on every deploy and on
  every cold start, "needs no backfill" is worth a lot here — `CONTRIBUTING.md`
  is explicit that the schema path has no notion of ordering or history.
- **The submit UI is where the real work is.** Today it is a name, a textarea,
  and an odds box. It has to become: pick a market type → pick a player (search
  over a 24k-row `players.csv`, or over this week's active rosters — much
  smaller) or a game → enter a line → over/under. On a phone. That is most of
  the build cost of this whole feature, and it is worth prototyping against
  `prototype/` before writing it, because `CONTRIBUTING.md` names that bundle as
  the source of truth for how the UI looks.
- **Do not build a free-text parser.** Mapping "Puka 75.5 rec yds" to a market
  by regex will be wrong often enough to be worse than useless, and every wrong
  mapping is a leg that silently settles incorrectly. Make people pick from a
  list. If a leg does not fit the list, it stays free text and stays manual.

---

## Schema changes

Written for `schema.sql` in the existing voice: idempotent, `if not exists`,
safe to re-run and safe to lose a race, commented so the next person knows why.

```sql
-- Structured legs, for the ones a feed can settle on its own. Every column
-- here is nullable and `pick` is untouched: a leg with no structure is exactly
-- the leg this app has always had — free text, graded by hand — and legs
-- already in the table stay that way without a backfill.
alter table legs
  add column if not exists market text;
alter table legs
  add column if not exists game_id text;
alter table legs
  add column if not exists subject_id text;
alter table legs
  add column if not exists subject_label text;
alter table legs
  add column if not exists line numeric(6, 1);
alter table legs
  add column if not exists side text;

-- The vocabulary lives in src/lib/markets.ts; this is the guard that stops a
-- typo reaching the settler. Re-runnable: `add constraint` alone would fail the
-- second time, same as legs_result_valid above.
alter table legs
  drop constraint if exists legs_market_valid;
alter table legs
  add constraint legs_market_valid check (
    market is null or market in (
      'spread', 'total', 'moneyline', 'team_total',
      'pass_yds', 'rush_yds', 'rec_yds', 'receptions',
      'pass_tds', 'rush_tds', 'rec_tds', 'anytime_td'
    )
  );

alter table legs
  drop constraint if exists legs_side_valid;
alter table legs
  add constraint legs_side_valid check (
    side is null or side in ('over', 'under', 'home', 'away', 'yes')
  );

-- Half the structure is no structure: a leg the settler can act on needs a
-- market and the game it belongs to, and an over/under needs a number to be
-- over or under. Anything short of that is free text wearing a costume, and it
-- is better to refuse it here than to settle it wrongly at 4pm on a Sunday.
alter table legs
  drop constraint if exists legs_structure_complete;
alter table legs
  add constraint legs_structure_complete check (
    market is null
    or (
      game_id is not null
      and side is not null
      and (side not in ('over', 'under') or line is not null)
      and (market in ('spread', 'total', 'moneyline', 'team_total')
           or subject_id is not null)
    )
  );

-- Where a result came from. Null alongside a null result means ungraded; null
-- alongside a result means a grade from before this column existed, which is
-- to say a human. The settler only ever writes 'auto', and only into a leg
-- whose result is still null — see the guard in recordAutoResult.
alter table legs
  add column if not exists result_source text;
alter table legs
  drop constraint if exists legs_result_source_valid;
alter table legs
  add constraint legs_result_source_valid
  check (result_source is null or result_source in ('auto', 'manual'));

-- Live progress, one row per leg. Kept apart from `legs` because it is the one
-- thing here that churns — rewritten every poll for three hours on a Sunday —
-- while a leg row is written once and then read all season. Dropping this table
-- loses nothing but the progress line: the outcome lives on legs.result.
create table if not exists leg_tracking (
  leg_id      uuid primary key references legs (id) on delete cascade,
  -- What the player/team has so far, against the line the leg was taken at.
  -- Null while a game hasn't kicked off, or when the feed has nothing to say.
  value       numeric(7, 2),
  -- Free text for the card: "62 of 75.5 receiving yards", "currently +7".
  detail      text,
  -- Where the feed thinks this leg stands, which is not the same as settled:
  -- the settler promotes this onto legs.result only once the game is final.
  standing    text,
  -- 'pre' | 'in' | 'post' — the game's state, not the leg's.
  game_state  text,
  source      text        not null,
  updated_at  timestamptz not null default now()
);

alter table leg_tracking
  drop constraint if exists leg_tracking_standing_valid;
alter table leg_tracking
  add constraint leg_tracking_standing_valid
  check (standing is null or standing in ('ahead', 'behind', 'won', 'lost'));

-- One row per feed, holding the last time anyone fetched it. Fourteen phones
-- polling the board must not become fourteen requests to ESPN: whoever wins the
-- race here does the fetch and everyone else reads what they wrote. This is the
-- whole throttle — see claimFeedPoll in store.ts.
create table if not exists feed_state (
  feed        text        primary key,
  polled_at   timestamptz not null default now(),
  -- Passed back as If-Modified-Since / If-None-Match so an unchanged file
  -- costs a 304 instead of two megabytes.
  last_modified text,
  etag        text,
  -- Last failure, kept so the board can say "feed is down" rather than showing
  -- stale numbers as though they were current.
  error       text,
  updated_at  timestamptz not null default now()
);
```

The claim-a-poll query, which is the only non-obvious piece of SQL in the
feature. It is one atomic statement, so two concurrent board loads cannot both
decide to fetch:

```sql
-- Returns a row only to the caller that won the right to poll. `interval` is
-- passed as a parameter so a live Sunday can poll harder than a Tuesday.
insert into feed_state (feed, polled_at)
values ($1, now())
on conflict (feed)
do update set polled_at = now(),
              updated_at = now()
 where feed_state.polled_at < now() - $2::interval
returning last_modified, etag;
```

And the settle-without-trampling-a-human write:

```sql
-- Writes only into an ungraded leg of a locked week. A human's grade — or an
-- earlier auto grade a human has since cleared and re-set — is never
-- overwritten, because `result is null` is checked in the same statement that
-- does the write.
update legs
   set result = $2::text,
       result_source = 'auto',
       updated_at = now()
 where id = $1::uuid
   and result is null
   and exists (
         select 1
           from weeks
          where weeks.season = legs.season
            and weeks.week = legs.week
            and weeks.locked_at is not null
       )
returning id, name, pick, odds, result, result_source, created_at
```

`setLegResult` in `store.ts` should gain `result_source = 'manual'` on the same
statement, so clearing an auto result and re-grading it by hand marks it human
and the settler leaves it alone from then on.

---

## Polling and runtime architecture

### The constraint that decides this

**Vercel Cron on Hobby is capped at once per day.** Per-project cron count was
lifted to 100 on every plan in January 2026, but the *frequency* floor did not
move: Hobby allows a once-per-day cadence, with timing only guaranteed within
the hour, UTC only. Per-minute cadence is a Pro feature. (Cross-checked across
several secondary sources; `vercel.com` is egress-blocked from this sandbox so
this was not read from the primary docs — **verify before relying on it**, it is
load-bearing for everything below.)

So Vercel Cron cannot drive live tracking on a free plan. Not "is awkward" —
cannot. An `*/5 * * * *` expression is reported to fail at deploy time on Hobby.

### The three options

**1. Vercel Cron → route handler.** Would be the clean answer. On Hobby it can
only fire daily, which is useless for live progress but *genuinely good* for a
backstop sweeper: one job at, say, 10:00 UTC (6 am ET) settles everything from
the previous day off nflverse, including MNF and any stat corrections. Free,
invisible, and it means the board is correct by breakfast even if nobody opened
the app all weekend. Keep it, but as a safety net, not the engine.

**2. On-demand refresh when someone loads the board.** `src/app/page.tsx` is
already `force-dynamic` and already does a fan-out of queries. Adding "if the
ticket is live and the feed is stale, refresh it" costs one extra round trip on
a cold board load. Zero infrastructure. The catch is it only updates when
someone looks — which, for a league whose members are all staring at the app on
Sunday afternoon, is most of the time, but leaves the board stale at 4:20 pm if
everyone is watching the TV instead. Use `after()` from `next/server` so the
fetch does not block the response: it runs after the response is finished and,
per the Next.js 16 docs, "is not a Request-time API and calling it does not
cause a route to become dynamic."

**3. Client-side polling.** `ParlayBoard.tsx` is already a client component with
`legs` and `parlay` in state and an optimistic-update pattern to copy. A
`setInterval` that hits `POST /api/tracking` every 45–60 seconds *only while the
ticket is locked and at least one leg's game is in progress* gives real live
behaviour with no platform features at all.

### Recommendation

**Client polling as the engine, on-demand as the seed, one daily cron as the
sweeper — with a single server-side throttle in front of all three.**

The throttle is the important part and it is why `feed_state` exists. Every path
calls the same `claimFeedPoll(feed, interval)`; only the caller that wins the
atomic upsert actually talks to the feed, and everyone else reads what is
already in `leg_tracking`. Fourteen phones polling every 45 seconds become **one**
upstream request per 45 seconds, regardless of how many people are watching.
Without this, fourteen viewers is fourteen times the load on an undocumented
endpoint that has no published rate limit and a stated willingness to block
abusers — the fastest possible way to get the feature killed.

Polling cadence should be state-driven, not fixed:

| Ticket state | Client poll | Upstream throttle |
|---|---|---|
| Open (not locked) | none | — |
| Locked, no game started | 5 min | 5 min |
| Locked, a game in progress | 45 s | 45 s |
| All games final, legs settled | none | — |
| Feed erroring | back off to 5 min | 5 min |

Stop the interval on `document.hidden` and resume on focus. A phone in a pocket
should not poll.

**Invocation budget.** Hobby's included function invocations are generous
relative to this: fourteen people × 3 hours × one poll/45 s ≈ 4,000 invocations
on a Sunday, ~70,000 across an 18-week season, against a Hobby allowance
reported in the 100k–1M range. It fits, but it is not nothing — which is another
argument for pausing the interval when the tab is hidden and for stopping dead
once every leg is settled. Also note Hobby is non-commercial-use only; a
fourteen-person league passing $10 around is fine, but it is worth knowing the
plan has that condition.

**Route handler shape**, matching the house style (`export const dynamic =
"force-dynamic"`, `NextResponse.json`, the shared `dbError` helper):

```ts
// src/app/api/tracking/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 30; // a slate-wide nflverse pull is a few MB

// GET  — read what's stored, no upstream call. Cheap enough to poll.
// POST — refresh if the throttle allows, then return the same shape as GET.
```

Have `POST` return the current tracking either way, so a client that loses the
throttle race still gets fresh-enough data and never needs a second request.

**Two Next.js 16 notes for the build session**, both confirmed against
`node_modules/next/dist/docs`:

- Route Handlers are **not cached by default**, and only `GET` can opt in. The
  existing routes all set `dynamic = "force-dynamic"` anyway; match that.
- This project does **not** enable Cache Components (there is no
  `cacheComponents: true` in `next.config.ts`), so the
  `01-app/02-guides/caching-without-cache-components.md` model applies, not the
  `use cache` / `cacheLife` model in `01-app/01-getting-started/09-revalidating.md`.
  Do not reach for `cacheLife` here. Store freshness in Postgres, where the
  throttle already lives and where it is visible to every instance.

One more, easy to miss: `next.config.ts` has an `outputFileTracingIncludes` entry
that pulls `schema.sql` into the serverless bundle because nothing imports it.
Any new data file you decide to ship (a cached `players.csv`, say) needs the same
treatment or it will be missing in production and present in dev.

---

## UI changes

**`LegCard.tsx`** — the main surface. Today a card is a name, the pick text, an
odds chip, and a footer that is either Edit/Remove or Mark won/Mark lost. It
gains, between the pick and the footer, a **progress row** rendered only when
tracking exists and the leg is ungraded:

```
CHRIS                                              -115
Puka Nacua over 75.5 receiving yards
━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░  62 of 75.5
Q3 · 8:41 · LA 17–13 SEA                    updated 40s ago
```

A team-market leg says it differently — `Chiefs -3.5 · currently +7 · Q2 4:12` —
so `markets.ts` should own a `describe(market, tracking)` function rather than
letting the component branch on market type. Reuse the existing `ProgressBar`
idiom and the `--accent` / `--loss` / `--track` tokens from `globals.css`;
`CONTRIBUTING.md` is explicit about not hardcoding colors.

Provenance has to be visible. A leg settled by the feed shows the existing
`ResultChip` plus a quiet `auto` marker, and its footer keeps **Clear** — which
is already there for graded legs — so the override is one tap and needs no new
control. A leg graded by a person looks exactly as it does today. An untracked
free-text leg looks exactly as it does today, which is the point.

**`ParlayBoard.tsx`** — owns the polling interval and merges tracking into state
next to `legs`. The summary column gains a line under `StatusBanner` when the
ticket is live: `4 of 14 legs hit · 7 in progress · 3 not started`, plus a
muted "updated 40s ago" and, when the feed is erroring, a plain
`Feed is down — grade by hand` rather than stale numbers dressed as current.
`StatusBanner`'s `live` copy currently reads `Locked and loaded · N of M
graded`; with a feed running, "graded" is the wrong word and it should say
`settled`.

The existing `ProgressBar` already re-colours per leg once locked. Add a third
state for "ahead but not final" — a partial fill or a dimmed accent — so the bar
reads as live rather than as mostly-ungraded.

**`AddLegView.tsx`** — the large one, and the thing to design before building.
It needs a market picker, a player or game picker, a line, and over/under, all
on a phone, without making the fast path (someone who knows exactly what they
want) any slower than today's textarea. Suggested shape: keep the free-text box
as the default and put **"Track this leg automatically"** as an opt-in that
expands the structured fields. That way phase 3 can ship to a league that
half-adopts it, the free-text path never regresses, and nobody is blocked from
submitting because the player picker cannot find their guy.

**`LockControls.tsx`** — no change needed. Worth noting though: unlock is
currently refused once anything is graded, and auto-settlement writes grades. So
a feed that settles a leg at 4:10 pm silently removes the "Locked by mistake?
Unlock it" escape hatch. That is arguably correct — by then the games have
started — but it is a behaviour change nobody asked for and it should be a
deliberate decision, not a surprise.

---

## Failure modes and the manual override

**The override is the feature's foundation, not a fallback.** The app works
today with zero feeds. Every line below is in service of: if all of this breaks,
the league is back to tapping Mark won, and nothing is lost.

The four rules that guarantee it:

1. **`legs.result` remains the single source of truth.** `parlay.ts` does not
   learn about feeds. Auto-settlement is just another writer of the same column,
   which means the board, the archive, and `/history` and `/stats` when they get
   built all keep working unchanged.
2. **The settler never overwrites a non-null result.** Enforced in the `update
   ... where result is null` statement above, not in the caller.
3. **A human's grade is sticky.** Clearing an auto result and re-grading marks
   `result_source = 'manual'`, and the settler skips it from then on. Without
   this, a human fix would be undone on the next poll — which would be the
   single most infuriating possible bug in this feature.
4. **Tracking is decorative until a game is final.** `leg_tracking.standing` can
   say `lost` at halftime; it does not touch `legs.result` until
   `game_state = 'post'`. A receiver on 20 yards at the half has not lost an
   over-75.5 leg.

| Failure | What happens | What it should do |
|---|---|---|
| **Feed down mid-game** | Fetch throws or 5xx. | Record in `feed_state.error`, keep the last `leg_tracking` rows, board shows "feed is down, grade by hand", client backs off to 5 min. Never blank the progress — show it stale and say so. |
| **ESPN changes response shape** | Parse throws, or worse, silently yields `undefined`. | Parse defensively and treat a missing expected field as an error, not a zero. **A stat that parses to 0 when it should be 62 will settle a leg lost.** Look stats up by label index; never trust a fixed offset. |
| **Stat correction after settling** | Tuesday's nflverse file disagrees with Sunday's settle. | The daily sweeper can *flag* a disagreement — surface it on the board — but must not silently flip a settled ticket. A parlay people have already celebrated or mourned should not change without someone being told. |
| **Parser can't map a leg** | Structured fields are null. | Leg is simply untracked. No error, no warning — it is a normal free-text leg. This is why structure is opt-in. |
| **Player doesn't play** | Absent from the box score. | Show "not started" during the game; settle on the final snapshot, where absence means zero. Do not settle an over as lost at 1:05 pm because the box score is empty. |
| **Game postponed / cancelled** | Never reaches `post`. | Leave ungraded forever. A human grades or voids it. Do not invent a rule. |
| **Wrong player matched** | Two players share a name. | Match on `gsis_id` captured at submit time, never on a name string at settle time. The picker resolves the id once; the settler only ever compares ids. |
| **Throttle row missing / clock skew** | `claimFeedPoll` misbehaves. | Worst case is extra upstream requests. Add a hard floor (never poll the same feed twice in 20 s) in `tracking.ts` as well, so a database oddity can't become a request storm. |
| **Someone unlocks mid-tracking** | Legs become editable while tracking rows point at old lines. | `on delete cascade` handles deletes. On an edit that changes `market`/`line`/`subject_id`, delete the tracking row so it cannot show a stale line. |
| **All of it breaks permanently** | ESPN closes; nflverse abandoned. | Delete `src/lib/feeds/`, drop the cron, leave the columns. The app is what it is today. This is a real, cheap exit and it is worth keeping it real. |

---

## Build phases and effort

"A session" means one focused working session, roughly a half-day, by someone
who has read this document. Estimates assume no test suite is being added — the
repo has none — though `markets.ts` is pure and genuinely wants one, and that
would be the first test in the project.

**Phase 1 — structured legs, team markets only. ~1.5 sessions.**
Schema columns and constraints. `markets.ts` with `spread`, `total`,
`moneyline`. Submit form gains an opt-in "track this" toggle exposing game +
market + side + line, with games read from nflverse `games.csv`. Nothing settles
yet; legs just carry structure. *Value on its own: none. This is scaffolding —
which is exactly why the thinnest version bundles it with phase 2.*

**Phase 2 — auto-settle from nflverse. ~1 session.**
`feeds/nflverse.ts` + `tracking.ts` + `POST /api/tracking` + `feed_state`
throttle + the one daily Vercel cron. On-demand refresh from the board load.
Team markets settle within ~15 minutes of each game ending. *Value: the Sunday
grading chore mostly disappears.*

> ### 👉 Thinnest first version = Phase 1 + Phase 2, ~2.5 sessions.
>
> Spreads, totals and moneylines auto-settle within ~15 minutes of each game
> ending. Free data, verified today, zero ToS risk, no new platform features,
> no client polling, no ESPN. Legs that aren't structured stay free text and
> stay manual, so nothing regresses and nothing needs migrating. If the feature
> stopped here it would still be worth having.

**Phase 3 — player props, post-window. ~1.5 sessions.**
Player picker in the submit form (the fiddly part: a searchable list on a phone,
sourced from this week's rosters rather than all 24k players). `players.csv`
crosswalk. `stats_player_week` parsing. Yardage, receptions, TDs, anytime TD.
*Value: now essentially the whole realistic leg menu settles itself, just on a
"after the 1 o'clock games" cadence rather than live.*

**Phase 4 — live progress from ESPN. ~2.5 sessions, and the riskiest.**
`feeds/espn.ts`. Client polling in `ParlayBoard`. Progress rows in `LegCard`.
Live board summary. **Budget the first half-session purely for verification** —
hit `summary?event=` during an actual live game, log the box score every 30
seconds, and find out what the real latency and shape are before writing
anything against them. If ESPN turns out to be broken or blocked, this phase is
the one you cancel, and phases 1–3 are unaffected. *Value: the thing the feature
request actually asked for — "Puka Nacua 62 of 75.5" updating on the board.*

**Phase 5 — polish. ~1 session.**
Correction detection in the sweeper. Backoff and "feed is down" states. Stop
polling on hidden tabs. The `StatusBanner` copy change. Tidying the live
progress bar.

**Total for everything: ~7.5 sessions.** Most of the risk is in phase 4 and most
of the *user-visible* value arrives by the end of phase 3, which needs no
undocumented endpoints at all. If there is one thing to take from this estimate:
**phases 1–3 (~4 sessions) get you a board that grades itself, using only data
this research actually verified.** Phase 4 makes it live, and is the only part
built on something that might not be there next month.

---

## Open questions

1. **Does ESPN actually work, and how fast?** The load-bearing unknown. Nothing
   in phase 4 should be designed in detail until someone has watched
   `summary?event=` during a live game from an unrestricted network. Ten minutes
   of curl on a Sunday settles it.
2. **Is the Hobby cron frequency limit really once per day?** Cross-checked
   across secondary sources but not read from `vercel.com`, which is blocked
   here. If it is actually hourly, an hourly sweeper becomes attractive and
   takes some load off client polling. Check the plan page first.
3. **What does the league actually bet?** This document guesses the market menu.
   Before building the picker, read the `pick` column of the legs already in the
   database. If ten of fourteen legs each week are SGP-style combos or novelty
   bets, the structured menu is mostly wasted and the honest answer shifts back
   toward manual grading with a nicer UI.
4. **Should a leg hold more than one condition?** SGP-style combos are marked ❌
   above because a leg is one row with one market. Supporting them means a
   `leg_conditions` child table and an all-must-hit rule. Probably not worth it
   — but it depends entirely on question 3.
5. **Should an auto-settled loss kill the ticket immediately?** `parlay.ts`
   already flips to `lost` on the first `lost` leg. With a feed, that now
   happens at 4:12 pm without a human in the loop. Fine, probably — but somebody
   should say so out loud, because it changes the feel of a Sunday.
6. **Who can override?** There is no auth. Anyone with the link can clear an
   auto result, and the app cannot tell who did. Consistent with the rest of the
   app, and `CONTRIBUTING.md` says not to build on the assumption a request is
   trustworthy — but "the feed said won, someone changed it to lost, nobody
   knows who" is a new category of argument this app hasn't had before. An
   append-only note of what changed and when would cost very little.
7. **Stat corrections: flag, or ignore?** Phase 5 assumes flag-don't-flip. The
   alternative — ignore corrections entirely, treat the Sunday settle as final —
   is defensible for a $10 ticket and is less code.
8. **Where do live odds come from, if ever?** Nothing free gives live
   player-prop lines. Out of scope, noted so nobody re-researches it.
9. **If the $0 constraint were ever relaxed** — the cheapest thing that
   removes essentially every risk in this document is a paid feed with a real
   contract (SportsDataIO, Sportradar and similar start in the low hundreds per
   month for live NFL player stats) plus Vercel Pro at $20/month for per-minute
   cron. The Pro upgrade alone, without any paid data, would also be enough to
   move polling off the clients and onto a real 1-minute cron — which is by far
   the better-engineered version of phase 4.

---

## Appendix: raw endpoint samples

Everything below was captured in this sandbox on **2026-09-16**, except where
marked otherwise.

### Egress restrictions in this sandbox

Recorded by the agent proxy while this research ran. All are
`connect_rejected — gateway answered 403 to CONNECT (organization policy)`:

```
api.balldontlie.io:443        api.bigballsdata.com:443      api.mysportsfeeds.com:443
api.prop-odds.com:443         api.sleeper.app:443           api.sportradar.com:443
api.sportsdata.io:443         developer.sportradar.com:443  feeds.nfl.com:443
highlightly.net:443           site.api.espn.com:443         sports.highlightly.net:443
sportsdataapi.com:443         statsapi.mlb.com:443          www.nfl.com:443
www.oddsapi.io:443            tank01-nfl-...rapidapi.com:443
```

`raw.githubusercontent.com`, `github.com` and `release-assets.githubusercontent.com`
were reachable, which is why nflverse is the only first-hand-verified source
here. `vercel.com` was also blocked, hence open question 2.

### nflverse release assets — HTTP headers

```
$ curl -sSLI "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv"
HTTP/1.1 302 Found
HTTP/1.1 200 OK
Content-Length: 5537823
Content-Type: application/octet-stream
Etag: "0x8DF13346EC7631A"
Last-Modified: Tue, 15 Sep 2026 14:20:02 GMT

# stats_player/stats_player_week_2026.csv  -> 200, 498905 B, Last-Modified: Tue, 15 Sep 2026 14:21:38 GMT
# schedules/games.csv                      -> 200, 2178316 B, Last-Modified: Wed, 16 Sep 2026 13:06:29 GMT
# players/players.csv                      -> 200, 7291058 B, Last-Modified: Wed, 16 Sep 2026 13:00:58 GMT
# rosters/roster_2026.csv                  -> 200, 940136 B,  Last-Modified: Wed, 16 Sep 2026 12:35:59 GMT
# player_stats/player_stats_2026.csv       -> 404 (old path; use stats_player/)
```

Note the contrast: play-by-play and player stats last changed **Tuesday**;
schedules changed **seven minutes before this was captured**.

### `play_by_play_2026.csv` — contents and one row

```
total plays:      2756
weeks present:    ['1']            <- week 1 only; week 2 kicks off tomorrow
game_date range:  2026-09-09 .. 2026-09-14
games:            16
```

One completed pass, trimmed to the columns that matter for a receiving prop
(the file has ~380 columns):

```
game_id              = 2026_01_NO_DET
week                 = 1
posteam              = NO
defteam              = DET
qtr                  = 2
time                 = 13:16
desc                 = (13:16) (No Huddle, Shotgun) 6-T.Shough pass short middle
                       to 12-C.Olave to NO 38 for 22 yards (12-T.Harper).
play_type            = pass
yards_gained         = 22
receiver_player_id   = 00-0037239
receiver_player_name = C.Olave
receiving_yards      = 22
complete_pass        = 1
touchdown            = 0
total_home_score     = 7
total_away_score     = 0
```

Week-1 receiving leaders summed from this file — note pbp carries only the
abbreviated `C.Olave` form, which is why you settle on `gsis_id`:

```
C.Olave            182 yds, 10 catches
Z.Flowers          150 yds,  5
C.Watson           147 yds,  6
J.Coker            138 yds,  8
D.Kincaid          130 yds,  5
J.Smith-Njigba     122 yds,  8
```

### `stats_player_week_2026.csv` — the file to settle player props from

1,118 rows, week 1 only. 100+ columns; the prop-relevant ones are
`completions, attempts, passing_yards, passing_tds, passing_interceptions,
carries, rushing_yards, rushing_tds, receptions, targets, receiving_yards,
receiving_tds, special_teams_tds`.

```
player_id=00-0037239 | player_display_name=Chris Olave      | position=WR | season=2026 | week=1
                     | team=NO  | opponent_team=DET | game_id=2026_01_NO_DET
                     | receptions=10 | targets=13 | receiving_yards=182 | receiving_tds=0

player_id=00-0039064 | player_display_name=Zay Flowers      | team=BAL | game_id=2026_01_BAL_IND
                     | receptions=5  | targets=6  | receiving_yards=150 | receiving_tds=1

player_id=00-0038124 | player_display_name=Christian Watson | team=GB  | game_id=2026_01_GB_MIN
                     | receptions=6  | targets=8  | receiving_yards=147 | receiving_tds=2
```

Full `display_name` here, unlike pbp — one more reason this is the file to use.

### `games.csv` — the file to settle team markets from

One row, trimmed:

```
game_id          = 2026_01_BUF_HOU      away_team     = BUF     home_team  = HOU
season           = 2026                 away_score    = 36      home_score = 31
game_type        = REG                  result        = -5      total      = 67
week             = 1                    overtime      = 0
gameday          = 2026-09-13           espn          = 401872660   <- ESPN event id, free
weekday          = Sunday               gsis          = 60183
gametime         = 13:00                pfr           = 202609130htx
spread_line      = -1.5                 total_line    = 44.5
away_spread_odds = -105                 over_odds     = -110
home_spread_odds = -115                 under_odds    = -110
away_moneyline   = -112                 home_moneyline = -108
roof             = closed               surface       = astroturf
stadium          = Reliant Stadium
```

`result` is `home_score - away_score`. `total` is the combined points. Both are
empty until the game is final — see below.

### Proof that `games.csv` is final-only, not live

Walked from the git history of `nflverse/nfldata`, whose pushes to
`data/games.rds` trigger the release. Same game, successive commits across
Sunday 2026-09-13:

```
66dc458  16:45 UTC  2026_01_BUF_HOU  away=     home=     result=     total=
5543068  17:35 UTC  2026_01_BUF_HOU  away=     home=     result=     total=    <- kickoff was 17:00
b6d86c7  19:15 UTC  2026_01_BUF_HOU  away=     home=     result=     total=    <- ~mid third quarter
89f1b73  20:05 UTC  2026_01_BUF_HOU  away=     home=     result=     total=
ecc8cf9  20:23 UTC  2026_01_BUF_HOU  away=  36 home=  31 result=  -5 total=  67
```

Commit cadence during that window, showing the pipeline really is running every
few minutes and simply has nothing to say about an in-progress game:

```
2026-09-13 20:05:15   20:07:22   20:10:37   20:15:16   20:15:29   20:16:23
           20:23:23   20:30:23   20:35:15   20:40:29   20:45:14   20:49:49   20:55:16
```

First commit carrying a score, per game:

```
2026_01_TB_CIN    2026-09-13 20:10 UTC   (Sun 1:00pm ET slot)
2026_01_BUF_HOU   2026-09-13 20:23 UTC
2026_01_CHI_CAR   2026-09-13 20:40 UTC
2026_01_NO_DET    2026-09-13 20:49 UTC
2026_01_GB_MIN    2026-09-13 23:47 UTC   (4:25pm ET slot)
2026_01_DAL_NYG   2026-09-14 03:32 UTC   (SNF)
2026_01_DEN_KC    2026-09-15 03:20 UTC   (MNF)
```

### `players.csv` — the crosswalk

24,824 rows. Columns include `gsis_id, display_name, common_first_name,
first_name, last_name, short_name, football_name, suffix, esb_id, nfl_id,
pfr_id, pff_id, otc_id, espn_id, smart_id, birth_date, position_group, position,
height, weight, headshot, college_name`, plus `latest_team` and `status`.

```
Puka Nacua   gsis_id=00-0039075  position=WR  latest_team=LA  status=ACT
             espn_id=4426515     esb_id=NAC559347  pfr_id=NacuPu00
Chris Olave  gsis_id=00-0037239  position=WR  latest_team=NO  status=ACT
             espn_id=4361370     esb_id=OLA659325  pfr_id=OlavCh00
```

`gsis_id` ↔ `espn_id` in one file is what lets a single structured leg settle
from either feed.

### nflfastR has no live path (source excerpt)

`nflfastR/R/utils.R:341`, from a clone of `nflverse/nflfastR` at
`DESCRIPTION: Version: 5.2.0.9015`:

```r
raw_pbp_urls <- function(game_ids) {
  # pattern
  # https://github.com/nflverse/nflverse-pbp/releases/download/{season}/{game_id}.rds
  file.path(
    "https://github.com/nflverse/nflverse-pbp/releases/download",
    paste0("raw_pbp_", substr(game_ids, 1, 4)),
    paste0(game_ids, ".rds"),
    fsep = "/"
  )
}
```

`fetch_raw()` (same file, line 184) calls this and nothing else. The package
description still reads "access National Football League play-by-play data from
<https://www.nfl.com/>", but the code no longer talks to nfl.com at all.

Per-game raw files re-upload wholesale on each run — all 16 week-1 files carried
an identical `Last-Modified: Wed, 16 Sep 2026 11:54:2x GMT` — so their
timestamps say when the batch last ran, not when a game was scraped. Don't try
to infer per-game latency from them.

### ESPN — NOT captured here

```
$ curl -sS "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
curl: (56) CONNECT tunnel failed, response 403

[agent-proxy] site.api.espn.com:443 — connect_rejected
              (the egress proxy denied the CONNECT (organization policy))
```

`WebFetch` on the same URL returned `EGRESS_BLOCKED`. **No ESPN response shape in
this document was observed first-hand.** The `boxscore.players[] →
statistics[] → athletes[] → stats[]` structure in the *Data sources* section is
reconstructed from the parser in `espnscrapeR::get_nfl_boxscore_players`
(fetched from `raw.githubusercontent.com/jthomasmock/espnscrapeR`), which calls:

```r
game_url <- glue::glue("http://site.api.espn.com/apis/site/v2/sports/football/nfl/summary")
raw_get  <- httr::GET(game_url,
                      query = list(event = game_id,
                                   enable = "ranks,odds,linescores,logos"))

raw_json[["boxscore"]][["players"]] %>%
  unnest_longer(statistics) %>% unnest_wider(statistics) %>%
  unnest_longer(athletes)   %>% unnest_wider(athletes)   %>%
  unnest_wider(athlete)     %>%
  unchop(cols = c(labels, descriptions, totals, stats))
```

and whose `case_when` block enumerates the `statistics[].name` vocabulary:
`passing, rushing, receiving, fumbles, defensive, interceptions, kickReturns,
puntReturns, kicking, punting`. Its later `separate()` calls confirm `C/ATT` is
slash-delimited and `SACKS` is hyphen-delimited within a single string cell.

The first task of a build session is to replace this appendix entry with a real
captured response.
