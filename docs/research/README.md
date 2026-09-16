# Which feature next: live tracking, or a live-odds leg selector?

Two candidate features were researched in parallel, each against the same
constraint the league actually has: **$0/month for data**. This page is the
recommendation and the reasoning. The two long documents beside it are the
warm starts — read the relevant one when the time comes to build.

| Document | Feature | Verdict in one line |
|---|---|---|
| [`live-leg-tracking.md`](./live-leg-tracking.md) | Track leg results from an NFL feed | Auto-**settlement** is free and verified; live in-game progress is a separate, unverified feature. |
| [`live-odds-leg-selector.md`](./live-odds-leg-selector.md) | Pick real legs at real odds | The selector is buildable; "odds refresh until lock" is not, on the free tier. |

**Recommendation: build live tracking first** — specifically its phases 1–3
(structured legs plus nflverse auto-settlement), stopping short of the live
ESPN phase. Then spend ten minutes on the odds selector's Phase 0, which
settles whether that feature is ever viable for free.

---

## Both headline features die at $0. The consolation prizes are not equal.

This is the honest framing, and it took both research passes to see it. Neither
feature survives the free-data constraint in the shape it was imagined:

| What was asked for | What $0 actually buys |
|---|---|
| Legs update **live** during games | Legs **settle** ~5–15 min after each game ends (team markets), or after the 1pm window closes (player props) |
| Odds **adjust live** until lock | Odds are a **snapshot**, refreshed once or twice a week, **frozen** at submit |

So the choice is not between two features. It is between two *consolation
prizes*, and they differ sharply in value and in risk:

**Live tracking's consolation prize is substantial and permanent.** Auto-settling
essentially the whole realistic leg menu — spreads, totals, moneylines, passing
and rushing and receiving yards, receptions, TDs, anytime TD — removes the
Sunday-night chore of grading fourteen legs by hand, forever, at no ongoing cost.

**The selector's consolation prize is real but thinner.** A searchable weekly
snapshot that fills in the pick and the odds correctly kills two genuine
annoyances: writing the pick as prose, and fat-fingering `-115`. Worth having.
But it explicitly does *not* include the live price movement that was the point
of the request.

---

## The four things that decide it

### 1. One foundation was measured; the other was not

Live tracking's core rests on data verified first-hand *today*, against real
2026 Week 1 games: nflverse publishes scores and box scores as plain CSV on
GitHub, no key, no signup, no terms-of-service question. The research walked the
git history of `games.csv` across Sunday 2026-09-13 and watched score fields go
from empty mid-game to populated minutes after the whistle. That is not a claim
to re-check later; it is a measurement.

The selector's core rests on a **contradicted** claim. The vendor's own docs say
the free plan is not market-gated and player props come off the same endpoint a
paying customer uses. A competitor's blog says the free tier is 25 requests/day,
h2h only, no NFL. Nobody could adjudicate, because this environment's egress
gateway blocks every odds-provider domain — which I verified independently, so
it is an environment restriction and not evidence about the APIs themselves.

One feature's foundation is known. The other's is a coin flip with a cheap way
to look at the coin.

### 2. One has no ongoing cost; the other has a budget with no headroom

nflverse has no quota. It is a static file on GitHub — fetch it as often as you
like.

The selector runs on 500 credits a month, where a single full-slate player-prop
snapshot costs 160. The free month buys **three** of them. The recommended
design spends 125 credits a week with *zero* headroom, in an app that has **no
auth** — anyone with the link can trigger a fetch. One bad `useEffect` in a
preview deploy drains the month. That is a structural hazard, not a bug to avoid
carefully.

### 3. The risky half is severable in one feature and structural in the other

Live tracking's unverified dependency (ESPN, for live progress) is **phase 4 of
4**. If ESPN turns out to be blocked or broken, you delete that phase and phases
1–3 are untouched — you still have a board that grades itself. The risk is
quarantined at the end of the build.

The selector's unverified dependency is **phase 0**. Everything is downstream of
it. And the quota pressure never goes away; it is the permanent shape of the
feature on the free tier.

### 4. Building tracking first gets you the selector's hardest UI work anyway

This is the sequencing argument, and it is the one that tipped it.

Live tracking cannot auto-grade free text. So its phase 1 is a game/market/side
picker in the submit form — which *is* a leg selector, just without prices
attached. Build tracking first and you end up with the structured submit flow
either way. The odds selector then becomes a much smaller increment: attach real
prices to a picker that already exists, rather than building the picker and the
pricing and the cache and the budget guard all at once.

