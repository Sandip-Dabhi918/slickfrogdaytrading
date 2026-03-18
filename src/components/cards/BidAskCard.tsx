import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar } from "recharts";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, ChartLoader } from "../../lib/ui/shared";

export default function BidAskCard() {
  const { activeSymbol, allPrices, signals } = useDashboard();

  const prices = allPrices[activeSymbol] || [];
  const last   = prices[prices.length - 1];
  const prev   = prices[prices.length - 2];

  const currentSpread = last?.spread ?? null;
  const prevSpread    = prev?.spread ?? null;

  // Spread rate of change (Section 4.3 — not just widening/narrowing but how fast)
  const spreadChange  = currentSpread != null && prevSpread != null ? currentSpread - prevSpread : null;
  const widening      = (spreadChange ?? 0) > 0;

  // Rate of change series — diff between consecutive spreads
  const spreadSeries = prices.slice(-60).map((p, i, arr) => {
    const prevP = arr[i - 1];
    const rate  = prevP != null ? (p.spread ?? 0) - (prevP.spread ?? 0) : 0;
    return {
      i,
      time:    p.time,
      spread:  p.spread ?? 0,
      rate,                         // rate of change
      rateAbs: Math.abs(rate),
    };
  });

  // Trend acceleration: is the rate itself speeding up or slowing down?
  const lastRate = spreadSeries[spreadSeries.length - 1]?.rate ?? 0;
  const prevRate = spreadSeries[spreadSeries.length - 2]?.rate ?? 0;
  const rateAccel = lastRate - prevRate;
  const rateAccelLabel = Math.abs(rateAccel) < 0.0001
    ? "Steady"
    : rateAccel > 0
    ? widening ? "Widening faster" : "Narrowing slower"
    : widening ? "Widening slower" : "Narrowing faster";

  // Latest signal for context
  const latestSig = signals.find(s => s.symbol === activeSymbol);
  const velocity  = Number(latestSig?.velocity ?? 0);
  const accel     = Number(latestSig?.acceleration ?? 0);
  const direction = getDirection(velocity, accel);

  // Context-aware interpretation (Section 4.3)
  let interpretation = "";
  let interpColor    = C.neutral;
  if (currentSpread != null) {
    if (widening && direction === "SELL_FADE") {
      interpretation = "Spread widening during upward run — market makers stepping back. Bearish.";
      interpColor    = C.bear;
    } else if (!widening && direction === "BUY_EXHAUSTION") {
      interpretation = "Spread tightening after selloff — market makers re-engaging. Bullish.";
      interpColor    = C.bull;
    } else if (widening) {
      interpretation = "Spread widening — reduced liquidity.";
      interpColor    = C.warn;
    } else {
      interpretation = "Spread tightening — improved liquidity.";
      interpColor    = C.bull;
    }
  }

  const spreadColor = widening ? C.bear : C.bull;

  return (
    <Card title="Bid / Ask Spread" subtitle={activeSymbol}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

        {/* Current bid/ask/spread */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Bid",    value: last?.bid    != null ? `$${last.bid.toFixed(4)}`         : "—", color: C.bull },
            { label: "Ask",    value: last?.ask    != null ? `$${last.ask.toFixed(4)}`         : "—", color: C.bear },
            { label: "Spread", value: currentSpread != null ? `$${currentSpread.toFixed(4)}` : "—", color: spreadColor },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, background: C.surfaceAlt, borderRadius: 8,
              padding: "10px 12px", border: `1px solid ${C.borderLight}`, textAlign: "center",
            }}>
              <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "monospace", marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Trend + rate of change row */}
        <div style={{ display: "flex", gap: 10 }}>
          {/* Direction + change */}
          <div style={{
            flex: 2, display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "10px 14px", borderRadius: 8,
            background: widening ? C.bearLight : C.bullLight,
            border: `1px solid ${widening ? C.bear + "30" : C.bull + "30"}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: spreadColor }}>
              {widening ? "▲ Widening" : "▼ Narrowing"}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              {spreadChange != null
                ? `${spreadChange >= 0 ? "+" : ""}$${spreadChange.toFixed(5)} vs prev tick`
                : "—"}
            </div>
            <div style={{ fontSize: 10, color: C.textSub, marginTop: 3, fontStyle: "italic" }}>
              {rateAccelLabel}
            </div>
          </div>

          {/* Rate of change value */}
          <div style={{
            flex: 1, background: C.surfaceAlt, borderRadius: 8,
            padding: "10px 12px", border: `1px solid ${C.borderLight}`, textAlign: "center",
          }}>
            <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>Rate Δ/tick</div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginTop: 4,
              color: Math.abs(lastRate) < 0.0001 ? C.neutral : lastRate > 0 ? C.bear : C.bull,
            }}>
              {lastRate >= 0 ? "+" : ""}{lastRate.toFixed(5)}
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
              Accel: {rateAccel >= 0 ? "+" : ""}{rateAccel.toFixed(5)}
            </div>
          </div>
        </div>

        {/* Interpretation */}
        {interpretation && (
          <div style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 11,
            background: interpColor === C.bear ? C.bearLight : interpColor === C.bull ? C.bullLight : C.surfaceAlt,
            color: interpColor, border: `1px solid ${interpColor}30`, lineHeight: 1.5,
          }}>
            {interpretation}
          </div>
        )}

        {/* Dual chart: spread level + rate of change */}
        <div style={{ flex: 1, minHeight: 80 }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>
            Spread level &amp; rate of change over session
          </div>
          {spreadSeries.length < 2 ? (
            <ChartLoader
              height={100}
              label="Waiting for spread data"
              detail="Next scan in"
              pollIntervalSec={15}
            />
          ) : (
            <ResponsiveContainer width="100%" height={100}>
              <ComposedChart data={spreadSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spreadGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={spreadColor} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={spreadColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.borderLight} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis
                  yAxisId="spread"
                  tick={{ fontSize: 9, fill: C.textMuted, fontFamily: "monospace" }}
                  tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tick={{ fontSize: 9, fill: C.textMuted, fontFamily: "monospace" }}
                  tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v: number) => v.toFixed(4)}
                />
                <Tooltip
  formatter={(v: any, name?: string | number) => [
    name === "spread"
      ? `$${Number(v).toFixed(4)}`
      : Number(v).toFixed(5),
    name === "spread" ? "Spread" : "Rate Δ",
  ]}
/>
                <Area
                  yAxisId="spread" type="monotone" dataKey="spread"
                  stroke={spreadColor} strokeWidth={1.5}
                  fill="url(#spreadGrad2)" dot={false}
                />
                <Bar
                  yAxisId="rate" dataKey="rate"
                  fill={C.accent + "60"} radius={[1,1,0,0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </Card>
  );
}
