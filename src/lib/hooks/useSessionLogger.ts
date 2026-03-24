import { useEffect, useRef } from "react";
import { supabase } from "../db/client";
import type { Signal, PricePoint } from "../context/DashboardContext";

interface SnapshotPayload {
  symbol:       string;
  user_id:      string | null;
  velocity:     number;
  acceleration: number;
  spread:       number | null;
  spread_rate:  number | null;
  divergence:   number | null;
  score:        number;
  strength:     string;
  price:        number | null;
  volume:       number | null;
  signal_type:  string;
  snapshot_at:  string;
}

/**
 * Client-side companion to the server-side snapshot logger in marketWorker.
 * Logs a snapshot every intervalMs while the dashboard is open.
 * The server-side logger runs even when the dashboard is closed.
 */
export function useSessionLogger(
  activeSymbol: string,
  signals: Signal[],
  allPrices: Record<string, PricePoint[]>,
  intervalMs = 30_000
) {
  const lastLogRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const id = setInterval(async () => {
      const sig    = signals.find(s => s.symbol === activeSymbol);
      const prices = allPrices[activeSymbol] || [];
      const last   = prices[prices.length - 1];
      const prev   = prices[prices.length - 2];

      if (!sig) return;

      const now = Date.now();
      const lastLogged = lastLogRef.current[activeSymbol] ?? 0;
      if (now - lastLogged < intervalMs - 1000) return; // debounce
      lastLogRef.current[activeSymbol] = now;

      // Get current user id
      const { data: { user } } = await supabase.auth.getUser();

      const spreadRate = last?.spread != null && prev?.spread != null
        ? last.spread - prev.spread
        : null;

      const payload: SnapshotPayload = {
        symbol:       activeSymbol,
        user_id:      user?.id ?? null,
        velocity:     Number(sig.velocity),
        acceleration: Number(sig.acceleration),
        spread:       sig.spread != null ? Number(sig.spread) : null,
        spread_rate:  spreadRate,
        divergence:   sig.divergence != null ? Number(sig.divergence) : null,
        score:        Number(sig.score),
        strength:     sig.strength,
        price:        last?.price ?? null,
        volume:       last?.volume ?? null,
        signal_type:  sig.signal_type,
        snapshot_at:  new Date().toISOString(),
      };

      try {
        await supabase.from("session_snapshots").insert([payload]);
      } catch {
        // Non-critical — fail silently
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [activeSymbol, signals, allPrices, intervalMs]);
}