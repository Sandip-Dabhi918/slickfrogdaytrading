/**
 * Twelve Data market data adapter
 *
 * Free tier: 8 REST calls/min, 800 WebSocket credits/day
 * Real-time WebSocket for both US and Canadian (TSX) stocks
 * API key: https://twelvedata.com/pricing (free signup)
 *
 * Set TWELVE_DATA_API_KEY in .env.local to enable
 */

import type { QuoteData } from "./marketFetcher";

const BASE  = "https://api.twelvedata.com";
const token = () => process.env.TWELVE_DATA_API_KEY || "";

/**
 * Convert a symbol to Twelve Data format
 * TSX symbols: TD.TO → TD:TSX
 * US symbols:  AAPL  → AAPL:NASDAQ (or just AAPL)
 */
export function toTwelveSymbol(symbol: string): string {
  if (symbol.endsWith(".TO"))  return symbol.replace(".TO", ":TSX");
  if (symbol.endsWith(".TSX")) return symbol.replace(".TSX", ":TSX");
  if (symbol.endsWith(".V"))   return symbol.replace(".V", ":TSXV");
  return symbol; // US symbols pass through as-is
}

/**
 * Convert Twelve Data symbol back to our internal format
 * TD:TSX → TD.TO
 */
export function fromTwelveSymbol(symbol: string): string {
  if (symbol.endsWith(":TSX"))  return symbol.replace(":TSX", ".TO");
  if (symbol.endsWith(":TSXV")) return symbol.replace(":TSXV", ".V");
  // Strip any exchange suffix for US stocks
  return symbol.split(":")[0];
}

export async function fetchTwelveQuote(symbol: string): Promise<QuoteData> {
  const sym = toTwelveSymbol(symbol);
  const url = `${BASE}/quote?symbol=${encodeURIComponent(sym)}&apikey=${token()}`;

  const res = await fetch(url, { headers: { "User-Agent": "MomentumFade/1.0" } });
  if (!res.ok) throw new Error(`Twelve Data returned ${res.status} for ${symbol}`);

  const d = await res.json();
  if (d.status === "error") throw new Error(d.message || `Twelve Data error for ${symbol}`);

  const price     = Number(d.close ?? d.price ?? 0);
  const prevClose = Number(d.previous_close ?? price);

  // Estimate bid/ask (Twelve Data REST doesn't include L1 on free tier)
  const spreadEst = price > 100 ? 0.02 : price > 50 ? 0.03 : price > 10 ? 0.05 : 0.10;

  return {
    price,
    bid:       price - spreadEst / 2,
    ask:       price + spreadEst / 2,
    volume:    Number(d.volume ?? 0),
    open:      Number(d.open   ?? price),
    high:      Number(d.high   ?? price),
    low:       Number(d.low    ?? price),
    prevClose,
    change:    price - prevClose,
    changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
  };
}

export async function fetchTwelveQuotes(
  symbols: string[]
): Promise<Record<string, QuoteData>> {
  // Twelve Data supports batch requests — comma-separated
  const syms = symbols.map(toTwelveSymbol).join(",");
  const url  = `${BASE}/quote?symbol=${encodeURIComponent(syms)}&apikey=${token()}`;

  const res = await fetch(url, { headers: { "User-Agent": "MomentumFade/1.0" } });
  if (!res.ok) throw new Error(`Twelve Data batch returned ${res.status}`);

  const data = await res.json();
  const result: Record<string, QuoteData> = {};

  // Single symbol returns object directly; multiple returns { SYMBOL: object }
  const isMulti = symbols.length > 1;

  for (const sym of symbols) {
    const twelveKey = toTwelveSymbol(sym);
    const d = isMulti ? data[twelveKey] : data;
    if (!d || d.status === "error") {
      console.warn(`[Twelve Data] No data for ${sym}:`, d?.message);
      continue;
    }
    const price     = Number(d.close ?? d.price ?? 0);
    const prevClose = Number(d.previous_close ?? price);
    const spreadEst = price > 100 ? 0.02 : price > 50 ? 0.03 : price > 10 ? 0.05 : 0.10;

    result[sym] = {
      price,
      bid:       price - spreadEst / 2,
      ask:       price + spreadEst / 2,
      volume:    Number(d.volume ?? 0),
      open:      Number(d.open   ?? price),
      high:      Number(d.high   ?? price),
      low:       Number(d.low    ?? price),
      prevClose,
      change:    price - prevClose,
      changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    };
  }

  return result;
}