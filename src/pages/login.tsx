import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../lib/auth/AuthContext";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode]       = useState<Mode>("signin");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [info, setInfo]       = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    if (mode === "signup") {
      const { error, session } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else if (session) {
        // Email confirmation disabled — session returned immediately, go to dashboard
        router.push("/dashboard");
      } else {
        // Fallback: session not returned (shouldn't happen with confirmation off,
        // but handle gracefully by switching to sign-in)
        setInfo("Account created! Please sign in.");
        setMode("signin");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    }

    setBusy(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:         #f7f5f2;
          --bg2:        #f0ece6;
          --card:       #ffffff;
          --border:     #e2ddd6;
          --border-mid: #cec8be;
          --text:       #18150f;
          --text-mid:   #4a4438;
          --muted:      #9a9086;
          --accent:     #2563eb;
          --accent-bg:  #eff4ff;
          --accent-bdr: #bfcffd;
          --bear:       #991b1b;
          --bear-bg:    #fff5f5;
          --bear-bdr:   #fecaca;
          --bull-bg:    #f0fdf4;
          --bull-bdr:   #bbf7d0;
          --bull:       #166534;
          --fn:         'Plus Jakarta Sans', sans-serif;
          --serif:      'Playfair Display', serif;
          --mono:       'JetBrains Mono', monospace;
        }
        html, body {
          background: var(--bg); color: var(--text);
          font-family: var(--fn); min-height: 100vh;
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; } 50% { opacity:0.35; }
        }
        .dot-bg {
          background-color: var(--bg);
          background-image: radial-gradient(#cec8be 1px, transparent 1px);
          background-size: 28px 28px;
        }
        input {
          width: 100%; font-family: var(--fn); font-size: 14px;
          padding: 11px 14px; border: 1.5px solid var(--border-mid);
          border-radius: 10px; background: var(--card); color: var(--text);
          outline: none; transition: border-color 0.15s;
        }
        input:focus { border-color: var(--accent); }
        input::placeholder { color: var(--muted); }
        .btn-primary {
          width: 100%; font-family: var(--fn); font-weight: 700; font-size: 14px;
          letter-spacing: 0.02em; background: var(--accent); color: #fff;
          border: none; border-radius: 10px; padding: 12px 24px; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 58, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 28px",
        background: "rgba(247,245,242,0.88)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
             onClick={() => router.push("/")}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          background: "var(--bull-bg)", border: "1px solid var(--bull-bdr)",
          borderRadius: 20, padding: "5px 12px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a",
            display: "inline-block", animation: "pulse-dot 1.8s infinite" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--bull)",
            fontWeight: 500, letterSpacing: "0.06em" }}>LIVE</span>
        </div>
      </nav>

      {/* Main */}
      <main className="dot-bg" style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "80px 24px 40px",
      }}>
        <div style={{
          width: "100%", maxWidth: 420,
          background: "var(--card)", border: "1.5px solid var(--border)",
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 4px 32px #2563eb0a, 0 1px 6px #0000000a",
          animation: "fadeUp 0.55s ease both",
        }}>
          {/* Card header */}
          <div style={{
            padding: "20px 28px 18px",
            borderBottom: "1px solid var(--border)",
            background: "#faf9f7",
          }}>
            <p style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--accent)",
              letterSpacing: "0.12em", fontWeight: 500, marginBottom: 6 }}>
              {mode === "signin" ? "WELCOME BACK" : "CREATE ACCOUNT"}
            </p>
            <h1 style={{ fontFamily: "var(--fn)", fontWeight: 800, fontSize: 22,
              letterSpacing: "-0.03em" }}>
              {mode === "signin" ? "Sign in" : "Get started"}
            </h1>
            <p style={{ fontFamily: "var(--fn)", fontSize: 13, color: "var(--text-mid)",
              marginTop: 4, lineHeight: 1.5 }}>
              {mode === "signin"
                ? "Enter your credentials to access the dashboard."
                : "Create your account to start detecting momentum fades."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: "24px 28px", display: "flex",
            flexDirection: "column", gap: 14 }}>

            {info && (
              <div style={{
                padding: "10px 14px", borderRadius: 9,
                background: "var(--bull-bg)", border: "1px solid var(--bull-bdr)",
                fontFamily: "var(--fn)", fontSize: 13, color: "var(--bull)", lineHeight: 1.5,
              }}>{info}</div>
            )}

            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 9,
                background: "var(--bear-bg)", border: "1px solid var(--bear-bdr)",
                fontFamily: "var(--fn)", fontSize: 13, color: "var(--bear)", lineHeight: 1.5,
              }}>{error}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: "var(--fn)", fontSize: 12, fontWeight: 600,
                color: "var(--text-mid)", letterSpacing: "0.01em" }}>Email</label>
              <input
                type="email" placeholder="you@example.com" required
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontFamily: "var(--fn)", fontSize: 12, fontWeight: 600,
                color: "var(--text-mid)", letterSpacing: "0.01em" }}>Password</label>
              <input
                type="password"
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
              {busy
                ? (mode === "signin" ? "Signing in…" : "Creating account…")
                : (mode === "signin" ? "Sign in →" : "Create account →")}
            </button>

            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <span style={{ fontFamily: "var(--fn)", fontSize: 13, color: "var(--text-mid)" }}>
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                type="button"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
                style={{ fontFamily: "var(--fn)", fontSize: 13, fontWeight: 700,
                  color: "var(--accent)", background: "none", border: "none",
                  cursor: "pointer", padding: 0 }}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        borderTop: "1px solid var(--border)", padding: "12px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(240,236,230,0.92)", backdropFilter: "blur(10px)",
      }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>MomentumFade · v1.2</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>Not financial advice.</span>
      </footer>
    </>
  );
}
