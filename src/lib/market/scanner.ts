import { runMarketWorker } from "./marketWorker";
import { getAllProfiles } from "../db/profileRepository";

/**
 * Delay between Finnhub calls.
 * Free tier: 60 req/min = 1 req/sec minimum safe gap.
 * We use 1100ms to stay safely under while being as fast as possible.
 */
const DELAY_MS = 1100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runScanner(user_id?: string) {
  let symbols: string[] = [];
  let peerSymbols: string[] = [];

  try {
    const profiles = await getAllProfiles();
    symbols = profiles.map(p => p.ticker);
    peerSymbols = [...new Set(profiles.flatMap(p => p.peers || []))];
  } catch (e: any) {
    console.error("[scanner] Failed to load profiles:", e.message);
    const env = process.env.FALLBACK_WATCHLIST;
    symbols = env ? env.split(",").map(s => s.trim()) : ["AAPL", "TSLA", "NVDA", "MSFT", "AMD"];
  }

  // Prioritise watchlist symbols first — they're what the user sees
  // Peer symbols are secondary and can lag slightly
  const primary   = [...new Set(symbols)];
  const secondary = [...new Set(peerSymbols.filter(s => !primary.includes(s)))];
  const allSymbols = [...primary, ...secondary];

  const results: Record<string, any> = {};
  const errors:  Record<string, string> = {};

  for (let i = 0; i < allSymbols.length; i++) {
    const symbol = allSymbols[i];
    if (i > 0) await sleep(DELAY_MS);

    try {
      const r = await runMarketWorker(symbol, user_id);
      results[symbol] = r ?? { symbol, status: "no-change" };
    } catch (err: any) {
      if (err?.response?.status === 429 || err?.message?.includes("429")) {
        console.warn(`[scanner] Rate limited on ${symbol} — backing off 5s`);
        await sleep(5000);
      } else {
        console.error(`[scanner] Error for ${symbol}:`, err.message);
      }
      errors[symbol] = err.message;
    }
  }

  return { scanned: allSymbols, results, errors };
}