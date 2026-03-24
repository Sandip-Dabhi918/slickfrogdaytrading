import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, Skeleton } from "../../lib/ui/shared";
import { apiFetch } from "../../lib/auth/apiFetch";

interface YahooQuote {
  symbol:        string;
  shortName:     string;
  price:         number;
  previousClose: number;
  open:          number;
  dayHigh:       number;
  dayLow:        number;
  volume:        number;
  change:        number;
  changePct:     number;
  marketState:   string;
  bid:           number;
  ask:           number;
  spread:        number;
  currency:      string;
  exchange:      string;
}

function MarketStateBadge({ state }: { state: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    REGULAR: { label: "Market Open",   color: C.bull,     bg: C.bullLight  },
    PRE:     { label: "Pre-Market",    color: C.warn,     bg: C.warnLight  },
    POST:    { label: "After Hours",   color: C.accent,   bg: C.accent+"15"},
    CLOSED:  { label: "Market Closed", color: C.textMuted,bg: C.surfaceAlt },
  };
  const c = cfg[state] ?? cfg.CLOSED;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 10,
      fontWeight: 700, fontFamily: "monospace",
      color: c.color, background: c.bg,
      border: `1px solid ${c.color}40`,
    }}>
      {state === "REGULAR" && <span style={{ marginRight: 5, display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.bull, animation: "pulse 2s infinite" }} />}
      {c.label}
    </span>
  );
}

function QuoteRow({ quote, prevClose }: { quote: YahooQuote; prevClose?: number }) {
  const up = quote.change >= 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 90px 80px 80px 80px 80px",
      gap: 8, padding: "10px 14px",
      borderBottom: `1px solid ${C.borderLight}`,
      alignItems: "center",
    }}>
      {/* Symbol + name */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13, color: C.text }}>
            {quote.symbol}
          </span>
          <MarketStateBadge state={quote.marketState} />
          {quote.currency !== "USD" && (
            <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>{quote.currency}</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {quote.shortName}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: C.text }}>
          ${quote.price.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: up ? C.bull : C.bear, fontFamily: "monospace" }}>
          {up ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}%
        </div>
      </div>

      {/* Bid */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>BID</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: C.bull }}>${quote.bid.toFixed(2)}</div>
      </div>

      {/* Ask */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>ASK</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: C.bear }}>${quote.ask.toFixed(2)}</div>
      </div>

      {/* Spread */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>SPREAD</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: C.text }}>${quote.spread.toFixed(4)}</div>
      </div>

      {/* Volume */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>VOL</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: C.textSub }}>
          {quote.volume > 1e6
            ? `${(quote.volume / 1e6).toFixed(1)}M`
            : quote.volume > 1e3
            ? `${(quote.volume / 1e3).toFixed(0)}K`
            : quote.volume}
        </div>
      </div>
    </div>
  );
}

