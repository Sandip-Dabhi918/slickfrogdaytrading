import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card } from "../../lib/ui/shared";

export default function StockOverviewCard() {
  const { profiles, activeSymbol, setActiveSymbol, allPrices, signals } = useDashboard();

  const prices   = allPrices[activeSymbol] || [];
  const last     = prices[prices.length - 1];
  const first    = prices[0];
  const change   = last && first ? last.price - first.price : null;
  const pct      = first && change != null ? (change / first.price) * 100 : null;
  const up       = (change ?? 0) >= 0;
  const totalVol = prices.reduce((a, p) => a + p.volume, 0);
  const lastSig  = signals.find(s => s.symbol === activeSymbol);

  return (
    <Card title="Stock Overview" subtitle="Session">
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Symbol selector — driven by Supabase profiles */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {profiles.map(profile => {
            const p  = allPrices[profile.ticker] || [];
            const l  = p[p.length - 1];
            const f  = p[0];
            const ch = l && f ? l.price - f.price : null;
            const isUp = (ch ?? 0) >= 0;
            return (
              <button key={profile.ticker} onClick={() => setActiveSymbol(profile.ticker)} style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                fontFamily: "monospace", fontWeight: 700, transition: "all .15s",
                border: `1px solid ${activeSymbol === profile.ticker ? C.accent : C.border}`,
                background: activeSymbol === profile.ticker ? C.accent : C.surfaceAlt,
                color: activeSymbol === profile.ticker ? "#fff" : C.textSub,
              }}>
                {profile.ticker}
                {ch != null && (
                  <span style={{ marginLeft: 5, fontSize: 9, color: activeSymbol === profile.ticker ? "#ffffff99" : isUp ? C.bull : C.bear }}>
                    {isUp ? "▲" : "▼"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Price display */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", marginBottom: 2 }}>{activeSymbol}</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: C.text, lineHeight: 1 }}>
              {last ? `$${last.price.toFixed(2)}` : "—"}
            </div>
          </div>
          {change != null && (
            <div style={{ paddingBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: up ? C.bull : C.bear, fontFamily: "monospace" }}>
                {up ? "+" : ""}{change.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: up ? C.bull : C.bear }}>
                {up ? "▲" : "▼"} {Math.abs(pct ?? 0).toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Bid",    value: last?.bid    != null ? `$${last.bid.toFixed(2)}`               : "—" },
            { label: "Ask",    value: last?.ask    != null ? `$${last.ask.toFixed(2)}`               : "—" },
            { label: "Spread", value: last?.spread != null ? `$${last.spread.toFixed(4)}`            : "—" },
            { label: "Volume", value: totalVol > 0 ? `${(totalVol / 1e6).toFixed(2)}M`              : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: C.surfaceAlt, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "monospace", marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Latest signal */}
        {lastSig && (() => {
          const vel   = Number(lastSig.velocity);
          const accel = Number(lastSig.acceleration);
          const isUp  = lastSig.signal_type === "BUY";
          const label = vel > 0 && accel < 0 ? "Sell Fade" : vel < 0 && accel > 0 ? "Buy Exhaustion" : "Hold";
          const color = label === "Sell Fade" ? C.bear : label === "Buy Exhaustion" ? C.bull : C.neutral;
          const bg    = label === "Sell Fade" ? C.bearLight : label === "Buy Exhaustion" ? C.bullLight : C.surfaceAlt;
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: bg, border: `1px solid ${color}40` }}>
              <span style={{ fontSize: 11, color: C.textSub }}>Latest Signal</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color }}>
                {label} · {lastSig.strength}
              </span>
            </div>
          );
        })()}

      </div>
    </Card>
  );
}
