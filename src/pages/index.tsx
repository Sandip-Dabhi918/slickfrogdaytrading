import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────
type ScannerItem = { symbol: string; price: number; signal: "BUY" | "SELL" | "HOLD" };
type SignalItem  = { symbol: string; signal: "BUY" | "SELL" | "HOLD"; score: number };
type DebugData   = { status: string; mode: string; time: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const MOCK_SCANNER: ScannerItem[] = [
  { symbol: "AAPL", price: 189.12, signal: "BUY"  },
  { symbol: "TSLA", price: 242.55, signal: "SELL" },
  { symbol: "MSFT", price: 401.22, signal: "BUY"  },
  { symbol: "NVDA", price: 128.44, signal: "BUY"  },
  { symbol: "AMD",  price: 172.18, signal: "SELL" },
];

const MOCK_SIGNALS: SignalItem[] = [
  { symbol: "AAPL", signal: "BUY",  score: 3 },
  { symbol: "TSLA", signal: "SELL", score: 2 },
  { symbol: "MSFT", signal: "HOLD", score: 1 },
  { symbol: "NVDA", signal: "BUY",  score: 3 },
  { symbol: "AMD",  signal: "SELL", score: 2 },
];

const API_URLS: Record<string, string> = {
  debug:   "/api/debug",
  scanner: "/api/run-scanner",
  signals: "/api/get-signals",
};

const SIGNAL_COLOR: Record<string, string> = {
  BUY:  "#16a34a",
  SELL: "#dc2626",
  HOLD: "#d97706",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DemoPage() {
  const [useMock, setUseMock]   = useState(true);
  const [loading, setLoading]   = useState<string | null>(null);
  const [debug,   setDebug]     = useState<DebugData | null>(null);
  const [scanner, setScanner]   = useState<ScannerItem[] | null>(null);
  const [signals, setSignals]   = useState<SignalItem[]  | null>(null);

  async function runApi(type: string) {
    setLoading(type);
    try {
      let data: any;

      if (useMock) {
        await new Promise((r) => setTimeout(r, 400));
        if (type === "debug")   data = { status: "OK", mode: "MOCK", time: new Date().toLocaleTimeString() };
        if (type === "scanner") data = MOCK_SCANNER;
        if (type === "signals") data = MOCK_SIGNALS;
      } else {
        const res = await fetch(API_URLS[type]);
        const raw = await res.json();
        data = Array.isArray(raw) ? raw.filter((i: any) => i && !i.error).slice(0, 5) : raw;
      }

      if (type === "debug")   setDebug(data);
      if (type === "scanner") setScanner(data);
      if (type === "signals") setSignals(data);
    } catch (err) {
      console.error(type, err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>API Demo Panel</h1>
        <button
          onClick={() => setUseMock(!useMock)}
          style={{ ...s.modeBtn, background: useMock ? "#166534" : "#581c87" }}
        >
          <span style={s.modeDot} />
          {useMock ? "Mock data" : "Backend API"}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={s.btnRow}>
        {(["debug", "scanner", "signals"] as const).map((t) => (
          <button key={t} onClick={() => runApi(t)} style={s.btn} disabled={loading === t}>
            {loading === t ? <span style={s.spinner} /> : null}
            {loading === t ? "Loading…" : `Run ${t}`}
          </button>
        ))}
      </div>

      {/* Debug card */}
      {debug && (
        <Card title="Debug response">
          <pre style={s.pre}>{JSON.stringify(debug, null, 2)}</pre>
        </Card>
      )}

      {/* Scanner */}
      {scanner && (
        <>
          <Card title="Scanner results">
            <table style={s.table}>
              <thead>
                <tr>
                  {["Symbol", "Signal", "Price"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scanner.map((row) => (
                  <tr key={row.symbol} style={s.tr}>
                    <td style={s.td}><strong>{row.symbol}</strong></td>
                    <td style={s.td}><Badge signal={row.signal} /></td>
                    <td style={{ ...s.td, color: "#9ca3af" }}>${row.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Price chart">
            <BarChartCard
              data={scanner.map((d) => ({ name: d.symbol, value: d.price, signal: d.signal }))}
            />
          </Card>
        </>
      )}

      {/* Signals */}
      {signals && (
        <>
          <Card title="Signals">
            <table style={s.table}>
              <thead>
                <tr>
                  {["Symbol", "Signal", "Score"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map((row) => (
                  <tr key={row.symbol} style={s.tr}>
                    <td style={s.td}><strong>{row.symbol}</strong></td>
                    <td style={s.td}><Badge signal={row.signal} /></td>
                    <td style={{ ...s.td, color: "#9ca3af" }}>{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Signal score chart">
            <BarChartCard
              data={signals.map((d) => ({ name: d.symbol, value: d.score, signal: d.signal }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <p style={s.cardTitle}>{title}</p>
      {children}
    </div>
  );
}

function Badge({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  const color = SIGNAL_COLOR[signal];
  return (
    <span style={{
      ...s.badge,
      color,
      background: color + "1a",
      border: `1px solid ${color}33`,
    }}>
      {signal}
    </span>
  );
}

function BarChartCard({ data }: { data: { name: string; value: number; signal: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 13 }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ color: "#9ca3af" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={SIGNAL_COLOR[entry.signal] ?? "#2563eb"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    padding: "28px 24px",
    background: "#0f172a",
    minHeight: "100vh",
    color: "#e5e7eb",
    fontFamily: "system-ui, sans-serif",
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: "#f9fafb",
    margin: 0,
  },
  modeBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 14px",
    border: "none",
    borderRadius: 20,
    color: "#d1fae5",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  modeDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#4ade80",
    display: "inline-block",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  btn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#cbd5e1",
    fontSize: 13,
    cursor: "pointer",
  },
  spinner: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "2px solid #475569",
    borderTopColor: "#94a3b8",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "16px 18px",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    margin: "0 0 12px",
  },
  pre: {
    fontSize: 12,
    lineHeight: 1.7,
    color: "#4ade80",
    overflowX: "auto",
    margin: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid #334155",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  td: {
    padding: "9px 10px",
    color: "#e2e8f0",
  },
  badge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: 20,
    letterSpacing: "0.04em",
  },
};