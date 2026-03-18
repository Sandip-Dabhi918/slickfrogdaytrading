import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, Skeleton } from "../../lib/ui/shared";
import { apiFetch } from "../../lib/auth/apiFetch";

interface AnomalyItem { metric: string; current: number; baseline: number; ratio: number; severity: "LOW"|"MEDIUM"|"HIGH" }

export default function AIInsightCard() {
  const { activeSymbol, activeProfile, allPrices, peerPrices, signals } = useDashboard();
  const [interpretation, setInterpretation] = useState("");
  const [anomalies,      setAnomalies]      = useState<AnomalyItem[]>([]);
  const [anomalySummary, setAnomalySummary] = useState("");
  const [loading,        setLoading]        = useState(false);
  const [lastUpdate,     setLastUpdate]     = useState("");
  const [hasApiKey,      setHasApiKey]      = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const latestSig  = signals.find(s => s.symbol === activeSymbol);
  const prices     = allPrices[activeSymbol] || [];
  const last       = prices[prices.length - 1];
  const peers      = activeProfile?.peers || [];
  const peerAvgPct = peers.length
    ? peers.map(sym => {
        const p = peerPrices[sym] || [];
        const f = p[0]; const l = p[p.length - 1];
        return f && l ? ((l.price - f.price) / f.price) * 100 : 0;
      }).reduce((a, b) => a + b, 0) / peers.length
    : null;

  const fetchInsights = async () => {
    if (!latestSig) return;
    setLoading(true);
    const vel  = Number(latestSig.velocity);
    const accel= Number(latestSig.acceleration);
    const dir  = getDirection(vel, accel);

    let news: any[] = [];
    try {
      const nr = await apiFetch(`/api/get-news?symbol=${activeSymbol}`);
      news = (await nr.json()).news || [];
    } catch {}

    try {
      const r = await apiFetch("/api/ai/interpret-signal", {
        method: "POST",
        body: JSON.stringify({ symbol: activeSymbol, velocity: vel, acceleration: accel, spread: latestSig.spread, divergence: latestSig.divergence, score: latestSig.score, strength: latestSig.strength, price: last?.price, peerAvg: peerAvgPct, direction: dir, news }),
      });
      const d = await r.json();
      if (d.interpretation) setInterpretation(d.interpretation);
      else setHasApiKey(false);
    } catch { setHasApiKey(false); }

    try {
      const r = await apiFetch("/api/ai/detect-anomaly", {
        method: "POST",
        body: JSON.stringify({ symbol: activeSymbol, currentSpread: latestSig.spread, currentVolume: last?.volume, currentVelocity: vel }),
      });
      const d = await r.json();
      setAnomalies(d.anomalies || []);
      setAnomalySummary(d.summary || "");
    } catch {}

    setLastUpdate(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
    timerRef.current = setInterval(fetchInsights, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSymbol]);

  const severityColor = (s: string) => s === "HIGH" ? C.bear : s === "MEDIUM" ? C.warn : C.textMuted;

  if (!hasApiKey) return (
    <Card title="AI Insight" subtitle="Phase 2">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 24 }}>🔑</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>Anthropic API Key Required</div>
        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5, maxWidth: 240 }}>
          Add <code style={{ background: C.surfaceAlt, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>ANTHROPIC_API_KEY</code> to your <code style={{ background: C.surfaceAlt, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>.env.local</code> to enable Claude AI interpretation.
        </div>
      </div>
    </Card>
  );

  return (
    <Card title="AI Insight" subtitle={`${activeSymbol} · 30s refresh`}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>🤖</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>Signal Interpretation</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {loading && <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>Analysing…</span>}
            {lastUpdate && !loading && <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>{lastUpdate}</span>}
            <button onClick={fetchInsights} disabled={loading} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.textSub }}>↻</button>
          </div>
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 8, background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, fontSize: 12, color: C.text, lineHeight: 1.7, minHeight: 72, flex: 1 }}>
          {loading && !interpretation ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.borderLight}`, borderTop: `2px solid ${C.accent}`, animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>Generating interpretation…</span>
              </div>
              <Skeleton width="95%" height={12} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="88%" height={12} />
            </div>
          ) : interpretation ? (
            <span style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>{interpretation}</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width="90%" height={12} />
              <Skeleton width="75%" height={12} />
              <Skeleton width="60%" height={12} />
            </div>
          )}
        </div>

        {anomalySummary && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 6 }}>Anomaly Detection</div>
            {anomalies.length === 0
              ? <div style={{ fontSize: 11, color: C.bull, padding: "6px 10px", background: C.bullLight, borderRadius: 6 }}>✓ All metrics within normal range</div>
              : <>
                  <div style={{ fontSize: 11, color: C.warn, padding: "7px 10px", background: C.warnLight, borderRadius: 6, lineHeight: 1.5, border: `1px solid ${C.warn}30`, marginBottom: 6 }}>⚠ {anomalySummary}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {anomalies.map((a, i) => (
                      <span key={i} style={{ padding: "3px 9px", borderRadius: 8, background: C.surfaceAlt, border: `1px solid ${severityColor(a.severity)}40`, fontSize: 10, fontFamily: "monospace" }}>
                        <span style={{ color: severityColor(a.severity), fontWeight: 700 }}>{a.metric}</span>
                        <span style={{ color: C.textMuted }}> {a.ratio.toFixed(1)}×</span>
                      </span>
                    ))}
                  </div>
                </>
            }
          </div>
        )}

        <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.4, flexShrink: 0 }}>
          AI interpretation is informational only — not financial advice.
        </div>
      </div>
    </Card>
  );
}