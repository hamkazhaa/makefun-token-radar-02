# Token Launch Radar — radar-4

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hamkazhaa/makefun-token-radar-02/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hamkazhaa/makefun-token-radar-02/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Built for the [make.fun "Build the best token launch radar" bounty](https://make.fun/bounty/token-radar-01) ($1,325 in USDC).

A token launch radar for the make.fun token-radar-01 bounty ($1,325). It ranks every
protocol in the sealed snapshot that could still launch a token, by an implied value
calibrated on the market's own numbers — and it shows the uncertainty instead of hiding it.

## The model

```
implied = exp(category level) × TVL^slope × growth × maturity × breadth
```

- **Category level** — the log-log fit `log(market cap) = level + slope × log(TVL)` on
  the tokened protocols in the same category, computed from this snapshot at runtime.
  The market does not pay a flat multiple of TVL: across the snapshot's tokened
  protocols the fitted slope is 0.52, so small protocols trade richly per dollar of
  TVL and large ones cheaply. The level is the category's median residual
  (`log(mcap) − slope × log(TVL)`), shrunk toward the global level with pseudo-count 5;
  categories with fewer than five tokened protocols use the global level. The dashboard
  prints the whole calibration table, so every level can be checked — the multiple shown
  is the level's multiple at the category's typical TVL.
- **Growth** — `1 + 0.5 × clamp(change_7d, −60%, +120%)`.
- **Maturity** — `0.6 + 0.4 × min(days since listing, 1095) / 1095`: a protocol that has
  waited years without a token is worth more than a new one.
- **Breadth** — +5% per extra chain, up to four.
- **Range** — the same product with the category's 25th and 75th percentile levels
  instead of the median. A wide range means the market disagrees about the kind.

The board ranks all 198 rankable protocols in the practice snapshot: the 40 watchlist
protocols plus every other pre-token protocol that is not a wrapped, staked or bridged
product of a token that already trades (the watchlist's own rule, minus its TVL floor —
the floor is a floor, never a ceiling). The 24 largest live-token protocols are shown
separately, because their market caps are the calibration's source.

Each ranked row carries an 8-step farm plan derived from the protocol's own record
(category, chains, TVL, age, 7-day move): the core action, a second chain or a second
action, a weekly qualifying action, a hold period, a risk step sized to the 7-day move,
a claim check, and a farm log with an exit plan. Costs and times are on every step.

## How good is it, honestly

Measured on the practice snapshot's 128 tokened protocols (market cap > 0, TVL > 0),
predicting market cap from TVL, growth, age and chains:

| | within 2× | within 3× | median error |
|---|---|---|---|
| radar-4 (log-log fit, in-sample) | 34.4% | 48.4% | 3.38× |
| radar-3 (calibrated multiples, in-sample) | 31.3% | 44.5% | 3.77× |
| radar-2 (flat 0.25× multiple, in-sample) | 26.6% | 34.4% | 5.24× |

In-sample numbers flatter any model fitted on the same data, so the decision was made
on a **time-based out-of-sample test**: train on tokens listed before a cutoff, test on
tokens listed after it (95 of the 128 tokened protocols carry a listing date). Mean over
three cutoffs (2024-01-01, 2025-01-01, median listing date):

| | within 2× | within 3× | median error |
|---|---|---|---|
| radar-4 (log-log, median offsets) | 32.6% | 48.4% | 3.63× |
| radar-3 (calibrated multiples) | 29.9% | 37.1% | 5.29× |
| flat 0.25× multiple | 24.8% | 33.6% | 5.22× |

Radar-4 beats radar-3 on all three cutoffs for within-3× and median error, and on
within-2× on two cutoffs (tying the third) — and on the largest test set (51 tokens
listed since 2024) its error is smaller than radar-3's on 35 protocols against 16.
The same holds on a seeded random split-half (median error 2.99×/4.06× vs 4.30×/5.69×).
What did not survive the test, and was rejected: recency-weighted multiples, shrinkage
toward the global median, trimmed means, a year-trend extrapolation (much worse), a
fuller regression with 7-day change and age as extra predictors, and blends of the two
models. The FDV/TVL signal is still very noisy — a median error near 3.6× — so the
dashboard reports the in-sample check and does not claim precision. The ranking
differentiates from radar-3 (Spearman ρ 0.978, top-10 overlap 8/10, 22 of 198 rows move
20+ ranks), and every multiple is traceable to the snapshot's own market data.

## Run it

Node 22, standard library only, no network:

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Reads `/input/snapshot.json` (or `--input <snapshot.json|directory>`), writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output
directory. Two runs on the same snapshot are byte-identical. `main.ts` refuses to write
a dossier when the board fails the gate (missing watchlist slugs, ranks out of order,
farm steps outside 3–12 or 20–600 characters) or when fewer than 3 screenshots are present.

## The dashboard

`dashboard/index.html` (with `data.js` next to it) is a self-contained page: top-5
spotlight, the model and its calibration table, the sortable/filterable board
(search, category, chain, minimum TVL, six sort orders), a live-token tab, the fastest
growers, a category table, and a reading guide. Clicking a row opens a detail drawer
with the value breakdown (TVL × multiple × growth × maturity × breadth), the tokened
comparables the multiple came from, and the 8-step farm plan. Hash routes:
`#/detail/<slug>` and `#/filter/<category>`.

Screenshots in `screenshots/` (1280×800 JPEG, rendered in headless Chromium from this
dashboard): the board, a rank-1 detail view, and a category-filtered board.

## Files

```
main.ts                  entrypoint: snapshot → board.json + data.js + dashboard + dossier.json
lib/model.ts             the model: calibration, ranking, farm plans, validation
vendor/makefun-board.ts  the kit's dossier library, vendored byte-for-byte
dashboard/               index.html, app.css, app.js (the dashboard; ≤ 64 KiB of source)
screenshots/              3 rendered views of the dashboard
LICENSE                  MIT
.makefun/owner.json      the submitting account's wallet
```

## Data

Snapshot: DefiLlama `https://api.llama.fi/protocols`, as of 2026-11-14, floor $50,000,000,
758 protocols, 40 on the watchlist. Values are model estimates from that snapshot. They
are not prices, not advice, and not a promise that any token will launch.

## License

MIT — see `LICENSE`. Copyright (c) 2026 dhiandt.
