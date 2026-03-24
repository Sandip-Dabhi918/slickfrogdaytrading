import { useState, useRef } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, Skeleton } from "../../lib/ui/shared";
import { apiFetch } from "../../lib/auth/apiFetch";

const US_BENCHMARKS  = ["SPY", "QQQ", "DIA", "IWM"];
const TSX_BENCHMARKS = ["XIU.TO", "XIC.TO", "ZEB.TO", "XEG.TO"];

type Mode = "list" | "add" | "edit";

interface SearchResult { symbol: string; description: string; exchange?: string }

export default function ProfileManagerCard() {
  const { profiles, activeSymbol, setActiveSymbol, saveProfile, removeProfile, profilesLoading } = useDashboard();

  const [mode,        setMode]        = useState<Mode>("list");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [editTarget,  setEditTarget]  = useState<string | null>(null);

  // Ticker search state
  const [searchQ,        setSearchQ]        = useState("");
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedName,   setSelectedName]   = useState("");
  const [selectedExchange, setSelectedExchange] = useState<"US"|"TSX">("US");
  const [livePrice,      setLivePrice]      = useState<number | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Form
  const [benchmark, setBenchmark]  = useState("QQQ");
  const [peers,     setPeers]      = useState<string[]>([]);
  const [peerInput, setPeerInput]  = useState("");
  const [accelT,    setAccelT]     = useState(0.02);
  const [spreadT,   setSpreadT]    = useState(0.05);
  const [divT,      setDivT]       = useState(1.0);
  const [alertsOn,  setAlertsOn]   = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sector,      setSector]      = useState("");
  const [suggesting,  setSuggesting]  = useState(false);

  // Live search with debounce
  const handleSearch = (q: string) => {
    setSearchQ(q);
    setSelectedTicker("");
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 1) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await apiFetch(`/api/search-stock?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setSearchResults(d.results || []);
        if (d.quote) setLivePrice(d.quote.price);
      } catch {}
      setSearching(false);
    }, 350);
  };

  const selectTicker = async (sym: string, desc: string, exchange: "US"|"TSX" = "US") => {
    setSelectedTicker(sym);
    setSelectedName(desc);
    setSelectedExchange(exchange);
    setSearchQ(`${sym} — ${desc}`);
    setSearchResults([]);
    // Switch benchmarks to match exchange
    setBenchmark(exchange === "TSX" ? "XIU.TO" : "QQQ");
    // Auto-fetch peer suggestions
    setSuggesting(true);
    try {
      const r = await apiFetch(`/api/suggest-peers?symbol=${sym}`);
      const d = await r.json();
      setSuggestions((d.suggestions || []).filter((s: string) => s !== sym && s !== sym.replace(".TO","")));
      if (d.sector) setSector(d.sector);
    } catch {}
    setSuggesting(false);
  };

  const openAdd = () => {
    setSearchQ(""); setSelectedTicker(""); setSelectedName(""); setLivePrice(null);
    setSelectedExchange("US");
    setBenchmark("QQQ"); setPeers([]); setPeerInput(""); setAccelT(0.02);
    setSpreadT(0.05); setDivT(1.0); setAlertsOn(true); setError("");
    setEditTarget(null); setSuggestions([]); setSector(""); setMode("add");
  };

  const openEdit = (ticker: string) => {
    const p = profiles.find(pr => pr.ticker === ticker); if (!p) return;
    setSelectedTicker(p.ticker); setSearchQ(p.ticker);
    setSelectedExchange((p.exchange as "US"|"TSX") || "US");
    setBenchmark(p.benchmark); setPeers(p.peers || []); setPeerInput("");
    setAccelT(p.accel_threshold); setSpreadT(p.spread_threshold);
    setDivT(p.divergence_threshold); setAlertsOn(p.alerts_enabled);
    setError(""); setEditTarget(ticker); setSuggestions([]); setSector(""); setMode("edit");
  };

  const addPeer = (s: string) => {
    const up = s.trim().toUpperCase();
    if (!up || peers.includes(up) || up === selectedTicker) return;
    if (peers.length >= 5) { setError("Maximum 5 peers"); return; }
    setPeers(prev => [...prev, up]); setPeerInput(""); setError("");
    setSuggestions(prev => prev.filter(x => x !== up));
  };

  const handleSave = async () => {
    const t = selectedTicker || searchQ.split("—")[0].trim().toUpperCase();
    if (!t) { setError("Select a stock first"); return; }
    if (!peers.length) { setError("Add at least 1 peer"); return; }
    setSaving(true); setError("");
    try {
      await saveProfile({
        ticker: t, benchmark, exchange: selectedExchange,
        accel_threshold: accelT, spread_threshold: spreadT,
        divergence_threshold: divT, alerts_enabled: alertsOn, peers,
      });
      setActiveSymbol(t); setMode("list");
    } catch (e: any) { setError(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: string) => {
    if (!confirm(`Remove ${t} from watchlist?`)) return;
    await removeProfile(t);
    if (activeSymbol === t && profiles.length > 1) setActiveSymbol(profiles.find(p => p.ticker !== t)!.ticker);
  };

  // ── List view ──────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <Card title="Stock Profiles" subtitle="Watchlist — any US stock">
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={openAdd} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer", background: C.accent, color: "#fff", border: "none", fontWeight: 700 }}>+ Add Stock</button>
        </div>
        {profilesLoading
          ? <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, padding: "4px 0" }}>{Array.from({ length: 4 }).map((_, i) => (<div key={i} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.surfaceAlt, display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Skeleton width={60} height={16}/><div style={{ display: "flex", gap: 6 }}><Skeleton width={40} height={24} radius={6}/><Skeleton width={24} height={24} radius={6}/></div></div><div style={{ display: "flex", gap: 4 }}><Skeleton width={32} height={16} radius={10}/><Skeleton width={32} height={16} radius={10}/><Skeleton width={32} height={16} radius={10}/></div></div>))}</div>
          : <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {profiles.map(p => (
                <div key={p.ticker} onClick={() => setActiveSymbol(p.ticker)} style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${activeSymbol === p.ticker ? C.accent : C.borderLight}`, background: activeSymbol === p.ticker ? C.accent + "08" : C.surfaceAlt, transition: "all .15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.text, fontSize: 13 }}>{p.ticker}</span>
                      <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>vs {p.benchmark}</span>
                      <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: p.exchange === "TSX" ? C.accent + "18" : C.bullLight, color: p.exchange === "TSX" ? C.accent : C.bull, border: `1px solid ${p.exchange === "TSX" ? C.accent + "40" : C.bull + "40"}` }}>{p.exchange || "US"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={e => { e.stopPropagation(); openEdit(p.ticker); }} style={{ padding: "2px 9px", borderRadius: 6, fontSize: 10, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.textSub }}>Edit</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(p.ticker); }} style={{ padding: "2px 9px", borderRadius: 6, fontSize: 10, cursor: "pointer", border: `1px solid ${C.bear}40`, background: C.bearLight, color: C.bear }}>✕</button>
                    </div>
                  </div>
                 {(p.peers?.length ?? 0) > 0 && (
  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
    {(p.peers ?? []).map((peer: string) => (
      <span
        key={peer}
        style={{
          padding: "1px 7px",
          borderRadius: 10,
          fontSize: 9,
          fontFamily: "monospace",
          background: "#fff",
          border: `1px solid ${C.border}`,
          color: C.textSub
        }}
      >
        {peer}
      </span>
    ))}
  </div>
)}
                </div>
              ))}
            </div>
        }
      </div>
    </Card>
  );

  // ── Add / Edit form ────────────────────────────────────────────────────────
  return (
    <Card title={mode === "add" ? "Add Any Stock" : `Edit ${editTarget}`}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto" }}>

        {/* Stock search */}
        {mode === "add" && (
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>Search Any US Stock</label>
            <div style={{ position: "relative", marginTop: 4 }}>
              <input
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Type ticker or company name…"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${selectedTicker ? C.accent : C.border}`, fontSize: 13, fontFamily: "monospace", fontWeight: selectedTicker ? 700 : 400, color: C.text, background: C.surfaceAlt, outline: "none" }}
              />
              {searching && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textMuted }}>…</span>}
              {selectedTicker && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.bull }}>✓</span>}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", marginTop: 4, overflow: "hidden" }}>
                {searchResults.map(r => (
                  <div key={r.symbol} onClick={() => selectTicker(r.symbol, r.description, (r.exchange as "US"|"TSX") || "US")} style={{ padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13, color: C.text }}>{r.symbol}</span>
                      <span style={{ fontSize: 11, color: C.textSub, marginLeft: 10 }}>{r.description}</span>
                    </div>
                    <span style={{ fontSize: 10, color: C.accent, fontFamily: "monospace" }}>+</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected stock info */}
            {selectedTicker && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, padding: "6px 10px", background: C.bullLight, borderRadius: 6, border: `1px solid ${C.bull}30` }}>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: C.bull }}>{selectedTicker}</span>
                <span style={{ fontSize: 11, color: C.textSub }}>{selectedName}</span>
                {livePrice && <span style={{ marginLeft: "auto", fontFamily: "monospace", fontWeight: 700, color: C.text }}>${livePrice.toFixed(2)}</span>}
                {sector && <span style={{ fontSize: 10, color: C.textMuted }}>{sector}</span>}
              </div>
            )}
          </div>
        )}

        {/* Benchmark — switches between US and TSX options based on selected stock */}
        <div>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>
            Benchmark · <span style={{ color: selectedExchange === "TSX" ? C.accent : C.bull }}>{selectedExchange}</span>
          </label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {(selectedExchange === "TSX" ? TSX_BENCHMARKS : US_BENCHMARKS).map(b => (
              <button key={b} onClick={() => setBenchmark(b)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700, border: `1px solid ${benchmark === b ? C.accent : C.border}`, background: benchmark === b ? C.accent : "transparent", color: benchmark === b ? "#fff" : C.textSub }}>{b}</button>
            ))}
          </div>
        </div>

        {/* Peer group */}
        <div>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>Peer Group (3–5 stocks)</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input value={peerInput} onChange={e => setPeerInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addPeer(peerInput)} placeholder="Type ticker + Enter" style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: "monospace", background: C.surfaceAlt, color: C.text, outline: "none" }} />
            <button onClick={() => addPeer(peerInput)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", background: C.accent, color: "#fff", border: "none", fontWeight: 700 }}>Add</button>
          </div>

          {/* AI suggestions */}
          {suggesting && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6, fontFamily: "monospace" }}>🤖 Finding peers…</div>}
          {suggestions.length > 0 && (
            <div style={{ marginTop: 7 }}>
              <div style={{ fontSize: 9, color: C.purple, fontFamily: "monospace", marginBottom: 4 }}>🤖 Suggested{sector ? ` · ${sector}` : ""}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {suggestions.filter(s => !peers.includes(s)).map(s => (
                  <button key={s} onClick={() => addPeer(s)} style={{ padding: "2px 9px", borderRadius: 10, fontSize: 10, cursor: "pointer", border: `1px solid ${C.purple}50`, background: C.purpleLight, color: C.purple, fontFamily: "monospace", fontWeight: 700 }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Selected peers */}
          {peers.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
              {peers.map(p => (
                <span key={p} onClick={() => setPeers(prev => prev.filter(x => x !== p))} style={{ padding: "2px 9px", borderRadius: 10, fontSize: 10, cursor: "pointer", border: `1px solid ${C.border}`, background: "#fff", color: C.text, fontFamily: "monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  {p} <span style={{ color: C.bear, fontSize: 12 }}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Alert thresholds */}
        <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 10 }}>Alert Thresholds</div>
          {[
            { label: "Acceleration ≥", value: accelT,  set: setAccelT,  step: 0.01, max: 0.2 },
            { label: "Spread ($) ≥",   value: spreadT, set: setSpreadT, step: 0.01, max: 0.2 },
            { label: "Divergence % ≥", value: divT,    set: setDivT,    step: 0.1,  max: 5.0 },
          ].map(({ label, value, set, step, max }) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: C.textSub }}>{label}</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: C.accent, fontWeight: 700 }}>{value}</span>
              </div>
              <input type="range" min={step} max={max} step={step} value={value} onChange={e => set(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.accent }} />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div onClick={() => setAlertsOn(v => !v)} style={{ width: 34, height: 18, borderRadius: 9, cursor: "pointer", background: alertsOn ? C.bull : C.border, position: "relative", transition: "background .2s" }}>
              <div style={{ position: "absolute", top: 2, left: alertsOn ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </div>
            <span style={{ fontSize: 11, color: alertsOn ? C.bull : C.textMuted }}>Alerts {alertsOn ? "enabled" : "disabled"}</span>
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: C.bear, background: C.bearLight, padding: "6px 10px", borderRadius: 6 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMode("list")} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.textSub }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "8px 0", borderRadius: 8, fontSize: 12, cursor: saving ? "not-allowed" : "pointer", background: saving ? C.textMuted : C.accent, color: "#fff", border: "none", fontWeight: 700 }}>
            {saving ? "Saving…" : mode === "add" ? "Add to Watchlist" : "Save Changes"}
          </button>
        </div>

      </div>
    </Card>
  );
}