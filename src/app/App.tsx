import { useState, useEffect } from "react";

const F = "'Nunito', sans-serif";
const M = "'DM Mono', monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
@keyframes fadeUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
@keyframes zoomIn  { from{opacity:0;transform:scale(.82)} to{opacity:1;transform:scale(1)} }
@keyframes pop     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
@keyframes fall    { 0%{transform:translateY(-30px) rotateZ(0deg);opacity:1} 100%{transform:translateY(115vh) rotateZ(720deg);opacity:0} }
.fu { animation: fadeUp .46s ease both }
.zi { animation: zoomIn .42s cubic-bezier(.34,1.56,.64,1) both }
.po { animation: pop 2.4s ease infinite }
.sr { animation: slideR  .38s ease both }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type ScreenId =
  | "home" | "host-lobby" | "player-lobby" | "tutorial"
  | "round-intro" | "decision" | "event" | "rbc" | "orsa" | "leaderboard" | "final";
type ViewMode  = "host" | "player";
type RBCStatus = "healthy" | "watch" | "intervention";

interface DemoStep {
  id: ScreenId; round?: number; eventIdx?: number; label: string;
}
interface PlayerRow {
  name: string; emoji: string; value: number; capital: number; rbc: number; status: RBCStatus;
}
interface LobbyPlayer {
  id: string;
  name: string;
}
type KVRoomStatus = "waiting" | "started";

const generateRoomCode = (length = 4) =>
  Array.from({ length }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");

const jsonFetch = async (url: string, opts: RequestInit = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || response.statusText || "Request failed");
  }
  return body;
};

const createRoomInKV = async (code: string, hostName: string) =>
  jsonFetch("/api/kv/room", {
    method: "POST",
    body: JSON.stringify({ code, hostName }),
  });

const joinRoomInKV = async (code: string, playerName: string) =>
  jsonFetch("/api/kv/join", {
    method: "POST",
    body: JSON.stringify({ code, playerName }),
  });

const fetchPlayersFromKV = async (code: string): Promise<LobbyPlayer[]> =>
  jsonFetch(`/api/kv/players?code=${encodeURIComponent(code)}`);

