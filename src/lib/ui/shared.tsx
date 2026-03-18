// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  bg:          "#F0F3FA",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F8F9FD",
  border:      "#E2E6F0",
  borderLight: "#EEF1F8",
  text:        "#131722",
  textSub:     "#5D6785",
  textMuted:   "#9CA3AF",
  accent:      "#2962FF",
  bull:        "#089981",
  bullLight:   "#E6F5F3",
  bear:        "#F23645",
  bearLight:   "#FEE9EB",
  warn:        "#F59E0B",
  warnLight:   "#FEF3C7",
  purple:      "#7C3AED",
  purpleLight: "#EDE9FE",
  neutral:     "#6B7280",
};

// ─── Signal direction helpers ─────────────────────────────────────────────────
export type Direction = "SELL_FADE" | "BUY_EXHAUSTION" | "HOLD";

export function getDirection(velocity: number, acceleration: number): Direction {
  if (velocity > 0 && acceleration < 0) return "SELL_FADE";
  if (velocity < 0 && acceleration > 0) return "BUY_EXHAUSTION";
  return "HOLD";
}

export function directionLabel(d: Direction) {
  if (d === "SELL_FADE")      return "Sell Fade";
  if (d === "BUY_EXHAUSTION") return "Buy Exhaustion";
  return "Hold";
}

export function directionColor(d: Direction) {
  if (d === "SELL_FADE")      return C.bear;
  if (d === "BUY_EXHAUSTION") return C.bull;
  return C.neutral;
}

export function directionBg(d: Direction) {
  if (d === "SELL_FADE")      return C.bearLight;
  if (d === "BUY_EXHAUSTION") return C.bullLight;
  return "#F3F4F6";
}

export function convictionLabel(score: number) {
  if (score >= 3) return "High Conviction — Act";
  if (score >= 2) return "Strong Signal — Prepare";
  if (score >= 1) return "Nudge — Watch Closely";
  return "No Signal";
}

export function convictionColor(score: number) {
  if (score >= 3) return C.bull;
  if (score >= 2) return C.warn;
  if (score >= 1) return C.textSub;
  return C.textMuted;
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export function Card({ title, subtitle, children, style = {} }: {
  title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, display: "flex", flexDirection: "column",
      overflow: "hidden", ...style,
    }}>
      <div style={{
        padding: "12px 16px 8px", borderBottom: `1px solid ${C.borderLight}`,
        display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {title}
        </span>
        {subtitle && <span style={{ fontSize: 10, color: C.textMuted }}>{subtitle}</span>}
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Direction badge ──────────────────────────────────────────────────────────
export function DirectionBadge({ direction }: { direction: Direction }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
      fontFamily: "monospace", textTransform: "uppercase",
      color: directionColor(direction), background: directionBg(direction),
      border: `1px solid ${directionColor(direction)}30`,
    }}>
      {directionLabel(direction)}
    </span>
  );
}

// ─── Signal type badge ────────────────────────────────────────────────────────
export function SignalBadge({ type }: { type: string }) {
  const color = type === "BUY" ? C.bull : type === "SELL" ? C.bear : C.neutral;
  const bg    = type === "BUY" ? C.bullLight : type === "SELL" ? C.bearLight : "#F3F4F6";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      fontFamily: "monospace", textTransform: "uppercase", color, background: bg,
    }}>{type}</span>
  );
}

// ─── Sparkline (recharts) ─────────────────────────────────────────────────────
import { LineChart, Line, ResponsiveContainer } from "recharts";
export function Spark({ data, dataKey = "value", color, height = 32, width = 80 }: any) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────
export function MetricRow({ label, value, color, sub }: { label: string; value: any; color?: string; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: `1px solid ${C.borderLight}` }}>
      <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: color || C.text }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── ChartLoader — progress bar with ETA shown while chart waits for data ─────
import { useState, useEffect } from "react";

export function ChartLoader({
  height = 120,
  label  = "Fetching data",
  detail = "Next poll in",
  pollIntervalSec = 15,
}: {
  height?:         number;
  label?:          string;
  detail?:         string;
  pollIntervalSec?: number;
}) {
  // Count up from 0 to pollIntervalSec, then reset
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(e => {
        if (e >= pollIntervalSec) return 0;   // reset on each poll cycle
        return e + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [pollIntervalSec]);

  const pct    = Math.min(100, (elapsed / pollIntervalSec) * 100);
  const eta    = Math.max(0, Math.ceil(pollIntervalSec - elapsed));
  const active = pct < 99;

  return (
    <div style={{
      height,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:            10,
      padding:        "0 16px",
    }}>
      {/* Animated icon */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   "50%",
        border:         `2px solid ${C.borderLight}`,
        borderTop:      `2px solid ${C.accent}`,
        animation:      "spin 1s linear infinite",
        flexShrink:     0,
      }} />

      {/* Label */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub }}>{label}</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, fontFamily: "monospace" }}>
          {active ? `${detail} ~${eta}s` : "Loading…"}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: 200 }}>
        <div style={{
          height:       5,
          background:   C.borderLight,
          borderRadius: 3,
          overflow:     "hidden",
        }}>
          <div style={{
            height:     "100%",
            borderRadius: 3,
            width:      `${pct}%`,
            background: `linear-gradient(90deg, ${C.accent}, #6B48FF)`,
            transition: "width 0.1s linear",
            position:   "relative",
            overflow:   "hidden",
          }}>
            <div style={{
              position:   "absolute",
              top:        0, left: 0, right: 0, bottom: 0,
              background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.4) 50%,transparent 100%)",
              animation:  "chartShimmer 1.2s infinite",
            }} />
          </div>
        </div>
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          marginTop:      4,
          fontSize:       9,
          fontFamily:     "monospace",
          color:          C.textMuted,
        }}>
          <span>{Math.round(pct)}%</span>
          <span>{active ? `${eta}s` : "now"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton pulse — shimmer block for loading placeholders ──────────────────
export function Skeleton({ width = "100%", height = 14, radius = 6, style = {} }: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${C.borderLight} 25%, ${C.border} 50%, ${C.borderLight} 75%)`,
      backgroundSize: "200% 100%",
      animation: "skeletonShimmer 1.4s infinite",
      flexShrink: 0,
      ...style,
    }} />
  );
}

// ─── CardLoader — full-card loading state with labelled skeletons ─────────────
export function CardLoader({ rows = 3, label = "Loading…" }: {
  rows?: number;
  label?: string;
}) {
  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%",
          border: `2px solid ${C.borderLight}`,
          borderTop: `2px solid ${C.accent}`,
          animation: "spin 1s linear infinite",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{label}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width={`${65 + (i % 3) * 10}%`} height={12} />
          <Skeleton width={`${40 + (i % 2) * 20}%`} height={10} />
        </div>
      ))}
    </div>
  );
}

// ─── InlineLoader — small spinner + text for inline loading states ────────────
export function InlineLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `2px solid ${C.borderLight}`,
        borderTop: `2px solid ${C.accent}`,
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{label}</span>
    </div>
  );
}