The reverse ordering does not have this property. Building the selector first
gets you priced legs that still need a separate identity mapping before anything
can settle them — see below.

---

## The integration trap: the two features do not compose for free

Neither research pass could see this, because each only looked at its own
feature. Both propose structured columns on `legs`, and they model the **same
concepts under different names, in different identity spaces**:

| Concept | Tracking doc | Selector doc | Compatible? |
|---|---|---|---|
| Which market | `market` (`'rec_yds'`) | `market_key` (`'player_reception_yds'`) | Same idea, different vocabulary |
| Which game | `game_id` (nflverse) | `event_id` (the book's id) | **Different id spaces** |
| Which player | `subject_id` (nflverse `gsis_id`) | `player` (name string, verbatim) | **Different id spaces** |
| Which side | `side` | `selection` | Same idea, different vocabulary |
| The number | `line numeric(6,1)` | `line numeric(6,1)` | Identical |

Built independently, this yields duplicate columns and a name-matching problem:
a leg chosen from the book carries a player's *name as printed*, and settling it
from nflverse needs a stable `gsis_id`. Fuzzy name matching is exactly the kind
of thing that works all season and then quietly mis-grades a leg in Week 14.

**The rule to carry into whichever gets built first: define one canonical
internal vocabulary, and make the settler's identity space the canonical one.**
Grading is where identity has to be exactly right, and grading happens when
nobody is watching. Selection happens with a human present — so if the odds
selector is built later, it should resolve the book's offer to an nflverse
player and game **at submit time**, where a bad match is visible and
correctable, rather than leaving it to the settler at 4pm on a Sunday.

Both documents independently reached the same good instinct on the rest of the
schema, and that part needs no reconciling: every new column nullable, `pick`
untouched and still `not null`, no backfill, and free text preserved as a
first-class path rather than a legacy one being phased out. Keep that.

---

## What to actually do

**1. Build live tracking, phases 1–3. About 4 sessions.**
Structured legs, then nflverse settlement for team markets, then player props.
Stop before phase 4. At the end of this the board grades itself using only data
that has been verified, with no key, no quota and no ongoing cost — and you have
the structured submit flow that the odds selector would need anyway.

The thinnest useful cut is phases 1+2 (~2.5 sessions): spreads, totals and
moneylines settling within ~15 minutes of each game ending.

**2. Before any of that, settle two load-bearing facts.** Both are quick, and
both are currently resting on secondary sources because this sandbox could not
reach the primary ones:

- **Vercel Hobby cron frequency.** The research says Hobby caps cron at once per
  day, which is why the recommended architecture is client polling rather than
  cron. Worth confirming from Vercel's own docs before designing around it.
- **ESPN, during an actual live game.** Ten minutes of `curl` against
  `summary?event=` on a Sunday tells you whether phase 4 is ever worth planning.
  Do it from a normal network, not from here.

**3. Separately, spend ten minutes on the selector's Phase 0.** Sign up for a
free key and make the three calls in that document's phase 0. Total spend: one
credit. It answers permanently whether the free plan is 500 credits or 25
requests/day, and whether NFL props come back at all. Do this even though the
selector is not next — it converts an open question into a fact, and if the
answer is "h2h only", the feature is dead and you stop thinking about it.

**4. Revisit the selector after tracking ships.** By then the structured legs
exist, Phase 0 has answered the quota question, and the decision is a much
smaller one: attach prices to a picker that already works. If the league ever
decides $30/month is fine, that same design gets roughly 40× the headroom and
the quota problem disappears entirely.

---

## The counter-argument, stated fairly

The selector improves what the league does **every week** — fourteen people
submitting legs. Live tracking improves what happens **after**, and the manual
grading it replaces is maybe fourteen taps on a Sunday night. If the real pain
is "submitting is annoying and people type the odds wrong", the selector
addresses it more directly, and the recommendation above is wrong.

It still would not be my call, for one reason: the selector's cheapest valuable
version is a *hand-refreshed weekly snapshot with frozen prices*. That is close
enough to "type it in yourself" that the gain is mostly convenience, while the
cost is a permanent unauthenticated budget in a no-auth app. Tracking's cheapest
valuable version changes something the app genuinely cannot do today.

And if what you actually want is the **live** experience — the board moving
while the games are on — then be clear-eyed that *both* features are blocked on
the same thing, and neither one is bought with money you are currently spending.
Tracking at least gets there on one unverified endpoint (ESPN, free). The
selector's live half needs a paid tier, full stop.
