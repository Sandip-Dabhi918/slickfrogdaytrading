import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, DirectionBadge, getDirection, convictionLabel, convictionColor, ChartLoader, Skeleton } from "../../lib/ui/shared";

const INTERVALS = [5, 10, 30] as const;

function AccelTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "8px 12px", fontSize: 11, fontFamily: "monospace",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    }}>
      <div style={{ color: C.textMuted }}>{d.time}</div>
      <div style={{ color: d.acceleration >= 0 ? C.bull : C.bear, fontWeight: 700 }}>
        Accel: {Number(d.acceleration).toFixed(4)}
      </div>
      <div style={{ color: C.textSub }}>Vel: {Number(d.velocity).toFixed(4)}</div>
    </div>
  );
}

export default function MomentumCard() {
  const { activeSymbol, signals, velocityInterval, setVelocityInterval, loading } = useDashboard();

  const allSymSigs = [...signals]
    .filter(s => s.symbol === activeSymbol)
    .reverse();

  const window    = velocityInterval;
  const recent    = allSymSigs.slice(-window);
  const older     = allSymSigs.slice(-(window * 2), -window);

  const avgVel = (arr: typeof recent) =>
    arr.length ? arr.reduce((a, s) => a + Number(s.velocity), 0) / arr.length : 0;

  const windowedVelocity     = avgVel(recent);
  const windowedPrevVelocity = avgVel(older);
  const windowedAccel        = windowedVelocity - windowedPrevVelocity;

  const chartData = allSymSigs.slice(-60).map((s, i) => ({
    i,
    time:         new Date(s.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    velocity:     Number(s.velocity),
    acceleration: Number(s.acceleration),
    score:        Number(s.score),
  }));

  const latest    = allSymSigs[allSymSigs.length - 1];
  const rawScore  = Number(latest?.score ?? 0);
  const direction = getDirection(windowedVelocity, windowedAccel);
  const accelColor = windowedAccel > 0 ? C.bull : windowedAccel < 0 ? C.bear : C.neutral;
  const velColor   = windowedVelocity > 0 ? C.bull : windowedVelocity < 0 ? C.bear : C.neutral;

  // Show skeleton ONLY during the initial DB load (loading=true from context)
  // Once loading is done, always show real data — even if values are zero
  // (zero is valid data when market is flat or just opened)
  const isWaiting = loading;

  return (
    <Card title="Momentum" subtitle={activeSymbol}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

        {/* Direction label + conviction */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {isWaiting
            ? <Skeleton width={90} height={26} radius={20} />
            : <DirectionBadge direction={direction} />
          }
          {isWaiting
            ? <Skeleton width={80} height={14} />
            : <span style={{ fontSize: 11, fontWeight: 700, color: convictionColor(rawScore), fontFamily: "monospace" }}>
                {convictionLabel(rawScore)}
              </span>
          }
        </div>

        {/* Velocity + Acceleration + Score */}
        <div style={{ display: "flex", gap: 10 }}>
          {isWaiting ? (
            // Skeleton stat boxes while waiting for first signal
            [0, 1, 2].map(i => (
              <div key={i} style={{ flex: 1, background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton width="60%" height={9} />
                <Skeleton width="80%" height={20} />
                <Skeleton width="40%" height={9} />
              </div>
            ))
          ) : (
            <>
              {[
                { label: "Velocity",     value: windowedVelocity, color: velColor,   fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}` },
                { label: "Acceleration", value: windowedAccel,    color: accelColor, fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}` },
              ].map(({ label, value, color, fmt }) => (
                <div key={label} style={{ flex: 1, background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace", marginTop: 4 }}>{fmt(value)}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                    {label === "Velocity"
                      ? (value > 0 ? "Rising" : value < 0 ? "Falling" : "Flat")
                      : (value > 0 ? "Speeding up" : value < 0 ? "Slowing down" : "Steady")}
                  </div>
                </div>
              ))}
              <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}` }}>
                <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>Score</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: convictionColor(rawScore), fontFamily: "monospace", marginTop: 4 }}>{rawScore} / 3</div>
                <div style={{ marginTop: 4, display: "flex", gap: 3 }}>
                  {[1,2,3].map(n => (
                    <div key={n} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: rawScore >= n ? convictionColor(rawScore) : C.borderLight,
                      transition: "background .3s",
                    }} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Lookback window buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", flexShrink: 0 }}>
            Lookback window:
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {INTERVALS.map(s => (
              <button key={s} onClick={() => setVelocityInterval(s)} style={{
                padding: "2px 9px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                fontFamily: "monospace", fontWeight: 700, transition: "all .15s",
                border: `1px solid ${velocityInterval === s ? C.accent : C.border}`,
                background: velocityInterval === s ? C.accent : "transparent",
                color: velocityInterval === s ? "#fff" : C.textMuted,
              }}>{s}s</button>
            ))}
          </div>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>
            ({recent.length} ticks averaged)
          </span>
        </div>

        {/* Rolling acceleration chart */}
        <div style={{ flex: 1, minHeight: 120 }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>
            Acceleration over time — zero-line crossing = momentum shift
          </div>
          {isWaiting ? (
            <ChartLoader
              height={120}
              label="Loading signal history…"
              detail="Almost ready"
              pollIntervalSec={5}
            />
          ) : chartData.length === 0 ? (
            <ChartLoader
              height={120}
              label="Waiting for first scan…"
              detail="Next scan in"
              pollIntervalSec={30}
            />
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="accelPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.bull} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.bull} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="accelNeg" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={C.bear} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.bear} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.borderLight} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis
                  tick={{ fontSize: 9, fill: C.textMuted, fontFamily: "monospace" }}
                  tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v: number) => v.toFixed(3)}
                />
                <Tooltip content={<AccelTooltip />} />
                <ReferenceLine
                  y={0} stroke={C.textSub} strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: "0", position: "right", fontSize: 9, fill: C.textMuted }}
                />
                <Area
                  type="monotone" dataKey="acceleration"
                  stroke={windowedAccel >= 0 ? C.bull : C.bear} strokeWidth={2}
                  fill={windowedAccel >= 0 ? "url(#accelPos)" : "url(#accelNeg)"}
                  dot={false} activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </Card>
  );
}