import WebSocket from "ws";
import { processRealtimeTick } from "./market/marketWorker";

const API_KEY = process.env.POLYGON_API_KEY!;

let ws: WebSocket | null = null;
let isAuthenticated = false;
let hasSubscribed = false;

// ✅ throttle
const lastProcessed: Record<string, number> = {};

function shouldProcess(symbol: string) {
  const now = Date.now();
  if (!lastProcessed[symbol] || now - lastProcessed[symbol] > 1000) {
    lastProcessed[symbol] = now;
    return true;
  }
  return false;
}

// ✅ handle ticks
const handleMarketData = (data: any[]) => {
  for (const tick of data) {
    const symbol = tick.sym;
    if (!shouldProcess(symbol)) continue;

    if (tick.ev === "T") {
      processRealtimeTick({
        symbol,
        price: tick.p,
        volume: tick.s,
      });
    }

    if (tick.ev === "Q") {
      processRealtimeTick({
        symbol,
        price: tick.bp,
        bid: tick.bp,
        ask: tick.ap,
      });
    }
  }
};

export const startPolygonWS = () => {
  if (ws) {
    console.log("⚠️ WS already running");
    return;
  }

  ws = new WebSocket("wss://socket.polygon.io/stocks");

  ws.on("open", () => {
    console.log("🔌 Connecting to Polygon...");

    ws?.send(JSON.stringify({
      action: "auth",
      params: API_KEY,
    }));
  });

  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());

      // ✅ Handle status messages
      if (!Array.isArray(parsed)) {
        console.log("Polygon:", parsed);

        if (parsed.status === "auth_success") {
          console.log("✅ Authenticated");
          isAuthenticated = true;

          // ⚠️ Try subscribing (will fail on free plan)
          if (!hasSubscribed) {
            ws?.send(JSON.stringify({
              action: "subscribe",
              params: "Q.AAPL", // minimal safe test
            }));
            hasSubscribed = true;
          }
        }

        if (parsed.status === "error") {
          console.log("❌ Subscription not allowed (plan limitation)");
          console.log("👉 Running in NO-DATA mode");
        }

        return;
      }

      // ✅ real data
      handleMarketData(parsed);

    } catch (err) {
      console.error("WS parse error:", err);
    }
  });

  ws.on("close", () => {
    console.log("⚠️ WS closed");

    // ❗ Prevent infinite loop
    if (!isAuthenticated) {
      console.log("❌ Stopping reconnect (auth failed)");
      ws = null;
      return;
    }

    console.log("🔁 Reconnecting in 5s...");
    setTimeout(() => {
      ws = null;
      startPolygonWS();
    }, 5000);
  });

  ws.on("error", (err) => {
    console.error("❌ WS error:", err);
  });
};