import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, directionLabel, directionColor, convictionLabel, Skeleton } from "../../lib/ui/shared";
import { useAlertSound } from "../../lib/hooks/useAlertSound";
import { apiFetch } from "../../lib/auth/apiFetch";
import { saveAlertHistory, getAlertHistory } from "../../lib/db/profileRepository";
import {
  getAlertConfigs, upsertAllAlertConfigs, buildThresholdMap,
  DEFAULTS, type AlertConfig, type SignalType, type AlertDirection,
} from "../../lib/db/alertConfigRepository";

interface AlertEvent {
  id: string; symbol: string; direction: "SELL_FADE"|"BUY_EXHAUSTION";
  conviction: string; score: number; ts: string; triggers: string[]; persisted?: boolean;
}

const SIGNAL_LABELS: Record<SignalType, string> = {
  acceleration: "Acceleration ≥",
  spread:       "Spread ($) ≥",
  divergence:   "Divergence % ≥",
};

const SIGNAL_STEPS: Record<SignalType, { step: number; max: number }> = {
  acceleration: { step: 0.01, max: 0.2 },
  spread:       { step: 0.01, max: 0.5 },
  divergence:   { step: 0.1,  max: 5.0 },
};

const DIRECTIONS: AlertDirection[] = ["SELL_FADE", "BUY_EXHAUSTION"];
const SIGNALS:   SignalType[]      = ["acceleration", "spread", "divergence"];

