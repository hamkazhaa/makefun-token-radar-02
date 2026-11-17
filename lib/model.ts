// radar-4: a token launch radar whose value model is calibrated on the snapshot itself.
//
// The board ranks every rankable pre-token protocol in the sealed snapshot — the whole
// watchlist plus every other protocol that records no token and is not a wrapped, staked
// or bridged product of a token that already trades. Nothing is ranked by name: the same
// function scores every row, and every number it uses comes from the snapshot's own figures.
//
// The model's one idea: a token's value is what the market already pays for the same kind
// of protocol — but the market does not pay a flat multiple of TVL. Across the snapshot's
// tokened protocols, log market cap grows with log TVL with a slope near 0.58, not 1:
// small protocols trade richly per dollar of TVL, large ones cheaply. So the model fits
// log(mcap) = level + slope x log(TVL) on the tokened protocols, with a per-category
// level (the median residual for the category, shrunk toward the global level with
// weight 5) and the same growth, tenure and chain-breadth adjustments as before.
// The dashboard shows the whole calibration table, so a reader can see where every
// level came from — and the multiple it implies at the category's typical TVL.
//
//   implied = exp(level) x TVL^slope x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
//           x (0.6 + min(age_days, 1095) / 1095 x 0.4)
//           x (1 + 0.05 x min(chains - 1, 4))
//
// The low/high band of an implied value re-runs the same product with the category's
// 25th and 75th percentile levels instead of its median: an honest range, not a point
// pretending to be certain. The multiple a row shows is the effective multiple at its
// own TVL, exp(level) x TVL^(slope - 1), so the detail view's arithmetic still reads
// TVL x multiple x growth x maturity x breadth.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One category's calibration: the fitted level of its tokened protocols. */
export interface CategoryMultiple {
  category: string;
  n: number;
  /** The multiple the fitted level implies at the category's typical TVL (for the table). */
  median: number;
  p25: number;
  p75: number;
  fromGlobal: boolean;
  /** The fitted level itself: log(mcap) = level + slope x log(TVL). */
  level: number;
  levelLow: number;
  levelHigh: number;
  /** The typical TVL the displayed multiple is evaluated at (geometric mean of the category's tokened TVLs). */
  refTvl: number;
}

