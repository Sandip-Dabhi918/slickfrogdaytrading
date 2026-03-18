import { useState, useEffect } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, Skeleton } from "../../lib/ui/shared";
import { apiFetch } from "../../lib/auth/apiFetch";

interface Headline { headline: string; source: string; datetime: number; url: string }
interface SentResult { headline: string; sentiment: "POSITIVE"|"NEGATIVE"|"NEUTRAL"; material: boolean; assessment: string }
const SC = { POSITIVE: C.bull, NEGATIVE: C.bear, NEUTRAL: C.textMuted };
const SB = { POSITIVE: C.bullLight, NEGATIVE: C.bearLight, NEUTRAL: "#F3F4F6" };

export default function NewsCard() {
  const { profiles, activeSymbol, setActiveSymbol, signals } = useDashboard();

  // News can be pinned to any stock independently of the active symbol
  const [newsSymbol, setNewsSymbol] = useState(activeSymbol);
  const [news,      setNews]        = useState<Headline[]>([]);
  const [sentiment, setSentiment]   = useState<SentResult[]>([]);
  const [loading,   setLoading]     = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [checked,   setChecked]     = useState("");

  // Sync newsSymbol when active stock changes (unless user pinned it manually)
  useEffect(() => { setNewsSymbol(activeSymbol); }, [activeSymbol]);

  const latestSig = signals.find(s => s.symbol === newsSymbol);
  const direction = getDirection(Number(latestSig?.velocity ?? 0), Number(latestSig?.acceleration ?? 0));

  const fetchNews = async (sym: string) => {
    setLoading(true); setNews([]); setSentiment([]);
    try {
      const res = await apiFetch(`/api/get-news?symbol=${sym}`);
      const d   = await res.json();
      const hl: Headline[] = d.news || [];
      setNews(hl);
      setChecked(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));

      if (hl.length > 0) {
        setAiLoading(true);
        try {
          const sr = await apiFetch("/api/ai/news-sentiment", {
            method: "POST",
                        body: JSON.stringify({ symbol: sym, headlines: hl, direction }),
          });
          setSentiment((await sr.json()).results || []);
        } catch { setSentiment([]); }
        setAiLoading(false);
      }
    } catch { setNews([]); }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews(newsSymbol);
    const id = setInterval(() => fetchNews(newsSymbol), 60_000);
    return () => clearInterval(id);
  }, [newsSymbol]);

  const hasMaterial = sentiment.some(s => s.material);

  return (
    <Card title="News" subtitle={`${newsSymbol}${checked ? " · " + checked : ""}`}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1, overflow: "hidden" }}>

        {/* Stock selector — all profiles in a scrollable pill row */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0 }}>
          {profiles.map(p => (
            <button
              key={p.ticker}
              onClick={() => {
                setNewsSymbol(p.ticker);
                setActiveSymbol(p.ticker);
              }}
              style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer",
                fontFamily: "monospace", fontWeight: 700, transition: "all .12s",
                border: `1px solid ${newsSymbol === p.ticker ? C.accent : C.border}`,
                background: newsSymbol === p.ticker ? C.accent : C.surfaceAlt,
                color: newsSymbol === p.ticker ? "#fff" : C.textSub,
              }}
            >
              {p.ticker}
            </button>
          ))}
          <button
            onClick={() => fetchNews(newsSymbol)}
            style={{ marginLeft: "auto", padding: "3px 9px", borderRadius: 20, fontSize: 10, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted }}
          >↻</button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.borderLight}`, borderTop: `2px solid ${C.accent}`, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>Fetching headlines for {newsSymbol}…</span>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.surfaceAlt, display: "flex", flexDirection: "column", gap: 7 }}>
                <Skeleton width="85%" height={13} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Skeleton width={60} height={10} />
                  <Skeleton width={80} height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : !news.length ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.bullLight, border: `2px solid ${C.bull}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.bull, fontFamily: "monospace" }}>No News</div>
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>
              No recent headlines for <strong>{newsSymbol}</strong>. Price movement is momentum-driven — signals are reinforced.
            </div>
            <div style={{ padding: "4px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.bullLight, color: C.bull, border: `1px solid ${C.bull}40`, fontFamily: "monospace" }}>
              SIGNALS REINFORCED
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
            {hasMaterial
              ? <div style={{ padding: "7px 12px", borderRadius: 8, fontSize: 11, background: C.warnLight, color: C.warn, border: `1px solid ${C.warn}40`, fontWeight: 600, flexShrink: 0 }}>⚠ Material news found — verify before acting</div>
              : sentiment.length > 0 && <div style={{ padding: "7px 12px", borderRadius: 8, fontSize: 11, background: C.bullLight, color: C.bull, border: `1px solid ${C.bull}40`, flexShrink: 0 }}>✓ Non-material news — signals remain valid</div>
            }
            {aiLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${C.borderLight}`, borderTop: `2px solid ${C.accent}`, animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>Analysing sentiment…</span>
              </div>
            )}
            {news.map((item, i) => {
              const sent = sentiment.find(s => s.headline.slice(0, 30) === item.headline.slice(0, 30));
              return (
                <a key={i} href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.surfaceAlt, cursor: "pointer" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.4, marginBottom: 5 }}>{item.headline}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>{item.source}</span>
                        <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8, fontFamily: "monospace" }}>
                          {new Date(item.datetime * 1000).toLocaleTimeString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {sent && <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4, marginTop: 3, maxWidth: 240 }}>{sent.assessment}</div>}
                      </div>
                      {sent && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ padding: "1px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: SC[sent.sentiment], background: SB[sent.sentiment] }}>
                            {sent.sentiment}
                          </span>
                          {sent.material && (
                            <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: 9, fontWeight: 700, color: C.warn, background: C.warnLight, fontFamily: "monospace" }}>MATERIAL</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}