const startRoomInKV = async (code: string) =>
  jsonFetch("/api/kv/start", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

const fetchRoomStatusFromKV = async (code: string): Promise<KVRoomStatus> => {
  const result = await jsonFetch(`/api/kv/status?code=${encodeURIComponent(code)}`);
  return (result?.status ?? "waiting") as KVRoomStatus;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hi = (s: RBCStatus) =>
  s === "healthy"      ? { emoji:"🟢", label:"Strong",  col:"#4ade80", bg:"#052e16", desc:"Financially healthy" }
: s === "watch"        ? { emoji:"🟡", label:"At Risk",  col:"#fbbf24", bg:"#431407", desc:"Watch your reserves" }
:                        { emoji:"🔴", label:"Danger",   col:"#f87171", bg:"#1c0505", desc:"Danger zone!" };

const statusOf = (capital: number, rbc: number): RBCStatus =>
  capital / rbc >= 1.5 ? "healthy" : capital / rbc >= 1.0 ? "watch" : "intervention";

// ─── Data: Strategies ─────────────────────────────────────────────────────────
const STRATEGIES = [
  { id:"conservative", emoji:"🛡", name:"Safe Choice",     sub:"Grow slowly, stay secure",
    valueGain:"+1 Value", riskLevel:2, risk:"Low Risk",    recommended:false,
    grad:"linear-gradient(145deg,#052e16,#064e3b)", border:"#16a34a", tag:"#bbf7d0", tagText:"#14532d", col:"#4ade80" },
  { id:"balanced",     emoji:"⚖️", name:"Balanced Choice", sub:"Grow steadily, manage risk",
    valueGain:"+2 Value", riskLevel:3, risk:"Medium Risk", recommended:true,
    grad:"linear-gradient(145deg,#0f172a,#1e3a5f)", border:"#3b82f6", tag:"#bfdbfe", tagText:"#1e3a8a", col:"#60a5fa" },
  { id:"aggressive",   emoji:"🚀", name:"Risky Choice",    sub:"Grow fastest, highest stakes",
    valueGain:"+4 Value", riskLevel:5, risk:"High Risk",   recommended:false,
    grad:"linear-gradient(145deg,#1a0030,#4c1d95)", border:"#a855f7", tag:"#e9d5ff", tagText:"#4c1d95", col:"#c084fc" },
];

// ─── Data: Events ─────────────────────────────────────────────────────────────
const EVENTS = [
  { emoji:"🎯", name:"Excellent Underwriting Year",
    story:"Claims came in well below forecast — a lucky year that rewards companies who took on more risk.",
    col:"#22c55e", bg:"#052e16",
    impact:[
      { label:"🛡 Safe Choice",     val:"+4 Capital",  good:true },
      { label:"⚖️ Balanced Choice", val:"+10 Capital", good:true },
      { label:"🚀 Risky Choice",    val:"+22 Capital", good:true },
    ],
  },
  { emoji:"🦠", name:"Severe Flu Season",
    story:"A flu outbreak drove a surge in claims, and companies with more exposure absorbed the heaviest losses.",
    col:"#ef4444", bg:"#1c0505",
    impact:[
      { label:"🛡 Safe Choice",     val:"−5 Capital",  good:true  },
      { label:"⚖️ Balanced Choice", val:"−14 Capital", good:false },
      { label:"🚀 Risky Choice",    val:"−30 Capital", good:false },
    ],
  },
  { emoji:"📈", name:"Interest Rates Rise",
    story:"The central bank raised rates sharply, rewarding companies with conservatively matched portfolios.",
    col:"#6366f1", bg:"#1e1b4b",
    impact:[
      { label:"🛡 Safe Choice",     val:"+16 Capital", good:true  },
      { label:"⚖️ Balanced Choice", val:"+8 Capital",  good:true  },
      { label:"🚀 Risky Choice",    val:"−10 Capital", good:false },
    ],
  },
  { emoji:"📉", name:"Market Crash",
    story:"Global markets fell 30% — riskier portfolios took a far harder hit than cautious ones.",
    col:"#f59e0b", bg:"#1c0a00",
    impact:[
      { label:"🛡 Safe Choice",     val:"−6 Capital",  good:false },
      { label:"⚖️ Balanced Choice", val:"−18 Capital", good:false },
      { label:"🚀 Risky Choice",    val:"−35 Capital", good:false },
    ],
  },
  { emoji:"❤️", name:"Medical Breakthrough",
    story:"New therapies extended life expectancy, raising required capital for every company equally.",
    col:"#ec4899", bg:"#1c0616",
    impact:[
      { label:"🛡 Safe Choice",     val:"SCR +10", good:false },
      { label:"⚖️ Balanced Choice", val:"SCR +10", good:false },
      { label:"🚀 Risky Choice",    val:"SCR +10", good:false },
    ],
  },
];

// ─── Data: Future Planning options ───────────────────────────────────────────
const ORSA_OPTIONS = [
  { id:"continue", icon:"📈", text:"Keep Growing",    desc:"Stay aggressive. Accept the added risk.",     col:"#a855f7" },
  { id:"slow",     icon:"🐢", text:"Slow Down",       desc:"Reduce targets. Buy yourself more flexibility.", col:"#3b82f6" },
  { id:"raise",    icon:"💰", text:"Raise Reserves",  desc:"Build a bigger buffer before the next shock.",  col:"#22c55e" },
  { id:"reduce",   icon:"🛡", text:"Reduce Risk",     desc:"Take on less risk. Lower your minimum requirement.", col:"#f59e0b" },
];
const ORSA_OUTCOMES: Record<string,string> = {
  continue: "You kept growing. If a shock hits next round, you'll feel the full force.",
  slow:     "Sensible move. Reduced exposure gives you room to absorb losses.",
  raise:    "Smart. Extra reserves protect you from the danger zone.",
  reduce:   "Good thinking. Lower risk means a smaller safety-capital requirement.",
};

// ─── Data: Leaderboard snapshots ─────────────────────────────────────────────
const LEADERBOARD: PlayerRow[][] = [
  [
    {name:"Pinnacle Life", emoji:"🦅",value:4, capital:109,rbc:83,status:"healthy"},
    {name:"Guardian Re",   emoji:"🐺",value:2, capital:105,rbc:81,status:"healthy"},
    {name:"Frontier Life", emoji:"🐉",value:2, capital:105,rbc:80,status:"healthy"},
    {name:"Apex Shield",   emoji:"🦁",value:1, capital:105,rbc:80,status:"healthy"},
    {name:"Summit Mutual", emoji:"🐻",value:1, capital:105,rbc:80,status:"watch"},
    {name:"Coastal Assure",emoji:"🌊",value:1, capital:105,rbc:80,status:"watch"},
  ],
  [
    {name:"Pinnacle Life", emoji:"🦅",value:8, capital:89, rbc:86,status:"watch"},
    {name:"Frontier Life", emoji:"🐉",value:6, capital:90, rbc:83,status:"healthy"},
    {name:"Guardian Re",   emoji:"🐺",value:4, capital:90, rbc:82,status:"healthy"},
    {name:"Apex Shield",   emoji:"🦁",value:3, capital:97, rbc:81,status:"healthy"},
    {name:"Coastal Assure",emoji:"🌊",value:2, capital:95, rbc:80,status:"healthy"},
    {name:"Summit Mutual", emoji:"🐻",value:2, capital:100,rbc:80,status:"healthy"},
  ],
  [
    {name:"Pinnacle Life", emoji:"🦅",value:12,capital:84, rbc:89,status:"watch"},
    {name:"Frontier Life", emoji:"🐉",value:10,capital:72, rbc:86,status:"intervention"},
    {name:"Apex Shield",   emoji:"🦁",value:7, capital:85, rbc:84,status:"watch"},
    {name:"Guardian Re",   emoji:"🐺",value:6, capital:95, rbc:83,status:"healthy"},
    {name:"Coastal Assure",emoji:"🌊",value:4, capital:100,rbc:81,status:"healthy"},
    {name:"Summit Mutual", emoji:"🐻",value:3, capital:110,rbc:80,status:"healthy"},
  ],
  [
    {name:"Summit Mutual", emoji:"🐻",value:5, capital:95, rbc:80, status:"healthy"},
    {name:"Coastal Assure",emoji:"🌊",value:6, capital:85, rbc:81, status:"healthy"},
    {name:"Apex Shield",   emoji:"🦁",value:9, capital:72, rbc:85, status:"watch"},
    {name:"Guardian Re",   emoji:"🐺",value:8, capital:76, rbc:84, status:"watch"},
    {name:"Pinnacle Life", emoji:"🦅",value:14,capital:69, rbc:92, status:"intervention"},
    {name:"Frontier Life", emoji:"🐉",value:12,capital:57, rbc:89, status:"intervention"},
  ],
  [
    {name:"Summit Mutual", emoji:"🐻",value:7, capital:97, rbc:92, status:"healthy"},
    {name:"Coastal Assure",emoji:"🌊",value:8, capital:87, rbc:93, status:"watch"},
    {name:"Apex Shield",   emoji:"🦁",value:10,capital:75, rbc:95, status:"watch"},
    {name:"Guardian Re",   emoji:"🐺",value:10,capital:75, rbc:96, status:"watch"},
    {name:"Pinnacle Life", emoji:"🦅",value:15,capital:55, rbc:100,status:"intervention"},
    {name:"Frontier Life", emoji:"🐉",value:13,capital:44, rbc:97, status:"intervention"},
  ],
];

const P_STATS = [
  {capital:100,value:0, rbc:80,rep:70},
  {capital:105,value:1, rbc:80,rep:75},
  {capital:97, value:3, rbc:81,rep:72},
  {capital:85, value:7, rbc:84,rep:68},
  {capital:72, value:9, rbc:85,rep:65},
  {capital:75, value:10,rbc:95,rep:72},
];

// ─── Demo steps ───────────────────────────────────────────────────────────────
const STEPS: DemoStep[] = [
  {id:"home",         label:"Welcome"},
  {id:"host-lobby",   label:"Host Lobby"},
  {id:"player-lobby", label:"Waiting Room"},
  {id:"tutorial",     label:"How to Play"},
  {id:"round-intro",  round:1,          label:"Round 1 — Start"},
  {id:"decision",     round:1,          label:"Round 1 — Pick a Strategy"},
  {id:"event",        round:1,eventIdx:0,label:"Round 1 — Industry Event"},
  {id:"rbc",          round:1,          label:"Round 1 — Company Safety Check"},
  {id:"leaderboard",  round:1,          label:"Round 1 — Rankings"},
  {id:"round-intro",  round:2,          label:"Round 2 — Start"},
  {id:"decision",     round:2,          label:"Round 2 — Pick a Strategy"},
  {id:"event",        round:2,eventIdx:1,label:"Round 2 — Industry Event"},
  {id:"rbc",          round:2,          label:"Round 2 — Company Safety Check"},
  {id:"leaderboard",  round:2,          label:"Round 2 — Rankings"},
  {id:"round-intro",  round:3,          label:"Round 3 — Start"},
  {id:"decision",     round:3,          label:"Round 3 — Pick a Strategy"},
  {id:"event",        round:3,eventIdx:2,label:"Round 3 — Industry Event"},
  {id:"rbc",          round:3,          label:"Round 3 — Company Safety Check"},
  {id:"orsa",         round:3,          label:"Round 3 — Future Planning"},
  {id:"leaderboard",  round:3,          label:"Round 3 — Rankings"},
  {id:"round-intro",  round:4,          label:"Round 4 — Start"},
  {id:"decision",     round:4,          label:"Round 4 — Pick a Strategy"},
  {id:"event",        round:4,eventIdx:3,label:"Round 4 — Industry Event"},
  {id:"rbc",          round:4,          label:"Round 4 — Company Safety Check"},
  {id:"orsa",         round:4,          label:"Round 4 — Future Planning"},
  {id:"leaderboard",  round:4,          label:"Round 4 — Rankings"},
  {id:"round-intro",  round:5,          label:"Round 5 — Final Round!"},
  {id:"decision",     round:5,          label:"Round 5 — Pick a Strategy"},
  {id:"event",        round:5,eventIdx:4,label:"Round 5 — Industry Event"},
  {id:"rbc",          round:5,          label:"Round 5 — Final Safety Check"},
  {id:"orsa",         round:5,          label:"Round 5 — Future Planning"},
  {id:"leaderboard",  round:5,          label:"Round 5 — Final Rankings"},
  {id:"final",        label:"🏆 Final Results"},
];

// ─── Shared UI: RiskMeter ─────────────────────────────────────────────────────
const RiskMeter = ({ level, col }: { level:number; col:string }) => (
  <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
    {[1,2,3,4,5].map(i=>(
      <div key={i} style={{width:"10px",height:"10px",borderRadius:"50%",
        background:i<=level?col:"rgba(255,255,255,.13)",transition:"background .2s"}} />
    ))}
  </div>
);

// ─── Shared UI: InfoTip ───────────────────────────────────────────────────────
const InfoTip = ({ text }: { text:string }) => {
  const [open,setOpen] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-block"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(!open)}} style={{
        background:"rgba(129,140,248,.18)",border:"none",borderRadius:"50%",
        width:"18px",height:"18px",fontSize:"10px",cursor:"pointer",
        color:"#818cf8",fontWeight:900,display:"inline-flex",alignItems:"center",justifyContent:"center",
        fontFamily:F,flexShrink:0,
      }}>ⓘ</button>
      {open&&<>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:98}}/>
        <div style={{position:"absolute",bottom:"24px",left:"50%",transform:"translateX(-50%)",
          background:"#1e293b",borderRadius:"12px",padding:"10px 14px",
          fontSize:"13px",color:"#f0f6fc",zIndex:99,width:"210px",
          boxShadow:"0 8px 24px rgba(0,0,0,.55)",border:"1px solid #334155",
          fontFamily:F,fontWeight:600,lineHeight:1.55,whiteSpace:"normal",
        }}>{text}</div>
      </>}
    </span>
  );
};

// ─── Shared UI: HealthBadge ───────────────────────────────────────────────────
const HealthBadge = ({ status, large }: { status:RBCStatus; large?:boolean }) => {
  const {emoji,label,col,bg} = hi(status);
  return (
    <span style={{background:bg,color:col,borderRadius:"999px",
      padding:large?"8px 18px":"3px 10px",fontSize:large?"15px":"12px",
      fontWeight:800,fontFamily:F,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:"5px"}}>
      {emoji} {label}
    </span>
  );
};

