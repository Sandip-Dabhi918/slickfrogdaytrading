import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, ChartLoader } from "../../lib/ui/shared";

export default function PeerIndexCard() {
  const { activeSymbol, activeProfile, allPrices, peerPrices, signals } = useDashboard();

  // Active stock % change
  const activePrices = allPrices[activeSymbol] || [];
  const activeFirst  = activePrices[0];
  const activeLast   = activePrices[activePrices.length - 1];
  const activePct    = activeFirst && activeLast
    ? ((activeLast.price - activeFirst.price) / activeFirst.price) * 100
    : null;

  // Peers from profile (not hardcoded)
  const peers = activeProfile?.peers || [];
  const peerData = peers.map(sym => {
    const p     = peerPrices[sym] || [];
    const first = p[0];
    const last  = p[p.length - 1];
    const pct   = first && last ? ((last.price - first.price) / first.price) * 100 : null;
    return { symbol: sym, pct };
  }).filter(p => p.pct != null);

  const peerAvg   = peerData.length
    ? peerData.reduce((a, p) => a + (p.pct ?? 0), 0) / peerData.length
    : null;
  const divergence = activePct != null && peerAvg != null ? activePct - peerAvg : null;

  // Direction for context interpretation
  const latestSig = signals.find(s => s.symbol === activeSymbol);
  const direction = getDirection(Number(latestSig?.velocity ?? 0), Number(latestSig?.acceleration ?? 0));

  // Interpretation (Section 4.4 — bidirectional)
  let interpretation = "";
  let interpColor    = C.neutral;
  if (divergence != null) {
    if (divergence > 0.5 && direction === "SELL_FADE") {
      interpretation = `${activeSymbol} outperforming peers by ${divergence.toFixed(2)}% with no news — overextended up. Sell signal reinforced.`;
      interpColor    = C.bear;
    } else if (divergence < -0.5 && direction === "BUY_EXHAUSTION") {
      interpretation = `${activeSymbol} underperforming peers by ${Math.abs(divergence).toFixed(2)}% with no bad news — oversold. Buy signal reinforced.`;
      interpColor    = C.bull;
    } else if (Math.abs(divergence) < 0.5) {
      interpretation = `${activeSymbol} tracking peers closely — no significant divergence.`;
      interpColor    = C.neutral;
    } else {
      interpretation = `Divergence of ${divergence > 0 ? "+" : ""}${divergence.toFixed(2)}% vs peer average.`;
      interpColor    = C.warn;
    }
  }

  // Chart data — active stock + peers
  const chartData = [
    { symbol: activeSymbol, pct: activePct ?? 0, isActive: true },
    ...peerData.map(p => ({ ...p, pct: p.pct ?? 0, isActive: false })),
  ];

  const benchmark = activeProfile?.benchmark || "SPY";

  return (
    <Card title="Peer & Index Comparison" subtitle={`${activeSymbol} vs ${peers.length > 0 ? peers.join(", ") : "no peers configured"} · ${benchmark}`}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

        {peers.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.textMuted, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>👥</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>No peers configured</div>
            <div style={{ fontSize: 11 }}>Edit this stock profile in Settings to add peer stocks for comparison.</div>
          </div>
        ) : (
          <>
            {/* Divergence score row */}
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: `${activeSymbol} Session`, value: activePct, color: (activePct ?? 0) >= 0 ? C.bull : C.bear },
                { label: "Peer Avg",                value: peerAvg,   color: (peerAvg   ?? 0) >= 0 ? C.bull : C.bear },
                {
                  label: "Divergence",
                  value: divergence,
                  color: divergence == null ? C.textMuted
                    : divergence > 0.5  ? C.bear
                    : divergence < -0.5 ? C.bull
                    : C.neutral,
                },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  flex: 1, background: C.surfaceAlt, borderRadius: 8,
                  padding: "10px 12px", border: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "monospace", marginTop: 4 }}>
                    {value != null ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"}
                  </div>
                </div>
              ))}
            </div>

            {/* Interpretation */}
            {interpretation && (
              <div style={{
                padding: "8px 12px", borderRadius: 8, fontSize: 11,
                background: interpColor === C.bear ? C.bearLight : interpColor === C.bull ? C.bullLight : C.surfaceAlt,
                color: interpColor, border: `1px solid ${interpColor}30`, lineHeight: 1.5,
              }}>{interpretation}</div>
            )}

            {/* Bar chart */}
            <div style={{ flex: 1, minHeight: 100 }}>
              {chartData.every(d => d.pct === 0) ? (
                <ChartLoader
                  height={110}
                  label="Waiting for peer price data"
                  detail="Next scan in"
                  pollIntervalSec={15}
                />
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={28}>
                    <CartesianGrid stroke={C.borderLight} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: C.textSub, fontFamily: "monospace", fontWeight: 700 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: C.textMuted, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={40} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Change"]} contentStyle={{ fontSize: 11, fontFamily: "monospace", borderRadius: 8 }} />
                    <ReferenceLine y={0} stroke={C.textSub} strokeWidth={1} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i}
                          fill={entry.isActive
                            ? (entry.pct >= 0 ? C.accent : C.bear)
                            : (entry.pct >= 0 ? C.bull + "80" : C.bear + "80")}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}

      </div>
    </Card>
  );
}
