import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { DashboardProvider, useDashboard, LoadProgress } from "../lib/context/DashboardContext";
import { C, getDirection, directionLabel, directionColor, convictionLabel } from "../lib/ui/shared";
import { useSessionLogger } from "../lib/hooks/useSessionLogger";
import { withAuth } from "../lib/auth/withAuth";
import { useAuth } from "../lib/auth/AuthContext";
import { apiFetch } from "../lib/auth/apiFetch";

import StockOverviewCard  from "../components/cards/StockOverviewCard";
import MomentumCard       from "../components/cards/MomentumCard";
import BidAskCard         from "../components/cards/BidAskCard";
import PeerIndexCard      from "../components/cards/PeerIndexCard";
import NewsCard           from "../components/cards/NewsCard";
import AlertCard          from "../components/cards/AlertCard";
import AIInsightCard      from "../components/cards/AIInsightCard";
import ProfileManagerCard from "../components/cards/ProfileManagerCard";
import TradeJournalCard   from "../components/cards/TradeJournalCard";
import ScannerCard        from "../components/cards/ScannerCard";
import BacktestCard       from "../components/cards/BacktestCard";
import YahooDataCard      from "../components/cards/YahooDataCard";

const NAV = [
  { icon:"⊞", label:"Dashboard" },
  { icon:"📡", label:"Scanner"   },
  { icon:"⚡", label:"Signals"   },
  { icon:"📈", label:"Charts"    },
  { icon:"📓", label:"Journal"   },
  { icon:"🔬", label:"Backtest"  },
  { icon:"🟡", label:"Yahoo"     },
  { icon:"⚙",  label:"Settings"  },
];

function NavItem({ icon, label, active, onClick, mobile=false }: any) {
  return (
    <button onClick={onClick} title={label} style={{
      display:"flex", flexDirection:mobile?"row":"column", alignItems:"center",
      gap:mobile?8:4, padding:mobile?"12px 16px":"11px 0",
      width:mobile?"100%":"100%", border:"none", cursor:"pointer",
      background:active?(mobile?"#2962FF18":"#2962FF12"):"transparent",
      borderLeft:mobile?"none":`3px solid ${active?C.accent:"transparent"}`,
      borderBottom:mobile?`2px solid ${active?C.accent:"transparent"}`:"none",
      transition:"all 0.15s",
    }}>
      <span style={{fontSize:mobile?18:17, color:active?C.accent:C.textMuted}}>{icon}</span>
      <span style={{fontSize:mobile?12:8, color:active?C.accent:C.textMuted, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:active?700:400}}>{label}</span>
    </button>
  );
}