export default function AlertCard() {
  const { activeSymbol, activeProfile, signals } = useDashboard();
  const { beep, browserNotify } = useAlertSound();

  const [alerts,     setAlerts]     = useState<AlertEvent[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [soundOn,    setSoundOn]    = useState(true);
  const [notifyOn,   setNotifyOn]   = useState(true);
  const [notifPerm,  setNotifPerm]  = useState<NotificationPermission>("default");
  const [enabled,    setEnabled]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const seenIds = useRef(new Set<string>());

  // Per-signal, per-direction thresholds loaded from DB
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [thresholds, setThresholds] = useState<
    Record<string, { threshold: number; enabled: boolean }>
  >({});

  // Local edit state — mirrors DB values, committed on Save
  const [localT, setLocalT] = useState<
    Record<string, { threshold: number; enabled: boolean }>
  >({});

  // ── Load alert configs from DB ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeProfile?.id) return;
    getAlertConfigs(activeProfile.id).then(rows => {
      setConfigs(rows);
      const map = buildThresholdMap(rows);
      setThresholds(map);
      // Seed local edit state
      const local: Record<string, { threshold: number; enabled: boolean }> = {};
      for (const sig of SIGNALS) {
        for (const dir of DIRECTIONS) {
          const key = `${sig}_${dir}`;
          local[key] = map[key] ?? { threshold: DEFAULTS[sig], enabled: true };
        }
      }
      setLocalT(local);
    }).catch(() => {});
  }, [activeProfile?.id]);

  // ── Load alert history ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getAlertHistory(activeSymbol, 30).then(rows => {
      if (cancelled) return;
      const hist: AlertEvent[] = rows.map((r: any) => ({
        id: r.id, symbol: r.symbol, direction: r.direction,
        conviction: r.conviction, score: r.score ?? 0,
        ts: new Date(r.fired_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        triggers: r.triggers || [], persisted: true,
      }));
      setAlerts(hist);
      hist.forEach(a => seenIds.current.add(a.id));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeSymbol]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const requestPerm = async () => {
    if (!("Notification" in window)) return;
    setNotifPerm(await Notification.requestPermission());
  };

  // ── Save configs to DB ─────────────────────────────────────────────────────
  const saveConfigs = useCallback(async () => {
    if (!activeProfile?.id) return;
    setSaving(true);
    try {
      const rows = SIGNALS.flatMap(sig =>
        DIRECTIONS.map(dir => ({
          signal_type: sig as SignalType,
          direction:   dir as AlertDirection,
          threshold:   localT[`${sig}_${dir}`]?.threshold ?? DEFAULTS[sig],
          enabled:     localT[`${sig}_${dir}`]?.enabled   ?? true,
        }))
      );
      await upsertAllAlertConfigs(activeProfile.id, rows);
      const map = buildThresholdMap(
        rows.map(r => ({ ...r, id: "", profile_id: activeProfile.id, user_id: "", created_at: "", updated_at: "" }))
      );
      setThresholds(map);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Failed to save alert configs:", e.message);
    } finally {
      setSaving(false);
    }
  }, [activeProfile?.id, localT]);

  // ── Signal watcher — fires alerts ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const recent = signals.filter(s => s.symbol === activeSymbol).slice(0, 5);
    for (const sig of recent) {
      if (seenIds.current.has(sig.id)) continue;
      seenIds.current.add(sig.id);
      const vel = Number(sig.velocity), accel = Number(sig.acceleration), score = Number(sig.score);
      const dir = getDirection(vel, accel);
      if (dir === "HOLD" || score === 0) continue;

      const triggers: string[] = [];

      // Check per-direction thresholds from DB configs
      const accelCfg = thresholds[`acceleration_${dir}`] ?? thresholds[`acceleration_BOTH`];
      const spreadCfg = thresholds[`spread_${dir}`]       ?? thresholds[`spread_BOTH`];
      const divCfg    = thresholds[`divergence_${dir}`]   ?? thresholds[`divergence_BOTH`];

      if (accelCfg?.enabled && Math.abs(accel) >= accelCfg.threshold)
        triggers.push("Acceleration threshold crossed");
      if (spreadCfg?.enabled && sig.spread != null && Number(sig.spread) >= spreadCfg.threshold)
        triggers.push("Spread threshold exceeded");
      if (divCfg?.enabled && sig.divergence != null && Math.abs(Number(sig.divergence)) >= divCfg.threshold)
        triggers.push("Peer divergence exceeded");

      if (!triggers.length) triggers.push("Signal score ≥ 1");

      const event: AlertEvent = {
        id: sig.id, symbol: sig.symbol, direction: dir,
        conviction: convictionLabel(score), score,
        ts: new Date(sig.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        triggers,
      };

      setAlerts(prev => [event, ...prev].slice(0, 50));
      if (soundOn) beep(dir === "SELL_FADE" ? "sell" : "buy");
      if (notifyOn) browserNotify(`${sig.symbol} · ${directionLabel(dir)}`, `${convictionLabel(score)} · ${triggers.join(", ")}`);
      if (score >= 2) {
        apiFetch("/api/send-notification", { method: "POST", body: JSON.stringify({ symbol: sig.symbol, direction: dir, conviction: convictionLabel(score), score, triggers }) }).catch(() => {});
      }
      saveAlertHistory({ symbol: sig.symbol, direction: dir, conviction: convictionLabel(score), score, triggers }).catch(() => {});
    }
  }, [signals, activeSymbol, enabled, thresholds, soundOn, notifyOn, beep, browserNotify]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card title="Alerts" subtitle={`${activeSymbol} · ${enabled ? "Active" : "Paused"}`}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1, overflow: "hidden" }}>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => setEnabled(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: enabled ? C.bull : C.border, position: "relative", transition: "background .2s" }}>
              <div style={{ position: "absolute", top: 2, left: enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </div>
            <span style={{ fontSize: 11, color: enabled ? C.bull : C.textMuted, fontWeight: 600 }}>{enabled ? "ON" : "OFF"}</span>
            <button onClick={() => setSoundOn(v => !v)} style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}`, background: soundOn ? C.accent + "15" : "transparent", color: soundOn ? C.accent : C.textMuted, fontSize: 13 }}>🔊</button>
            <button onClick={() => { if (notifPerm !== "granted") requestPerm(); setNotifyOn(v => !v); }} style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}`, background: notifyOn && notifPerm === "granted" ? C.accent + "15" : "transparent", color: notifyOn && notifPerm === "granted" ? C.accent : C.textMuted, fontSize: 13 }}>🔔</button>
          </div>
          <button onClick={() => setShowConfig(s => !s)} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer", border: `1px solid ${C.border}`, background: showConfig ? C.surfaceAlt : "transparent", color: C.textSub, fontFamily: "monospace", fontWeight: 600 }}>
            {showConfig ? "▲ Hide" : "▼ Config"}
          </button>
        </div>

        {notifyOn && notifPerm === "default" && (
          <div onClick={requestPerm} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer", background: C.warnLight, border: `1px solid ${C.warn}40`, color: C.warn, flexShrink: 0 }}>
            ⚠ Click to allow browser notifications
          </div>
        )}
        {notifyOn && notifPerm === "denied" && (
          <div style={{ padding: "6px 12px", borderRadius: 8, fontSize: 10, background: C.bearLight, border: `1px solid ${C.bear}40`, color: C.bear, flexShrink: 0 }}>
            🚫 Notifications blocked — enable in browser settings
          </div>
        )}

        {/* Config panel — per-signal, per-direction */}
        {showConfig && (
          <div style={{ padding: "12px", borderRadius: 8, background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Signal</span>
              <span style={{ fontSize: 9, color: C.bear, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Sell Fade</span>
              <span style={{ fontSize: 9, color: C.bull, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Buy Exhaustion</span>
            </div>

            {/* Per-signal rows */}
            {SIGNALS.map(sig => (
              <div key={sig} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub }}>{SIGNAL_LABELS[sig]}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {DIRECTIONS.map(dir => {
                    const key = `${sig}_${dir}`;
                    const cfg = localT[key] ?? { threshold: DEFAULTS[sig], enabled: true };
                    const color = dir === "SELL_FADE" ? C.bear : C.bull;
                    return (
                      <div key={dir} style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: `1px solid ${cfg.enabled ? color + "40" : C.borderLight}`, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: cfg.enabled ? color : C.textMuted, fontWeight: 700 }}>
                            {cfg.threshold.toFixed(sig === "divergence" ? 1 : 2)}
                          </span>
                          {/* Enabled toggle */}
                          <div
                            onClick={() => setLocalT(prev => ({ ...prev, [key]: { ...cfg, enabled: !cfg.enabled } }))}
                            style={{ width: 24, height: 13, borderRadius: 7, cursor: "pointer", background: cfg.enabled ? color : C.border, position: "relative", transition: "background .15s", flexShrink: 0 }}
                          >
                            <div style={{ position: "absolute", top: 1.5, left: cfg.enabled ? 12 : 1.5, width: 10, height: 10, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                          </div>
                        </div>
                        <input
                          type="range"
                          min={SIGNAL_STEPS[sig].step}
                          max={SIGNAL_STEPS[sig].max}
                          step={SIGNAL_STEPS[sig].step}
                          value={cfg.threshold}
                          disabled={!cfg.enabled}
                          onChange={e => setLocalT(prev => ({ ...prev, [key]: { ...cfg, threshold: parseFloat(e.target.value) } }))}
                          style={{ width: "100%", accentColor: color, opacity: cfg.enabled ? 1 : 0.4 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={saveConfigs}
              disabled={saving}
              style={{ padding: "7px 0", borderRadius: 8, fontSize: 12, cursor: saving ? "not-allowed" : "pointer", background: saved ? C.bull : C.accent, color: "#fff", border: "none", fontWeight: 700, transition: "background .2s" }}
            >
              {saving ? "Saving…" : saved ? "✓ Saved to DB" : "Save Thresholds"}
            </button>

            {!activeProfile?.id && (
              <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>
                Add a stock profile in Settings to persist thresholds
              </div>
            )}
          </div>
        )}

        {/* Alert history list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {!alerts.length ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.textMuted, padding: 16 }}>
              <div style={{ fontSize: 22 }}>🔔</div>
              <div style={{ fontSize: 11 }}>No alerts triggered yet</div>
              <div style={{ fontSize: 10, textAlign: "center", lineHeight: 1.4, maxWidth: 200 }}>
                Alerts fire when signals cross thresholds. Thresholds are saved per stock, per direction.
              </div>
            </div>
          ) : alerts.map(a => (
            <div key={a.id} style={{ padding: "10px 12px", borderRadius: 8, background: a.direction === "SELL_FADE" ? C.bearLight : C.bullLight, border: `1px solid ${directionColor(a.direction)}30`, opacity: a.persisted ? 0.75 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: directionColor(a.direction), fontFamily: "monospace" }}>
                  {a.symbol} · {directionLabel(a.direction)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {a.persisted && <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>historical</span>}
                  <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>{a.ts}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.textSub, marginBottom: 4 }}>{a.conviction}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {a.triggers.map((t, i) => (
                  <span key={i} style={{ padding: "1px 7px", borderRadius: 10, fontSize: 9, fontFamily: "monospace", background: "#fff", border: `1px solid ${C.border}`, color: C.textSub }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}