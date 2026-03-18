import { useState, useEffect } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection } from "../../lib/ui/shared";
import { getTrades, openTrade, closeTrade, deleteTrade, getJournalStats, TradeEntry } from "../../lib/db/journalRepository";

type Tab = "open"|"closed"|"stats";

export default function TradeJournalCard() {
  const { activeSymbol, allPrices, signals } = useDashboard();
  const [tab,      setTab]     = useState<Tab>("open");
  const [trades,   setTrades]  = useState<TradeEntry[]>([]);
  const [stats,    setStats]   = useState({ totalPnl:0, wins:0, losses:0, winRate:0, totalTrades:0 });
  const [loading,  setLoading] = useState(false);
  const [showForm, setShowForm]= useState(false);
  const [closing,  setClosing] = useState<string|null>(null);

  // New trade form
  const [direction,   setDirection]   = useState<"BUY"|"SELL">("BUY");
  const [entryPrice,  setEntryPrice]  = useState("");
  const [quantity,    setQuantity]    = useState("1");
  const [notes,       setNotes]       = useState("");
  const [exitPrice,   setExitPrice]   = useState("");
  const [saving,      setSaving]      = useState(false);

  const prices    = allPrices[activeSymbol] || [];
  const lastPrice = prices[prices.length-1]?.price;
  const latestSig = signals.find(s=>s.symbol===activeSymbol);

  const load = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([getTrades(undefined, 100), getJournalStats()]);
      setTrades(t); setStats(s);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = async () => {
    if (!entryPrice) return;
    setSaving(true);
    try {
      const vel  = Number(latestSig?.velocity??0);
      const accel= Number(latestSig?.acceleration??0);
      await openTrade({
        symbol:       activeSymbol,
        direction,
        entry_price:  parseFloat(entryPrice),
        quantity:     parseFloat(quantity)||1,
        notes:        notes||undefined,
        signal_score: latestSig?.score,
        signal_state: latestSig ? { velocity:vel, acceleration:accel, score:latestSig.score, strength:latestSig.strength } : undefined,
      });
      setEntryPrice(""); setNotes(""); setShowForm(false);
      await load();
    } catch {} finally { setSaving(false); }
  };

  const handleClose = async (id:string) => {
    if (!exitPrice) return;
    setSaving(true);
    try { await closeTrade(id, parseFloat(exitPrice)); setClosing(null); setExitPrice(""); await load(); }
    catch {} finally { setSaving(false); }
  };

  const openTrades  = trades.filter(t=>t.status==="OPEN");
  const closedTrades= trades.filter(t=>t.status==="CLOSED");

  return (
    <Card title="Trade Journal" subtitle="All symbols">
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10,flex:1,overflow:"hidden"}}>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,flexShrink:0,borderBottom:`1px solid ${C.borderLight}`,paddingBottom:8}}>
          {(["open","closed","stats"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"3px 12px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"monospace",fontWeight:700,border:`1px solid ${tab===t?C.accent:C.border}`,background:tab===t?C.accent+"15":"transparent",color:tab===t?C.accent:C.textSub,textTransform:"uppercase"}}>
              {t==="open"?`Open (${openTrades.length})`:t==="closed"?`Closed (${closedTrades.length})`:"Stats"}
            </button>
          ))}
          <div style={{flex:1}} />
          <button onClick={()=>setShowForm(s=>!s)} style={{padding:"3px 12px",borderRadius:6,fontSize:10,cursor:"pointer",background:showForm?C.surfaceAlt:C.accent,color:showForm?C.textSub:"#fff",border:`1px solid ${showForm?C.border:C.accent}`,fontWeight:700}}>
            {showForm?"Cancel":"+ Log Trade"}
          </button>
        </div>

        {/* New trade form */}
        {showForm && (
          <div style={{padding:"12px",borderRadius:8,background:C.surfaceAlt,border:`1px solid ${C.borderLight}`,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:6}}>
              {["BUY","SELL"].map(d=><button key={d} onClick={()=>setDirection(d as "BUY"|"SELL")} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"monospace",fontWeight:700,border:`1px solid ${direction===d?(d==="BUY"?C.bull:C.bear):C.border}`,background:direction===d?(d==="BUY"?C.bullLight:C.bearLight):"transparent",color:direction===d?(d==="BUY"?C.bull:C.bear):C.textSub}}>{d}</button>)}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input value={entryPrice} onChange={e=>setEntryPrice(e.target.value)} placeholder={lastPrice?`Entry price (~$${lastPrice.toFixed(2)})`:"Entry price"} style={{flex:2,padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontFamily:"monospace",background:"#fff",color:C.text,outline:"none"}} />
              <input value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="Qty" style={{flex:1,padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontFamily:"monospace",background:"#fff",color:C.text,outline:"none"}} />
            </div>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)" style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:"#fff",color:C.text,outline:"none"}} />
            {latestSig&&<div style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>Signal at entry: Score {latestSig.score}/3 · {latestSig.strength} · {activeSymbol}</div>}
            <button onClick={handleOpen} disabled={saving||!entryPrice} style={{padding:"7px 0",borderRadius:8,fontSize:12,cursor:"pointer",background:C.accent,color:"#fff",border:"none",fontWeight:700}}>{saving?"Saving…":"Log Trade"}</button>
          </div>
        )}

        {/* Tab content */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {tab==="stats" ? (
            <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 0"}}>
              {[
                {label:"Total P&L",  value:`${stats.totalPnl>=0?"+":""}$${stats.totalPnl.toFixed(2)}`, color:stats.totalPnl>=0?C.bull:C.bear},
                {label:"Win Rate",   value:`${stats.winRate}%`,  color:C.accent},
                {label:"Total Trades",value:stats.totalTrades,   color:C.text},
                {label:"Wins",       value:stats.wins,           color:C.bull},
                {label:"Losses",     value:stats.losses,         color:C.bear},
              ].map(({label,value,color})=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.surfaceAlt,borderRadius:8,border:`1px solid ${C.borderLight}`}}>
                  <span style={{fontSize:12,color:C.textSub}}>{label}</span>
                  <span style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color}}>{value}</span>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMuted,fontSize:11}}>Loading…</div>
          ) : (tab==="open"?openTrades:closedTrades).length===0 ? (
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:C.textMuted,padding:16}}>
              <div style={{fontSize:20}}>{tab==="open"?"📋":"📁"}</div>
              <div style={{fontSize:11}}>No {tab} trades</div>
            </div>
          ) : (tab==="open"?openTrades:closedTrades).map(t=>(
            <div key={t.id} style={{padding:"10px 12px",borderRadius:8,background:C.surfaceAlt,border:`1px solid ${C.borderLight}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:C.text}}>{t.symbol}</span>
                  <span style={{padding:"1px 8px",borderRadius:10,fontSize:10,fontWeight:700,fontFamily:"monospace",color:t.direction==="BUY"?C.bull:C.bear,background:t.direction==="BUY"?C.bullLight:C.bearLight}}>{t.direction}</span>
                  <span style={{fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>×{t.quantity}</span>
                </div>
                {t.pnl!=null&&<span style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:t.pnl>=0?C.bull:C.bear}}>{t.pnl>=0?"+":""}${t.pnl.toFixed(2)}</span>}
              </div>
              <div style={{fontSize:11,color:C.textSub,fontFamily:"monospace"}}>
                Entry ${Number(t.entry_price).toFixed(2)}{t.exit_price!=null?` → Exit $${Number(t.exit_price).toFixed(2)}`:""}
                {" · "}{new Date(t.entry_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              </div>
              {t.notes&&<div style={{fontSize:10,color:C.textMuted,marginTop:3}}>{t.notes}</div>}
              {t.signal_score!=null&&<div style={{fontSize:10,color:C.textMuted,fontFamily:"monospace",marginTop:3}}>Signal score at entry: {t.signal_score}/3</div>}
              {t.status==="OPEN"&&(
                closing===t.id
                  ? <div style={{display:"flex",gap:6,marginTop:8}}>
                      <input value={exitPrice} onChange={e=>setExitPrice(e.target.value)} placeholder="Exit price" style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontFamily:"monospace",background:"#fff",color:C.text,outline:"none"}} />
                      <button onClick={()=>handleClose(t.id)} disabled={saving||!exitPrice} style={{padding:"5px 12px",borderRadius:6,fontSize:11,cursor:"pointer",background:C.bull,color:"#fff",border:"none",fontWeight:700}}>Close</button>
                      <button onClick={()=>setClosing(null)} style={{padding:"5px 10px",borderRadius:6,fontSize:11,cursor:"pointer",border:`1px solid ${C.border}`,background:"transparent",color:C.textSub}}>✕</button>
                    </div>
                  : <div style={{display:"flex",gap:6,marginTop:8}}>
                      <button onClick={()=>{setClosing(t.id);setExitPrice(lastPrice?lastPrice.toFixed(2):"");}} style={{padding:"4px 12px",borderRadius:6,fontSize:10,cursor:"pointer",background:C.bull,color:"#fff",border:"none",fontWeight:700}}>Close Trade</button>
                      <button onClick={()=>deleteTrade(t.id).then(load)} style={{padding:"4px 10px",borderRadius:6,fontSize:10,cursor:"pointer",border:`1px solid ${C.bear}40`,background:C.bearLight,color:C.bear}}>Delete</button>
                    </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
