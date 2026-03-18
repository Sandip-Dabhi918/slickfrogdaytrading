import { calculateDivergence } from "./divergenceEngine";

/**
 * EMA (Exponential Moving Average) smoothing.
 * α = 2/(period+1) — standard EMA formula.
 */
export function ema(current: number, prevEma: number, period = 5): number {
  const alpha = 2 / (period + 1);
  return alpha * current + (1 - alpha) * prevEma;
}

// Per-symbol EMA state — persists within the same Node process
const emaVelocity:     Record<string, number> = {};
const emaAcceleration: Record<string, number> = {};

/**
 * Calculate signal with EMA-smoothed velocity and acceleration.
 *
 * Scoring (§9 Signal Logic Summary — max score = 3):
 *
 *   1. Acceleration (1pt)
 *      SELL: velocity > 0 AND acceleration < 0  (rising but slowing)
 *      BUY:  velocity < 0 AND acceleration > 0  (falling but slowing)
 *
 *   2. Spread (1pt) — DIRECTION-AWARE (§3.3)
 *      SELL: spread widening during upward run    (market makers stepping back)
 *      BUY:  spread tightening during downward slide (market stabilising)
 *
 *   3. Divergence (1pt) — from peer comparison
 *
 *   News modifier: if material news present, conviction is downgraded
 *   because the move is fundamentally supported (§3.5)
 *
 * @param symbol       - Used for per-symbol EMA state
 * @param current      - Current price
 * @param previous     - Previous price
 * @param prevVelocity - Previous raw velocity
 * @param bid          - Current bid
 * @param ask          - Current ask
 * @param prevSpread   - Previous spread (to detect widening/tightening)
 * @param hasNews      - True if material news exists for this ticker
 * @param indexCurrent / indexPrevious - For divergence calc
 * @param emaPeriod    - EMA smoothing period (default 5)
 */
export function calculateSignal(
  current:        number,
  previous:       number,
  prevVelocity:   number,
  bid?:           number,
  ask?:           number,
  indexCurrent?:  number,
  indexPrevious?: number,
  symbol?:        string,
  emaPeriod = 5,
  prevSpread?:    number | null,
  hasNews = false
) {
  // ── Raw values ─────────────────────────────────────────────────────────────
  const rawVelocity     = current - previous;
  const rawAcceleration = rawVelocity - prevVelocity;
  const spread          = bid && ask ? ask - bid : null;

  // ── EMA smoothing ──────────────────────────────────────────────────────────
  let smoothedVelocity:     number;
  let smoothedAcceleration: number;

  if (symbol) {
    if (!(symbol in emaVelocity)) {
      emaVelocity[symbol]     = rawVelocity;
      emaAcceleration[symbol] = rawAcceleration;
    }
    emaVelocity[symbol]     = ema(rawVelocity,     emaVelocity[symbol],     emaPeriod);
    emaAcceleration[symbol] = ema(rawAcceleration, emaAcceleration[symbol], emaPeriod);
    smoothedVelocity     = emaVelocity[symbol];
    smoothedAcceleration = emaAcceleration[symbol];
  } else {
    smoothedVelocity     = rawVelocity;
    smoothedAcceleration = rawAcceleration;
  }

  let signal = "HOLD";
  let score  = 0;

  // ── 1. Acceleration signal (§3.2) ──────────────────────────────────────────
  const isSellFade      = smoothedVelocity > 0 && smoothedAcceleration < 0;
  const isBuyExhaustion = smoothedVelocity < 0 && smoothedAcceleration > 0;

  if (isSellFade) {
    signal = "SELL";
    score += 1;
  } else if (isBuyExhaustion) {
    signal = "BUY";
    score += 1;
  }

  // ── 2. Spread signal — DIRECTION-AWARE (§3.3) ──────────────────────────────
  // Spread widening during upward run = bearish (sell)
  // Spread tightening during downward slide = bullish (buy)
  if (spread != null && prevSpread != null) {
    const spreadWidening  = spread > prevSpread;
    const spreadTightening = spread < prevSpread;

    if (isSellFade && spreadWidening) {
      score += 1; // confirms sell fade
    } else if (isBuyExhaustion && spreadTightening) {
      score += 1; // confirms buy exhaustion
    }
  } else if (spread != null) {
    // No previous spread to compare — fall back to absolute threshold
    // Only score if direction signal already exists (avoid false points)
    if ((isSellFade || isBuyExhaustion) && spread > 0.05) {
      score += 1;
    }
  }

  // ── 3. Divergence signal (§3.4) ────────────────────────────────────────────
  let divergenceResult = null;
  if (indexCurrent && indexPrevious) {
    divergenceResult = calculateDivergence(current, previous, indexCurrent, indexPrevious);
    score += divergenceResult.score;
  }

  // ── Cap score at 3 (§9) ────────────────────────────────────────────────────
  score = Math.min(score, 3);

  // ── News modifier (§3.5) ───────────────────────────────────────────────────
  // Material news explains the move → downgrade conviction by 1
  // (signal is still valid but less reliable)
  const effectiveScore = hasNews && score > 0 ? Math.max(0, score - 1) : score;

  // ── Strength label (§9) ────────────────────────────────────────────────────
  let strength = "WEAK";
  if (effectiveScore === 2) strength = "STRONG";
  if (effectiveScore >= 3)  strength = "ACTION";

  return {
    velocity:        smoothedVelocity,
    acceleration:    smoothedAcceleration,
    rawVelocity,
    rawAcceleration,
    spread,
    spreadWidening:  spread != null && prevSpread != null ? spread > prevSpread : null,
    divergence:      divergenceResult?.divergence ?? null,
    signal,
    score:           effectiveScore,  // news-adjusted
    rawScore:        score,           // pre-news score for debugging
    hasNews,
    strength,
  };
}

export function resetEmaState(symbol: string): void {
  delete emaVelocity[symbol];
  delete emaAcceleration[symbol];
}