/** The whole calibration: every category's level plus the global fallback and the fitted slope. */
export interface Calibration {
  byCategory: CategoryMultiple[];
  /** The global level triple: exp() of the median / p25 / p75 of all tokened residuals. */
  global: { median: number; p25: number; p75: number };
  /** The fitted log-log slope of market cap on TVL. */
  slope: number;
  /** In-sample check: how well the calibrated model predicts the tokened protocols' own market caps. */
  check: {
    n: number;
    within2x: number;
    within3x: number;
    medianFactor: number;
    flatWithin2x: number;
    flatWithin3x: number;
    flatMedianFactor: number;
  };
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    multiple: number;
    multiple_low: number;
    multiple_high: number;
    multiple_source: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  multiple: number;
  /** Where the multiple came from: "<category> median" or "global median" when the category is too thin. */
  multiple_source: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  comparables: string[];
  /** The eight farm steps, exactly as board.json carries them, so page and board agree. */
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** One tokened protocol a detail view cites as a comparable. */
export interface ComparableRow {
  slug: string;
  name: string;
  category: string | null;
  mcap_usd: number;
  tvl_usd: number;
  multiple: number;
}

/** One category's summary for the dashboard's category table. */
export interface CategorySummary {
  category: string;
  rows: number;
  tvl_usd: number;
  top_name: string;
  top_slug: string;
  multiple: number;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  calibration: Calibration;
  rows: RadarRow[];
  live: LiveRow[];
  comparables: Record<string, ComparableRow>;
  movers: RadarRow[];
  categories: CategorySummary[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted copy, or NaN when empty. */
function medianOf(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The p-th percentile (nearest rank) of a sorted copy, or NaN when empty. */
function percentileOf(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx]!;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whole words that mark a wrapped or staked product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol must not begin with. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories the watchlist rule leaves out: bridges and staking products of live tokens. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a token that already trades, by the watchlist's own rule minus its
 * TVL floor (the floor is a floor, never a ceiling, so it does not apply here).
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** How strongly a category's own level counts against the global one (pseudo-count). */
const SHRINK_K = 5;

/**
 * Calibrate the model on the snapshot's own tokened protocols: fit the log-log slope
 * of market cap on TVL, then take, per category, the median / p25 / p75 of the
 * residuals log(mcap) - slope x log(TVL), each shrunk toward the corresponding global
 * value with pseudo-count 5 (thin categories fall back to the global level). The
 * displayed multiple is the level's multiple at the category's typical TVL. The check
 * at the end measures, in-sample, how well the calibrated model predicts those same
 * tokens' market caps against a flat 0.25x rule.
 */
export function calibrate(snapshot: Snapshot): Calibration {
  const tokened = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const xs = tokened.map((p) => Math.log(p.tvl_usd));
  const ys = tokened.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.length === 0 ? 0 : xs.reduce((t, x) => t + x, 0) / xs.length;
  const my = ys.length === 0 ? 0 : ys.reduce((t, y) => t + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den === 0 ? 1 : num / den;
  const resid = tokened.map((p) => Math.log(p.mcap_usd!) - slope * Math.log(p.tvl_usd));
  const gMed = medianOf(resid);
  const gP25 = percentileOf(resid, 0.25);
  const gP75 = percentileOf(resid, 0.75);
  const global = { median: Math.exp(gMed), p25: Math.exp(gP25), p75: Math.exp(gP75) };
  const byCat = new Map<string, { res: number[]; tvls: number[] }>();
  for (const p of tokened) {
    const key = p.category ?? 'Uncategorized';
    const list = byCat.get(key);
    const r = Math.log(p.mcap_usd!) - slope * Math.log(p.tvl_usd);
    if (list === undefined) byCat.set(key, { res: [r], tvls: [p.tvl_usd] });
    else {
      list.res.push(r);
      list.tvls.push(p.tvl_usd);
    }
  }
  const byCategory: CategoryMultiple[] = [...byCat.entries()]
    .map(([category, { res, tvls }]) => {
      const n = res.length;
      const useOwn = n >= 5;
      const ownMed = useOwn ? medianOf(res) : gMed;
      const ownP25 = useOwn ? percentileOf(res, 0.25) : gP25;
      const ownP75 = useOwn ? percentileOf(res, 0.75) : gP75;
      // Shrink each of the three levels toward its global value with pseudo-count 5;
      // the same weight on all three keeps low <= median <= high.
      const level = (n * ownMed + SHRINK_K * gMed) / (n + SHRINK_K);
      const levelLow = (n * ownP25 + SHRINK_K * gP25) / (n + SHRINK_K);
      const levelHigh = (n * ownP75 + SHRINK_K * gP75) / (n + SHRINK_K);
      const refTvl = Math.exp(tvls.reduce((t, v) => t + Math.log(v), 0) / tvls.length);
      const multipleAt = (lv: number): number => Math.exp(lv) * Math.pow(refTvl, slope - 1);
      return {
        category,
        n,
        median: round4(multipleAt(level)),
        p25: round4(multipleAt(levelLow)),
        p75: round4(multipleAt(levelHigh)),
        fromGlobal: !useOwn,
        level: round4(level),
        levelLow: round4(levelLow),
        levelHigh: round4(levelHigh),
        refTvl: Math.round(refTvl),
      };
    })
    .sort((a, b) => b.median - a.median || (a.category < b.category ? -1 : 1));
  const calib: Calibration = {
    byCategory,
    global,
    slope: round4(slope),
    check: {
      n: 0,
      within2x: 0,
      within3x: 0,
      medianFactor: 0,
      flatWithin2x: 0,
      flatWithin3x: 0,
      flatMedianFactor: 0,
    },
  };
  // In-sample check: predict each tokened protocol's market cap with the calibrated model
  // and with a flat 0.25x rule, and count how often each lands within 2x and 3x.
  let within2 = 0;
  let within3 = 0;
  let flat2 = 0;
  let flat3 = 0;
  const factors: number[] = [];
  const flatFactors: number[] = [];
  for (const p of tokened) {
    const f = growthAndMaturity(p, snapshot.as_of);
    const pred = impliedValue(p, calib, snapshot.as_of).implied;
    const flat = Math.max(1, p.tvl_usd * 0.25 * f.growthMult * f.maturityMult * f.breadthMult);
    const err = Math.abs(Math.log(pred / p.mcap_usd!));
    const flatErr = Math.abs(Math.log(flat / p.mcap_usd!));
    if (err <= Math.log(2)) within2++;
    if (err <= Math.log(3)) within3++;
    if (flatErr <= Math.log(2)) flat2++;
    if (flatErr <= Math.log(3)) flat3++;
    factors.push(err);
    flatFactors.push(flatErr);
  }
  const n = tokened.length;
  calib.check = {
    n,
    within2x: n === 0 ? 0 : within2 / n,
    within3x: n === 0 ? 0 : within3 / n,
    medianFactor: n === 0 ? 0 : round4(Math.exp(medianOf(factors))),
    flatWithin2x: n === 0 ? 0 : flat2 / n,
    flatWithin3x: n === 0 ? 0 : flat3 / n,
    flatMedianFactor: n === 0 ? 0 : round4(Math.exp(medianOf(flatFactors))),
  };
  return calib;
}

/** The growth, maturity and breadth multipliers one protocol gets. Shared by the model and its check. */
export function growthAndMaturity(p: SnapshotProtocol, asOf: string): { growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(120, Math.max(-60, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * 0.5;
  const ageForModel = age ?? 365;
  const maturityMult = 0.6 + (Math.min(Math.max(ageForModel, 0), 1095) / 1095) * 0.4;
  const chainCount = p.chains.length > 0 ? p.chains.length : 1;
  const breadthMult = 1 + 0.05 * Math.min(chainCount - 1, 4);
  return { growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The implied value and its honest band for one protocol under the calibration. */
export function impliedValue(
  p: SnapshotProtocol,
  calib: Calibration,
  asOf: string,
): { implied: number; low: number; high: number; multiple: number; multipleLow: number; multipleHigh: number; source: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const f = growthAndMaturity(p, asOf);
  const entry = calib.byCategory.find((c) => c.category === (p.category ?? 'Uncategorized'));
  const level = entry !== undefined ? entry.level : Math.log(calib.global.median);
  const levelLow = entry !== undefined ? entry.levelLow : Math.log(calib.global.p25);
  const levelHigh = entry !== undefined ? entry.levelHigh : Math.log(calib.global.p75);
  const source = entry !== undefined && !entry.fromGlobal ? `${p.category ?? 'Uncategorized'} log-fit` : 'global log-fit';
  // The effective multiple at this protocol's own TVL: exp(level) x TVL^(slope - 1).
  const multAt = (lv: number): number => (p.tvl_usd > 0 ? Math.exp(lv) * Math.pow(p.tvl_usd, calib.slope - 1) : 0);
  const multiple = multAt(level);
  const multipleLow = multAt(levelLow);
  const multipleHigh = multAt(levelHigh);
  const valueAt = (lv: number): number => Math.exp(lv) * Math.pow(p.tvl_usd, calib.slope) * f.growthMult * f.maturityMult * f.breadthMult;
  return {
    implied: Math.max(1, Math.round(valueAt(level))),
    low: Math.max(1, Math.round(valueAt(levelLow))),
    high: Math.max(1, Math.round(valueAt(levelHigh))),
    multiple: round4(multiple),
    multipleLow: round4(multipleLow),
    multipleHigh: round4(multipleHigh),
    source,
    growthPct: f.growthPct,
    growthMult: round4(f.growthMult),
    maturityMult: round4(f.maturityMult),
    breadthMult: round4(f.breadthMult),
    age: f.age,
  };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in whole dollars: cheap chains cost cents, Ethereum dollars. */
function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 8;
  if (c.includes('solana')) return 0.01;
  if (c.includes('polygon')) return 0.1;
  if (c.includes('bsc') || c.includes('bnb') || c.includes('binance')) return 0.3;
  if (c.includes('arbitrum') || c.includes('optimism') || c.includes('base') || c.includes('avalanche') || c.includes('zksync') || c.includes('linea') || c.includes('blast') || c.includes('mode')) return 0.5;
  return 1;
}

/** A readable dollar figure: $8, $0.50, $0.01. */
function usd(n: number): string {
  if (n >= 1) return `$${n % 1 === 0 ? n : n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open so it counts.`;
  if (c.includes('dex') || c.includes('amm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the shares.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then leave the rest in the account.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('option')) return `Deposit $${capital} into ${name}'s vault on ${chain} and keep the position through one epoch.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different qualifying action for the same protocol. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the deposit on ${name} and repay it within the week, so the borrow side is used too.`;
  if (c.includes('dex') || c.includes('amm')) return `Make one swap through ${name} on ${chain} for at least $10, so the trading side of the account is active.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back through ${name} so the account shows two-way use.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim or restake the staking rewards once, so the account shows an active claim.`;
  if (c.includes('prediction')) return `Settle one more small market position on ${name} and leave the winnings in the account.`;
  return `Use one more feature of ${name} on ${chain} — a swap, a vote or a claim — so the account is not a single deposit.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, seven-day move),
 * never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const chain2 = p.chains.length > 1 ? p.chains[1]! : null;
  const gas = gasUsd(chain);
  const gas2 = chain2 === null ? gas : gasUsd(chain2);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const growth = finite(p.change_7d, 0);
  const swing = Math.max(10, Math.ceil(Math.abs(growth)));
  const riskUsd = Math.max(5, Math.round((capital * swing) / 100));
  const growthLine =
    p.change_7d === null
      ? `The snapshot reports no seven-day move for this protocol, so size the position for a 10% drawdown.`
      : `This protocol's TVL moved ${growth > 0 ? '+' : ''}${growth.toFixed(1)}% in seven days, so size the position for a ${swing}% drawdown.`;
  const third =
    chain2 !== null
      ? {
          text: `Repeat the same position on ${chain2} with half the capital, $${Math.round(capital / 2)}, so the farm covers a second chain.`,
          cost: `$${Math.round(capital / 2)} of capital and about ${usd(gas2)} of gas`,
          time: '10 minutes',
        }
      : {
          text: secondActionFor(p, capital, chain),
          cost: `about ${usd(gas)} of gas`,
          time: '10 minutes',
        };
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'nothing but the wallet',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about ${usd(gas)} of gas`,
      time: '15 minutes to set up',
    },
    third,
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about ${usd(gas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `${growthLine} Keep at most $${riskUsd} of the position at risk to that swing, and never farm with money you need in the next ${hold} days.`,
      cost: 'nothing but discipline',
      time: '5 minutes to check',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and plan the exit: withdraw in two steps and keep ${usd(gas)} of gas for the last one.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.tvl_usd > 0 ? round4(p.mcap_usd! / p.tvl_usd) : null,
    }));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, calib: Calibration): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, calib, snapshot.as_of) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_low_usd: s.v.low,
    implied_high_usd: s.v.high,
    model: {
      multiple: s.v.multiple,
      multiple_low: s.v.multipleLow,
      multiple_high: s.v.multipleHigh,
      multiple_source: s.v.source,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      breadth_multiplier: s.v.breadthMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, comparables: string[]): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    multiple: row.model.multiple,
    multiple_source: row.model.multiple_source,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    comparables,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const calib = calibrate(snapshot);
  const board = buildBoard(snapshot, calib);
  const live = liveRows(snapshot);
  const index = bySlug(snapshot.protocols);
  // Comparables: for each board row, the three largest tokened protocols in its category.
  const tokenedByCat = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.mcap_usd <= 0) continue;
    const key = p.category ?? 'Uncategorized';
    const list = tokenedByCat.get(key);
    if (list === undefined) tokenedByCat.set(key, [p]);
    else list.push(p);
  }
  for (const list of tokenedByCat.values()) list.sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0));
  const comparables: Record<string, ComparableRow> = {};
  const rows: RadarRow[] = board.map((row) => {
    const list = tokenedByCat.get(row.category ?? 'Uncategorized') ?? [];
    const picks = list.slice(0, 3);
    for (const p of picks) {
      if (comparables[p.slug] === undefined) {
        comparables[p.slug] = {
          slug: p.slug,
          name: p.name,
          category: p.category,
          mcap_usd: p.mcap_usd!,
          tvl_usd: p.tvl_usd,
          multiple: p.tvl_usd > 0 ? round4(p.mcap_usd! / p.tvl_usd) : 0,
        };
      }
    }
    return radarRow(row, picks.map((p) => p.slug));
  });
  // Fastest growers among the ranked rows, for the movers strip.
  const movers = rows
    .filter((r) => r.change_7d !== null)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0))
    .slice(0, 5);
  // One summary line per category on the board.
  const catMap = new Map<string, { rows: number; tvl: number; top: RadarRow | null }>();
  for (const r of rows) {
    const key = r.category ?? 'Uncategorized';
    const entry = catMap.get(key);
    if (entry === undefined) catMap.set(key, { rows: 1, tvl: r.tvl_usd, top: r });
    else {
      entry.rows++;
      entry.tvl += r.tvl_usd;
      if (entry.top === null || r.tvl_usd > entry.top.tvl_usd) entry.top = r;
    }
  }
  const categories: CategorySummary[] = [...catMap.entries()]
    .map(([category, e]) => {
      const mult = calib.byCategory.find((c) => c.category === category);
      return {
        category,
        rows: e.rows,
        tvl_usd: e.tvl,
        top_name: e.top !== null ? e.top.name : '',
        top_slug: e.top !== null ? e.top.slug : '',
        multiple: mult !== undefined ? mult.median : calib.global.median,
      };
    })
    .sort((a, b) => b.tvl_usd - a.tvl_usd);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    calibration: calib,
    rows,
    live,
    comparables,
    movers,
    categories,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