function LiveBar() {
  const { activeSymbol, allPrices, loading } = useDashboard();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [time, setTime] = useState("");
  useEffect(()=>{
    const f=()=>new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setTime(f()); const id=setInterval(()=>setTime(f()),1000); return ()=>clearInterval(id);
  },[]);
  const prices=allPrices[activeSymbol]||[]; const last=prices[prices.length-1]; const first=prices[0];
  const change=last&&first?last.price-first.price:null; const pct=first&&change!=null?(change/first.price)*100:null; const up=(change??0)>=0;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div style={{height:50,background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 18px",justifyContent:"space-between",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:13,fontWeight:700,color:C.text,letterSpacing:"-0.02em"}}>Momentum Fade</span>
        {last&&change!=null&&<div style={{display:"flex",alignItems:"center",gap:8,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 12px"}}>
          <span style={{fontWeight:700,fontFamily:"monospace",fontSize:12,color:C.text}}>{activeSymbol}</span>
          <span style={{fontFamily:"monospace",fontSize:13,color:up?C.bull:C.bear,fontWeight:700}}>${last.price.toFixed(2)}</span>
          <span style={{fontSize:11,color:up?C.bull:C.bear}}>{up?"▲":"▼"}{Math.abs(pct??0).toFixed(2)}%</span>
        </div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {loading&&<span style={{fontSize:10,color:C.textMuted}}>…</span>}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:C.bull,display:"inline-block",animation:"pulse 2s infinite"}} />
          <span style={{fontSize:10,color:C.bull,fontFamily:"monospace",fontWeight:700}}>LIVE</span>
        </div>
        <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace",background:C.surfaceAlt,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`}}>{time}</span>
        {user && (
          <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:6,borderLeft:`1px solid ${C.border}`}}>
            <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              style={{fontFamily:"monospace",fontSize:10,color:C.textMuted,background:"transparent",
                border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",
                transition:"border-color 0.15s, color 0.15s"}}
              onMouseEnter={e=>{(e.target as HTMLButtonElement).style.borderColor=C.accent;(e.target as HTMLButtonElement).style.color=C.accent;}}
              onMouseLeave={e=>{(e.target as HTMLButtonElement).style.borderColor=C.border;(e.target as HTMLButtonElement).style.color=C.textMuted;}}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignalsTab() {
  const { signals } = useDashboard();
  const [filter,  setFilter]  = useState("ALL");
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const filtered = signals
    .filter((s:any)=>filter==="ALL"||s.signal_type===filter)
    .filter((s:any)=>s.symbol.includes(search.toUpperCase()))
    .sort((a:any,b:any)=>{
      const av=a[sortCol],bv=b[sortCol];
      if(typeof av==="string") return sortAsc?av.localeCompare(bv):bv.localeCompare(av);
      return sortAsc?Number(av)-Number(bv):Number(bv)-Number(av);
    });
  const col=(k:string,l:string)=>(
    <th key={k} onClick={()=>{if(sortCol===k)setSortAsc(a=>!a);else{setSortCol(k);setSortAsc(false);} }} style={{padding:"7px 12px",textAlign:"left",fontSize:9,fontWeight:700,color:sortCol===k?C.accent:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontFamily:"monospace",whiteSpace:"nowrap"}}>
      {l}{sortCol===k&&<span style={{marginLeft:3}}>{sortAsc?"↑":"↓"}</span>}
    </th>
  );
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:14}}>
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",flex:1}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`,flexShrink:0,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:C.text}}>Signals</span>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:19,height:19,borderRadius:"50%",background:C.accent,fontSize:10,color:"#fff",fontWeight:700}}>{filtered.length}</span>
            {["ALL","BUY","SELL","HOLD"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"2px 9px",borderRadius:20,fontSize:10,cursor:"pointer",fontFamily:"monospace",fontWeight:700,border:`1px solid ${filter===f?C.accent:C.border}`,background:filter===f?C.accent+"15":"transparent",color:filter===f?C.accent:C.textMuted}}>{f}</button>)}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter…" style={{padding:"4px 10px",borderRadius:8,fontSize:11,border:`1px solid ${C.border}`,background:C.surfaceAlt,color:C.text,outline:"none",fontFamily:"monospace",width:130}} />
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{position:"sticky",top:0,background:C.surfaceAlt,zIndex:1}}><tr>
              {col("symbol","Symbol")}{col("signal_type","Direction")}{col("velocity","Velocity")}{col("acceleration","Accel")}{col("spread","Spread")}{col("divergence","Div")}{col("score","Score")}{col("strength","Conv")}{col("created_at","Time")}
            </tr></thead>
            <tbody>
              {!filtered.length&&<tr><td colSpan={9} style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12}}>No signals yet…</td></tr>}
              {filtered.map((s:any,i:number)=>{
                const score=Number(s.score??0),vel=Number(s.velocity??0),accel=Number(s.acceleration??0);
                const dir=getDirection(vel,accel);
                return <tr key={s.id} style={{cursor:"default"}}>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontWeight:700,color:C.text,borderBottom:`1px solid ${C.borderLight}`}}>{s.symbol}</td>
                  <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.borderLight}`}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,fontFamily:"monospace",color:directionColor(dir),background:dir==="SELL_FADE"?C.bearLight:dir==="BUY_EXHAUSTION"?C.bullLight:"#F3F4F6"}}>{directionLabel(dir)}</span></td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,borderBottom:`1px solid ${C.borderLight}`,color:vel>=0?C.bull:C.bear}}>{vel>=0?"+":""}{vel.toFixed(4)}</td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,borderBottom:`1px solid ${C.borderLight}`,color:accel>=0?C.bull:C.bear}}>{accel>=0?"+":""}{accel.toFixed(4)}</td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,borderBottom:`1px solid ${C.borderLight}`,color:C.textSub}}>{s.spread!=null?`$${Number(s.spread).toFixed(4)}`:"—"}</td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,borderBottom:`1px solid ${C.borderLight}`,color:Number(s.divergence??0)>=0?C.bull:C.bear}}>{s.divergence!=null?(Number(s.divergence)>=0?"+":"")+Number(s.divergence).toFixed(4):"—"}</td>
                  <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.borderLight}`}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:42,height:4,background:C.borderLight,borderRadius:2}}><div style={{height:"100%",borderRadius:2,width:`${Math.min(100,score*33.3)}%`,background:score>=3?C.bull:score>=2?C.warn:C.bear}} /></div><span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.text}}>{score}</span></div></td>
                  <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.borderLight}`}}><span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:s.strength==="ACTION"||s.strength==="STRONG"?C.bull:C.warn}}>● {s.strength??"—"}</span></td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:10,color:C.textMuted,borderBottom:`1px solid ${C.borderLight}`}}>{new Date(s.created_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ progress }: { progress: LoadProgress }) {
  const pct     = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  const eta     = progress.done > 0 && progress.done < progress.total
    ? Math.max(0, Math.round((elapsed / progress.done) * (progress.total - progress.done)))
    : null;

  const phaseLabel: Record<string, string> = {
    profiles: "Loading watchlist…",
    prices:   "Fetching price history",
    signals:  "Loading signals…",
    peers:    "Fetching peer data",
    done:     "Ready",
  };

  const steps = [
    { key: "profiles", label: "Profiles"      },
    { key: "prices",   label: "Price History" },
    { key: "signals",  label: "Signals"        },
    { key: "peers",    label: "Peer Data"      },
  ];
  const phaseOrder = ["profiles","prices","signals","peers","done"];
  const currentPhaseIdx = phaseOrder.indexOf(progress.phase);

  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
      <div style={{
        width:"100%",maxWidth:440,padding:"36px 40px",
        background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,
        display:"flex",flexDirection:"column",gap:20,
        boxShadow:"0 4px 32px rgba(41,98,255,0.06)",
        margin:"0 20px",
      }}>
        {/* Logo + title */}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#2962FF,#6B48FF)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"#fff",fontSize:17,fontWeight:900}}>M</span>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>Momentum Fade Detector</div>
            <div style={{fontSize:11,color:C.textMuted}}>Connecting to live data…</div>
          </div>
        </div>

        {/* Main progress bar */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:C.textSub,fontWeight:600}}>
              {phaseLabel[progress.phase] || "Loading…"}
              {progress.current && progress.phase !== "profiles" && progress.phase !== "done" && (
                <span style={{fontFamily:"monospace",color:C.accent,marginLeft:6,fontWeight:700}}>
                  {progress.current}
                </span>
              )}
            </span>
            <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:C.accent}}>{pct}%</span>
          </div>
          <div style={{height:8,background:C.borderLight,borderRadius:4,overflow:"hidden"}}>
            <div style={{
              height:"100%",borderRadius:4,
              background:`linear-gradient(90deg, ${C.accent}, #6B48FF)`,
              width:`${pct}%`,
              transition:"width 0.4s ease",
              position:"relative",
              overflow:"hidden",
            }}>
              {/* Shimmer sweep */}
              <div style={{
                position:"absolute",top:0,left:0,right:0,bottom:0,
                background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.35) 50%,transparent 100%)",
                animation:"shimmer 1.4s infinite",
              }} />
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
            <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>
              {progress.done} / {progress.total > 0 ? progress.total : "…"} items
            </span>
            {eta !== null && (
              <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>
                ETA ~{eta}s
              </span>
            )}
            {elapsed > 1 && eta === null && progress.phase !== "done" && (
              <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>{Math.round(elapsed)}s elapsed</span>
            )}
          </div>
        </div>

        {/* Step indicators */}
        <div style={{display:"flex",gap:0}}>
          {steps.map((step, i) => {
            const stepIdx     = phaseOrder.indexOf(step.key);
            const isDone      = currentPhaseIdx > stepIdx;
            const isCurrent   = currentPhaseIdx === stepIdx;
            const isPending   = currentPhaseIdx < stepIdx;
            return (
              <div key={step.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,position:"relative"}}>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div style={{
                    position:"absolute",top:11,left:"50%",width:"100%",height:2,
                    background: isDone ? C.accent : C.borderLight,
                    transition:"background 0.3s",zIndex:0,
                  }} />
                )}
                {/* Circle */}
                <div style={{
                  width:22,height:22,borderRadius:"50%",zIndex:1,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,
                  border:`2px solid ${isDone||isCurrent ? C.accent : C.border}`,
                  background: isDone ? C.accent : isCurrent ? C.accent+"18" : C.surface,
                  color: isDone ? "#fff" : isCurrent ? C.accent : C.textMuted,
                  transition:"all 0.3s",
                }}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span style={{
                  fontSize:9,fontFamily:"monospace",textAlign:"center",
                  color: isDone ? C.accent : isCurrent ? C.text : C.textMuted,
                  fontWeight: isCurrent ? 700 : 400,
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tip */}
        <div style={{padding:"10px 14px",background:C.surfaceAlt,borderRadius:8,border:`1px solid ${C.borderLight}`}}>
          <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace",lineHeight:1.5}}>
            💡 Selection is remembered between sessions. Data loads faster after the first visit.
          </span>
        </div>
      </div>
    </div>
  );
}