export default function YahooDataCard() {
  const { profiles, allPrices, signals } = useDashboard();

  const [quotes,      setQuotes]      = useState<Record<string, YahooQuote>>({});
  const [loading,     setLoading]     = useState(false);
  const [lastFetch,   setLastFetch]   = useState("");
  const [error,       setError]       = useState("");
  const [customSym,   setCustomSym]   = useState("");
  const [extraSymbols,setExtraSymbols]= useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const allSymbols = [
    ...profiles.map(p => p.ticker),
    ...extraSymbols,
  ].filter((s, i, a) => a.indexOf(s) === i); // dedupe

  const fetchQuotes = useCallback(async () => {
    if (!allSymbols.length) return;
    setLoading(true); setError("");
    try {
      const r = await apiFetch(`/api/yahoo-quote?symbols=${allSymbols.join(",")}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fetch failed");
      setQuotes(d.quotes || {});
      setLastFetch(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [allSymbols.join(",")]);

  // Initial fetch + auto-refresh every 60s
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchQuotes, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchQuotes]);

  function addCustomSymbol() {
    const s = customSym.trim().toUpperCase();
    if (!s || allSymbols.includes(s)) return;
    setExtraSymbols(prev => [...prev, s]);
    setCustomSym("");
  }

  function removeExtra(sym: string) {
    setExtraSymbols(prev => prev.filter(s => s !== sym));
    setQuotes(prev => { const n = { ...prev }; delete n[sym]; return n; });
  }

  const sortedSymbols = allSymbols.sort((a, b) => {
    const qa = quotes[a]; const qb = quotes[b];
    if (!qa || !qb) return 0;
    return Math.abs(qb.changePct) - Math.abs(qa.changePct); // most moved first
  });

  return (
    <Card title="Yahoo Finance" subtitle={`Alternate data source${lastFetch ? " · " + lastFetch : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
          borderBottom: `1px solid ${C.borderLight}`, flexShrink: 0, flexWrap: "wrap",
        }}>
          {/* Info badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 8,
            background: C.warnLight, border: `1px solid ${C.warn}40`,
          }}>
            <span style={{ fontSize: 10, color: C.warn, fontFamily: "monospace", fontWeight: 600 }}>
              ⚠ Unofficial · ~1min delay · Dev/testing only
            </span>
          </div>

          {/* Auto refresh toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ fontSize: 10, color: C.textMuted }}>Auto-refresh</span>
            <div
              onClick={() => setAutoRefresh(v => !v)}
              style={{
                width: 30, height: 16, borderRadius: 8, cursor: "pointer",
                background: autoRefresh ? C.bull : C.border,
                position: "relative", transition: "background .2s",
              }}
            >
              <div style={{
                position: "absolute", top: 2,
                left: autoRefresh ? 14 : 2,
                width: 12, height: 12, borderRadius: "50%",
                background: "#fff", transition: "left .2s",
              }} />
            </div>
          </div>

          <button
            onClick={fetchQuotes}
            disabled={loading}
            style={{
              padding: "4px 12px", borderRadius: 7, fontSize: 11,
              cursor: loading ? "not-allowed" : "pointer",
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.textSub, fontFamily: "monospace",
            }}
          >
            {loading ? "Fetching…" : "↻ Refresh"}
          </button>
        </div>

        {/* Add custom symbol */}
        <div style={{
          display: "flex", gap: 6, padding: "8px 14px",
          borderBottom: `1px solid ${C.borderLight}`, flexShrink: 0,
        }}>
          <input
            value={customSym}
            onChange={e => setCustomSym(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addCustomSymbol()}
            placeholder="Add any symbol (e.g. TD.TO, SHOP.TO, AAPL)"
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 12,
              border: `1px solid ${C.border}`, background: C.surfaceAlt,
              color: C.text, outline: "none", fontFamily: "monospace",
            }}
          />
          <button
            onClick={addCustomSymbol}
            style={{
              padding: "6px 14px", borderRadius: 7, fontSize: 11,
              background: C.accent, color: "#fff", border: "none",
              cursor: "pointer", fontWeight: 700,
            }}
          >+ Add</button>

          {/* Extra symbols pills */}
          {extraSymbols.map(s => (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 20,
              background: C.accent + "18", border: `1px solid ${C.accent}40`,
              fontSize: 11, fontFamily: "monospace", color: C.accent, fontWeight: 700,
            }}>
              {s}
              <span
                onClick={() => removeExtra(s)}
                style={{ cursor: "pointer", color: C.bear, marginLeft: 2, fontSize: 13 }}
              >×</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "8px 14px", background: C.bearLight,
            borderBottom: `1px solid ${C.bear}30`, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: C.bear, fontFamily: "monospace" }}>⚠ {error}</span>
          </div>
        )}

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 80px 80px 80px 80px",
          gap: 8, padding: "6px 14px",
          background: C.surfaceAlt,
          borderBottom: `1px solid ${C.borderLight}`,
          flexShrink: 0,
        }}>
          {["Symbol", "Price", "Bid", "Ask", "Spread", "Volume"].map(h => (
            <span key={h} style={{
              fontSize: 9, color: C.textMuted,
              textTransform: "uppercase", letterSpacing: "0.08em",
              fontFamily: "monospace", textAlign: h !== "Symbol" ? "right" : "left",
            }}>{h}</span>
          ))}
        </div>

        {/* Quotes list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && !Object.keys(quotes).length ? (
            // Skeleton rows on initial load
            Array.from({ length: profiles.length || 3 }).map((_, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 80px 80px",
                gap: 8, padding: "12px 14px", borderBottom: `1px solid ${C.borderLight}`,
                alignItems: "center",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton width={80} height={14} />
                  <Skeleton width={140} height={10} />
                </div>
                {[90, 70, 70, 70, 60].map((w, j) => (
                  <Skeleton key={j} width={w} height={13} style={{ marginLeft: "auto" }} />
                ))}
              </div>
            ))
          ) : !allSymbols.length ? (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 32, gap: 10, color: C.textMuted,
            }}>
              <div style={{ fontSize: 24 }}>📊</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>No symbols to watch</div>
              <div style={{ fontSize: 11, textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>
                Add stocks in Settings first, or type a symbol above.
              </div>
            </div>
          ) : (
            sortedSymbols.map(sym => {
              const q = quotes[sym];
              if (!q) return (
                <div key={sym} style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 80px 80px",
                  gap: 8, padding: "12px 14px", borderBottom: `1px solid ${C.borderLight}`,
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontWeight: 700, fontFamily: "monospace", color: C.textMuted }}>{sym}</div>
                    <Skeleton width={100} height={10} />
                  </div>
                  {[90, 70, 70, 70, 60].map((w, j) => (
                    <Skeleton key={j} width={w} height={12} style={{ marginLeft: "auto" }} />
                  ))}
                </div>
              );
              return <QuoteRow key={sym} quote={q} />;
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "6px 14px", borderTop: `1px solid ${C.borderLight}`,
          display: "flex", justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>
            Source: Yahoo Finance (unofficial) · Not financial advice
          </span>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace" }}>
            {Object.keys(quotes).length}/{allSymbols.length} symbols loaded
          </span>
        </div>
      </div>
    </Card>
  );
}