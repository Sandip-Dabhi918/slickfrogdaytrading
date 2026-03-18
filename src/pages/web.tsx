import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../lib/auth/AuthContext";

const SIGNALS = [
  { ticker: "AAPL", signal: "SELL FADE",   score: 3, vel: "+0.42", acc: "-0.18", div: "+2.1%" },
  { ticker: "TD",   signal: "BUY EXHAUST", score: 2, vel: "-0.31", acc: "+0.09", div: "-1.8%" },
  { ticker: "NVDA", signal: "SELL FADE",   score: 3, vel: "+0.87", acc: "-0.34", div: "+3.4%" },
  { ticker: "RY",   signal: "HOLD",        score: 1, vel: "+0.05", acc: "+0.01", div: "+0.2%" },
  { ticker: "MSFT", signal: "BUY EXHAUST", score: 2, vel: "-0.19", acc: "+0.07", div: "-1.2%" },
  { ticker: "BMO",  signal: "SELL FADE",   score: 2, vel: "+0.22", acc: "-0.11", div: "+1.5%" },
];

const FEATURES = [
  { icon: "⚡", title: "Price Acceleration Engine", desc: "Track velocity and its rate of change — the second derivative of price. When a rising stock's acceleration turns negative, the move is fading before price reverses." },
  { icon: "↔", title: "Bid/Ask Spread Dynamics",   desc: "Spreads widening on an upward run signal market makers losing conviction. Spreads tightening in a selloff signal stabilization. Both directions, real time." },
  { icon: "⊞", title: "Peer Divergence Score",     desc: "Stock up 3% while peers are up 1% with no news? That's an unsupported momentum run. The divergence score surfaces this instantly across your whole watchlist." },
  { icon: "◎", title: "AI Signal Interpretation",  desc: "Plain-English analysis of what the signals mean — not raw numbers. Claude reads your signal state and tells you what's happening and what to do about it." },
  { icon: "⧉", title: "Card-Based Dashboard",      desc: "Every card is an independent module with its own data feed and state. Swap, rearrange, or replace any card without touching the rest of the system." },
  { icon: "◈", title: "Multi-Market Scanner",      desc: "Watch NYSE, NASDAQ and TSX simultaneously. The scanner surfaces the strongest fade and exhaustion signals across your configured watchlist automatically." },
];

