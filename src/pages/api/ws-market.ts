/**
 * /api/ws-market
 *
 * Opens a persistent Finnhub WebSocket → Supabase pipeline.
 * Calculates velocity + acceleration on every real-time tick.
 *
 * Works correctly when:
 *   - Running with `next dev` (long-lived Node process) ✅
 *   - Deployed on Vercel Pro with maxDuration: 300 ✅
 *   - On Vercel free tier: WebSocket opens but closes after 10s,
 *     /api/run-scanner acts as the reliable 30s fallback ✅
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../lib/auth/apiAuth";

// Global state — persists across requests within the same Node process
declare global {
  var __mfd_ws:            any;
  var __mfd_subscribed:    string[];
  var __mfd_prevPrices:    Record<string, number>;
  var __mfd_prevVelocities:Record<string, number>;
  var __mfd_prevSpreads:   Record<string, number>;
  var __mfd_userId:        string | null;
  var __mfd_bootstrapped:  Record<string, boolean>;
}

if (!global.__mfd_subscribed)    global.__mfd_subscribed    = [];
if (!global.__mfd_prevPrices)    global.__mfd_prevPrices    = {};
if (!global.__mfd_prevVelocities)global.__mfd_prevVelocities= {};
if (!global.__mfd_prevSpreads)   global.__mfd_prevSpreads   = {};
if (!global.__mfd_userId)        global.__mfd_userId        = null;
if (!global.__mfd_bootstrapped)  global.__mfd_bootstrapped  = {};

/** Seed previous price + velocity from DB so first tick produces real velocity */
async function bootstrapSymbol(symbol: string, supabase: any): Promise<void> {
  if (global.__mfd_bootstrapped[symbol]) return;
  global.__mfd_bootstrapped[symbol] = true;

  try {
    const { data } = await supabase
      .from("price_history")
      .select("price, created_at")
      .eq("symbol", symbol)
      .order("created_at", { ascending: false })
      .limit(2);

    if (data && data.length >= 1) {
      global.__mfd_prevPrices[symbol] = Number(data[0].price);
      if (data.length >= 2) {
        global.__mfd_prevVelocities[symbol] = Number(data[0].price) - Number(data[1].price);
      }
      console.log(`[WS] ${symbol}: bootstrapped from DB $${data[0].price}`);
    }
  } catch (e: any) {
    console.warn(`[WS] ${symbol}: bootstrap failed —`, e.message);
  }
}

async function openWebSocket(symbols: string[], userId: string) {
  // Store user_id for signal writes
  global.__mfd_userId = userId;

  // If already open — add any new symbols and update user_id
  if (global.__mfd_ws && global.__mfd_ws.readyState === 1) {
    const newSyms = symbols.filter(s => !global.__mfd_subscribed.includes(s));
    if (newSyms.length > 0) {
      newSyms.forEach(sym => {
        global.__mfd_ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
        global.__mfd_subscribed.push(sym);
      });
      console.log(`[WS] Added symbols: ${newSyms.join(", ")}`);
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

  // Server-side Supabase client for bootstrap queries
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Bootstrap all symbols before opening WebSocket
  await Promise.all(symbols.map(sym => bootstrapSymbol(sym, supabase)));

  const token = process.env.MARKET_API_KEY;
  if (!token) throw new Error("MARKET_API_KEY not set in environment");

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
  global.__mfd_ws = ws;

  ws.on("open", () => {
    console.log("[WS] Finnhub connected —", symbols.join(", "));
    symbols.forEach((sym: string) => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
    });
    global.__mfd_subscribed = [...symbols];
  });

  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== "trade" || !msg.data) return;

      // Dedupe ticks — Finnhub can send multiple trades per message
      // Use only the latest price per symbol in this batch
      const latestBySymbol: Record<string, { price: number; volume: number }> = {};
      for (const trade of msg.data) {
        latestBySymbol[trade.s] = { price: Number(trade.p), volume: Number(trade.v ?? 0) };
      }

      for (const [symbol, { price, volume }] of Object.entries(latestBySymbol)) {
        const uid = global.__mfd_userId;

        // Estimate bid/ask spread from price
        const spreadEst = price > 100 ? 0.02 : price > 50 ? 0.03 : price > 10 ? 0.05 : 0.10;
        const bid = price - spreadEst / 2;
        const ask = price + spreadEst / 2;

        // Save real-time price tick
        await savePrice({ symbol, price, bid, ask, volume }, uid ?? undefined);

        // Calculate signal from tick delta
        const prevPrice    = global.__mfd_prevPrices[symbol];
        const prevVelocity = global.__mfd_prevVelocities[symbol] ?? 0;

        if (prevPrice !== undefined) {
          const prevSpread = global.__mfd_prevSpreads[symbol] ?? null;
          const result = calculateSignal(price, prevPrice, prevVelocity, bid, ask, undefined, undefined, symbol, 5, prevSpread, false);
          global.__mfd_prevVelocities[symbol] = result.rawVelocity;
          if (result.spread != null) global.__mfd_prevSpreads[symbol] = result.spread;

          await saveSignal({
            symbol,
            signal_type:  result.signal,
            velocity:     result.velocity,
            acceleration: result.acceleration,
            spread:       result.spread,
            divergence:   result.divergence,
            score:        result.score,
            strength:     result.strength,
          }, uid ?? undefined);

          console.log(`[WS] ${symbol} $${price.toFixed(2)} vel:${result.velocity.toFixed(4)} accel:${result.acceleration.toFixed(4)} score:${result.score}`);
        }

        global.__mfd_prevPrices[symbol] = price;
      }
    } catch (e) {
      console.error("[WS] Message error:", e);
    }
  });

  ws.on("error", (err: Error) => {
    console.error("[WS] Error:", err.message);
    global.__mfd_ws = null;
  });

  ws.on("close", () => {
    console.log("[WS] Disconnected — reconnecting in 5s");
    global.__mfd_ws = null;
    global.__mfd_subscribed = [];
    // Reconnect with same symbols and user
    setTimeout(() => openWebSocket(symbols, global.__mfd_userId ?? userId), 5000);
  });

  // Keepalive ping every 25s
  const ping = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "ping" }));
    } else {
      clearInterval(ping);
    }
  }, 25_000);

  return "opened";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { getAllProfiles } = await import("../../lib/db/profileRepository");
    const profiles = await getAllProfiles();
    const symbols  = profiles.map((p: any) => p.ticker);

    if (symbols.length === 0) {
      return res.status(200).json({ status: "no-profiles", message: "Add stocks in Settings first" });
    }

    const result = await openWebSocket(symbols, user.id);

    const wsState     = global.__mfd_ws?.readyState;
    const stateLabel  = wsState === 0 ? "connecting"
                      : wsState === 1 ? "open"
                      : wsState === 2 ? "closing"
                      : wsState === 3 ? "closed"
                      : "not-started";

    return res.status(200).json({
      status:     result,
      wsState:    stateLabel,
      symbols,
      subscribed: global.__mfd_subscribed,
    });
  } catch (e: any) {
    console.error("[WS] Handler error:", e.message);
    return res.status(500).json({
      error: e.message,
      hint:  e.message.includes("ws")
        ? "Run `npm install ws && npm install --save-dev @types/ws`"
        : "Check server logs for details",
    });
  }
}