/**
 * /api/ws-twelve
 *
 * Twelve Data real-time WebSocket for TSX (Canadian) stocks.
 * Works alongside Finnhub WebSocket — Finnhub handles US,
 * Twelve Data handles TSX (.TO symbols).
 *
 * Twelve Data WebSocket docs:
 * https://twelvedata.com/docs#websocket-usage
 *
 * Requires: TWELVE_DATA_API_KEY in .env.local
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../lib/auth/apiAuth";
import { fromTwelveSymbol, toTwelveSymbol } from "../../lib/market/twelveDataFetcher";

declare global {
  var __td_ws:            any;
  var __td_subscribed:    string[];
  var __td_prevPrices:    Record<string, number>;
  var __td_prevVelocities:Record<string, number>;
  var __td_prevSpreads:   Record<string, number>;
  var __td_userId:        string | null;
  var __td_bootstrapped:  Record<string, boolean>;
}

if (!global.__td_subscribed)     global.__td_subscribed     = [];
if (!global.__td_prevPrices)     global.__td_prevPrices     = {};
if (!global.__td_prevVelocities) global.__td_prevVelocities = {};
if (!global.__td_prevSpreads)    global.__td_prevSpreads    = {};
if (!global.__td_userId)         global.__td_userId         = null;
if (!global.__td_bootstrapped)   global.__td_bootstrapped   = {};

async function bootstrapSymbol(symbol: string, supabase: any): Promise<void> {
  if (global.__td_bootstrapped[symbol]) return;
  global.__td_bootstrapped[symbol] = true;
  try {
    const { data } = await supabase
      .from("price_history")
      .select("price, created_at")
      .eq("symbol", symbol)
      .order("created_at", { ascending: false })
      .limit(2);
    if (data?.length >= 1) {
      global.__td_prevPrices[symbol] = Number(data[0].price);
      if (data.length >= 2)
        global.__td_prevVelocities[symbol] = Number(data[0].price) - Number(data[1].price);
      console.log(`[WS-TD] ${symbol}: bootstrapped $${data[0].price}`);
    }
  } catch (e: any) {
    console.warn(`[WS-TD] ${symbol}: bootstrap failed —`, e.message);
  }
}

async function openTwelveWebSocket(symbols: string[], userId: string) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("TWELVE_DATA_API_KEY not set in .env.local");

  global.__td_userId = userId;

  // If already open — subscribe new symbols
  if (global.__td_ws && global.__td_ws.readyState === 1) {
    const newSyms = symbols.filter(s => !global.__td_subscribed.includes(s));
    if (newSyms.length > 0) {
      const twelveSyms = newSyms.map(toTwelveSymbol);
      global.__td_ws.send(JSON.stringify({
        action: "subscribe",
        params: { symbols: twelveSyms.join(",") },
      }));
      global.__td_subscribed.push(...newSyms);
      console.log(`[WS-TD] Added: ${newSyms.join(", ")}`);
    }
    return "already-open";
  }

  let WebSocket: any;
  try {
    WebSocket = (await import("ws")).default;
  } catch {
    throw new Error("'ws' package not installed. Run: npm install ws");
  }

  const { savePrice }       = await import("../../lib/db/priceRepository");
  const { saveSignal }      = await import("../../lib/db/signalRepository");
  const { calculateSignal } = await import("../../lib/market/signalEngine");
  const { createClient }    = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Bootstrap all symbols
  await Promise.all(symbols.map(sym => bootstrapSymbol(sym, supabase)));

  const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`);
  global.__td_ws = ws;

  ws.on("open", () => {
    const twelveSyms = symbols.map(toTwelveSymbol);
    console.log("[WS-TD] Twelve Data connected —", symbols.join(", "));
    ws.send(JSON.stringify({
      action: "subscribe",
      params: { symbols: twelveSyms.join(",") },
    }));
    global.__td_subscribed = [...symbols];
  });

  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Twelve Data sends: { event: "price", symbol: "TD:TSX", price: 82.45, ... }
      if (msg.event !== "price" || !msg.symbol) return;

      const internalSym = fromTwelveSymbol(msg.symbol);
      const price       = Number(msg.price ?? 0);
      if (!price) return;

      const uid = global.__td_userId;

      // Estimate spread (Twelve Data WebSocket doesn't send L1 bid/ask on free tier)
      const spreadEst = price > 100 ? 0.02 : price > 50 ? 0.03 : price > 10 ? 0.05 : 0.10;
      const bid = price - spreadEst / 2;
      const ask = price + spreadEst / 2;
      const volume = Number(msg.volume ?? 0);

      await savePrice({ symbol: internalSym, price, bid, ask, volume }, uid ?? undefined);

      const prevPrice    = global.__td_prevPrices[internalSym];
      const prevVelocity = global.__td_prevVelocities[internalSym] ?? 0;
      const prevSpread   = global.__td_prevSpreads[internalSym] ?? null;

      if (prevPrice !== undefined) {
        const result = calculateSignal(
          price, prevPrice, prevVelocity, bid, ask,
          undefined, undefined, internalSym, 5, prevSpread, false
        );
        global.__td_prevVelocities[internalSym] = result.rawVelocity;
        if (result.spread != null) global.__td_prevSpreads[internalSym] = result.spread;

        await saveSignal({
          symbol:       internalSym,
          signal_type:  result.signal,
          velocity:     result.velocity,
          acceleration: result.acceleration,
          spread:       result.spread,
          divergence:   result.divergence,
          score:        result.score,
          strength:     result.strength,
        }, uid ?? undefined);

        console.log(`[WS-TD] ${internalSym} $${price.toFixed(2)} vel:${result.velocity.toFixed(4)} score:${result.score}`);
      }

      global.__td_prevPrices[internalSym] = price;
    } catch (e) {
      console.error("[WS-TD] Message error:", e);
    }
  });

  ws.on("error", (err: Error) => {
    console.error("[WS-TD] Error:", err.message);
    global.__td_ws = null;
  });

  ws.on("close", () => {
    console.log("[WS-TD] Disconnected — reconnecting in 5s");
    global.__td_ws = null;
    global.__td_subscribed = [];
    setTimeout(() => openTwelveWebSocket(symbols, global.__td_userId ?? userId), 5000);
  });

  // Keepalive heartbeat every 10s (Twelve Data requires this)
  const ping = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ action: "heartbeat" }));
    } else {
      clearInterval(ping);
    }
  }, 10_000);

  return "opened";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      status:  "no-key",
      message: "Add TWELVE_DATA_API_KEY to .env.local to enable TSX real-time streaming",
      hint:    "Get a free key at https://twelvedata.com/pricing",
    });
  }

  try {
    const { getAllProfiles } = await import("../../lib/db/profileRepository");
    const profiles = await getAllProfiles();

    // Only TSX symbols — US stocks go through Finnhub WebSocket
    const tsxSymbols = profiles
      .map(p => p.ticker)
      .filter(t => t.endsWith(".TO") || t.endsWith(".V") || t.endsWith(".TSX"));

    if (tsxSymbols.length === 0) {
      return res.status(200).json({
        status:  "no-tsx-symbols",
        message: "No TSX symbols in watchlist. Add Canadian stocks (e.g. TD.TO) in Settings.",
      });
    }

    const result = await openTwelveWebSocket(tsxSymbols, user.id);

    const wsState    = global.__td_ws?.readyState;
    const stateLabel = wsState === 0 ? "connecting"
                     : wsState === 1 ? "open"
                     : wsState === 2 ? "closing"
                     : wsState === 3 ? "closed"
                     : "not-started";

    return res.status(200).json({
      status:     result,
      wsState:    stateLabel,
      provider:   "Twelve Data",
      symbols:    tsxSymbols,
      subscribed: global.__td_subscribed,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}