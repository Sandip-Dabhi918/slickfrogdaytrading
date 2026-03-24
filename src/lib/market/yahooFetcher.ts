/**
 * Yahoo Finance market data adapter
 *
 * Uses Yahoo's unofficial (but stable) v8 quote endpoint.
 * No API key required. ~1 min delay. Supports US + TSX (.TO suffix).
 *
 * ToS note: unofficial endpoint, fine for dev/testing.
 * For production use, consider upgrading to a paid provider.
 */

export interface YahooQuote {
  symbol:       string;
  shortName:    string;
  price:        number;
  previousClose:number;
  open:         number;
  dayHigh:      number;
  dayLow:       number;
  volume:       number;
  change:       number;
  changePct:    number;
  marketState:  "REGULAR" | "PRE" | "POST" | "CLOSED" | string;
  bid:          number;
  ask:          number;
  spread:       number;
  currency:     string;
  exchange:     string;
}

/**
 * Fetch a single quote from Yahoo Finance.
 * Call this from a server-side API route to avoid CORS.
 */
export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept":     "application/json",
    },
  });

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;

  if (!meta) throw new Error(`No data returned from Yahoo Finance for ${symbol}`);

  const price         = Number(meta.regularMarketPrice   ?? 0);
  const previousClose = Number(meta.previousClose        ?? meta.chartPreviousClose ?? price);
  const change        = price - previousClose;
  const changePct     = previousClose > 0 ? (change / previousClose) * 100 : 0;

  // Yahoo provides bid/ask on some symbols, estimate on others
  const bid    = Number(meta.bid ?? price - (price > 100 ? 0.01 : 0.05));
  const ask    = Number(meta.ask ?? price + (price > 100 ? 0.01 : 0.05));
  const spread = ask - bid;

  return {
    symbol:        symbol.toUpperCase(),
    shortName:     meta.shortName || meta.symbol || symbol,
    price,
    previousClose,
    open:          Number(meta.regularMarketOpen    ?? price),
    dayHigh:       Number(meta.regularMarketDayHigh ?? price),
    dayLow:        Number(meta.regularMarketDayLow  ?? price),
    volume:        Number(meta.regularMarketVolume  ?? 0),
    change,
    changePct,
    marketState:   meta.marketState || "CLOSED",
    bid,
    ask,
    spread,
    currency:      meta.currency    || "USD",
    exchange:      meta.exchangeName || meta.fullExchangeName || "",
  };
}

/**
 * Fetch multiple quotes in parallel.
 * Returns a map of symbol → quote (failed symbols are omitted).
 */
export async function fetchYahooQuotes(
  symbols: string[]
): Promise<Record<string, YahooQuote>> {
  const results = await Promise.allSettled(
    symbols.map(s => fetchYahooQuote(s))
  );

  const map: Record<string, YahooQuote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") map[symbols[i]] = r.value;
    else console.warn(`[Yahoo] ${symbols[i]}: ${(r.reason as Error).message}`);
  });
  return map;
}