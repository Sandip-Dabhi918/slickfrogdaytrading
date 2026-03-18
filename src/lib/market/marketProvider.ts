/**
 * Pluggable market data adapter (§6.1)
 *
 * All market data goes through this interface.
 * To swap providers: set MARKET_PROVIDER env var or pass name to getProvider().
 * The rest of the app never imports from individual fetchers directly.
 *
 * Supported providers:
 *   finnhub  — US stocks real-time WS, TSX REST (15min delay). Free tier.
 *   yahoo    — US + TSX REST (~1min delay). No API key needed.
 *   twelve   — US + TSX real-time WS. Free tier (8 req/min REST, 800 WS credits/day).
 *   hybrid   — Finnhub for US, Twelve Data for TSX. Best of both.
 */

import type { QuoteData } from "./marketFetcher";
export type { QuoteData };

export interface MarketProvider {
  name:        string;
  fetchStock:  (symbol: string) => Promise<QuoteData>;
  supportsWSS: boolean;
  supportsTSX: boolean;
}

// ── Finnhub ───────────────────────────────────────────────────────────────────
import { fetchStock as finnhubFetch } from "./marketFetcher";

const finnhubProvider: MarketProvider = {
  name:        "Finnhub",
  fetchStock:  finnhubFetch,
  supportsWSS: true,
  supportsTSX: true, // .TO suffix, REST only on free tier
};

// ── Yahoo Finance ─────────────────────────────────────────────────────────────
import { fetchYahooQuote } from "./yahooFetcher";

const yahooProvider: MarketProvider = {
  name:       "Yahoo Finance",
  fetchStock: async (symbol: string): Promise<QuoteData> => {
    const q = await fetchYahooQuote(symbol);
    return {
      price: q.price, bid: q.bid, ask: q.ask, volume: q.volume,
      open: q.open, high: q.dayHigh, low: q.dayLow,
      prevClose: q.previousClose, change: q.change, changePct: q.changePct,
    };
  },
  supportsWSS: false,
  supportsTSX: true,
};

// ── Twelve Data ───────────────────────────────────────────────────────────────
import { fetchTwelveQuote } from "./twelveDataFetcher";

const twelveProvider: MarketProvider = {
  name:        "Twelve Data",
  fetchStock:  fetchTwelveQuote,
  supportsWSS: true,  // real-time WS for US + TSX
  supportsTSX: true,  // full TSX support including real-time
};

// ── Hybrid: Finnhub (US) + Twelve Data (TSX) ──────────────────────────────────
function isTSX(symbol: string): boolean {
  return symbol.endsWith(".TO") || symbol.endsWith(".TSX") || symbol.endsWith(".V");
}

const hybridProvider: MarketProvider = {
  name:       "Hybrid (Finnhub + Twelve Data)",
  fetchStock: async (symbol: string): Promise<QuoteData> => {
    if (isTSX(symbol)) {
      return fetchTwelveQuote(symbol);
    }
    return finnhubFetch(symbol);
  },
  supportsWSS: true,  // both WS connections open simultaneously
  supportsTSX: true,
};

// ── Registry ──────────────────────────────────────────────────────────────────
const PROVIDERS: Record<string, MarketProvider> = {
  finnhub: finnhubProvider,
  yahoo:   yahooProvider,
  twelve:  twelveProvider,
  hybrid:  hybridProvider,
};

export function getProvider(name?: string): MarketProvider {
  const key = (name || process.env.MARKET_PROVIDER || "hybrid").toLowerCase();
  return PROVIDERS[key] ?? hybridProvider;
}

// Default — hybrid gives best coverage out of the box
export const marketProvider = getProvider();

export async function fetchStock(symbol: string): Promise<QuoteData> {
  return marketProvider.fetchStock(symbol);
}

export { isTSX };