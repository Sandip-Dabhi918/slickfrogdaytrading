import { supabase } from "./client";
import { seedDefaultAlertConfigs } from "./alertConfigRepository";

export interface StockProfile {
  id:                   string;
  ticker:               string;
  display_name:         string;
  benchmark:            string;
  exchange:             string;
  accel_threshold:      number;
  spread_threshold:     number;
  divergence_threshold: number;
  alerts_enabled:       boolean;
  created_at:           string;
  updated_at:           string;
  last_used:            string | null;
  peers?:               string[];
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getAllProfiles(): Promise<StockProfile[]> {
  const { data: profiles, error } = await supabase
    .from("stock_profiles")
    .select("*")
    .order("last_used", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const { data: peers } = await supabase
    .from("peer_groups")
    .select("profile_id, peer_ticker, display_order")
    .order("display_order", { ascending: true });

  return (profiles || []).map(p => ({
    ...p,
    exchange: p.exchange || "US",
    peers: (peers || [])
      .filter(pg => pg.profile_id === p.id)
      .map(pg => pg.peer_ticker),
  }));
}

export async function upsertProfile(data: {
  ticker:               string;
  display_name?:        string;
  benchmark:            string;
  exchange?:            string;
  accel_threshold:      number;
  spread_threshold:     number;
  divergence_threshold: number;
  alerts_enabled:       boolean;
  peers:                string[];
}): Promise<StockProfile> {
  const user_id  = await requireUserId();
  const exchange = data.exchange || (data.ticker.endsWith(".TO") ? "TSX" : "US");

  const { data: profile, error } = await supabase
    .from("stock_profiles")
    .upsert(
      {
        ticker:               data.ticker.toUpperCase(),
        display_name:         data.display_name || data.ticker.toUpperCase(),
        benchmark:            data.benchmark,
        exchange,
        accel_threshold:      data.accel_threshold,
        spread_threshold:     data.spread_threshold,
        divergence_threshold: data.divergence_threshold,
        alerts_enabled:       data.alerts_enabled,
        user_id,
      },
      { onConflict: "ticker,user_id" }
    )
    .select()
    .single();

  if (error) throw error;

  // Replace peer group
  await supabase.from("peer_groups").delete().eq("profile_id", profile.id);
  if (data.peers.length > 0) {
    await supabase.from("peer_groups").insert(
      data.peers.map((ticker, i) => ({
        profile_id:    profile.id,
        peer_ticker:   ticker.toUpperCase(),
        display_order: i,
      }))
    );
  }

  // Seed default per-signal alert configs if not already set
  seedDefaultAlertConfigs(profile.id).catch(() => {});

  return { ...profile, exchange, peers: data.peers };
}

// Seed default alert configs for a new profile (called after upsert)
// Runs in background — does not block the save flow

export async function deleteProfile(ticker: string): Promise<void> {
  const { error } = await supabase
    .from("stock_profiles")
    .delete()
    .eq("ticker", ticker.toUpperCase());
  if (error) throw error;
}

/** Update last_used timestamp when user focuses a stock — called on symbol change */
export async function touchLastUsed(ticker: string): Promise<void> {
  await supabase
    .from("stock_profiles")
    .update({ last_used: new Date().toISOString() })
    .eq("ticker", ticker.toUpperCase());
  // Non-critical — fail silently
}

// ── Alert History ─────────────────────────────────────────────────────────────

export async function saveAlertHistory(data: {
  symbol:     string;
  direction:  string;
  conviction: string;
  score:      number;
  triggers:   string[];
}): Promise<void> {
  const user_id = await requireUserId();

  const { data: profile } = await supabase
    .from("stock_profiles")
    .select("id")
    .eq("ticker", data.symbol.toUpperCase())
    .single();

  await supabase.from("alert_history").insert([{
    profile_id: profile?.id ?? null,
    symbol:     data.symbol,
    direction:  data.direction,
    conviction: data.conviction,
    score:      data.score,
    triggers:   data.triggers,
    user_id,
  }]);
}

export async function getAlertHistory(symbol: string, limit = 50) {
  const { data, error } = await supabase
    .from("alert_history")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .order("fired_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}