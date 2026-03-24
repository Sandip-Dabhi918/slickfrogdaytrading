import { useState, useEffect } from "react";
import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, directionLabel, directionColor, Skeleton } from "../../lib/ui/shared";
import { supabase } from "../../lib/db/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

interface Snapshot {
  id: string; symbol: string; velocity: number; acceleration: number;
  spread: number; divergence: number; score: number; strength: string;
  price: number; volume: number; signal_type: string; snapshot_at: string;
}

interface BacktestResult {
  signal: string; direction: string; priceAtSignal: number;
  priceAfter5: number|null; priceAfter10: number|null;
  pnl5: number|null; pnl10: number|null; correct5: boolean|null;
}

export default function BacktestCard() {
  const { activeSymbol } = useDashboard();
  const [snapshots,  setSnapshots]  = useState<Snapshot[]>([]);
  const [results,    setResults]    = useState<BacktestResult[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [period,     setPeriod]     = useState<"today"|"week"|"month">("today");
  const [minScore,   setMinScore]   = useState(1);
  const [accuracy,   setAccuracy]   = useState<number|null>(null);
  const [avgPnl,     setAvgPnl]     = useState<number|null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const since = period==="today"
        ? new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString()
        : period==="week"
        ? new Date(now.getTime()-7*86400000).toISOString()
        : new Date(now.getTime()-30*86400000).toISOString();

      const { data } = await supabase
        .from("session_snapshots")
        .select("*")
        .eq("symbol", activeSymbol)
        .gte("snapshot_at", since)
        .order("snapshot_at", { ascending: true })
        .limit(500);

      const snaps = (data||[]) as Snapshot[];
      setSnapshots(snaps);

      // Backtest: for each signal snapshot, look ahead 5 and 10 ticks
      const significant = snaps.filter(s=>Number(s.score)>=minScore);
      const bt: BacktestResult[] = significant.map((snap, idx) => {
        const vel   = Number(snap.velocity);
        const accel = Number(snap.acceleration);
        const dir   = getDirection(vel, accel);
        const price = Number(snap.price);
        const after5  = snaps[idx+5]  ? Number(snaps[idx+5].price)  : null;
        const after10 = snaps[idx+10] ? Number(snaps[idx+10].price) : null;
        const pnl5  = after5  ? ((after5  - price)/price)*100 : null;
        const pnl10 = after10 ? ((after10 - price)/price)*100 : null;
        // Signal is "correct" if: SELL_FADE predicts price drop (pnl < 0), BUY_EXHAUSTION predicts rise (pnl > 0)
        const correct5 = pnl5!=null ? (dir==="SELL_FADE"?pnl5<0:dir==="BUY_EXHAUSTION"?pnl5>0:null) : null;
        return { signal:snap.id, direction:dir, priceAtSignal:price, priceAfter5:after5, priceAfter10:after10, pnl5, pnl10, correct5 };
      });

      setResults(bt);
      const withResult = bt.filter(r=>r.correct5!=null);
      if (withResult.length>0) {
        setAccuracy(Math.round((withResult.filter(r=>r.correct5).length/withResult.length)*100));
        setAvgPnl(withResult.reduce((a,r)=>a+(r.pnl5??0),0)/withResult.length);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [activeSymbol, period, minScore]);

  // Price chart with signal markers
  const chartData = snapshots.slice(-80).map((s,i)=>({
    i, price:Number(s.price),
    signal: Number(s.score)>=minScore ? Number(s.price) : undefined,
    time: new Date(s.snapshot_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
  }));

  return (
    <Card title="Backtest" subtitle={`${activeSymbol} · session replay`}>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12,flex:1,overflow:"hidden"}}>

        {/* Controls */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:4}}>
            {(["today","week","month"] as const).map(p=><button key={p} onClick={()=>setPeriod(p)} style={{padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"monospace",fontWeight:700,border:`1px solid ${period===p?C.accent:C.border}`,background:period===p?C.accent+"15":"transparent",color:period===p?C.accent:C.textSub,textTransform:"capitalize"}}>{p}</button>)}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,color:C.textMuted}}>Min score</span>
            {[1,2,3].map(n=><button key={n} onClick={()=>setMinScore(n)} style={{width:22,height:22,borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"monospace",fontWeight:700,border:`1px solid ${minScore===n?C.accent:C.border}`,background:minScore===n?C.accent:"transparent",color:minScore===n?"#fff":C.textSub}}>{n}</button>)}
          </div>
          <button onClick={load} disabled={loading} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",border:`1px solid ${C.border}`,background:"transparent",color:C.textSub}}>↻ Refresh</button>
        </div>

        {/* Summary stats */}
        {results.length>0&&accuracy!=null&&(
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            {[
              {label:"Accuracy (5-tick)",value:`${accuracy}%`, color:accuracy>=60?C.bull:accuracy>=45?C.warn:C.bear},
              {label:"Avg P&L (5-tick)", value:`${(avgPnl??0)>=0?"+":""}${(avgPnl??0).toFixed(3)}%`, color:(avgPnl??0)>=0?C.bull:C.bear},
              {label:"Signals Tested",   value:results.filter(r=>r.correct5!=null).length, color:C.text},
              {label:"Total Snapshots",  value:snapshots.length, color:C.textMuted},
            ].map(({label,value,color})=>(
              <div key={label} style={{flex:1,background:C.surfaceAlt,borderRadius:8,padding:"8px 10px",border:`1px solid ${C.borderLight}`}}>
                <div style={{fontSize:9,color:C.textMuted,fontFamily:"monospace",marginBottom:3}}>{label}</div>
                <div style={{fontSize:16,fontWeight:700,fontFamily:"monospace",color}}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Price chart */}
        {chartData.length>0&&(
          <div style={{height:100,flexShrink:0}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid stroke={C.borderLight} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{fontSize:8,fill:C.textMuted}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={["auto","auto"]} tick={{fontSize:8,fill:C.textMuted}} tickLine={false} axisLine={false} width={50} tickFormatter={(v:number)=>`$${v.toFixed(1)}`} />
                <Tooltip contentStyle={{fontSize:10,fontFamily:"monospace",borderRadius:8}} formatter={(v:any)=>[`$${Number(v).toFixed(2)}`,"Price"]} />
                <Line type="monotone" dataKey="price" stroke={C.accent} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="signal" stroke={C.warn} strokeWidth={0} dot={{fill:C.warn,r:4,strokeWidth:0}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Results table */}
        {loading
          ? <div style={{flex:1,display:"flex",flexDirection:"column",gap:8,padding:"12px"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${C.borderLight}`,borderTop:`2px solid ${C.accent}`,animation:"spin 1s linear infinite"}}/><span style={{fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>Running backtest…</span></div>{Array.from({length:5}).map((_,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,padding:"8px",borderRadius:6,background:C.surfaceAlt}}>{Array.from({length:5}).map((_,j)=>(<Skeleton key={j} height={12}width={`${50+j*10}%`}/>))}</div>))}</div>
          : snapshots.length<10
          ? <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:C.textMuted,padding:16,textAlign:"center"}}>
              <div style={{fontSize:22}}>📊</div>
              <div style={{fontSize:12,fontWeight:600,color:C.textSub}}>Not enough data yet</div>
              <div style={{fontSize:11,lineHeight:1.5,maxWidth:240}}>Session snapshots are logged every 30 seconds. Come back after trading for a while to see backtest results.</div>
            </div>
          : <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead style={{position:"sticky",top:0,background:C.surfaceAlt,zIndex:1}}>
                  <tr>{["Direction","Entry","+5 ticks","P&L (5t)","Result"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:"left",fontSize:9,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"monospace",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {results.slice(0,30).map((r,i)=>(
                    <tr key={i}>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${C.borderLight}`}}>
                        <span style={{padding:"1px 6px",borderRadius:10,fontSize:9,fontWeight:700,fontFamily:"monospace",color:directionColor(r.direction as any),background:r.direction==="SELL_FADE"?C.bearLight:r.direction==="BUY_EXHAUSTION"?C.bullLight:"#F3F4F6"}}>{directionLabel(r.direction as any)}</span>
                      </td>
                      <td style={{padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:C.text,borderBottom:`1px solid ${C.borderLight}`}}>${r.priceAtSignal.toFixed(2)}</td>
                      <td style={{padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:C.textSub,borderBottom:`1px solid ${C.borderLight}`}}>{r.priceAfter5?`$${r.priceAfter5.toFixed(2)}`:"—"}</td>
                      <td style={{padding:"5px 8px",fontFamily:"monospace",fontSize:10,borderBottom:`1px solid ${C.borderLight}`,color:r.pnl5==null?C.textMuted:r.pnl5>=0?C.bull:C.bear}}>{r.pnl5!=null?(r.pnl5>=0?"+":"")+r.pnl5.toFixed(3)+"%":"—"}</td>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${C.borderLight}`}}>
                        {r.correct5==null ? <span style={{fontSize:10,color:C.textMuted}}>—</span>
                          : r.correct5 ? <span style={{fontSize:10,color:C.bull,fontWeight:700}}>✓</span>
                          : <span style={{fontSize:10,color:C.bear,fontWeight:700}}>✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </Card>
  );
}