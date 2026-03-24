import { processRealtimeTick } from "./market/marketWorker";

const SYMBOLS = ["AAPL", "TSLA"];

let priceState: Record<string, number> = {
  AAPL: 180,
  TSLA: 250,
};

export const startSimulator = () => {
  console.log("🎯 Simulator started");

  setInterval(() => {
    SYMBOLS.forEach((symbol) => {
      const prev = priceState[symbol];

      // 🔥 random movement
      const spike = Math.random() < 0.2; // 20% chance of big move

const change = spike
  ? (Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1) // BIG moves
  : (Math.random() - 0.5) * 0.5; // small noise
      const newPrice = prev + change;

      priceState[symbol] = newPrice;

      processRealtimeTick({
        symbol,
        price: newPrice,
        volume: Math.random() * 1000,
      });
    });
  }, 1000);
};