// ─── Shared UI: CapBar ────────────────────────────────────────────────────────
const CapBar = ({capital,rbc,animate}:{capital:number;rbc:number;animate?:boolean}) => {
  const pct = Math.min(100,(capital/150)*100);
  const rPct= Math.min(100,(rbc/150)*100);
  const col = capital/rbc>=1.5?"#22c55e":capital/rbc>=1.0?"#fbbf24":"#f87171";
  return (
    <div style={{width:"100%"}}>
      <div style={{height:"22px",background:"#21262d",borderRadius:"11px",overflow:"hidden",position:"relative"}}>
        <div style={{height:"100%",background:col,borderRadius:"11px",
          width:`${pct}%`,transition:animate?"width 1.2s cubic-bezier(.4,0,.2,1)":undefined}}/>
        <div style={{position:"absolute",top:0,left:`${rPct}%`,width:"3px",height:"100%",background:"#fff",transform:"translateX(-50%)"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px",fontSize:"11px",fontFamily:F,color:"#e2e8f0",fontWeight:700}}>
        <span>0</span>
        <span style={{color:"#e2e8f0"}}>▲ Minimum: {rbc}</span>
        <span>150</span>
      </div>
    </div>
  );
};

// ─── Shared UI: Confetti ──────────────────────────────────────────────────────
const Confetti = () => {
  const pieces = Array.from({length:90},(_,i)=>({
    id:i, left:Math.random()*100, delay:Math.random()*3.5, dur:2.5+Math.random()*2,
    col:["#4f46e5","#22c55e","#f59e0b","#ef4444","#a855f7","#ec4899","#3b82f6"][i%7],
    size:7+Math.random()*7,
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:100}}>
      {pieces.map(p=>(
        <div key={p.id} style={{position:"absolute",left:`${p.left}%`,top:"-30px",
          width:p.size,height:p.size*0.55,borderRadius:"2px",background:p.col,
          animation:`fall ${p.dur}s ${p.delay}s linear infinite`}}/>
      ))}
    </div>
  );
};

// ─── Component: Player Dashboard (fixed top during game) ─────────────────────
const PlayerDashboard = ({ step, companyName }: { step:DemoStep; companyName:string }) => {
  if (!step.round) return null;
  const r = step.round;
  const after = ["rbc","orsa","leaderboard"].includes(step.id);
  const statsIdx = after ? r : r - 1;
  const s = P_STATS[Math.min(statsIdx, 5)];
  const status = statusOf(s.capital, s.rbc);
  const {emoji,label,col} = hi(status);
  const sorted = [...LEADERBOARD[Math.min(r-1,4)]].sort((a,b)=>b.value-a.value);
  const rank   = sorted.findIndex(x=>x.name==="Apex Shield")+1;
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:30,
      background:"rgba(13,17,23,.97)",backdropFilter:"blur(12px)",
      borderBottom:"1px solid #21262d",height:"54px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"0 16px",fontFamily:F,gap:"8px"}}>
      {/* Round dots */}
      <div style={{display:"flex",gap:"5px",alignItems:"center",flexShrink:0}}>
        {[1,2,3,4,5].map(n=>(
          <div key={n} style={{width:n===r?"26px":"8px",height:"8px",borderRadius:"4px",
            background:n<r?"#4f46e5":n===r?"#818cf8":"#21262d",transition:"all .3s"}}/>
        ))}
        <span style={{fontSize:"12px",fontWeight:800,color:"#818cf8",marginLeft:"4px",whiteSpace:"nowrap"}}>
          Round {r}/5
        </span>
      </div>
      {/* Stats strip */}
      <div style={{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
        {[{ico:"📈",lbl:"Value",val:s.value},{ico:"💰",lbl:"Capital",val:s.capital}].map(it=>(
          <div key={it.lbl} style={{display:"flex",alignItems:"center",gap:"4px"}}>
            <span style={{fontSize:"13px"}}>{it.ico}</span>
            <span style={{fontFamily:M,fontSize:"14px",color:"#f0f6fc",fontWeight:500}}>{it.val}</span>
            <span style={{fontSize:"10px",color:"#e2e8f0",fontWeight:700}}>{it.lbl}</span>
          </div>
        ))}
        <span style={{fontSize:"12px",fontWeight:800,color:"#818cf8",whiteSpace:"nowrap"}}>{companyName}</span>
        <span style={{color:col,fontSize:"13px",fontWeight:800,whiteSpace:"nowrap"}}>
          {emoji} {label}
        </span>
        {r>1&&<span style={{fontFamily:M,fontSize:"14px",color:"#818cf8",fontWeight:500,whiteSpace:"nowrap"}}>
          #{rank}
        </span>}
      </div>
    </div>
  );
};

// ─── Screen: Home ─────────────────────────────────────────────────────────────
const HomeScreen = ({onHost,onJoin}:{onHost:(name:string)=>void;onJoin:(code:string,name:string)=>void}) => {
  const [code,setCode]=useState("");
  const [name,setName]=useState("Apex Shield");
  return (
    <div style={{minHeight:"100vh",background:"#f0f4ff",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:"40px 24px",fontFamily:F}}>
      <div className="zi" style={{textAlign:"center",maxWidth:"400px",width:"100%"}}>
        <h1 style={{fontSize:"clamp(64px,14vw,110px)",fontWeight:900,letterSpacing:"-3px",lineHeight:1,
          background:"linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:"8px"}}>
          LifeCo
        </h1>
        <p style={{fontSize:"18px",fontWeight:700,color:"#6366f1",marginBottom:"32px"}}>
          Insurance ALM Simulation
        </p>

        <button onClick={()=>onHost(name.trim()||"Apex Shield")} style={{
          fontFamily:F,fontWeight:800,fontSize:"20px",padding:"20px 0",borderRadius:"18px",
          border:"none",cursor:"pointer",width:"100%",
          background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",
          boxShadow:"0 8px 32px rgba(79,70,229,.35)",marginBottom:"24px",
          transition:"transform .15s"}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-2px)"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform=""}}>
          Host a Game
        </button>

        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"24px"}}>
          <div style={{flex:1,height:"1px",background:"#c7d2fe"}}/>
          <span style={{fontSize:"13px",fontWeight:700,color:"#6366f1"}}>or join</span>
          <div style={{flex:1,height:"1px",background:"#c7d2fe"}}/>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,4))}
            placeholder="Room code" style={{
              fontFamily:M,fontSize:"22px",fontWeight:500,textAlign:"center",letterSpacing:"0.2em",
              padding:"14px",borderRadius:"12px",border:"2px solid #c7d2fe",
              background:"#fff",color:"#1e1b4b",outline:"none",boxSizing:"border-box",width:"100%"}}/>
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder="Your nickname" style={{
              fontFamily:F,fontSize:"16px",fontWeight:700,
              padding:"13px",borderRadius:"12px",border:"2px solid #c7d2fe",
              background:"#fff",color:"#1e1b4b",outline:"none",boxSizing:"border-box",width:"100%"}}/>
          <button onClick={()=>onJoin(code.trim().toUpperCase(), name.trim()||"Apex Shield")} style={{
            fontFamily:F,fontWeight:800,fontSize:"17px",padding:"15px",borderRadius:"13px",
            cursor:"pointer",
            background:"#fff",color:"#4f46e5",border:"2px solid #c7d2fe",
            boxShadow:"0 4px 16px rgba(79,70,229,.1)",transition:"transform .15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-2px)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform=""}}>
            Join Game →
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Host Lobby ───────────────────────────────────────────────────────
const HostLobbyScreen = ({
  roomCode,
  players,
  onStart,
  error,
}: {
  roomCode: string;
  players: LobbyPlayer[];
  onStart: () => void;
  error: string | null;
}) => {
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:"40px 24px",fontFamily:F,color:"#f0f6fc"}}>
      <div className="fu" style={{textAlign:"center",maxWidth:"640px",width:"100%"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.15em",marginBottom:"8px",textTransform:"uppercase"}}>Game Room</p>
        <div style={{background:"#161b22",borderRadius:"24px",padding:"32px 40px",marginBottom:"28px",border:"1px solid #30363d"}}>
          <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.15em",marginBottom:"10px"}}>ROOM CODE — Share with players</p>
          <div style={{fontFamily:M,fontSize:"clamp(52px,12vw,84px)",fontWeight:500,letterSpacing:"0.2em",color:"#818cf8",lineHeight:1,marginBottom:"12px"}}>
            {roomCode}
          </div>
          <p style={{fontSize:"13px",color:"#e2e8f0"}}>lifeco.game → Enter this code to join</p>
        </div>
        <p style={{fontSize:"20px",fontWeight:800,marginBottom:"18px",color:"#c7d2fe"}}>
          {players.length} players connected
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"8px",marginBottom:"28px"}}>
          {players.map((player) => (
            <div key={player.id} className="zi" style={{background:"#161b22",border:"1px solid #30363d",
              borderRadius:"12px",padding:"12px",fontSize:"13px",fontWeight:700,textAlign:"center"}}>
              {player.name}
            </div>
          ))}
        </div>
        {error && (
          <div style={{color:"#f87171",fontWeight:700,marginBottom:"16px"}}>{error}</div>
        )}
        <button onClick={onStart} disabled={players.length < 2} style={{
          fontFamily:F,fontWeight:800,fontSize:"20px",padding:"18px 0",
          borderRadius:"16px",border:"none",cursor:players.length>=2?"pointer":"not-allowed",
          background:players.length>=2?"linear-gradient(135deg,#4f46e5,#7c3aed)":"#21262d",
          color:players.length>=2?"#fff":"#30363d",
          boxShadow:players.length>=2?"0 8px 32px rgba(79,70,229,.4)":"none",
          transition:"all .2s",width:"100%",
        }}>
          {players.length >= 2 ? "▶ Start Game" : "Waiting for more players…"}
        </button>
      </div>
    </div>
  );
};

// ─── Screen: Player Lobby ─────────────────────────────────────────────────────
const PlayerLobbyScreen = ({
  roomCode,
  companyName,
  players,
  started,
}: {
  roomCode: string;
  companyName: string;
  players: LobbyPlayer[];
  started: boolean;
}) => {
  return (
    <div style={{minHeight:"100vh",background:"#f0f4ff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,padding:"24px"}}>
      <div className="fu" style={{textAlign:"center",maxWidth:"420px",width:"100%"}}>
        <div style={{background:"#fff",borderRadius:"20px",padding:"28px 24px",border:"1px solid #e0e7ff",boxShadow:"0 8px 32px rgba(79,70,229,.1)",marginBottom:"16px"}}>
          <p style={{color:"#6366f1",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"6px"}}>YOUR COMPANY</p>
          <div style={{fontSize:"36px",marginBottom:"4px"}}>🦁</div>
          <h2 style={{fontSize:"26px",fontWeight:900,color:"#1e1b4b",marginBottom:"2px"}}>{companyName}</h2>
          <p style={{color:"#94a3b8",fontSize:"12px"}}>Room: {roomCode}</p>
        </div>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",border:"1px solid #e0e7ff",boxShadow:"0 4px 16px rgba(79,70,229,.08)",marginBottom:"16px"}}>
          <div className="po" style={{fontSize:"36px",marginBottom:"10px"}}>⏳</div>
          <p style={{fontWeight:800,fontSize:"18px",color:"#1e1b4b",marginBottom:"4px"}}>
            {started ? "Host started the game!" : "Waiting for host…"}
          </p>
          <p style={{color:"#6366f1",fontSize:"14px",fontWeight:700}}>{players.length} players connected</p>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center"}}>
          {players.map((player) => (
            <div key={player.id} className="zi" style={{background:"#fff",borderRadius:"10px",padding:"7px 12px",
              fontSize:"13px",fontWeight:700,color:"#4338ca",border:"1px solid #e0e7ff"}}>
              {player.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Tutorial ─────────────────────────────────────────────────────────
const TutorialScreen = ({onStart}:{onStart:()=>void}) => (
  <div style={{minHeight:"100vh",background:"#f0f4ff",display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",padding:"32px 24px 80px",fontFamily:F}}>
    <div className="zi" style={{textAlign:"center",maxWidth:"420px",width:"100%"}}>
      <h1 style={{fontSize:"clamp(24px,5vw,34px)",fontWeight:900,color:"#1e1b4b",marginBottom:"28px"}}>
        How It Works
      </h1>
      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"28px"}}>
        {[
          {n:"1",emoji:"🎯",title:"Pick a strategy",     col:"#4f46e5"},
          {n:"2",emoji:"⚡",title:"An event happens",    col:"#f59e0b"},
          {n:"3",emoji:"🏥",title:"Safety check",        col:"#22c55e"},
          {n:"4",emoji:"📊",title:"See the rankings",    col:"#a855f7"},
        ].map((s,i)=>(
          <div key={s.n} className="fu" style={{background:"#fff",borderRadius:"14px",padding:"16px 20px",
            border:"1px solid #e0e7ff",display:"flex",alignItems:"center",gap:"14px",
            animationDelay:`${i*0.08}s`}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",flexShrink:0,
              background:`${s.col}14`,border:`1px solid ${s.col}30`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>
              {s.emoji}
            </div>
            <div style={{textAlign:"left",fontWeight:800,fontSize:"17px",color:"#1e1b4b"}}>
              Step {s.n}: {s.title}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onStart} style={{fontFamily:F,fontWeight:900,fontSize:"19px",padding:"17px 0",
        borderRadius:"16px",border:"none",cursor:"pointer",width:"100%",
        background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",
        boxShadow:"0 8px 32px rgba(79,70,229,.35)"}}>
        Let's Play! →
      </button>
    </div>
  </div>
);

// ─── Screen: Round Intro ──────────────────────────────────────────────────────
const RoundIntroScreen = ({round,viewMode,onNext}:{round:number;viewMode:ViewMode;onNext:()=>void}) => (
  <div onClick={onNext} style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",fontFamily:F,cursor:"pointer",padding:"40px"}}>
    <div className="zi" style={{textAlign:"center"}}>
      <div style={{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"32px"}}>
        {[1,2,3,4,5].map(n=>(
          <div key={n} style={{width:n===round?"30px":"9px",height:"9px",borderRadius:"5px",
            background:n<round?"#4f46e5":n===round?"#818cf8":"#21262d",transition:"all .3s"}}/>
        ))}
      </div>
      <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"13px",letterSpacing:"0.2em",marginBottom:"10px",textTransform:"uppercase"}}>
        {round===5?"Final Round":"Round "+round+" of 5"}
      </p>
      <div style={{fontSize:"clamp(80px,18vw,160px)",fontWeight:900,lineHeight:1,letterSpacing:"-4px",
        background:"linear-gradient(135deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
        {round===5?"FINAL":round}
      </div>
      {viewMode==="player"&&(
        <div style={{marginTop:"36px",background:"#161b22",borderRadius:"16px",padding:"18px 24px",
          border:"1px solid #30363d",display:"inline-block"}}>
          <p style={{color:"#e2e8f0",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",marginBottom:"10px"}}>APEX SHIELD — GOING INTO ROUND {round}</p>
          <div style={{display:"flex",gap:"20px",justifyContent:"center"}}>
            {([["📈","Value",P_STATS[round-1].value],["💰","Capital",P_STATS[round-1].capital],
               ["🛡","Min. Req.",P_STATS[round-1].rbc],["⭐","Rep.",P_STATS[round-1].rep]] as [string,string,number][]).map(([ico,lbl,val])=>(
              <div key={lbl} style={{textAlign:"center"}}>
                <div style={{fontSize:"20px"}}>{ico}</div>
                <div style={{fontFamily:M,fontSize:"18px",fontWeight:500,color:"#f0f6fc"}}>{val}</div>
                <div style={{fontSize:"10px",color:"#e2e8f0",fontWeight:700}}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{color:"#e2e8f0",fontSize:"16px",marginTop:"36px",fontWeight:700}}>Click anywhere to continue</p>
    </div>
  </div>
);

// ─── Screen: Decision — Host ──────────────────────────────────────────────────
const DecisionHostScreen = ({round}:{round:number}) => {
  const [decided,setDecided]=useState(0);
  const [timer,setTimer]=useState(15);
  useEffect(()=>{
    const ta=setTimeout(()=>{let i=0;const t=setInterval(()=>{if(i<5){i++;setDecided(i);}else clearInterval(t);},2000);return()=>clearInterval(t);},600);
    const tb=setInterval(()=>setTimer(t=>t>0?t-1:0),1000);
    return()=>{clearTimeout(ta);clearInterval(tb);};
  },[]);
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:F,padding:"40px 24px"}}>
      <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.2em",marginBottom:"20px",textTransform:"uppercase"}}>
        Round {round} · Players are choosing their strategy
      </p>
      <div className="fu" style={{fontSize:"clamp(72px,15vw,130px)",fontWeight:900,fontFamily:M,lineHeight:1,marginBottom:"14px",
        color:timer<=5?"#ef4444":timer<=8?"#f59e0b":"#f0f6fc",transition:"color .5s"}}>
        {timer}
      </div>
      <p style={{color:"#4ade80",fontWeight:800,fontSize:"22px",marginBottom:"44px"}}>
        {decided} / 6 players have chosen
      </p>
      <div style={{display:"flex",gap:"14px",justifyContent:"center",flexWrap:"wrap"}}>
        {STRATEGIES.map(s=>(
          <div key={s.id} style={{background:s.grad,border:`1px solid ${s.border}22`,
            borderRadius:"16px",padding:"18px 22px",minWidth:"150px",textAlign:"center",opacity:.55}}>
            <div style={{fontSize:"28px",marginBottom:"6px"}}>{s.emoji}</div>
            <div style={{fontWeight:800,fontSize:"14px",color:"#f0f6fc"}}>{s.name}</div>
            <RiskMeter level={s.riskLevel} col={s.col}/>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Screen: Decision — Player ────────────────────────────────────────────────
const DecisionPlayerScreen = ({round,chosen,onChoose}:{round:number;chosen:string|null;onChoose:(id:string)=>void}) => {
  const [timer,setTimer]=useState(15);
  useEffect(()=>{const t=setInterval(()=>setTimer(n=>n>0?n-1:0),1000);return()=>clearInterval(t);},[]);
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"flex-start",fontFamily:F,padding:"24px 20px 80px"}}>
      <div style={{textAlign:"center",marginBottom:"18px"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"4px"}}>
          ROUND {round} · APEX SHIELD
        </p>
        <p style={{fontWeight:900,fontSize:"20px",color:"#f0f6fc"}}>Pick Your Strategy</p>
      </div>

      <div style={{width:"60px",height:"60px",borderRadius:"50%",marginBottom:"20px",flexShrink:0,
        border:`4px solid ${timer<=5?"#ef4444":timer<=8?"#f59e0b":"#4f46e5"}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:M,fontSize:"22px",fontWeight:500,
        color:timer<=5?"#ef4444":timer<=8?"#f59e0b":"#f0f6fc",transition:"border-color .5s,color .5s"}}>
        {timer}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"12px",width:"100%",maxWidth:"480px"}}>
        {STRATEGIES.map(s=>{
          const isChosen = chosen===s.id;
          return (
            <button key={s.id} onClick={()=>onChoose(s.id)} style={{
              fontFamily:F,cursor:"pointer",
              background:s.grad,
              border:`2px solid ${isChosen?s.border:`${s.border}33`}`,
              borderRadius:"18px",padding:"20px",textAlign:"left",
              display:"flex",alignItems:"center",gap:"14px",
              boxShadow:isChosen?`0 0 0 3px ${s.border}44,0 8px 32px ${s.border}22`:"none",
              transform:isChosen?"scale(1.015)":"scale(1)",
              transition:"all .2s",
            }}>
              <div style={{width:"56px",height:"56px",borderRadius:"14px",flexShrink:0,
                background:`${s.border}22`,border:`1px solid ${s.border}44`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px"}}>
                {s.emoji}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:900,fontSize:"18px",color:"#f0f6fc",marginBottom:"8px"}}>
                  {s.name}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <RiskMeter level={s.riskLevel} col={s.col}/>
                  <span style={{fontSize:"12px",color:s.col,fontWeight:700}}>{s.risk}</span>
                </div>
              </div>
              <div style={{background:s.tag,color:s.tagText,borderRadius:"12px",
                padding:"8px 14px",fontSize:"16px",fontWeight:900,whiteSpace:"nowrap",flexShrink:0}}>
                {s.valueGain}
              </div>
            </button>
          );
        })}
      </div>
      {chosen&&(
        <div className="zi" style={{marginTop:"18px",background:"#161b22",borderRadius:"12px",
          padding:"12px 20px",border:"1px solid #30363d",fontSize:"14px",fontWeight:700,color:"#4ade80"}}>
          ✅ Strategy locked in
        </div>
      )}
    </div>
  );
};

// ─── Screen: Event Reveal ─────────────────────────────────────────────────────
const EventScreen = ({eventIdx,onNext}:{eventIdx:number;onNext:()=>void}) => {
  const ev = EVENTS[eventIdx];
  const [phase,setPhase] = useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),600);
    const t2=setTimeout(()=>setPhase(2),1600);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);
  return (
    <div onClick={onNext} style={{minHeight:"100vh",background:ev.bg,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"flex-start",fontFamily:F,padding:"40px 24px 80px",cursor:"pointer"}}>
      <p style={{color:`${ev.col}88`,fontWeight:700,fontSize:"11px",letterSpacing:"0.2em",marginBottom:"14px",textTransform:"uppercase"}}>
        Industry Event
      </p>

      {/* Hero */}
      <div className="zi" style={{textAlign:"center",marginBottom:"28px"}}>
        <div style={{fontSize:"clamp(60px,14vw,110px)",marginBottom:"14px",filter:"drop-shadow(0 0 30px currentColor)"}}>
          {ev.emoji}
        </div>
        <h2 style={{fontSize:"clamp(22px,4.5vw,42px)",fontWeight:900,color:"#f8fafc",lineHeight:1.2}}>
          {ev.name}
        </h2>
      </div>

      {/* 3-section story */}
      <div style={{display:"flex",flexDirection:"column",gap:"14px",width:"100%",maxWidth:"620px"}}>
        {/* What happened */}
        <div className="fu" style={{background:"rgba(255,255,255,.06)",borderRadius:"16px",padding:"18px 20px",
          border:`1px solid ${ev.col}22`}}>
          <p style={{fontWeight:900,fontSize:"12px",color:ev.col,letterSpacing:"0.12em",marginBottom:"8px"}}>
            🎯 WHAT HAPPENED
          </p>
          <p style={{fontSize:"15px",color:"#f0f6fc",lineHeight:1.65,fontWeight:600}}>{ev.story}</p>
        </div>

        {/* Impact */}
        {phase>=1&&(
          <div className="fu" style={{background:"rgba(255,255,255,.06)",borderRadius:"16px",padding:"18px 20px",
            border:`1px solid ${ev.col}22`}}>
            <p style={{fontWeight:900,fontSize:"12px",color:ev.col,letterSpacing:"0.12em",marginBottom:"12px"}}>
              💥 THE IMPACT
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {ev.impact.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:"rgba(255,255,255,.05)",borderRadius:"10px",padding:"10px 14px"}}>
                  <span style={{fontWeight:700,fontSize:"14px",color:"#f8fafc"}}>{r.label}</span>
                  <span style={{fontFamily:M,fontWeight:500,fontSize:"15px",
                    color:r.good?"#4ade80":"#f87171"}}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <p style={{color:"#e2e8f0",fontSize:"16px",marginTop:"24px",fontWeight:700}}>
        Click to continue
      </p>
    </div>
  );
};

// ─── Screen: RBC — Host ───────────────────────────────────────────────────────
const RBCHostScreen = ({round}:{round:number}) => {
  const rows = LEADERBOARD[round-1]??[];
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:F,padding:"40px 24px"}}>
      <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.2em",marginBottom:"8px",textTransform:"uppercase"}}>
        Round {round} · Company Safety Check
      </p>
      <h2 className="zi" style={{fontSize:"clamp(26px,4.5vw,44px)",fontWeight:900,color:"#f0f6fc",marginBottom:"8px",textAlign:"center"}}>
        🏥 Financial Health Report
      </h2>
      <p style={{color:"#e2e8f0",fontSize:"14px",fontWeight:600,marginBottom:"32px",textAlign:"center"}}>
        Do all companies have enough money to cover their obligations?
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(272px,1fr))",gap:"12px",maxWidth:"860px",width:"100%"}}>
        {rows.map((p,i)=>{
          const {emoji:he,label:hl,col:hc,bg:hbg,desc:hdesc} = hi(p.status);
          return (
            <div key={i} className="fu" style={{background:"#161b22",borderRadius:"16px",padding:"18px 20px",
              border:`1px solid ${p.status==="intervention"?"#3a1a1a":p.status==="watch"?"#43270c":"#1a2e1a"}`,
              animationDelay:`${i*0.07}s`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <span style={{fontWeight:800,fontSize:"15px",color:"#f0f6fc"}}>{p.emoji} {p.name}</span>
                <span style={{background:hbg,color:hc,borderRadius:"999px",padding:"4px 10px",fontSize:"12px",fontWeight:800}}>
                  {he} {hl}
                </span>
              </div>
              <CapBar capital={p.capital} rbc={p.rbc} animate/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px",fontSize:"12px",fontWeight:700}}>
                <span style={{color:"#e2e8f0"}}>Money available: <span style={{color:"#60a5fa"}}>{p.capital}</span></span>
                <span style={{color:"#e2e8f0"}}>Minimum needed: <span style={{color:"#f87171"}}>{p.rbc}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Screen: RBC — Player ─────────────────────────────────────────────────────
const RBCPlayerScreen = ({round}:{round:number}) => {
  const s = P_STATS[round];
  const status = statusOf(s.capital, s.rbc);
  const {emoji,label,col,bg,desc} = hi(status);
  const msgs: Record<RBCStatus,{body:string}> = {
    healthy:      {body:"You have a comfortable cushion above the regulator's minimum. Your policyholders are well protected."},
    watch:        {body:"You're above the minimum, but the regulator is watching closely. Slow growth or raise reserves next round."},
    intervention: {body:"Your money has fallen below the required level. The regulator may step in. Take action immediately."},
  };
  const ratio = s.capital / s.rbc;
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:F,padding:"24px"}}>
      <div className="fu" style={{maxWidth:"440px",width:"100%"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"12px",textTransform:"uppercase"}}>
          Round {round} Safety Check · Apex Shield
        </p>

        {/* Big status */}
        <div style={{background:bg,borderRadius:"20px",padding:"28px 24px",marginBottom:"14px",
          border:`2px solid ${col}44`,textAlign:"center"}}>
          <div style={{fontSize:"52px",marginBottom:"8px"}}>{emoji}</div>
          <div style={{fontWeight:900,fontSize:"32px",color:col,marginBottom:"4px"}}>{label}</div>
          <div style={{fontSize:"15px",color:"#f0f6fc",fontWeight:700,marginBottom:"2px"}}>{desc}</div>
          <div style={{fontFamily:M,fontSize:"14px",color:`${col}cc`,marginTop:"4px"}}>
            {(ratio*100).toFixed(0)}% of minimum
          </div>
        </div>

        {/* Bar */}
        <div style={{background:"#161b22",borderRadius:"16px",padding:"20px",border:"1px solid #30363d",marginBottom:"14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{fontSize:"16px"}}>💰</span>
              <span style={{fontWeight:700,fontSize:"13px",color:"#e2e8f0"}}>
                Your Money <InfoTip text="Money your company has to pay claims and survive bad years."/>
              </span>
            </div>
            <span style={{fontFamily:M,fontSize:"20px",fontWeight:500,color:"#60a5fa"}}>{s.capital}</span>
          </div>
          <CapBar capital={s.capital} rbc={s.rbc} animate/>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:"8px",gap:"6px",alignItems:"center"}}>
            <span style={{fontSize:"11px",color:"#e2e8f0",fontWeight:700}}>Minimum required:</span>
            <span style={{fontFamily:M,fontSize:"14px",color:"#f87171",fontWeight:500}}>{s.rbc}</span>
            <InfoTip text="The minimum amount regulators require you to hold to protect policyholders."/>
          </div>
        </div>

        {/* Context message */}
        <div style={{background:"#161b22",borderRadius:"14px",padding:"16px 18px",border:"1px solid #21262d"}}>
          <p style={{fontSize:"14px",color:"#e2e8f0",lineHeight:1.6,fontWeight:600}}>{msgs[status].body}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Future Planning (ORSA) ──────────────────────────────────────────
const ORSAScreen = ({round,viewMode,chosen,onChoose}:
  {round:number;viewMode:ViewMode;chosen:string|null;onChoose:(id:string)=>void}) => {
  const scenarios = ["","","a year with higher costs and a market downturn",
    "another surge of unexpected claims","a prolonged period of low interest rates"];
  const scenario = scenarios[round];
  if (viewMode==="host") return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:F,padding:"40px 24px"}}>
      <div className="fu" style={{textAlign:"center",maxWidth:"580px"}}>
        <div style={{fontSize:"44px",marginBottom:"14px"}}>🔭</div>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.15em",marginBottom:"8px",textTransform:"uppercase"}}>
          Future Planning
        </p>
        <h2 style={{fontSize:"clamp(22px,4vw,38px)",fontWeight:900,color:"#f0f6fc",marginBottom:"10px"}}>
          How do you prepare for what's next?
        </h2>
        <p style={{color:"#e2e8f0",fontSize:"15px",fontWeight:600,marginBottom:"28px",lineHeight:1.6}}>
          Players are planning for:<br/>
          <span style={{color:"#818cf8"}}>Next year could bring {scenario}.</span>
        </p>
        <div style={{background:"#161b22",borderRadius:"16px",padding:"22px",border:"1px solid #30363d"}}>
          <p style={{color:"#4ade80",fontWeight:800,fontSize:"18px",marginBottom:"6px"}}>
            {chosen?"6 / 6":"5 / 6"} players have responded
          </p>
          <p style={{color:"#e2e8f0",fontWeight:600,fontSize:"13px"}}>Waiting for all players to submit…</p>
        </div>
      </div>
    </div>
  );
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:F,padding:"24px"}}>
      <div className="fu" style={{maxWidth:"460px",width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"36px",marginBottom:"8px"}}>🔭</div>
          <p style={{color:"#818cf8",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"8px",textTransform:"uppercase"}}>
            Future Planning · Round {round}
          </p>
          <p style={{fontWeight:900,fontSize:"18px",color:"#f0f6fc",marginBottom:"6px",lineHeight:1.4}}>
            What if next year brought {scenario}?
          </p>
          <p style={{fontWeight:700,fontSize:"13px",color:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
            How would you respond?
            <InfoTip text="This is called ORSA — Own Risk and Solvency Assessment. Strong companies plan ahead for tough scenarios."/>
          </p>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {ORSA_OPTIONS.map(opt=>{
            const isChosen=chosen===opt.id;
            return (
              <button key={opt.id} onClick={()=>!chosen&&onChoose(opt.id)} style={{
                fontFamily:F,cursor:chosen?"default":"pointer",textAlign:"left",
                background:isChosen?`${opt.col}20`:"#161b22",
                border:`2px solid ${isChosen?opt.col:"#30363d"}`,
                borderRadius:"14px",padding:"15px 18px",
                display:"flex",alignItems:"center",gap:"14px",
                transform:isChosen?"scale(1.015)":"scale(1)",
                opacity:chosen&&!isChosen?.35:1,transition:"all .2s",
              }}>
                <div style={{fontSize:"28px"}}>{opt.icon}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:"16px",color:"#f0f6fc",marginBottom:"2px"}}>{opt.text}</div>
                  <div style={{fontSize:"12px",color:"#e2e8f0",fontWeight:600}}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        {chosen&&(
          <div className="zi" style={{marginTop:"14px",background:"#161b22",borderRadius:"12px",
            padding:"14px 18px",border:"1px solid #818cf866"}}>
            <p style={{fontWeight:800,fontSize:"13px",color:"#818cf8",marginBottom:"4px"}}>📊 What this means for you</p>
            <p style={{fontSize:"13px",color:"#e2e8f0",fontWeight:600,lineHeight:1.5}}>
              {ORSA_OUTCOMES[chosen]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Screen: Leaderboard ──────────────────────────────────────────────────────
const LeaderboardScreen = ({round,viewMode,companyName}:{round:number;viewMode:ViewMode;companyName:string}) => {
  const rows = LEADERBOARD[round-1]??[];
  const sorted = [...rows].sort((a,b)=>b.value-a.value);
  const prev   = round>1?LEADERBOARD[round-2]:null;
  const playerRank = sorted.findIndex(r=>r.name==="Apex Shield")+1;
  const playerRow  = sorted.find(r=>r.name==="Apex Shield");

  if (viewMode==="player") {
    const ordinals=["","1st","2nd","3rd","4th","5th","6th"];
    const {emoji:hEmoji,label:hLabel,col:hCol}=hi(playerRow?.status??"watch");
    return (
      <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",
        justifyContent:"center",fontFamily:F,padding:"24px"}}>
        <div className="zi" style={{textAlign:"center"}}>
          <div style={{fontSize:"clamp(80px,20vw,140px)",fontWeight:900,lineHeight:1,
            color:playerRank===1?"#fbbf24":playerRank<=3?"#818cf8":"#e2e8f0",marginBottom:"12px"}}>
            {ordinals[playerRank]||`#${playerRank}`}
          </div>
          <div style={{fontSize:"clamp(28px,6vw,44px)",fontWeight:800,color:hCol}}>
            {hEmoji} {hLabel}
          </div>
        </div>
      </div>
    );
  }

  // Host: podium + list
  const podiumOrder = [sorted[1],sorted[0],sorted[2]];
  const podiumRank  = [2,1,3];
  const podiumH     = ["100px","140px","80px"];

  return (
    <div style={{minHeight:"100vh",background:"#0d1117",fontFamily:F,padding:"40px 24px",
      display:"flex",flexDirection:"column",alignItems:"center"}}>
      <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.2em",marginBottom:"6px",textTransform:"uppercase"}}>
        {round===5?"Final Rankings":"Round "+round+" Rankings"}
      </p>
      <h2 className="zi" style={{fontSize:"clamp(22px,4vw,38px)",fontWeight:900,color:"#f0f6fc",marginBottom:"32px",textAlign:"center"}}>
        📊 Company Rankings
      </h2>

      {/* Podium */}
      <div style={{display:"flex",gap:"10px",justifyContent:"center",alignItems:"flex-end",marginBottom:"32px"}}>
        {podiumOrder.map((p,i)=>{
          if(!p)return null;
          const rank=podiumRank[i];
          const medals=["","🥇","🥈","🥉"];
          return (
            <div key={p.name} className="fu" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",animationDelay:`${i*0.1}s`}}>
              <div style={{textAlign:"center",marginBottom:"4px"}}>
                <div style={{fontSize:"24px"}}>{p.emoji}</div>
                <div style={{fontWeight:800,fontSize:"13px",color:"#f0f6fc",maxWidth:"110px",wordBreak:"break-word"}}>{p.name}</div>
                <div style={{fontFamily:M,fontSize:"14px",color:"#818cf8",margin:"2px 0"}}>Value: {p.value}</div>
                <HealthBadge status={p.status}/>
              </div>
              <div style={{width:"110px",height:podiumH[i],borderRadius:"8px 8px 0 0",
                background:rank===1?"linear-gradient(180deg,#fbbf24,#d97706)":
                           rank===2?"linear-gradient(180deg,#94a3b8,#64748b)":
                           "linear-gradient(180deg,#b45309,#92400e)",
                display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8px"}}>
                <span style={{fontFamily:M,fontSize:"26px",fontWeight:500,color:"#fff"}}>{medals[rank]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Remaining list */}
      <div style={{width:"100%",maxWidth:"680px",display:"flex",flexDirection:"column",gap:"8px"}}>
        {sorted.slice(3).map((p,i)=>{
          const prevIdx = prev?prev.findIndex(r=>r.name===p.name):-1;
          const change  = prev?prevIdx-(i+3):0;
          const isPlayer=p.name==="Apex Shield";
          return (
            <div key={p.name} className="fu" style={{
              background:isPlayer?"#161b22":"#13161c",borderRadius:"14px",
              padding:"14px 18px",border:`1px solid ${isPlayer?"#4f46e5aa":"#21262d"}`,
              display:"flex",alignItems:"center",gap:"14px",
              animationDelay:`${(i+3)*0.06}s`,
              boxShadow:isPlayer?"0 0 0 2px #4f46e5aa":"none",
            }}>
              <div style={{fontFamily:M,fontSize:"20px",fontWeight:500,color:"#e2e8f0",minWidth:"32px",textAlign:"center"}}>
                #{i+4}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:"15px",color:"#f0f6fc"}}>
                  {p.emoji} {isPlayer?companyName:p.name} {isPlayer&&<span style={{color:"#818cf8",fontSize:"12px"}}>(You)</span>}
                </div>
                {change!==0&&(
                  <div style={{fontSize:"11px",fontWeight:700,marginTop:"2px",
                    color:change>0?"#4ade80":"#f87171"}}>
                    {change>0?`▲ Up ${change}`:`▼ Down ${Math.abs(change)}`}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:"14px",alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:M,fontSize:"20px",fontWeight:500,color:"#818cf8",lineHeight:1}}>{p.value}</div>
                  <div style={{fontSize:"10px",color:"#e2e8f0",fontWeight:700}}>VALUE</div>
                </div>
                <HealthBadge status={p.status}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Screen: Final Results ────────────────────────────────────────────────────
const FinalScreen = ({viewMode,choices}:{viewMode:ViewMode;choices:(string|null)[]}) => {
  const sorted = [...LEADERBOARD[4]].sort((a,b)=>b.value-a.value);
  const playerIdx = sorted.findIndex(r=>r.name==="Apex Shield");
  const playerRow = sorted[playerIdx];
  const safeCount = choices.filter(c=>c==="conservative").length;
  const riskyCount= choices.filter(c=>c==="aggressive").length;
  const playerStatus = playerRow ? statusOf(playerRow.capital, playerRow.rbc) : "watch";

  const narrative = safeCount>=3
    ? "You took the cautious approach — prioritising stability over speed. Your reserves stayed healthy through every shock."
    : riskyCount>=3
    ? "You chased maximum growth — bold, but it stretched your reserves thin. High value, high risk."
    : "You kept a steady hand — growing consistently while managing exposure. Balanced strategy paid off.";

  const narrativeTitle = safeCount>=3?"🐢 Steady Hand":riskyCount>=3?"🚀 High Roller":"⚖️ Strategic Thinker";

  const achievements = [
    {icon:"🏆",label:"Long-Term Thinker",     desc:"Completed all Future Planning challenges",  earned:true},
    {icon:"🛡",label:"Risk Manager",            desc:"Never entered the danger zone",             earned:playerStatus!=="intervention"},
    {icon:"📈",label:"Growth Champion",         desc:"Reached company value of 10 or more",      earned:(playerRow?.value??0)>=10},
    {icon:"⭐",label:"Strategic Thinker",       desc:"Made balanced decisions throughout",       earned:!safeCount||!riskyCount?false:(safeCount>=1&&riskyCount>=1)},
  ];

  if (viewMode==="player") return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"flex-start",fontFamily:F,padding:"32px 24px 80px"}}>
      <Confetti/>
      <div className="zi" style={{maxWidth:"420px",width:"100%",textAlign:"center"}}>
        <div style={{fontSize:"52px",marginBottom:"8px"}}>🎉</div>
        <h2 style={{fontSize:"32px",fontWeight:900,color:"#f0f6fc",marginBottom:"4px"}}>Game Over!</h2>
        <p style={{color:"#818cf8",fontWeight:700,fontSize:"16px",marginBottom:"24px"}}>{narrativeTitle}</p>

        {/* Final card */}
        <div style={{background:"#161b22",borderRadius:"20px",padding:"22px",
          border:"1px solid #4f46e5aa",marginBottom:"20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px"}}>
            {([["📈","Final Value",playerRow?.value??0,"#818cf8"],
               ["💰","Money Left",playerRow?.capital??0,"#60a5fa"],
               ["🏆","Final Rank",`#${playerIdx+1}`,"#fbbf24"],
               ["⭐","Reputation",P_STATS[5].rep,"#c084fc"]] as [string,string,string|number,string][]).map(([ic,lb,vl,col])=>(
              <div key={lb} style={{background:"#0d1117",borderRadius:"10px",padding:"12px"}}>
                <div style={{fontSize:"22px",marginBottom:"4px"}}>{ic}</div>
                <div style={{fontFamily:M,fontSize:"20px",fontWeight:500,color:col,lineHeight:1}}>{vl}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:"#e2e8f0",marginTop:"2px"}}>{lb}</div>
              </div>
            ))}
          </div>
          <HealthBadge status={playerRow?.status??"watch"} large/>
        </div>

        {/* Narrative */}
        <div style={{background:"linear-gradient(135deg,#161b22,#1e2437)",borderRadius:"16px",
          padding:"18px 20px",border:"1px solid #4f46e5aa",marginBottom:"20px",textAlign:"left"}}>
          <p style={{fontWeight:900,fontSize:"13px",color:"#818cf8",marginBottom:"8px",letterSpacing:"0.05em"}}>
            📖 YOUR STORY
          </p>
          <p style={{fontSize:"14px",color:"#e2e8f0",lineHeight:1.65,fontWeight:600,fontStyle:"italic"}}>
            "{narrative}"
          </p>
        </div>

        {/* Achievements */}
        <div style={{textAlign:"left",marginBottom:"20px"}}>
          <p style={{fontWeight:900,fontSize:"12px",color:"#e2e8f0",letterSpacing:"0.1em",marginBottom:"10px"}}>
            ACHIEVEMENTS
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {achievements.map(a=>(
              <div key={a.label} style={{background:"#161b22",borderRadius:"12px",padding:"12px 14px",
                border:`1px solid ${a.earned?"#fbbf2444":"#21262d"}`,
                display:"flex",alignItems:"center",gap:"12px",opacity:a.earned?1:0.4}}>
                <span style={{fontSize:"22px"}}>{a.icon}</span>
                <div>
                  <div style={{fontWeight:800,fontSize:"13px",color:a.earned?"#fbbf24":"#8b949e"}}>{a.label}</div>
                  <div style={{fontSize:"11px",color:"#e2e8f0",fontWeight:600}}>{a.desc}</div>
                </div>
                {a.earned&&<span style={{marginLeft:"auto",fontSize:"16px"}}>✅</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Host final
  const podiumOrder=[sorted[1],sorted[0],sorted[2]];
  const podiumRank=[2,1,3];
  const podiumH=["100px","144px","80px"];
  return (
    <div style={{minHeight:"100vh",background:"#0d1117",fontFamily:F,padding:"40px 24px",
      display:"flex",flexDirection:"column",alignItems:"center"}}>
      <Confetti/>
      <div className="zi" style={{textAlign:"center",marginBottom:"36px"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"12px",letterSpacing:"0.2em",marginBottom:"6px",textTransform:"uppercase"}}>
          Game Over
        </p>
        <h1 style={{fontSize:"clamp(38px,7vw,68px)",fontWeight:900,letterSpacing:"-2px",lineHeight:1,
          background:"linear-gradient(135deg,#818cf8,#c084fc,#f9a8d4)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:"6px"}}>
          Final Results
        </h1>
      </div>

      {/* Podium */}
      <div style={{display:"flex",gap:"10px",justifyContent:"center",alignItems:"flex-end",marginBottom:"40px"}}>
        {podiumOrder.map((p,i)=>{
          if(!p)return null;
          const rank=podiumRank[i]; const medals=["","🥇","🥈","🥉"];
          return (
            <div key={p.name} className="fu" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",animationDelay:`${i*0.1}s`}}>
              <div style={{textAlign:"center",marginBottom:"4px"}}>
                <div style={{fontSize:"26px"}}>{p.emoji}</div>
                <div style={{fontWeight:800,fontSize:"13px",color:"#f0f6fc",maxWidth:"110px",wordBreak:"break-word"}}>{p.name}</div>
                <div style={{fontFamily:M,fontSize:"13px",color:"#818cf8"}}>Value: {p.value}</div>
                <HealthBadge status={p.status}/>
              </div>
              <div style={{width:"110px",height:podiumH[i],borderRadius:"8px 8px 0 0",
                background:rank===1?"linear-gradient(180deg,#fbbf24,#d97706)":
                           rank===2?"linear-gradient(180deg,#94a3b8,#64748b)":"linear-gradient(180deg,#b45309,#92400e)",
                display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8px"}}>
                <span style={{fontFamily:M,fontSize:"26px",fontWeight:500,color:"#fff"}}>{medals[rank]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Awards */}
      <div style={{maxWidth:"740px",width:"100%",marginBottom:"40px"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"14px",textTransform:"uppercase"}}>Special Awards</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:"10px"}}>
          {[
            {name:"Summit Mutual", emoji:"🐻",title:"🏆 Best Managed Company",  col:"#fbbf24",desc:"Steady growth — strongest reserves at the end"},
            {name:"Apex Shield",   emoji:"🦁",title:"⭐ Strategic Thinker",      col:"#818cf8",desc:"Balanced decisions across all 5 rounds"},
            {name:"Coastal Assure",emoji:"🌊",title:"🛡 Safest Balance Sheet",   col:"#4ade80",desc:"Conservative — resilient through every shock"},
            {name:"Pinnacle Life", emoji:"🦅",title:"📈 Fastest Growth",         col:"#f87171",desc:"Highest company value — at regulatory cost"},
          ].map(a=>(
            <div key={a.name} style={{background:"#161b22",borderRadius:"14px",padding:"16px 18px",border:`1px solid ${a.col}33`}}>
              <p style={{fontWeight:900,fontSize:"14px",color:a.col,marginBottom:"4px"}}>{a.title}</p>
              <p style={{fontWeight:700,fontSize:"14px",color:"#f0f6fc",marginBottom:"3px"}}>{a.emoji} {a.name}</p>
              <p style={{fontSize:"12px",color:"#e2e8f0",fontWeight:600}}>{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Learning summary — plain English */}
      <div style={{maxWidth:"740px",width:"100%"}}>
        <p style={{color:"#e2e8f0",fontWeight:700,fontSize:"11px",letterSpacing:"0.15em",marginBottom:"14px",textTransform:"uppercase"}}>
          What You Learned Today
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}}>
          {[
            {ico:"⚙️",abbr:"ERM",title:"Enterprise Risk Management",col:"#818cf8",
             body:"Every business decision shapes your risk profile. In insurance, growth without risk management is a recipe for disaster."},
            {ico:"🏦",abbr:"RBC",title:"Risk-Based Capital",col:"#4ade80",
             body:"Riskier strategies need more money in reserve. Capital is your company's safety net for policyholders."},
            {ico:"🔭",abbr:"ORSA",title:"Future Planning",col:"#f9a8d4",
             body:"Strong companies don't just manage today's risk — they plan for tomorrow's shocks before they arrive."},
          ].map(item=>(
            <div key={item.abbr} style={{background:"#161b22",borderRadius:"16px",padding:"18px 20px",border:`1px solid ${item.col}33`}}>
              <div style={{width:"38px",height:"38px",borderRadius:"10px",background:`${item.col}20`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",marginBottom:"10px"}}>
                {item.ico}
              </div>
              <p style={{fontWeight:800,fontSize:"14px",color:"#f0f6fc",marginBottom:"5px"}}>{item.title}</p>
              <p style={{fontSize:"13px",color:"#e2e8f0",lineHeight:1.6,fontWeight:600}}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [stepIdx,     setStepIdx]     = useState(0);
  const [viewMode,    setViewMode]    = useState<ViewMode>("host");
  const [choices,     setChoices]     = useState<(string|null)[]>(Array(5).fill(null));
  const [orsa,        setOrsa]        = useState<(string|null)[]>(Array(5).fill(null));
  const [companyName, setCompanyName] = useState("Apex Shield");
  const [roomCode,    setRoomCode]    = useState("");
  const [players,     setPlayers]     = useState<LobbyPlayer[]>([]);
  const [roomStatus,  setRoomStatus]  = useState<KVRoomStatus>("waiting");
  const [isHost,      setIsHost]      = useState(false);
  const [lobbyError,  setLobbyError]  = useState<string | null>(null);
  const [isBusy,      setIsBusy]      = useState(false);

  const step    = STEPS[stepIdx];
  const advance = () => setStepIdx(i=>Math.min(i+1,STEPS.length-1));
  const back    = () => setStepIdx(i=>Math.max(i-1,0));

  const loadLobby = async (code: string) => {
    try {
      const nextPlayers = await fetchPlayersFromKV(code);
      const status = await fetchRoomStatusFromKV(code);
      setPlayers(nextPlayers ?? []);
      setRoomStatus(status ?? "waiting");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    loadLobby(roomCode);
    const interval = window.setInterval(() => {
      loadLobby(roomCode);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [roomCode]);

  useEffect(() => {
    if (roomStatus !== "started") return;
    if (step.id === "host-lobby" || step.id === "player-lobby") {
      setTimeout(() => setStepIdx(i=>Math.min(i+1,STEPS.length-1)), 300);
    }
  }, [roomStatus, step.id]);

  const handleHost = async (name: string) => {
    setLobbyError(null);
    setIsBusy(true);
    const code = generateRoomCode(4);
    try {
      await createRoomInKV(code, name);
      setCompanyName(name);
      setRoomCode(code);
      setIsHost(true);
      setRoomStatus("waiting");
      setPlayers([{ id: "host", name }]);
      setStepIdx(STEPS.findIndex(item => item.id === "host-lobby"));
    } catch (error) {
      setLobbyError((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = async (code: string, name: string) => {
    setLobbyError(null);
    setIsBusy(true);
    try {
      await joinRoomInKV(code, name);
      setCompanyName(name);
      setRoomCode(code);
      setIsHost(false);
      setRoomStatus("waiting");
      setStepIdx(STEPS.findIndex(item => item.id === "player-lobby"));
    } catch (error) {
      setLobbyError((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStart = async () => {
    if (!roomCode) return;
    setLobbyError(null);
    setIsBusy(true);
    try {
      await startRoomInKV(roomCode);
      setRoomStatus("started");
    } catch (error) {
      setLobbyError((error as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStrategy = (id:string) => {
    const ri=(step.round??1)-1;
    setChoices(prev=>{const n=[...prev];n[ri]=id;return n;});
    setTimeout(advance,700);
  };
  const handleOrsa = (id:string) => {
    const ri=(step.round??1)-1;
    setOrsa(prev=>{const n=[...prev];n[ri]=id;return n;});
    setTimeout(advance,1300);
  };

  const isLobby    = ["home","host-lobby","player-lobby","tutorial"].includes(step.id);
  const isGamePhase= !isLobby;
  const showDash   = viewMode==="player" && step.round!==undefined;
  const navHandled = ["decision","orsa","round-intro","event"].includes(step.id);
  const r          = step.round??1;
  const ri         = r-1;
  const ev         = step.eventIdx??0;

  const renderScreen = () => {
    switch(step.id){
      case "home":         return <HomeScreen onHost={handleHost} onJoin={handleJoin}/>;
      case "host-lobby":   return <HostLobbyScreen roomCode={roomCode} players={players} onStart={handleStart} error={lobbyError}/>;
      case "player-lobby": return <PlayerLobbyScreen roomCode={roomCode} companyName={companyName} players={players} started={roomStatus === "started"}/>;
      case "tutorial":     return <TutorialScreen onStart={advance}/>;
      case "round-intro":  return <RoundIntroScreen round={r} viewMode={viewMode} onNext={advance}/>;
      case "decision":
        return viewMode==="host"
          ? <DecisionHostScreen round={r}/>
          : <DecisionPlayerScreen round={r} chosen={choices[ri]} onChoose={handleStrategy}/>;
      case "event":        return <EventScreen eventIdx={ev} onNext={advance}/>;
      case "rbc":
        return viewMode==="host"
          ? <RBCHostScreen round={r}/>
          : <RBCPlayerScreen round={r}/>;
      case "orsa":         return <ORSAScreen round={r} viewMode={viewMode} chosen={orsa[ri]} onChoose={handleOrsa}/>;
      case "leaderboard":  return <LeaderboardScreen round={r} viewMode={viewMode} companyName={companyName}/>;
      case "final":        return <FinalScreen viewMode={viewMode} choices={choices}/>;
      default:             return null;
    }
  };

  return (
    <div style={{width:"100%",minHeight:"100vh",fontFamily:F,position:"relative",background:"#0d1117"}}>
      <style>{CSS}</style>

      {/* Player persistent dashboard */}
      {showDash && <PlayerDashboard step={step} companyName={companyName}/>}

      {/* Host/Player toggle (game phases) */}
      {isGamePhase&&(
        <div style={{position:"fixed",top:"10px",right:"14px",zIndex:50,
          display:"flex",background:"rgba(13,17,23,.88)",borderRadius:"999px",
          padding:"3px",border:"1px solid #30363d",backdropFilter:"blur(8px)"}}>
          {(["host","player"] as ViewMode[]).map(v=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{
              fontFamily:F,fontWeight:800,fontSize:"12px",padding:"6px 14px",
              borderRadius:"999px",border:"none",cursor:"pointer",
              background:viewMode===v?"#4f46e5":"transparent",
              color:viewMode===v?"#fff":"#8b949e",transition:"all .2s",
            }}>
              {v==="host"?"🖥 Host":"📱 Player"}
            </button>
          ))}
        </div>
      )}

      {/* Screen content */}
      <div style={{paddingTop:showDash?"54px":"0",paddingBottom:"60px"}}>
        {renderScreen()}
      </div>

      {/* Demo navigation bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:40,
        background:"rgba(13,17,23,.94)",backdropFilter:"blur(12px)",
        borderTop:"1px solid #21262d",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 20px",height:"52px"}}>
        <button onClick={back} disabled={stepIdx===0} style={{
          fontFamily:F,fontWeight:800,fontSize:"13px",padding:"6px 14px",
          borderRadius:"10px",border:"1px solid #30363d",cursor:stepIdx>0?"pointer":"not-allowed",
          background:"transparent",color:stepIdx>0?"#e2e8f0":"#21262d",transition:"all .15s",
        }}>← Prev</button>

        <div style={{textAlign:"center"}}>
          <p style={{fontFamily:M,fontSize:"10px",color:"#4f46e5",fontWeight:500,marginBottom:"1px"}}>
            {stepIdx+1} / {STEPS.length}
          </p>
          <p style={{fontFamily:F,fontWeight:700,fontSize:"11px",color:"#e2e8f0"}}>{step.label}</p>
        </div>

        {!navHandled?(
          <button onClick={advance} disabled={stepIdx===STEPS.length-1} style={{
            fontFamily:F,fontWeight:800,fontSize:"13px",padding:"6px 14px",
            borderRadius:"10px",border:"1px solid #4f46e5",cursor:"pointer",
            background:"#4f46e5",color:"#fff",transition:"all .15s",
          }}>Next →</button>
        ):(
          <button onClick={advance} style={{
            fontFamily:F,fontWeight:800,fontSize:"13px",padding:"6px 14px",
            borderRadius:"10px",border:"1px solid #21262d",cursor:"pointer",
            background:"transparent",color:"#e2e8f0",
          }}>Skip →</button>
        )}
      </div>
    </div>
  );
}