export default function Home() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function goToDashboard() {
    router.push(session ? "/dashboard" : "/login");
  }

  useEffect(() => {
    setMounted(true);
    tickerRef.current = setInterval(() => setTick(t => (t + 1) % SIGNALS.length), 2800);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  const active = SIGNALS[tick];
  const isSell = active.signal.includes("SELL");
  const isHold = active.signal === "HOLD";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:           #f7f5f2;
          --bg2:          #f0ece6;
          --card:         #ffffff;
          --card-alt:     #faf9f7;
          --border:       #e2ddd6;
          --border-mid:   #cec8be;
          --text:         #18150f;
          --text-mid:     #4a4438;
          --muted:        #9a9086;
          --accent:       #2563eb;
          --accent-bg:    #eff4ff;
          --accent-bdr:   #bfcffd;
          --bull:         #166534;
          --bull-bg:      #f0fdf4;
          --bull-bdr:     #bbf7d0;
          --bear:         #991b1b;
          --bear-bg:      #fff5f5;
          --bear-bdr:     #fecaca;
          --warn:         #92400e;
          --warn-bg:      #fffbeb;
          --fn:           'Plus Jakarta Sans', sans-serif;
          --serif:        'Playfair Display', serif;
          --mono:         'JetBrains Mono', monospace;
        }

        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--fn);
          min-height: 100vh;
          overflow-x: hidden;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes ticker-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 2px 16px #2563eb0a, 0 1px 4px #00000008; }
          50%       { box-shadow: 0 4px 32px #2563eb18, 0 1px 4px #00000008; }
        }

        .dot-bg {
          background-color: var(--bg);
          background-image: radial-gradient(#cec8be 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .nav-blur {
          background: rgba(247,245,242,0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .btn-primary {
          font-family: var(--fn); font-weight: 700; font-size: 13px;
          letter-spacing: 0.02em; background: var(--accent); color: #fff;
          border: none; border-radius: 10px; padding: 11px 24px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }

        .btn-ghost {
          font-family: var(--fn); font-weight: 600; font-size: 13px;
          letter-spacing: 0.01em; background: transparent; color: var(--text-mid);
          border: 1.5px solid var(--border-mid); border-radius: 10px;
          padding: 11px 24px; cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

        .feature-card {
          background: var(--card); border: 1.5px solid var(--border);
          border-radius: 14px; padding: 26px 24px;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .feature-card:hover {
          border-color: var(--accent-bdr);
          box-shadow: 0 4px 20px #2563eb0d;
          transform: translateY(-2px);
        }

        .ticker-tab {
          flex: 0 0 auto; display: flex; flex-direction: column;
          align-items: center; gap: 3px; padding: 10px 16px;
          border: none; cursor: pointer; transition: background 0.15s;
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="nav-blur" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 58, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 28px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #2563eb18, #2563eb0a)",
            border: "1.5px solid var(--accent-bdr)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>⚡</div>
          <span style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
            Momentum<span style={{ color: "var(--accent)" }}>Fade</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bull-bg)", border: "1px solid var(--bull-bdr)",
            borderRadius: 20, padding: "5px 12px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse-dot 1.8s infinite" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--bull)", fontWeight: 500, letterSpacing: "0.06em" }}>LIVE</span>
          </div>
          {session ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn-ghost" onClick={async () => { await signOut(); }} style={{ fontSize: 13, padding: "9px 16px" }}>
                Sign out
              </button>
              <button className="btn-primary" onClick={goToDashboard}>
                Dashboard →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn-ghost" onClick={() => router.push("/login")} style={{ fontSize: 13, padding: "9px 16px" }}>
                Sign in
              </button>
              <button className="btn-primary" onClick={goToDashboard}>
                Get Started →
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="dot-bg" style={{
        minHeight: "100vh", paddingTop: 130, paddingBottom: 80,
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Soft center bloom */}
        <div style={{
          position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)",
          width: 700, height: 500, borderRadius: "50%",
          background: "radial-gradient(ellipse, #2563eb06 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ textAlign: "center", maxWidth: 780, padding: "0 24px", animation: "fadeUp 0.7s ease both" }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--accent-bg)", border: "1px solid var(--accent-bdr)",
            borderRadius: 20, padding: "5px 16px", marginBottom: 28,
          }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em", fontWeight: 500 }}>
              REAL-TIME · BIDIRECTIONAL · AI-POWERED
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--fn)", fontWeight: 800,
            fontSize: "clamp(38px, 6.5vw, 68px)",
            lineHeight: 1.06, letterSpacing: "-0.04em", marginBottom: 10,
          }}>
            Detect momentum
          </h1>
          <h1 style={{
            fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 700,
            fontSize: "clamp(38px, 6.5vw, 68px)",
            lineHeight: 1.06, letterSpacing: "-0.02em",
            color: "var(--accent)", marginBottom: 28,
          }}>
            before the reversal.
          </h1>

          <p style={{
            fontFamily: "var(--fn)", fontWeight: 400, fontSize: 17, lineHeight: 1.7,
            color: "var(--text-mid)", maxWidth: 580, margin: "0 auto 36px",
          }}>
            Intraday traders know when momentum is exhausting — the ticks slow, the spread shifts, the energy drains. MomentumFade surfaces those signals in one unified view, for both buys <em>and</em> sells.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={goToDashboard} style={{ fontSize: 14, padding: "13px 30px" }}>
              Launch Dashboard →
            </button>
            <button className="btn-ghost" style={{ fontSize: 14, padding: "13px 30px" }}>
              How It Works
            </button>
          </div>
        </div>

        {/* ── LIVE SIGNAL CARD ── */}
        <div style={{
          marginTop: 56, width: "100%", maxWidth: 880, padding: "0 24px",
          animation: "fadeUp 0.8s 0.15s ease both", animationFillMode: "both",
        }}>
          <div style={{
            background: "var(--card)", borderRadius: 18,
            border: "1.5px solid var(--border)",
            boxShadow: "0 4px 32px #2563eb0a, 0 1px 6px #0000000a",
            overflow: "hidden",
            animation: "card-glow 4s ease-in-out infinite",
          }}>
            {/* Card header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 20px",
              background: "var(--card-alt)",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>LIVE SIGNAL FEED</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse-dot 1.8s infinite" }} />
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                {mounted ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
              </span>
            </div>

            {/* Active signal body */}
            {mounted && (
              <div key={tick} style={{ padding: "22px 24px", animation: "ticker-in 0.3s ease both" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>
                        {active.ticker}
                      </span>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500,
                        letterSpacing: "0.08em", padding: "4px 12px", borderRadius: 6,
                        background: isSell ? "var(--bear-bg)" : isHold ? "#f5f4f2" : "var(--bull-bg)",
                        color: isSell ? "var(--bear)" : isHold ? "var(--muted)" : "var(--bull)",
                        border: `1px solid ${isSell ? "var(--bear-bdr)" : isHold ? "var(--border)" : "var(--bull-bdr)"}`,
                      }}>
                        {active.signal}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                      {[{ label: "VELOCITY", val: active.vel }, { label: "ACCEL", val: active.acc }, { label: "DIVERGENCE", val: active.div }].map(item => (
                        <div key={item.label}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 3 }}>{item.label}</div>
                          <div style={{
                            fontFamily: "var(--mono)", fontSize: 15, fontWeight: 500,
                            color: item.val.startsWith("+") ? "var(--bull)" : item.val.startsWith("-") ? "var(--bear)" : "var(--text)",
                          }}>{item.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score dots */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {["MOMENTUM", "SPREAD", "DIVERGE"].map((label, i) => (
                      <div key={label} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "10px 12px", borderRadius: 10,
                        background: i < active.score ? "var(--accent-bg)" : "var(--card-alt)",
                        border: `1px solid ${i < active.score ? "var(--accent-bdr)" : "var(--border)"}`,
                      }}>
                        <span style={{ fontSize: 11, color: i < active.score ? "var(--accent)" : "var(--border-mid)" }}>
                          {i < active.score ? "●" : "○"}
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 7, color: i < active.score ? "var(--accent)" : "var(--muted)", letterSpacing: "0.06em" }}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI-style description */}
                <div style={{
                  marginTop: 16, padding: "12px 16px", borderRadius: 10,
                  background: isSell ? "var(--bear-bg)" : isHold ? "var(--card-alt)" : "var(--bull-bg)",
                  borderLeft: `3px solid ${isSell ? "#fca5a5" : isHold ? "var(--border-mid)" : "#86efac"}`,
                }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.7, color: "var(--text-mid)" }}>
                    {isSell
                      ? `${active.ticker} velocity is positive but acceleration has turned negative — the upward run is losing energy. Peer divergence of ${active.div} with no supporting news reinforces the fade.`
                      : isHold
                      ? `${active.ticker} signals are mixed — velocity and acceleration are both minor. No action signal present. Monitor for divergence change.`
                      : `${active.ticker} is still falling but acceleration is turning positive — selling pressure is exhausting. Underperformance of ${active.div} vs peers without negative news suggests a potential floor.`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Ticker tabs */}
            <div style={{ display: "flex", borderTop: "1px solid var(--border)", overflowX: "auto" }}>
              {SIGNALS.map((s, i) => {
                const sel = i === tick;
                const sc = s.signal.includes("SELL");
                const ho = s.signal === "HOLD";
                return (
                  <button
                    key={s.ticker}
                    className="ticker-tab"
                    onClick={() => setTick(i)}
                    style={{
                      background: sel ? "var(--accent-bg)" : "transparent",
                      borderRight: "1px solid var(--border)",
                      borderBottom: `2px solid ${sel ? "var(--accent)" : "transparent"}`,
                      borderTop: "none", borderLeft: "none",
                    }}
                  >
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 500, fontSize: 11, color: sel ? "var(--accent)" : "var(--muted)" }}>{s.ticker}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: sc ? "var(--bear)" : ho ? "var(--muted)" : "var(--bull)" }}>{s.score}/3</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE SIGNALS ── */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 12, fontWeight: 500 }}>THE THREE SIGNALS</p>
          <h2 style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Any one is a nudge.{" "}
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 700, color: "var(--accent)" }}>
              All three is the action signal.
            </span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {[
            { num: "01", icon: "📈", title: "Price Acceleration", bull: "Velocity: −0.31 → −0.09", bear: "Velocity: +0.42 → +0.14", desc: "The second derivative of price. Still moving, but losing energy.", accent: "#2563eb" },
            { num: "02", icon: "↔",  title: "Spread Dynamics",    bull: "$0.05 → $0.02 tightening", bear: "$0.02 → $0.06 widening", desc: "Market maker conviction encoded in the spread.", accent: "#0891b2" },
            { num: "03", icon: "⊞", title: "Peer Divergence",    bull: "Stock −2.8% vs peers −0.9%", bear: "Stock +3.1% vs peers +0.8%", desc: "Unsupported by peers with no news: it's pure momentum.", accent: "#7c3aed" },
          ].map(s => (
            <div key={s.num} style={{
              background: "var(--card)", border: "1.5px solid var(--border)",
              borderRadius: 16, padding: "28px 24px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${s.accent}55, ${s.accent}11)` }} />
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", marginBottom: 16, letterSpacing: "0.1em" }}>{s.num}</div>
              <div style={{ fontSize: 22, marginBottom: 12 }}>{s.icon}</div>
              <h3 style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontFamily: "var(--fn)", fontWeight: 400, fontSize: 13, color: "var(--text-mid)", lineHeight: 1.65, marginBottom: 18 }}>{s.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "7px 11px", background: "var(--bull-bg)", borderRadius: 7, color: "var(--bull)", border: "1px solid var(--bull-bdr)" }}>▲ BUY: {s.bull}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "7px 11px", background: "var(--bear-bg)", borderRadius: 7, color: "var(--bear)", border: "1px solid var(--bear-bdr)" }}>▼ SELL: {s.bear}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "40px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 10, fontWeight: 500 }}>EVERYTHING IN ONE VIEW</p>
        <h2 style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: "clamp(24px, 3.5vw, 36px)", letterSpacing: "-0.03em", marginBottom: 36 }}>Built for intraday traders</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div style={{ fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "var(--fn)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontFamily: "var(--fn)", fontWeight: 400, fontSize: 13, color: "var(--text-mid)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "80px 24px",
        textAlign: "center",
        background: "linear-gradient(to bottom, var(--bg), var(--bg2))",
        borderTop: "1px solid var(--border)",
      }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 20, fontWeight: 500 }}>READY WHEN THE MARKET OPENS</p>
        <h2 style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: "clamp(28px, 5vw, 50px)", letterSpacing: "-0.04em", marginBottom: 8, lineHeight: 1.1 }}>
          Stop watching the numbers.
        </h2>
        <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 700, fontSize: "clamp(28px, 5vw, 50px)", letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.1, color: "var(--accent)" }}>
          Start reading the signal.
        </h2>
        <p style={{ fontFamily: "var(--fn)", fontWeight: 400, fontSize: 16, color: "var(--text-mid)", maxWidth: 460, margin: "0 auto 36px" }}>
          Open the dashboard and load your first ticker. The signals start immediately.
        </p>
        <button className="btn-primary" onClick={goToDashboard} style={{ fontSize: 15, padding: "14px 38px" }}>
          Open Dashboard →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "22px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        background: "var(--bg2)",
      }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>MomentumFade Detector · JDove Consulting · v1.2</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>Not financial advice. For informational purposes only.</span>
      </footer>
    </>
  );
}