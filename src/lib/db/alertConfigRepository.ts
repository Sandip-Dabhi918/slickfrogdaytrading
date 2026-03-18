import { supabase } from "./client";

export type SignalType = "acceleration" | "spread" | "divergence";
export type AlertDirection = "SELL_FADE" | "BUY_EXHAUSTION" | "BOTH";

export interface AlertConfig {
  id:          string;
  profile_id:  string;
  user_id:     string;
  signal_type: SignalType;
  direction:   AlertDirection;
  threshold:   number;
  enabled:     boolean;
  created_at:  string;
  updated_at:  string;
}

// Default thresholds when no config exists yet
export const DEFAULTS: Record<SignalType, number> = {
  acceleration: 0.02,
  spread:       0.05,
  divergence:   1.0,
};

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAlertConfigs(profileId: string): Promise<AlertConfig[]> {
  const { data, error } = await supabase
    .from("alert_configurations")
    .select("*")
    .eq("profile_id", profileId)
    .order("signal_type");
  if (error) throw error;
  return (data || []) as AlertConfig[];
}

// ── Upsert single config ──────────────────────────────────────────────────────

export async function upsertAlertConfig(data: {
  profile_id:  string;
  signal_type: SignalType;
  direction:   AlertDirection;
  threshold:   number;
  enabled:     boolean;
}): Promise<AlertConfig> {
  const user_id = await requireUserId();
  const { data: row, error } = await supabase
    .from("alert_configurations")
    .upsert(
      { ...data, user_id, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,signal_type,direction" }
    )
    .select()
    .single();
  if (error) throw error;
  return row as AlertConfig;
}

// ── Upsert all 6 configs for a profile at once ────────────────────────────────
// (3 signal types × 2 directions = 6 rows)

export async function upsertAllAlertConfigs(
  profileId: string,
  configs: {
    signal_type: SignalType;
    direction:   AlertDirection;
    threshold:   number;
    enabled:     boolean;
  }[]
): Promise<void> {
  const user_id = await requireUserId();
  const rows = configs.map(c => ({
    ...c,
    profile_id: profileId,
    user_id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("alert_configurations")
    .upsert(rows, { onConflict: "profile_id,signal_type,direction" });

  if (error) throw error;
}

// ── Seed defaults for a new profile ──────────────────────────────────────────

export async function seedDefaultAlertConfigs(profileId: string): Promise<void> {
  const user_id = await requireUserId();
  const directions: AlertDirection[] = ["SELL_FADE", "BUY_EXHAUSTION"];
  const signals: SignalType[]        = ["acceleration", "spread", "divergence"];

  const rows = signals.flatMap(signal_type =>
    directions.map(direction => ({
      profile_id:  profileId,
      user_id,
      signal_type,
      direction,
      threshold:   DEFAULTS[signal_type],
      enabled:     true,
      updated_at:  new Date().toISOString(),
    }))
  );

  // Only insert rows that don't already exist
  const { error } = await supabase
    .from("alert_configurations")
    .upsert(rows, { onConflict: "profile_id,signal_type,direction", ignoreDuplicates: true });

  if (error) console.warn("[alertConfig] seed failed:", error.message);
}

// ── Delete all configs for a profile ─────────────────────────────────────────

export async function deleteAlertConfigs(profileId: string): Promise<void> {
  const { error } = await supabase
    .from("alert_configurations")
    .delete()
    .eq("profile_id", profileId);
  if (error) throw error;
}

// ── Helper: build a lookup map { "acceleration_SELL_FADE": threshold } ────────

export function buildThresholdMap(
  configs: AlertConfig[]
): Record<string, { threshold: number; enabled: boolean }> {
  const map: Record<string, { threshold: number; enabled: boolean }> = {};
  for (const c of configs) {
    map[`${c.signal_type}_${c.direction}`] = { threshold: c.threshold, enabled: c.enabled };
    if (c.direction === "BOTH") {
      map[`${c.signal_type}_SELL_FADE`]      = { threshold: c.threshold, enabled: c.enabled };
      map[`${c.signal_type}_BUY_EXHAUSTION`] = { threshold: c.threshold, enabled: c.enabled };
    }
  }
  return map;
}