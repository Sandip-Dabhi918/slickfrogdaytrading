import { useDashboard } from "../../lib/context/DashboardContext";
import { C, Card, getDirection, directionLabel, directionColor, convictionLabel } from "../../lib/ui/shared";

export default function ScannerCard() {
  const { profiles, allPrices, signals, setActiveSymbol } = useDashboard();

  const rows = profiles.map(profile => {
    const sym    = profile.ticker;
    const prices = allPrices[sym] || [];
    const last   = prices[prices.length-1];
    const first  = prices[0];
    const change = last&&first ? last.price-first.price : null;
    const pct    = first&&change!=null ? (change/first.price)*100 : null;
    const sig    = signals.find(s=>s.symbol===sym);
    const vel    = Number(sig?.velocity??0);
    const accel  = Number(sig?.acceleration??0);
    const score  = Number(sig?.score??0);
    const dir    = sig ? getDirection(vel, accel) : "HOLD" as const;
    return { sym, last, change, pct, sig, vel, accel, score, dir };
  }).sort((a,b) => b.score - a.score); // highest score first

  return (
    <Card title="Scanner" subtitle="All watchlist stocks">
      <div style={{padding:"8px 14px",display:"flex",flexDirection:"column",gap:6,flex:1,overflow:"hidden"}}>

        {/* Column headers */}
        <div style={{display:"grid",gridTemplateColumns:"80px 90px 80px 1fr 90px 80px",gap:8,paddingBottom:6,borderBottom:`1px solid ${C.borderLight}`,flexShrink:0}}>
          {["Symbol","Price","Change","Direction","Conviction","Score"].map(h=>(
            <span key={h} style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"monospace"}}>{h}</span>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {rows.map(({sym,last,change,pct,score,dir,sig})=>{
            const up = (change??0)>=0;
            const isActionable = dir!=="HOLD" && score>=1;
            return (
              <div key={sym} onClick={()=>setActiveSymbol(sym)} style={{
                display:"grid", gridTemplateColumns:"80px 90px 80px 1fr 90px 80px",
                gap:8, padding:"8px 6px", borderRadius:8, cursor:"pointer",
                background: isActionable ? (dir==="SELL_FADE"?C.bearLight:C.bullLight) : C.surfaceAlt,
                border:`1px solid ${isActionable?directionColor(dir)+"40":C.borderLight}`,
                transition:"all .1s",
              }}>
                <span style={{fontWeight:700,fontFamily:"monospace",color:C.text,fontSize:13,alignSelf:"center"}}>{sym}</span>
                <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,alignSelf:"center"}}>{last?`$${last.price.toFixed(2)}`:"—"}</span>
                <span style={{fontFamily:"monospace",fontSize:11,color:up?C.bull:C.bear,fontWeight:700,alignSelf:"center"}}>{pct!=null?(up?"+":"")+pct.toFixed(2)+"%":"—"}</span>
                <div style={{alignSelf:"center"}}>
                  {dir!=="HOLD"
                    ? <span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,fontFamily:"monospace",color:directionColor(dir),background:dir==="SELL_FADE"?C.bearLight:C.bullLight,border:`1px solid ${directionColor(dir)}30`}}>{directionLabel(dir)}</span>
                    : <span style={{fontSize:10,color:C.textMuted}}>—</span>}
                </div>
                <span style={{fontSize:10,color:score>=3?C.bull:score>=2?C.warn:C.textMuted,fontWeight:score>=2?700:400,alignSelf:"center"}}>{sig?convictionLabel(score).split(" — ")[0]:"—"}</span>
                <div style={{display:"flex",alignItems:"center",gap:5,alignSelf:"center"}}>
                  <div style={{display:"flex",gap:2}}>
                    {[1,2,3].map(n=><div key={n} style={{width:8,height:8,borderRadius:2,background:n<=score?(score>=3?C.bull:score>=2?C.warn:C.bear):C.borderLight}} />)}
                  </div>
                  <span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:C.text}}>{score}/3</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{fontSize:9,color:C.textMuted,flexShrink:0,textAlign:"center"}}>
          Click any row to focus that stock across all cards
        </div>
      </div>
    </Card>
  );
}
