import { fetchStock } from "./marketProvider";
import { calculateSignal } from "./signalEngine";
import { savePrice } from "../db/priceRepository";
import { saveSignal } from "../db/signalRepository";
import { supabase } from "../db/client";

// In-memory state per symbol
const previousPrices:    Record<string, number>        = {};
const previousVelocities:Record<string, number>        = {};
const previousSpreads:   Record<string, number | null> = {};
const pollCount:         Record<string, number>        = {};
const bootstrapped:      Record<string, boolean>       = {};

async function bootstrapSymbol(symbol: string): Promise<void> {
  if (bootstrapped[symbol]) return;
  bootstrapped[symbol] = true;
  try {
    const { data } = await supabase
      .from("price_history")
      .select("price, created_at")
      .eq("symbol", symbol)
      .order("created_at", { ascending: false })
      .limit(2);

    if (data && data.length >= 1) {
      previousPrices[symbol] = Number(data[0].price);
      if (data.length >= 2) {
        previousVelocities[symbol] = Number(data[0].price) - Number(data[1].price);
      }
      console.log(`[worker] ${symbol}: bootstrapped $${data[0].price}`);
    }
  } catch (e: any) {
    console.warn(`[worker] ${symbol}: bootstrap failed —`, e.message);
  }
}

/**
 * Check if there is recent news for this symbol.
 * Uses Finnhub /company-news — returns true if any headlines in last 24h.
 * Used to downgrade signal conviction when move is news-driven (§3.5).
 */
async function checkHasNews(symbol: string): Promise<boolean> {
  const token = process.env.MARKET_API_KEY;
  if (!token) return false;

  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${yesterday}&to=${today}&token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const news = await res.json();
    return Array.isArray(news) && news.length > 0;
  } catch {
    return false;
  }
}

export async function runMarketWorker(symbol: string, user_id?: string) {
  await bootstrapSymbol(symbol);

  const data = await fetchStock(symbol);

  if (!data.price) {
    console.log(`[worker] ${symbol}: price=0, skipping`);
    return;
  }

  pollCount[symbol] = (pollCount[symbol] ?? 0) + 1;

  await savePrice({
    symbol, price: data.price,
    bid: data.bid, ask: data.ask, volume: data.volume,
  }, user_id);

  const prevPrice    = previousPrices[symbol];
  const prevVelocity = previousVelocities[symbol] ?? 0;
  const prevSpread   = previousSpreads[symbol] ?? null;

  if (prevPrice !== undefined) {
    // Check news on every 3rd poll to avoid rate limits
    const shouldCheckNews = (pollCount[symbol] % 3) === 0;
    const hasNews = shouldCheckNews ? await checkHasNews(symbol) : false;

    const result = calculateSignal(
      data.price,
      prevPrice,
      prevVelocity,
      data.bid,
      data.ask,
      undefined,
      undefined,
      symbol,
      5,          // EMA period
      prevSpread, // for direction-aware spread scoring
      hasNews,    // news modifier
    );

    previousVelocities[symbol] = result.rawVelocity;
    if (result.spread != null) previousSpreads[symbol] = result.spread;

    await saveSignal({
      symbol,
      signal_type:  result.signal,
      velocity:     result.velocity,
      acceleration: result.acceleration,
      spread:       result.spread,
      divergence:   result.divergence,
      score:        result.score,
      strength:     result.strength,
    }, user_id);

    // Log session snapshot for anomaly detection
    try {
      const spreadRate = result.spread != null && prevSpread != null
        ? result.spread - prevSpread : null;

      await supabase.from("session_snapshots").insert([{
        symbol, user_id: user_id ?? null,
        velocity:     result.velocity,
        acceleration: result.acceleration,
        spread:       result.spread,
        spread_rate:  spreadRate,
        divergence:   result.divergence,
        score:        result.score,
        strength:     result.strength,
        price:        data.price,
        volume:       data.volume,
        signal_type:  result.signal,
        snapshot_at:  new Date().toISOString(),
      }]);
    } catch (e: any) {
      console.warn(`[worker] snapshot log failed for ${symbol}:`, e.message);
    }

    if (result.score > 0 || result.rawScore > 0) {
      console.log(
        `[worker] ${symbol} $${data.price.toFixed(2)}` +
        ` vel:${result.velocity.toFixed(4)}` +
        ` accel:${result.acceleration.toFixed(4)}` +
        ` spread:${result.spreadWidening === true ? "↑" : result.spreadWidening === false ? "↓" : "—"}` +
        ` score:${result.score}/3` +
        (hasNews ? " [news]" : "")
      );
    }
  }

  previousPrices[symbol] = data.price;
  return { symbol, price: data.price, change: data.changePct, poll: pollCount[symbol] };
}

export async function processRealtimeTick(
  
  tick: {
    symbol: string;
    price: number;
    bid?: number;
    ask?: number;
    volume?: number;
  },
  user_id?: string
) {
  console.log("🔥 Tick received:", tick.symbol, tick.price);
  const symbol = tick.symbol;

  await bootstrapSymbol(symbol);

  if (!tick.price) return;

  pollCount[symbol] = (pollCount[symbol] ?? 0) + 1;

  // ✅ Save price (optional but ok)
  await savePrice({
    symbol,
    price: tick.price,
    bid: tick.bid,
    ask: tick.ask,
    volume: tick.volume,
  }, user_id);

  const prevPrice    = previousPrices[symbol];
  const prevVelocity = previousVelocities[symbol] ?? 0;
  const prevSpread   = previousSpreads[symbol] ?? null;

  if (prevPrice !== undefined) {

    const result = calculateSignal(
      tick.price,
      prevPrice,
      prevVelocity,
      tick.bid,
      tick.ask,
      undefined,
      undefined,
      symbol,
      5,
      prevSpread,
      false // skip news for now (optimize later)
    );

    previousVelocities[symbol] = result.rawVelocity;
    if (result.spread != null) previousSpreads[symbol] = result.spread;

    await saveSignal({
      symbol,
      signal_type:  result.signal,
      velocity:     result.velocity,
      acceleration: result.acceleration,
      spread:       result.spread,
      divergence:   result.divergence,
      score:        result.score,
      strength:     result.strength,
    }, user_id);

    // 🔔 Optional: trigger alert here
    if (result.score >= 2) {
      console.log(`🚨 ALERT ${symbol} Momentum Fade`);
    }
    console.log(
  `📊 ${symbol} | vel:${result.velocity.toFixed(2)} | acc:${result.acceleration.toFixed(2)} | score:${result.score}`
);
  }

  previousPrices[symbol] = tick.price;
} 