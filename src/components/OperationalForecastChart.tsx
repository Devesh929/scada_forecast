import React,{useRef,useState,useCallback,useEffect,useMemo}from'react';
const D='2025-01-05';
const mkT=(h:number,m:number)=>new Date(`${D}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime();
const fmtT=(ts:number)=>{const d=new Date(ts);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

const BASE=[
  {t:mkT(13,0),a:21.2,p50:21.7,s:36.8},{t:mkT(13,15),a:20.8,p50:21.3,s:36.0},
  {t:mkT(13,30),a:20.3,p50:20.8,s:35.1},{t:mkT(13,45),a:19.7,p50:20.3,s:34.1},
  {t:mkT(14,0),a:19.1,p50:19.8,s:33.0},{t:mkT(14,15),a:18.5,p50:19.7,s:31.8},
  {t:mkT(14,30),a:17.8,p50:20.7,s:30.5},{t:mkT(14,45),a:17.4,p50:20.3,s:29.1},
  {t:mkT(15,0),a:17.3,p50:24.0,s:28.6},{t:mkT(15,15),a:17.6,p50:26.0,s:27.6},
  {t:mkT(15,30),a:19.0,p50:28.0,s:26.0},{t:mkT(15,45),a:22.5,p50:30.5,s:24.3},
  {t:mkT(16,0),a:26.0,p50:31.0,s:23.2},{t:mkT(16,15),a:28.2,p50:30.5,s:22.0},
  {t:mkT(16,30),a:27.5,p50:29.0,s:20.7},{t:mkT(16,45),a:24.1,p50:26.5,s:18.9},
  {t:mkT(17,0),a:20.4,p50:23.0,s:16.9},{t:mkT(17,15),a:16.8,p50:20.0,s:14.9},
  {t:mkT(17,30),a:13.2,p50:17.0,s:12.9},{t:mkT(17,45),a:10.1,p50:14.0,s:10.8},
  {t:mkT(18,0),a:7.5,p50:11.0,s:8.7},{t:mkT(18,15),a:5.0,p50:8.5,s:7.3},
];

const SPREAD:Record<string,number>={'5min':1.5,'15min':2.8,'1hr':5.0,'2hr':8.0,'day':14.0};

const EVENTS:any[]=[
  {id:'E1',tStart:mkT(15,20),tEnd:mkT(17,15),shortLabel:'Cloud Ramp-Up',severity:'high',
   rootCause:'NWP ensemble detects cloud clearance after 15:20 IST causing sigmoid ramp-up.',
   description:'Generation expected to surge 17→31 MW in 90 min. Schedule constraint may trigger curtailment.',
   impactMw:+8.5,horizons:['5min','15min','1hr','2hr']},
  {id:'E2',tStart:mkT(17,30),tEnd:mkT(18,15),shortLabel:'Evening Ramp-Down',severity:'low',
   rootCause:'Solar elevation drops below 15°. Natural end-of-day decline.',
   description:'Generation will decline 23→0 MW by 18:15 IST. No intervention required.',
   impactMw:-12.0,horizons:['1hr','2hr','day']},
];

const PATTERNS:Record<string,any[]>={
  '5min':[
    {root:'SCADA',label:'Micro Ramp Detected',confidence:94,prob:0.12,action:'Watch inverter response'},
    {root:'Weather',label:'Cloud Edge Approaching',confidence:81,prob:0.34,action:'Activate ramp buffer'},
  ],
  '15min':[
    {root:'Weather',label:'Cloud Ramp-Up',confidence:86,prob:0.62,action:'Pre-notify SLDC'},
    {root:'Grid',label:'Schedule Overrun Risk',confidence:74,prob:0.44,action:'Reduce setpoint by 5%'},
  ],
  '1hr':[
    {root:'Weather',label:'Cloud Ramp-Up',confidence:78,prob:0.68,action:'Pre-notify SLDC'},
    {root:'Weather',label:'Evening Ramp-Down',confidence:88,prob:0.91,action:'File evening ramp plan'},
    {root:'Grid',label:'Local Limit Breach',confidence:65,prob:0.38,action:'Monitor substation load'},
  ],
  '2hr':[
    {root:'Weather',label:'Cloud Ramp-Up',confidence:72,prob:0.71,action:'Stage spinning reserve'},
    {root:'Weather',label:'Evening Ramp-Down',confidence:90,prob:0.93,action:'File ramp plan with DSO'},
    {root:'NWP',label:'Irradiance Uncertainty',confidence:61,prob:0.55,action:'Widen P10-P90 operationally'},
  ],
  'day':[
    {root:'NWP',label:'Day-Ahead Ramp Profile',confidence:55,prob:0.74,action:'Submit DA schedule revision'},
    {root:'Weather',label:'Evening Ramp-Down',confidence:88,prob:0.95,action:'File statutory ramp plan'},
    {root:'Grid',label:'Congestion Window',confidence:48,prob:0.41,action:'Coordinate with RLDC'},
  ],
};

const PAD={top:28,right:20,bottom:52,left:66};

function smooth(pts:[number,number][]){
  if(pts.length<2)return'';
  let d=`M ${pts[0][0]} ${pts[0][1]}`;
  for(let i=1;i<pts.length;i++){
    const[x0,y0]=pts[i-1],[x1,y1]=pts[i];const cx=(x0+x1)/2;
    d+=` C ${cx} ${y0},${cx} ${y1},${x1} ${y1}`;
  }return d;
}

export default function OperationalForecastChart({ isPlaying, selectedHorizon, setSelectedHorizon, simState }: any) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 380 });
  const [xOff, setXOff] = useState(0);
  const [xZoom, setXZoom] = useState(3.5);
  const [selEv, setSelEv] = useState<any>(null);
  const drag = useRef({ on: false, sx: 0, so: 0 });

  useEffect(()=>{
    const o=new ResizeObserver(e=>setDims({w:Math.max(e[0].contentRect.width,400),h:380}));
    if(wrapRef.current)o.observe(wrapRef.current);
    return()=>o.disconnect();
  },[]);

  const nowIdx = useMemo(() => {
    const rawTime = simState?.plants[0]?.timestamp || "13:00";
    const [h, m] = rawTime.split(':').map(Number);
    const ts = mkT(h, m);
    const idx = BASE.findIndex(b => b.t >= ts);
    return idx === -1 ? BASE.length - 1 : idx;
  }, [simState]);

  const CW=dims.w-PAD.left-PAD.right;
  const CH=dims.h-PAD.top-PAD.bottom;
  const T0=BASE[0].t,T1=BASE[BASE.length-1].t,TSPAN=T1-T0;
  const bs=CW/TSPAN,sc=bs*xZoom;
  const xPx=useCallback((t:number)=>(t-T0)*sc+xOff,[sc,xOff,T0]);
  const yPx=useCallback((v:number)=>CH-(v/55)*CH,[CH]);
  const clamp=(o:number,z:number)=>Math.max(-(TSPAN*bs*z-CW)-CW*0.3,Math.min(CW*0.3,o));

  const onWheel=useCallback((e:React.WheelEvent<SVGSVGElement>)=>{
    e.preventDefault();
    const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const cx=e.clientX-r.left-PAD.left;
    const f=e.deltaY<0?1.15:1/1.15;
    setXZoom(z=>{const nz=Math.min(12,Math.max(0.3,z*f));
      setXOff(o=>{const tC=T0+(cx-o)/(bs*z);return clamp(cx-(tC-T0)*(bs*nz),nz);});
      return nz;});
  },[bs,T0]);

  const onMD=(e:React.MouseEvent)=>{drag.current={on:true,sx:e.clientX,so:xOff};};
  const onMM=useCallback((e:React.MouseEvent)=>{
    if(!drag.current.on)return;
    setXOff(clamp(drag.current.so+(e.clientX-drag.current.sx),xZoom));
  },[xZoom]);
  const onMU=()=>{drag.current.on=false;};

  const sp = SPREAD[selectedHorizon] || 5;
  const nowT = BASE[nowIdx].t;
  const visEvents = EVENTS.filter(ev => ev.horizons.includes(selectedHorizon));

  const bandTop:[number,number][]=[];
  const bandBot:[number,number][]=[];
  const p50Pts:[number,number][]=[];
  const actPts:[number,number][]=[];
  const schPts:[number,number][]=[];

  BASE.forEach((d,i)=>{
    const x=xPx(d.t),sp2=sp*(i>nowIdx?1.5:0.8);
    bandTop.push([x,yPx(d.p50+sp2)]);
    bandBot.push([x,yPx(Math.max(0,d.p50-sp2))]);
    p50Pts.push([x,yPx(d.p50)]);
    if(i<=nowIdx)actPts.push([x,yPx(d.a)]);
    schPts.push([x,yPx(d.s)]);
  });

  const bPath=smooth(bandTop)+' L '+[...bandBot].reverse().map(([x,y])=>`${x},${y}`).join(' L ')+' Z';
  const ticks:number[]=[];
  for(let t=BASE[0].t;t<=T1;t+=15*60*1000)ticks.push(t);

  const nx=PAD.left+xPx(nowT);
  const patterns = PATTERNS[selectedHorizon] || [];

  return(
    <div style={{display:'flex',gap:0,width:'100%',fontFamily:'Inter,sans-serif'}}>
      {/* Chart area */}
      <div ref={wrapRef} style={{flex:1,minWidth:0,position:'relative',userSelect:'none'}}>
        {/* Horizon + legend row */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4}}>
            {(['5min','15min','1hr','2hr','day'] as const).map(h=>(
              <button key={h} onClick={()=>setSelectedHorizon(h)} style={{
                padding:'4px 10px',fontSize:11,fontWeight:700,borderRadius:6,cursor:'pointer',
                background:selectedHorizon===h?'#3b82f6':'rgba(30,41,59,0.8)',
                color:selectedHorizon===h?'#fff':'#64748b',
                border:selectedHorizon===h?'1px solid #3b82f6':'1px solid rgba(100,130,200,0.2)',
              }}>{h.toUpperCase()}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:11}}>
            {[{c:'#3b82f6',l:'P50 Forecast'},{c:'#22c55e',l:'Actual MW'},{c:'rgba(59,130,246,0.25)',l:'P10-P90'},{c:'#ef4444',l:'Schedule',dash:true},{c:'#22c55e',l:'Now',dash:true}]
              .map(({c,l,dash})=>(
              <span key={l} style={{display:'flex',alignItems:'center',gap:4,color:'#94a3b8'}}>
                <span style={{width:22,height:2,display:'inline-block',background:c,borderTop:dash?`2px dashed ${c}`:`2px solid ${c}`}}/>
                {l}
              </span>
            ))}
          </div>
          <span style={{marginLeft:'auto',fontSize:10,color:'#475569'}}>🖱 Scroll to zoom · Drag to pan</span>
        </div>

        <svg width="100%" height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`}
          style={{cursor:drag.current.on?'grabbing':'grab',display:'block'}}
          onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
          <defs>
            <clipPath id="cc"><rect x={PAD.left} y={PAD.top} width={CW} height={CH}/></clipPath>
            <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03"/>
            </linearGradient>
            <linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02"/>
            </linearGradient>
          </defs>
          <rect x={PAD.left} y={PAD.top} width={CW} height={CH} fill="rgba(8,18,38,0.7)" rx={4}/>
          <g clipPath="url(#cc)">
            {[0,10,20,30,40,50].map(v=>(
              <line key={v} x1={PAD.left} x2={PAD.left+CW} y1={PAD.top+yPx(v)} y2={PAD.top+yPx(v)} stroke="rgba(100,130,200,0.08)" strokeWidth={1}/>
            ))}
            {/* Band */}
            <path d={bPath} transform={`translate(${PAD.left},${PAD.top})`} fill="url(#bg)" stroke="none"/>
            {/* Schedule */}
            <path d={smooth(schPts)} transform={`translate(${PAD.left},${PAD.top})`} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="6 4" opacity={0.7}/>
            {/* Actual fill */}
            {actPts.length>1&&<path d={smooth(actPts)+` L ${actPts[actPts.length-1][0]},${CH} L ${actPts[0][0]},${CH} Z`}
              transform={`translate(${PAD.left},${PAD.top})`} fill="url(#ag)" stroke="none"/>}
            {/* P50 */}
            <path d={smooth(p50Pts)} transform={`translate(${PAD.left},${PAD.top})`} fill="none" stroke="#3b82f6" strokeWidth={2.5}/>
            {/* Actual */}
            {actPts.length>1&&<path d={smooth(actPts)} transform={`translate(${PAD.left},${PAD.top})`} fill="none" stroke="#22c55e" strokeWidth={2.8}/>}
            {/* Events */}
            {visEvents.map(ev=>{
              const x1c=PAD.left+xPx(ev.tStart),x2c=PAD.left+xPx(ev.tEnd);
              if(x2c<PAD.left||x1c>PAD.left+CW)return null;
              const col=ev.severity==='high'?'#f97316':'#facc15';
              const cx=Math.max(x1c,PAD.left),cw2=Math.min(x2c,PAD.left+CW)-cx;
              return(
                <g key={ev.id} style={{cursor:'pointer'}} onClick={()=>setSelEv(selEv?.id===ev.id?null:ev)}>
                  <rect x={cx} y={PAD.top} width={cw2} height={CH} fill={col} fillOpacity={selEv?.id===ev.id?0.22:0.1} stroke={col} strokeOpacity={0.6} strokeWidth={1.5}/>
                  <rect x={cx} y={PAD.top} width={cw2} height={3} fill={col} opacity={0.9} rx={1}/>
                  {cw2>50&&<text x={cx+6} y={PAD.top+16} fill={col} fontSize={10} fontWeight={700}>{ev.shortLabel}</text>}
                </g>
              );
            })}
            {/* NOW */}
            {nx>=PAD.left&&nx<=PAD.left+CW&&(
              <g>
                <line x1={nx} x2={nx} y1={PAD.top} y2={PAD.top+CH} stroke="#4ade80" strokeWidth={2} strokeDasharray="8 5" opacity={0.9}/>
                <rect x={nx-18} y={PAD.top-18} width={36} height={16} fill="#052e16" rx={4} stroke="#4ade80" strokeWidth={1}/>
                <text x={nx} y={PAD.top-7} textAnchor="middle" fill="#4ade80" fontSize={10} fontWeight={700}>NOW</text>
              </g>
            )}
          </g>
          {/* Y axis */}
          {[0,10,20,30,40,50].map(v=>(
            <g key={v}>
              <text x={PAD.left-8} y={PAD.top+yPx(v)+4} textAnchor="end" fill="#475569" fontSize={11}>{v}</text>
              <line x1={PAD.left-4} x2={PAD.left} y1={PAD.top+yPx(v)} y2={PAD.top+yPx(v)} stroke="#334155"/>
            </g>
          ))}
          <text x={16} y={PAD.top+CH/2} textAnchor="middle" fill="#475569" fontSize={11} transform={`rotate(-90,16,${PAD.top+CH/2})`}>MW</text>
          {/* X axis */}
          {ticks.map(t=>{const x=PAD.left+xPx(t);if(x<PAD.left||x>PAD.left+CW)return null;return(
            <g key={t}><line x1={x} x2={x} y1={PAD.top+CH} y2={PAD.top+CH+5} stroke="#334155"/>
              <text x={x} y={PAD.top+CH+17} textAnchor="middle" fill="#475569" fontSize={10}>{fmtT(t)}</text>
            </g>);})}
          <text x={PAD.left+CW/2} y={dims.h-4} textAnchor="middle" fill="#475569" fontSize={11}>Time (IST) — 2025-01-05</text>
        </svg>

        {/* Event detail popup */}
        {selEv&&(
          <div style={{position:'absolute',top:50,right:8,width:260,background:'rgba(8,18,38,0.97)',
            border:`1px solid ${selEv.severity==='high'?'#f97316':'#facc15'}`,borderRadius:10,padding:14,zIndex:20}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:selEv.severity==='high'?'#f97316':'#facc15'}}>{selEv.severity.toUpperCase()} EVENT</span>
              <button onClick={()=>setSelEv(null)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:14}}>✕</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#f1f5f9',marginBottom:6}}>{selEv.shortLabel}</div>
            <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>{fmtT(selEv.tStart)}–{fmtT(selEv.tEnd)}</div>
            {[{l:'Impact',v:`${selEv.impactMw>0?'+':''}${selEv.impactMw} MW`},{l:'Root Cause',v:selEv.rootCause}].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid rgba(100,120,180,0.1)',padding:'4px 0',fontSize:11}}>
                <span style={{color:'#64748b'}}>{r.l}</span><span style={{color:'#e2e8f0',fontWeight:600,maxWidth:150,textAlign:'right'}}>{r.v}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:'#94a3b8',lineHeight:1.6,background:'rgba(30,41,59,0.5)',borderRadius:6,padding:'8px 10px'}}>{selEv.description}</div>
          </div>
        )}
      </div>

      {/* Pattern Intelligence sidebar */}
      <div style={{width:220,flexShrink:0,borderLeft:'1px solid rgba(100,150,255,0.1)',paddingLeft:14,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:'#3b82f6',marginBottom:4,paddingTop:2}}>
          PATTERN INTELLIGENCE
          <span style={{marginLeft:6,color:'#475569',fontWeight:400}}>· {selectedHorizon.toUpperCase()}</span>
        </div>
        {/* Sim time */}
        <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:8,padding:'8px 10px'}}>
          <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>OPERATIONAL CLOCK</div>
          <div style={{fontSize:16,fontWeight:700,color:'#4ade80',fontFamily:'monospace'}}>{fmtT(nowT)} IST</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:2}}>{isPlaying?'▶ LIVE SIMULATION':'⏸ SYSTEM PAUSED'}</div>
        </div>
        {/* Pattern cards */}
        {patterns.map((p,i)=>{
          const col=p.confidence>85?'#22c55e':p.confidence>70?'#f97316':'#ef4444';
          return(
            <div key={i} style={{background:'rgba(20,30,55,0.8)',border:'1px solid rgba(100,130,200,0.15)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#64748b',marginBottom:4,letterSpacing:0.5}}>{p.root.toUpperCase()}</div>
              <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',marginBottom:6}}>{p.label}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:10,color:'#64748b'}}>Confidence</span>
                <span style={{fontSize:11,fontWeight:700,color:col}}>{p.confidence}%</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:10,color:'#64748b'}}>Event Prob.</span>
                <span style={{fontSize:11,fontWeight:700,color:'#93c5fd'}}>{(p.prob*100).toFixed(0)}%</span>
              </div>
              {/* confidence bar */}
              <div style={{height:3,background:'rgba(100,130,200,0.15)',borderRadius:2,marginBottom:6}}>
                <div style={{height:3,width:`${p.confidence}%`,background:col,borderRadius:2}}/>
              </div>
              <div style={{fontSize:10,color:'#f59e0b',fontStyle:'italic'}}>⚡ {p.action}</div>
            </div>
          );
        })}
        <div style={{fontSize:10,color:'#334155',marginTop:'auto',paddingTop:8,borderTop:'1px solid rgba(100,130,200,0.1)'}}>
          Updates on horizon switch<br/>& simulation step
        </div>
      </div>
    </div>
  );
}