function useMarketData() {
  const [wsStatus,  setWsStatus]  = useState<"connecting"|"open"|"polling"|"error">("connecting");
  const [lastPoll,  setLastPoll]  = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const scanning = useRef(false);

  useEffect(() => {
    // ── 1. Open WebSocket FIRST — real-time ticks during market hours ──────
    const startWs = () => {
      // Finnhub WS for US stocks
      apiFetch("/api/ws-market")
        .then(r => r.json())
        .then(d => {
          if (d.wsState === "open" || d.wsState === "connecting") {
            setWsStatus("open");
            console.log("[dashboard] Finnhub WebSocket open — US real-time");
          } else {
            setWsStatus("polling");
          }
        })
        .catch(() => setWsStatus("polling"));

      // Twelve Data WS for TSX stocks (fires silently — no-key/no-tsx just returns info)
      apiFetch("/api/ws-twelve")
        .then(r => r.json())
        .then(d => {
          if (d.wsState === "open" || d.wsState === "connecting") {
            console.log("[dashboard] Twelve Data WebSocket open — TSX real-time");
          } else if (d.status === "no-key") {
            console.info("[dashboard] Twelve Data: no API key — TSX uses REST fallback");
          }
        })
        .catch(() => {});
    };
    startWs();

    // ── 2. REST scanner as fallback — runs every 30s regardless ───────────
    // Covers: market closed, WebSocket disconnected, peer symbols not in WS
    const poll = async () => {
      if (scanning.current) return;
      scanning.current = true;
      try {
        const r = await apiFetch("/api/run-scanner");
        const d = await r.json();
        if (!r.ok) {
          setLastError(d.error || "Scanner error");
        } else {
          setLastError("");
          setLastPoll(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
          setPollCount(n => n + 1);
        }
      } catch (e: any) {
        setLastError(e.message);
      } finally {
        scanning.current = false;
      }
    };

    // Delay first REST poll by 3s to let WS connect first
    const firstPoll = setTimeout(poll, 3000);
    const pollInterval = setInterval(poll, 30_000);

    return () => {
      clearTimeout(firstPoll);
      clearInterval(pollInterval);
    };
  }, []);

  return { wsStatus, lastPoll, pollCount, lastError };
}

function DataStatusBar({ wsStatus, lastPoll, pollCount, lastError }: { wsStatus: string; lastPoll: string; pollCount: number; lastError: string }) {
  return (
    <div style={{padding:"3px 18px",background:C.surfaceAlt,borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:10,flexShrink:0,minHeight:28,flexWrap:"wrap"}}>
      {wsStatus==="open"
        ? <><span style={{width:6,height:6,borderRadius:"50%",background:C.bull,display:"inline-block",animation:"pulse 2s infinite"}} /><span style={{fontSize:10,color:C.bull,fontFamily:"monospace",fontWeight:700}}>WebSocket · tick-by-tick</span></>
        : <><span style={{width:6,height:6,borderRadius:"50%",background:C.warn,display:"inline-block"}} /><span style={{fontSize:10,color:C.warn,fontFamily:"monospace",fontWeight:700}}>REST Polling · 30s</span></>}
      {lastPoll && <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>last: {lastPoll} · {pollCount} polls</span>}
      {lastError && <span style={{fontSize:10,color:C.bear,fontFamily:"monospace",background:C.bearLight,padding:"1px 6px",borderRadius:4}}>⚠ {lastError}</span>}
      <span style={{marginLeft:"auto",fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>
        {!lastError && pollCount===0 ? "Starting first scan…" : ""}
      </span>
    </div>
  );
}

function MainContent({ activeTab }: { activeTab: string }) {
  const { loading, loadProgress, activeSymbol, signals, allPrices } = useDashboard();
  useSessionLogger(activeSymbol, signals, allPrices);
  const { wsStatus, lastPoll, pollCount, lastError } = useMarketData();
  if (loading) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DataStatusBar wsStatus={wsStatus} lastPoll={lastPoll} pollCount={pollCount} lastError={lastError} />
      <LoadingScreen progress={loadProgress} />
    </div>
  );
  const twoCol = (a:React.ReactNode, b:React.ReactNode) => (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:12}}>{a}{b}</div>
  );
  const statusBar = <DataStatusBar wsStatus={wsStatus} lastPoll={lastPoll} pollCount={pollCount} lastError={lastError} />;
  if (activeTab==="Dashboard") return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {statusBar}
      <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <StockOverviewCard />
      {twoCol(<MomentumCard />, <BidAskCard />)}
      {twoCol(<PeerIndexCard />, <NewsCard />)}
      {twoCol(<AlertCard />, <AIInsightCard />)}
      </div>
    </div>
  );
  if (activeTab==="Scanner") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <ScannerCard />
      {twoCol(<AlertCard />, <AIInsightCard />)}
    </div>
  );
  if (activeTab==="Signals") return <SignalsTab />;
  if (activeTab==="Charts") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      {twoCol(<MomentumCard />, <BidAskCard />)}
      <PeerIndexCard />
    </div>
  );
  if (activeTab==="Journal") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <TradeJournalCard />
    </div>
  );
  if (activeTab==="Backtest") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <BacktestCard />
    </div>
  );
  if (activeTab==="Yahoo") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <YahooDataCard />
    </div>
  );
  if (activeTab==="Settings") return (
    <div style={{flex:1,overflow:"auto",padding:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:12,alignContent:"start"}}>
      <ProfileManagerCard />
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px"}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:12}}>Data Sources</div>
          {[
            {icon:"🟢",label:"Supabase",         detail:"Realtime prices, signals, profiles, journals"},
            {icon:"🟢",label:"Finnhub WS",        detail:"Live WebSocket — US stocks real-time (L1)"},
            {icon:"🟢",label:"Finnhub REST",      detail:"Stock profiles, news, peer suggestions"},
            {icon:"🟡",label:"Twelve Data WS",    detail:"TSX real-time WebSocket — requires TWELVE_DATA_API_KEY"},
            {icon:"🟢",label:"Yahoo Finance",     detail:"Alternate data source tab — no key needed"},
            {icon:"🟢",label:"Claude AI",         detail:"Signal interpretation, news sentiment, anomalies"},
            {icon:"🟡",label:"Resend",            detail:"Email push alerts (requires API key)"},
          ].map(({icon,label,detail})=>(
            <div key={label} style={{display:"flex",gap:10,marginBottom:8}}>
              <span style={{fontSize:11}}>{icon}</span>
              <div><div style={{fontSize:11,fontWeight:700,color:C.text}}>{label}</div><div style={{fontSize:10,color:C.textMuted}}>{detail}</div></div>
            </div>
          ))}
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px"}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:8}}>WebSocket</div>
          <div style={{fontSize:11,color:C.textSub,marginBottom:10,lineHeight:1.5}}>Live Finnhub WebSocket auto-starts on dashboard load. Reconnects automatically.</div>
          <button onClick={()=>apiFetch("/api/ws-market")} style={{padding:"6px 16px",borderRadius:8,fontSize:11,cursor:"pointer",background:C.accent,color:"#fff",border:"none",fontWeight:700}}>Restart WebSocket</button>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px"}}>
          <div style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:8}}>Required ENV Variables</div>
          {["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","MARKET_API_KEY (Finnhub)","ANTHROPIC_API_KEY","TWELVE_DATA_API_KEY (optional — TSX real-time)","MARKET_PROVIDER (optional — finnhub|yahoo|twelve|hybrid)","RESEND_API_KEY (optional)"].map(k=>(
            <div key={k} style={{padding:"3px 0",fontSize:10,fontFamily:"monospace",color:k.includes("optional")?C.textMuted:C.text}}>{k}</div>
          ))}
        </div>
      </div>
    </div>
  );
  return null;
}

function DashboardPage() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "Dashboard";
    return localStorage.getItem("mfd_activeTab") || "Dashboard";
  });
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") localStorage.setItem("mfd_activeTab", tab);
  };
  const [isMobile,  setIsMobile]  = useState(false);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check(); window.addEventListener("resize",check); return ()=>window.removeEventListener("resize",check);
  },[]);

  return (
    <DashboardProvider>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",height:"100vh",background:C.bg,color:C.text,overflow:"hidden",fontFamily:"'IBM Plex Sans','Trebuchet MS',sans-serif"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          ::-webkit-scrollbar{width:4px;height:4px}
          ::-webkit-scrollbar-thumb{background:#E2E6F0;border-radius:4px}
          ::-webkit-scrollbar-track{background:transparent}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
          @keyframes fadeSlide{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
          @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
          @keyframes chartShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        `}</style>

        {/* Sidebar — desktop */}
        {!isMobile && (
          <div style={{width:62,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:14,flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#2962FF,#6B48FF)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18}}>
              <span style={{color:"#fff",fontSize:15,fontWeight:900}}>M</span>
            </div>
            {NAV.map(n=><NavItem key={n.label} {...n} active={activeTab===n.label} onClick={()=>handleTabChange(n.label)} />)}
          </div>
        )}

        {/* Main column */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <LiveBar />
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <MainContent activeTab={activeTab} />
          </div>

          {/* Bottom nav — mobile */}
          {isMobile && (
            <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",flexShrink:0,overflowX:"auto"}}>
              {NAV.map(n=><NavItem key={n.label} {...n} active={activeTab===n.label} onClick={()=>handleTabChange(n.label)} mobile />)}
            </div>
          )}
        </div>
      </div>
    </DashboardProvider>
  );
}

export default withAuth(DashboardPage);