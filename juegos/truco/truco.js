const SUITS=['espada','basto','oro','copa'], PL={espada:'espadas',basto:'bastos',oro:'oros',copa:'copas'};
const NUMS=[1,2,3,4,5,6,7,10,11,12];
const PZ=[2,4,5,11,10], PZV={2:30,4:29,5:28,11:27,10:27};
const FIG={10:'Sota',11:'Caballo',12:'Rey'};
const ENAME={E:'Envido',R:'Real envido',F:'Falta envido'};
const TNAME={2:'Truco',3:'Retruco',4:'Vale cuatro'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- estado de sesión ---------- */
let G=null, tick=0;
let MODE='local', ME=0, SEATNAME=[], HOST=false;
let TCODE=null, mesas=null;
const seen={};
const LANDQ=window.matchMedia?matchMedia('(orientation:landscape) and (max-height:560px)'):null;
if(LANDQ&&LANDQ.addEventListener)LANDQ.addEventListener('change',()=>{if(G)render();});
const ANIM={deal:null,flown:new Set(),won:null,pile:null};
let autoTick=0;
const $=id=>document.getElementById(id);
const team=s=>s%2;
const myTeam=()=>team(ME);
const nm=s=>s===ME?'Vos':(SEATNAME[s]||'Jugador');
const teamName=t=>G.n===2?nm(G.n===2&&team(ME)===t?ME:1-ME):(t===myTeam()?'Nosotros':'Ellos');

/* ---------- reglas de cartas ---------- */
function piezaNum(c){
  const M=G.muestra; if(c.s!==M.s) return 0;
  let n=c.n; if(n===12 && PZ.includes(M.n)) n=M.n;
  return PZ.includes(n)?n:0;
}
function power(c){
  const pz=piezaNum(c); if(pz) return 100-PZ.indexOf(pz);
  if(c.n===1&&c.s==='espada')return 90; if(c.n===1&&c.s==='basto')return 89;
  if(c.n===7&&c.s==='espada')return 88; if(c.n===7&&c.s==='oro')return 87;
  return {3:80,2:79,1:78,12:77,11:76,10:75,7:74,6:73,5:72,4:71}[c.n];
}
const SC={90:.95,89:.9,88:.85,87:.8,80:.7,79:.62,78:.55,77:.45,76:.4,75:.36,74:.3,73:.22,72:.15,71:.08};
function score(c){const p=power(c);return p>=96?.96+(p-96)*.01:SC[p];}
const isMata=c=>!piezaNum(c)&&power(c)>=87;
const ev=c=>c.n>=10?0:c.n;
function envido(h){
  const pz=h.filter(piezaNum).map(c=>PZV[piezaNum(c)]).sort((a,b)=>b-a);
  const np=h.filter(c=>!piezaNum(c));
  if(pz.length) return pz[0]+Math.max(0,...np.map(ev),...pz.slice(1).map(v=>v%10));
  let best=Math.max(...h.map(ev));
  for(const s of SUITS){const v=h.filter(c=>c.s===s).map(ev).sort((a,b)=>b-a);if(v.length>=2)best=Math.max(best,20+v[0]+v[1]);}
  return best;
}
function hasFlor(h){
  const pz=h.filter(piezaNum), np=h.filter(c=>!piezaNum(c));
  if(pz.length>=2) return true;
  if(pz.length===1) return np[0].s===np[1].s;
  return h.every(c=>c.s===h[0].s);
}
function florVal(h){
  const pz=h.filter(piezaNum).map(c=>PZV[piezaNum(c)]).sort((a,b)=>b-a), np=h.filter(c=>!piezaNum(c));
  if(pz.length) return pz[0]+pz.slice(1).reduce((a,v)=>a+v%10,0)+np.reduce((a,c)=>a+ev(c),0);
  return 20+h.reduce((a,c)=>a+ev(c),0);
}
const cname=c=>`${c.n} de ${PL[c.s]}`;

/* ---------- mesa ---------- */
const ACT=()=>G.active||Array.from({length:G.n},(_,s)=>s);
const isAct=s=>ACT().includes(s);
const fromMano=()=>Array.from({length:G.n},(_,k)=>(G.mano+k)%G.n).filter(isAct);
function nextAct(s){for(let k=1;k<=G.n;k++){const q=(s+k)%G.n;if(isAct(q))return q;}return s;}
function nextOpp(s){for(let k=1;k<G.n;k++){const q=(s+k)%G.n;if(isAct(q)&&team(q)!==team(s))return q;}return nextAct(s);}
const played=(s,b)=>G.table[b].some(p=>p.s===s);
function bestOfTeams(valFn,seats){
  // mejor valor por equipo; empate lo gana el equipo cuyo mejor jugador está más cerca del mano
  const best=[null,null];
  for(const s of fromMano()){ if(seats&&!seats.includes(s))continue; const v=valFn(s),t=team(s);
    if(best[t]===null||v>best[t].v)best[t]={v,s}; }
  let w;
  if(!best[0])w=1;else if(!best[1])w=0;
  else if(best[0].v!==best[1].v)w=best[0].v>best[1].v?0:1;
  else w=fromMano().indexOf(best[0].s)<fromMano().indexOf(best[1].s)?0:1;
  return {best,w};
}

/* ---------- flujo ---------- */
function newDeck(){const d=[];for(const s of SUITS)for(const n of NUMS)d.push({n,s,id:n+s});
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
let TARGET=40; try{const t=+localStorage.getItem('truco.puntos');if(t===30||t===40)TARGET=t;}catch(e){}
// pico a pico: 'no' | 'ambos' (los dos equipos en malas) | 'alguno' (alguno en malas)
let PICO='ambos'; try{const v=localStorage.getItem('truco.pico');PICO=v==='no'?'no':v==='alguno'?'alguno':'ambos';}catch(e){}
/* ---------- reglas de la mesa: se eligen antes de jugar y viajan dentro de la partida ---------- */
const RULE_DEF={flor:true,contraflor:true,envidoRep:true};
let RULES={...RULE_DEF}; try{Object.assign(RULES,JSON.parse(localStorage.getItem('truco.reglas')||'{}'));}catch(e){}
const RULE=()=>Object.assign({},RULE_DEF,(G&&G.rules)||{});
/* ---------- ajustes de cada persona (no cambian la partida) ---------- */
const PREF_DEF={vol:80,cpu:'normal',anim:true,auto:true,size:'normal',board:'full'};
let PREF={...PREF_DEF}; try{Object.assign(PREF,JSON.parse(localStorage.getItem('truco.ajustes')||'{}'));}catch(e){}
function savePref(){try{localStorage.setItem('truco.ajustes',JSON.stringify(PREF));}catch(e){}applyPref();}
function applyPref(){const b=document.body;b.dataset.size=PREF.size;b.dataset.board=PREF.board;b.classList.toggle('anim-off',!PREF.anim);}
const CPU_MS={lenta:1700,normal:1000,rapida:450};
let PLAYERS=2; try{const t=+localStorage.getItem('truco.jugadores');if([2,4,6].includes(t))PLAYERS=t;}catch(e){}
function newGame(target,n,cpu,pico,rules){
  n=n||2;
  const m=Math.floor(Math.random()*n);
  G={n,target:target||TARGET,score:[0,0],cpu:cpu||Array.from({length:n},(_,s)=>s!==0),mano:m,dealMano:m,
     picoRule:n===6?(pico===true||pico===undefined?'ambos':pico===false?'no':pico):'no',
     rules:Object.assign({},RULE_DEF,rules||{}),lastPico:true,pico:false,log:[],phase:'play',started:Date.now()};
  G.picoOn=G.picoRule!=='no';
  dealHand();
}
function dealHand(){
  G.dealMano=((G.dealMano??G.mano)+1)%G.n; G.handNo=(G.handNo||0)+1;
  const order=Array.from({length:G.n},(_,k)=>(G.dealMano+k)%G.n);
  const d=newDeck(); G.hands=Array.from({length:G.n},()=>[]);
  for(let i=0;i<3;i++)for(const s of order)G.hands[s].push(d.pop());
  G.muestra=d.pop(); G.orig=G.hands.map(h=>[...h]);
  // pico a pico: en 6, mientras los dos equipos están en malas, se alterna una redonda y una de picos
  const h=TGT()/2, malas=G.picoRule==='alguno'?(G.score[0]<h||G.score[1]<h):(G.score[0]<h&&G.score[1]<h);
  G.pico=!!(G.picoOn&&malas&&!G.lastPico); G.lastPico=G.pico;
  G.duelNext=false; G.bubble={};
  if(G.pico){
    G.duels=[0,1,2].map(k=>{const a=(G.dealMano+k)%6;return [a,(a+3)%6];});
    addLog(null,`Nueva mano de pico a pico. Muestra: ${cname(G.muestra)}.`);
    startDuel(0);
  }else{
    G.active=null; G.duels=null; G.mano=G.dealMano;
    addLog(null,`Nueva mano. Muestra: ${cname(G.muestra)}. Mano: @${G.mano}.`);
    resetRound();
  }
}
function startDuel(i){
  G.duelIdx=i; G.duelNext=false;
  const [a,b]=G.duels[i]; G.active=[a,b]; G.mano=a;
  addLog(null,`Pico ${i+1} de 3: @${a} contra @${b}.`);
  resetRound();
}
function resetRound(){
  Object.assign(G,{table:[[],[],[]],bazaWin:[],baza:0,results:[],leader:G.mano,turn:G.mano,truco:{level:1,owner:null},
    env:{done:false,chain:[]},florRes:null,pending:null,deferred:null,phase:'play',handWinner:null,cpuChk:{},fresh:null,winner:null});
  G.flor=G.hands.map((h,s)=>RULE().flor&&isAct(s)&&hasFlor(h));
  if(G.flor.some(Boolean)){G.env.done=true;resolveFlor();}
}
function resolveFlor(){
  const holders=fromMano().filter(s=>G.flor[s]);
  const teams=new Set(holders.map(team));
  if(teams.size===2){
    const a=holders[0], b=holders.find(s=>team(s)!==team(a));
    holders.forEach(s=>{if(s!==b)say(s,'¡Flor!');});
    G.pending={kind:'flor',by:a,to:b};
  }else{
    holders.forEach(s=>say(s,'¡Flor!'));
    award(team(holders[0]),3*holders.length,holders.length>1?'flores':'flor');G.florRes='done';
  }
}
function florCompare(pts,why){
  const {best,w}=bestOfTeams(s=>florVal(G.orig[s]),G.flor.map((f,s)=>f?s:-1).filter(s=>s>=0));
  addLog(null,`Flor: %0 ${best[0]?best[0].v:'-'}, %1 ${best[1]?best[1].v:'-'}.`);award(w,pts,why);
}
function florOk(s){
  const P=G.pending;
  if(P.kind==='flor'){say(s,'La mía flor');G.pending={kind:'flor2',by:s,to:P.by};}
  else{say(s,'Está bien');G.florRes='end';G.pending=null;addLog(null,'Las flores se comparan al final de la mano (3 puntos).');}
  step();
}
function conFlorEnvido(s){const P=G.pending;say(s,'Con flor envido');G.pending={kind:'cfe',by:s,to:P.by};step();}
function contraFlor(s){const P=G.pending;say(s,'¡Contra flor al resto!');G.pending={kind:'cflor',by:s,to:P.by,prev:P.kind==='cfe'?5:3};step();}
function addLog(who,text){G.log.unshift({who,text});if(G.log.length>40)G.log.length=40;}
function say(who,text){G.bubble[who]={t:text,at:Date.now()+Math.random()};addLog(who,`«${text}»`);}
const TGT=()=>(G&&G.target)||30;
function award(t,pts,why){
  if(G.phase==='over')return;
  G.score[t]=Math.min(TGT(),G.score[t]+pts);addLog(null,`%${t} +${pts} por ${why}`);
  if(G.score[t]>=TGT()){G.phase='over';G.winner=t;G.pending=null;G.deferred=null;reportResult();}
}
function reportResult(){
  // Resultado común que propone ESTADO.md para alimentar el ranking cuando exista el servidor
  try{window.dispatchEvent(new CustomEvent('urugames:resultado',{detail:{juego:'truco',resultado:G.winner===myTeam()?'gano':'perdio',
    puntaje:G.score[myTeam()]+' a '+G.score[1-myTeam()],tiempo:Math.round((Date.now()-(G.started||Date.now()))/1000),jugadores:G.n}}));}catch(e){}
}
const actor=()=>G.pending?G.pending.to:G.turn;
function step(){
  render();
  if(MODE==='online')push();
  maybeCpu();
  maybeAuto();
}
function maybeAuto(){
  if(!G||G.phase!=='handover'||dealer()!==ME||!PREF.auto)return;
  const my=++autoTick;
  setTimeout(()=>{
    if(my!==autoTick||!G||G.phase!=='handover'||dealer()!==ME)return;
    if(G.duelNext)startDuel(G.duelIdx+1);else dealHand();
    step();
  },2800);
}
function maybeCpu(){
  if(!G||G.phase!=='play')return;
  const a=actor();
  if(!G.cpu[a])return;
  if(MODE==='online'&&!HOST)return;
  const my=++tick;
  setTimeout(()=>{if(my===tick&&G&&G.phase==='play'&&G.cpu[actor()])cpuAct(actor());},Math.round((CPU_MS[PREF.cpu]||1000)*(G.n>2?.85:1)));
}
function play(s,i){
  const c=G.hands[s].splice(i,1)[0]; G.table[G.baza].push({s,c}); G.fresh=c.id;
  addLog(s,`juega ${cname(c)}`);
  if(G.table[G.baza].length===ACT().length) resolveBaza(); else G.turn=nextAct(s);
  step();
}
function resolveBaza(){
  const plays=G.table[G.baza], mx=Math.max(...plays.map(p=>power(p.c)));
  const top=plays.filter(p=>power(p.c)===mx), ts=new Set(top.map(p=>team(p.s)));
  const r=ts.size>1?'parda':team(top[0].s);
  G.results.push(r); G.bazaWin.push(r==='parda'?null:top[0].s);
  const w=handWinner(); if(w!==null){endHand(w);return;}
  if(r!=='parda')G.leader=top[0].s; G.turn=G.leader; G.baza++;
}
function handWinner(){
  const R=G.results, P='parda';
  if(R.length===2){const[a,b]=R;
    if(a!==P&&a===b)return a; if(a===P&&b!==P)return b; if(a!==P&&b===P)return a; return null;}
  if(R.length===3){const[a,,c]=R; if(c!==P)return c; return a===P?team(G.mano):a;}
  return null;
}
function endHand(t){
  G.pending=null;G.deferred=null;G.handWinner=t;
  if(G.phase==='over')return;
  G.phase='handover';
  if(G.florRes==='end'){G.florRes='done';florCompare(3,'la mía flor');}
  award(t,G.truco.level,G.truco.level===1?'la mano':TNAME[G.truco.level].toLowerCase());
  if(G.pico&&G.phase!=='over'&&G.duelIdx<2)G.duelNext=true;
}
function envOptions(ch){
  const F=ch.includes('F'),e=ch.filter(x=>x==='E').length,r=ch.filter(x=>x==='R').length,o=[];
  const max=RULE().envidoRep?2:1;
  if(!F&&r===0&&e<max)o.push('E'); if(!F&&r<max)o.push('R'); if(!F)o.push('F'); return o;
}
const falta=()=>G.pico?6:TGT()-Math.max(G.score[0],G.score[1]);
const faltaFlor=()=>G.pico?12:falta();
const sumCh=ch=>ch.reduce((a,x)=>a+(x==='E'?2:3),0);
const envAccept=()=>G.env.chain.includes('F')?falta():sumCh(G.env.chain);
function envReject(){const ch=G.env.chain.slice(0,-1);return ch.length?sumCh(ch):1;}
function canEnvido(s){
  return !G.env.done&&!G.flor.some(Boolean)&&G.baza===0&&!played(s,0)&&G.truco.level===1&&!G.deferred&&
    (G.pending?(G.pending.kind==='truco'&&G.pending.to===s):G.turn===s);
}
const canTruco=s=>!G.pending&&G.turn===s&&G.truco.level<4&&(G.truco.owner===null||G.truco.owner===team(s));

function callEnvido(s,type){
  if(G.pending&&G.pending.kind==='envido'){ G.env.chain.push(type); G.pending={kind:'envido',by:s,to:G.pending.by}; }
  else{ if(G.pending&&G.pending.kind==='truco')G.deferred=G.pending; G.env.chain=[type]; G.pending={kind:'envido',by:s,to:nextOpp(s)}; }
  say(s,ENAME[type]); step();
}
function callTruco(s){
  if(G.pending&&G.pending.kind==='truco'){const P=G.pending;G.truco.level=P.level;G.pending={kind:'truco',by:s,to:P.by,level:P.level+1};}
  else G.pending={kind:'truco',by:s,to:nextOpp(s),level:G.truco.level+1};
  say(s,`¡${TNAME[G.pending.level]}!`); step();
}
function restoreDeferred(){if(G.deferred&&G.phase==='play'){G.pending=G.deferred;}G.deferred=null;}
function quiero(s){
  const P=G.pending; say(s,'Quiero'); G.pending=null;
  if(P.kind==='cflor'){G.florRes='done';florCompare(faltaFlor(),'contra flor al resto');step();return;}
  if(P.kind==='cfe'){G.florRes='done';florCompare(5,'con flor envido');step();return;}
  if(P.kind==='envido'){resolveEnvido();restoreDeferred();}
  else{G.truco.level=P.level;G.truco.owner=team(s);}
  step();
}
function resolveEnvido(){
  G.env.done=true;
  const {best,w}=bestOfTeams(s=>envido(G.orig[s]));
  const at=Date.now()+Math.random();
  G.bubble[best[w].s]={t:String(best[w].v),at};
  G.bubble[best[1-w].s]={t:'Son buenas',at};
  addLog(null,`Envido: %0 ${best[0].v} (@${best[0].s}), %1 ${best[1].v} (@${best[1].s}).`);
  award(w,envAccept(),'envido');
}
function noQuiero(s){
  const P=G.pending; say(s,'No quiero'); G.pending=null;
  if(P.kind==='cflor'){G.florRes='done';award(team(P.by),P.prev||3,'contraflor no querida');step();return;}
  if(P.kind==='cfe'){G.florRes='done';award(team(P.by),3,'con flor envido no querido');step();return;}
  if(P.kind==='envido'){G.env.done=true;award(team(P.by),envReject(),'envido no querido');restoreDeferred();}
  else endHand(team(P.by));
  step();
}
function mazo(s){say(s,'Me voy al mazo');endHand(1-team(s));step();}

/* ---------- máquina ---------- */
// Dificultad del menú: fácil se equivoca y canta peor; difícil no tira cartas al azar y blufea menos
let DIF=(window.URUGAMES&&window.URUGAMES.dificultad)||'normal';
let DIFT={facil:.1,normal:0,dificil:-.04}[DIF]||0;
function cpuStrength(s){
  const cur=G.table[G.baza],mine=cur.find(p=>p.s===s),pool=G.hands[s].map(score); if(mine)pool.push(score(mine.c));
  pool.sort((a,b)=>b-a); const v=i=>pool[i]??0, T=team(s);
  const R=G.results,w=R.filter(x=>x===T).length,l=R.filter(x=>x===1-T).length;
  let e;
  if(!R.length) e=.45*v(0)+.35*v(1)+.2*v(2);
  else if(w>l) e=.55+.45*v(0);
  else if(l>w) e=Math.min(1,v(0)*v(1)*1.15);
  else e=v(0);
  if(ACT().length>2) e=Math.min(1,e+.06*(ACT().length/2-1)); // con compañeros se confía un poco más
  if(!mine&&cur.length){
    const opp=Math.max(0,...cur.filter(p=>team(p.s)!==T).map(p=>power(p.c)));
    const mate=Math.max(0,...cur.filter(p=>team(p.s)===T).map(p=>power(p.c)));
    if(mate>opp)e+=.08; else e+=G.hands[s].some(c=>power(c)>opp)?.12:-.2;
  }
  return Math.max(0,Math.min(1,e));
}
function cpuAct(s){
  const P=G.pending,r=Math.random();
  if(P&&P.to===s){
    if(P.kind==='envido') return cpuEnvResp(s);
    if(P.kind==='flor'||P.kind==='flor2'){const v=florVal(G.orig[s]);
      if(RULE().contraflor&&((v>=35&&r<.6)||r<.04)) return contraFlor(s);
      if(RULE().contraflor&&((v>=31&&r<.5)||r<.06)) return conFlorEnvido(s);
      return florOk(s);}
    if(P.kind==='cfe'){const v=florVal(G.orig[s]);
      if(v>=35&&r<.5) return contraFlor(s);
      return (v>=30||r<.3)?quiero(s):noQuiero(s);}
    if(P.kind==='cflor'){const v=florVal(G.orig[s]);
      return (v>=33||(v>=30&&r<.4))?quiero(s):noQuiero(s);}
    if(canEnvido(s)){const v=envido(G.orig[s]);
      if(v>=28||(v>=26&&r<.4)) return callEnvido(s,v>=31&&Math.random()<.5?'R':'E');}
    const e=cpuStrength(s),L=P.level,r2=Math.random();
    if(L<4&&e>.82&&r2<.6) return callTruco(s);
    if(e>.36+.06*(L-2)||r2<.08) return quiero(s);
    return noQuiero(s);
  }
  if(G.turn!==s)return;
  const ke='env'+s;
  if(canEnvido(s)&&!G.cpuChk[ke]){
    G.cpuChk[ke]=true;const v=envido(G.orig[s]);
    if(v>=31&&r<.35) return callEnvido(s,'R');
    if((v>=27&&r<.85)||(v>=25&&r<.4)||r<.05) return callEnvido(s,'E');
  }
  const k='t'+s+'-'+G.baza+'-'+G.truco.level;
  if(canTruco(s)&&!G.cpuChk[k]){
    G.cpuChk[k]=true;const e=cpuStrength(s),th={2:.7,3:.8,4:.9}[G.truco.level+1]+DIFT;
    if((e>th&&Math.random()<.75)||Math.random()<.05) return callTruco(s);
  }
  cpuPlay(s);
}
function cpuEnvResp(s){
  const ch=G.env.chain,v=envido(G.orig[s]),r=Math.random(),o=envOptions(ch);
  if(v>=31&&o.includes('F')&&r<.35) return callEnvido(s,'F');
  if(v>=30&&o.includes('R')&&r<.5) return callEnvido(s,'R');
  let ok;
  if(ch.includes('F')) ok=v>=29||(v>=27&&r<.35);
  else ok=v>=27||(v>=25&&r<.55)||(v>=22&&ch.length===1&&r<.2);
  return ok?quiero(s):noQuiero(s);
}
function cpuPlay(s){
  const h=G.hands[s],asc=[...h].sort((a,b)=>power(a)-power(b)),cur=G.table[G.baza],T=team(s);let pick;
  if(DIF==='facil'&&Math.random()<.35)return play(s,Math.floor(Math.random()*h.length));
  if(cur.length){
    const opp=Math.max(0,...cur.filter(p=>team(p.s)!==T).map(p=>power(p.c)));
    const mate=Math.max(0,...cur.filter(p=>team(p.s)===T).map(p=>power(p.c)));
    const win=asc.filter(c=>power(c)>opp),tie=asc.filter(c=>power(c)===opp);
    const left=ACT().length-cur.length-1; // jugadores que faltan después de mí
    if(mate>opp&&(left===0||mate>=87)) pick=asc[0];
    else if(win.length) pick=win[0];
    else if(tie.length&&G.results[0]===T) pick=tie[0];
    else pick=asc[0];
  }else if(asc.length===3) pick=asc[1];
  else if(asc.length===2) pick=G.results[0]===T?(score(asc[1])>=.7?asc[1]:asc[0]):asc[1];
  else pick=asc[0];
  play(s,h.indexOf(pick));
}

/* ---------- dibujo ---------- */
const ROW={oro:0,copa:1,espada:2,basto:3};
function cardHTML(c,{cls='',act='',badge=''}={}){
  const pos=`background-position:${((c.n-1)/11*100).toFixed(4)}% ${ROW[c.s]*25}%`;
  const k=`card ${cls}`;
  return act?`<button class="${k}" style="${pos}" data-act="${act}" aria-label="Jugar ${cname(c)}">${badge}</button>`
            :`<div class="${k}" style="${pos}" role="img" aria-label="${cname(c)}">${badge}</div>`;
}
const backHTML=(cls='')=>`<div class="card back ${cls}" style="" aria-hidden="true"></div>`;
function sticks(n,T){
  const groups=T/5, half=groups/2;
  let s='',x=3;const S=17,GAP=9;
  for(let g=0;g<groups;g++){
    if(g===half){s+=`<line class="divl" x1="${x+1}" y1="1" x2="${x+1}" y2="25"/>`;x+=9;}
    const k=Math.max(0,Math.min(5,n-g*5)),x0=x,y0=4;
    const seg=[[x0,y0,x0+S,y0],[x0+S,y0,x0+S,y0+S],[x0+S,y0+S,x0,y0+S],[x0,y0+S,x0,y0],[x0,y0,x0+S,y0+S]];
    seg.forEach(([a,b,c,d],i)=>{
      if(i<k) s+=`<line class="stick" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;
      else if(i<4) s+=`<line class="ghost" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;
    });
    x+=S+GAP;
  }
  return `<svg class="sticks" viewBox="0 0 ${x} 26" width="${x}" height="26" aria-hidden="true">${s}</svg>`;
}
const fill=t=>esc(t).replace(/@(\d)/g,(_,s)=>esc(nm(+s))).replace(/%(\d)/g,(_,t)=>esc(teamName(+t)));
let bubbleTimer=null;
const SND={'¡Truco!':'truco','¡Retruco!':'retruco','¡Vale cuatro!':'vale-cuatro','Envido':'envido','Real envido':'real-envido','Falta envido':'falta-envido','¡Flor!':'flor','¡Contra flor al resto!':'contraflor','Quiero':'quiero','No quiero':'no-quiero','Con flor envido':'con-flor-envido','La mía flor':'la-mia-flor','Me voy al mazo':'mazo'};
const audioCache={}; let sndBusy=0;
let SOUND_ON=true; try{SOUND_ON=localStorage.getItem('truco.sonido')!=='no';}catch(e){}
function playSnd(t,s){
  const n=SND[t]; if(!n||!SOUND_ON||PREF.vol<=0)return;
  const f=`snd/${team(s)===myTeam()?'grave':'aguda'}/${n}.mp3`;
  try{const a=audioCache[f]||(audioCache[f]=new Audio(f));
    const now=Date.now(),wait=Math.max(0,sndBusy-now),len=(a.duration&&isFinite(a.duration)?a.duration*1000:2000);
    sndBusy=now+wait+len;
    setTimeout(()=>{a.currentTime=0;a.volume=Math.max(0,Math.min(1,PREF.vol/100));const p=a.play();if(p)p.catch(()=>{});},wait);}catch(e){}
}
function bubbleFor(s){
  const b=G.bubble&&G.bubble[s]; if(!b)return '';
  const key=s+':'+b.at; if(!seen[key]){seen[key]=Date.now(); if(Math.abs(Date.now()-b.at)<6000)playSnd(b.t,s);}
  const left=2600-(Date.now()-seen[key]);
  if(left<=0)return '';
  clearTimeout(bubbleTimer); bubbleTimer=setTimeout(render,left+30);
  return `<div class="bubble">${esc(b.t)}</div>`;
}
const SBTN=()=>`<button class="btn ghost sm" data-act="snd" aria-pressed="${SOUND_ON}">${SOUND_ON?'Sonido: sí':'Sonido: no'}</button><button class="btn ghost sm" data-act="opts" aria-haspopup="dialog">Opciones</button><button class="btn ghost sm" data-act="leave">Volver al inicio</button>`;
function render(){
  if(!G)return;
  const MT=myTeam();
  $('score').innerHTML=[MT,1-MT].map(t=>{
    const n=G.score[t];return `<div class="srow"><span class="sname">${esc(teamName(t))} <span class="stage">en ${n<TGT()/2?'malas':'buenas'}</span></span>${sticks(n,TGT())}<span class="spts">${n}</span></div>`;}).join('');
  const picoTxt=G.pico?`, pico a pico ${G.duelIdx+1} de 3: ${esc(nm(G.active[0]))} contra ${esc(nm(G.active[1]))}`:'';
  const modeTxt0=G.n===2?(MODE==='online'?`contra ${esc(nm(1-ME))}`:'contra la máquina'):`${G.n} jugadores, ${G.n/2} contra ${G.n/2}`;
  const modeTxt=modeTxt0+picoTxt;
  const tvH=G.truco.level===1?'sin cantar':TNAME[G.truco.level];
  $('ghead').innerHTML=`<span>${MODE==='online'?`Mesa <b>${esc(TCODE)}</b>, `:''}${modeTxt}<span class="infoL">. Truco ${tvH}, ${!isAct(ME)?'mirás este pico':(G.mano===ME?'sos mano':'sos pie')}</span></span><span class="btns">${SBTN()}</span>`;

  const reveal=G.phase!=='play';
  // ronda: los demás alrededor, cada carta jugada delante de quien la tiró, el mazo con la muestra al lado del mano
  const LAND=LANDQ&&LANDQ.matches;
  const SEAT=LAND?{2:[[50,112],[50,1]],4:[[50,112],[90,50],[50,1],[10,50]],6:[[50,112],[90,66],[78,20],[50,1],[22,20],[10,66]]}[G.n]:{2:[[50,112],[50,1]],4:[[50,112],[84,50],[50,1],[16,50]],6:[[50,112],[84,64],[84,30],[50,1],[16,30],[16,64]]}[G.n];
  const SEATC=LAND?{2:[[50,112],[50,10]],4:[[50,112],[90,50],[50,10],[10,50]],6:[[50,112],[90,66],[78,20],[50,10],[22,20],[10,66]]}[G.n]:{2:[[50,112],[50,10]],4:[[50,112],[84,50],[50,10],[16,50]],6:[[50,112],[84,64],[84,30],[50,10],[16,30],[16,64]]}[G.n];
  const PLAY=LAND?{2:[[50,82],[50,46]],4:[[50,84],[72,50],[50,48],[28,50]],6:[[50,86],[74,72],[64,44],[50,50],[36,44],[26,72]]}[G.n]:{2:[[50,74],[50,30]],4:[[50,76],[67,50],[50,28],[33,50]],6:[[50,77],[66,62],[66,38],[50,27],[34,38],[34,62]]}[G.n];
  const PILE=LAND?{2:[[30,88],[68,8]],4:[[22,86],[90,86],[66,6],[10,86]],6:[[36,90],[90,92],[93,22],[64,6],[7,22],[10,92]]}[G.n]:{2:[[20,78],[80,22]],4:[[22,80],[86,78],[78,14],[14,78]],6:[[22,84],[86,86],[84,47],[71,4],[16,47],[14,86]]}[G.n];
  const off=s=>(s-ME+G.n)%G.n;
  const others=Array.from({length:G.n-1},(_,k)=>(ME+1+k)%G.n);
  $('mesaMain').className='mesa n'+G.n;
  const dealKey=(G.handNo||0)+':'+(G.muestra&&G.muestra.id), dealing=dealKey!==ANIM.deal;
  const seatsHTML=others.map(s=>{
    const mate=team(s)===MT, turn=G.phase==='play'&&actor()===s, [x,y]=SEAT[off(s)];
    return `<div class="opp ${mate?'mate':'rival'} ${turn?'turn':''} ${y<5?'attop':''} ${isAct(s)?'':'out'}" style="left:${x}%;top:${y}%">
      <div class="who">${esc(nm(s))}${G.n>2?` <span class="tag">${mate?'compañero':'rival'}</span>`:''}${G.mano===s?' <span class="chip">Mano</span>':''}</div>
      <div class="hand ${dealing?'dealing':''}">${G.hands[s].map((c,i)=>{const st=`style="--i:${i+off(s)*0.35}"`;return ((reveal||mate)?cardHTML(c):backHTML()).replace('style="','style="'+st.slice(7,-1)+';');}).join('')}</div>${bubbleFor(s)}</div>`;}).join('');
  const bi=G.table[G.baza].length||G.baza===0?G.baza:G.baza-1, r=G.results[bi], ws=G.bazaWin[bi];
  const winKey=dealKey+':'+(G.duelIdx||0)+':'+bi;
  const playsHTML=G.table[bi].map(p=>{const [x,y]=PLAY[off(p.s)], [fx,fy]=SEATC[off(p.s)];
    const key=dealKey+':'+p.c.id, fly=!ANIM.flown.has(key); ANIM.flown.add(key);
    const cls=r!==undefined&&r!=='parda'?(p.s===ws?('win'+(ANIM.won!==winKey?' winpop':'')):(team(p.s)===r?'':'lose')):'';
    return `<div class="pc ${fly?'fly':''}" style="left:${x}%;top:${y}%;--fx:${fx}%;--fy:${fy}%;--tx:${x}%;--ty:${y}%">${cardHTML(p.c,{cls})}</div>`;}).join('');
  if(r!==undefined&&r!=='parda')ANIM.won=winKey;
  const pm=G.dealMano??G.mano, [px,py]=PILE[off(pm)], moved=ANIM.pile&&ANIM.pile!==px+','+py;
  const pileHTML=`<button type="button" data-act="zoom" aria-label="Ver la muestra: ${cname(G.muestra)}" class="pile2 ${moved?'move':''} ${dealing?'fresh':''}" style="left:${px}%;top:${py}%;--fx:${moved?ANIM.pile.split(',')[0]:px}%;--fy:${moved?ANIM.pile.split(',')[1]:py}%;--tx:${px}%;--ty:${py}%" title="Mazo y muestra">
    ${cardHTML(G.muestra,{cls:'m'})}${backHTML('d')}</button>`;
  ANIM.pile=px+','+py;
  $('ring').innerHTML=pileHTML+seatsHTML+playsHTML;
  $('bazas').innerHTML=[0,1,2].map(i=>{const q=G.results[i];
    if(q===undefined)return i===G.baza&&G.phase==='play'?`<span class="bchip now">Baza ${i+1}</span>`:'';
    return `<span class="bchip ${q!=='parda'?(q===MT?'w':'l'):''}">Baza ${i+1}: ${q==='parda'?'parda':esc(G.n===2?nm(G.bazaWin[i]):teamName(q))}</span>`;}).join('');

  const myTurn=G.phase==='play'&&!G.pending&&G.turn===ME;
  const tv=G.truco.level===1?'sin cantar':TNAME[G.truco.level];
  $('seatP').innerHTML=
    `${bubbleFor(ME)}<div class="hand ${myTurn?'':'idle'} ${dealing?'dealing':''}">${G.hands[ME].map((c,i)=>cardHTML(c,{act:myTurn?'play:'+i:''}).replace('style="',`style="--i:${i+G.n*0.35};`)).join('')}</div>
     <div class="info"><span>Truco <b>${tv}</b></span><span>${!isAct(ME)?'Mirás este pico':(G.mano===ME?'Sos mano':'Sos pie')}</span></div>`;
  ANIM.deal=dealKey;

  renderBar();
  $('log').innerHTML=G.log.slice(0,8).map(l=>
    `<li>${l.who!==null&&l.who!==undefined?`<b class="${team(l.who)===MT?'w-me':'w-op'}">${esc(nm(l.who))}</b>`:''}${fill(l.text)}</li>`).join('');
  renderRules();
  document.title=(G.phase==='play'&&actor()===ME&&MODE==='online')?'• Tu turno · Truco':'Truco Uruguayo';
}
function dealer(){ // quien reparte: el mano de la mano que terminó, si es persona; si no, el anfitrión
  if(MODE==='local')return ME;
  const dm=G.dealMano??G.mano;
  if(!G.cpu[dm])return dm;
  return HOST?ME:-1;
}
function renderBar(){
  const B=(act,label,cls='')=>`<button class="btn ${cls}" data-act="${act}">${label}</button>`;
  const MT=myTeam(), we=G.n>2;
  let st='',bs=[];
  if(G.phase==='over'){
    const won=G.winner===MT;
    st=`<div class="status big">${won?(we?'¡Ganamos la partida!':'¡Ganaste la partida!'):(we?'Ganaron ellos':`Ganó ${esc(nm(1-ME))}`)}</div><div class="status"><small>${G.score[MT]} a ${G.score[1-MT]}</small></div>`;
    if(MODE==='local'||HOST)bs.push(B('new','Jugar otra partida','yes'));
  }else if(G.phase==='handover'){
    const won=G.handWinner===MT, d=dealer();
    const auto=PREF.auto||d!==ME;
    st=`<div class="status">${won?(we?'Ganamos la mano':'Ganaste la mano'):(we?'Ellos ganan la mano':`${esc(nm(1-ME))} gana la mano`)} <small>Truco en juego: ${G.truco.level} ${G.truco.level===1?'punto':'puntos'}.${auto?(G.duelNext?` Sigue el pico ${G.duelIdx+2} de 3…`:' Repartiendo…'):''}</small></div>`;
    if(d===ME) bs.push(PREF.auto?B('deal',G.duelNext?'Siguiente pico ya':'Repartir ya','ghost sm'):B('deal',G.duelNext?'Siguiente pico':'Repartir','yes'));
  }else if(actor()===ME&&G.pending){
    const P=G.pending, by=esc(nm(P.by));
    if(P.kind==='flor'||P.kind==='flor2'){
      const cf=RULE().contraflor;
      st=`<div class="status">${by} ${P.kind==='flor'?'canta <b>Flor</b>':'canta <b>La mía flor</b>'}<small>${P.kind==='flor'?'La mía flor: se comparan al final (3).':'Está bien: se comparan al final (3).'}${cf?` Con flor envido: se comparan ahora por 5. Contra flor al resto: van ${faltaFlor()} puntos.`:''}</small></div>`;
      bs.push(B('flok',P.kind==='flor'?'La mía flor':'Está bien','yes'));
      if(cf)bs.push(B('cfe','Con flor envido','call'),B('cflor','Contra flor al resto','call'));
    }else if(P.kind==='cfe'){
      st=`<div class="status">${by} canta <b>Con flor envido</b><small>Querido: la mejor flor gana 5. No querido: le dan 3.</small></div>`;
      bs.push(B('q','Quiero','yes'),B('nq','No quiero','ghost'),B('cflor','Contra flor al resto','call'));
    }else if(P.kind==='cflor'){
      st=`<div class="status">${by} canta <b>Contra flor al resto</b><small>Querido: la mejor flor gana ${faltaFlor()} puntos. No querido: le dan ${P.prev||3}.</small></div>`;
      bs.push(B('q','Quiero','yes'),B('nq','No quiero','ghost'));
    }else if(P.kind==='envido'){
      const ch=G.env.chain.map(x=>ENAME[x]).join(' + ');
      st=`<div class="status">${by} canta <b>${ch}</b><small>Querido vale ${G.env.chain.includes('F')?falta()+' (falta)':envAccept()}, no querido ${envReject()}.${we?' Cuenta el mejor envido de cada equipo.':''}</small></div>`;
      bs.push(B('q','Quiero','yes'),B('nq','No quiero','ghost'));
      envOptions(G.env.chain).forEach(o=>bs.push(B('env:'+o,ENAME[o],'call')));
    }else{
      st=`<div class="status">${by} canta <b>${TNAME[P.level]}</b><small>Querido se juega por ${P.level}, no querido le dan ${G.truco.level}.</small></div>`;
      bs.push(B('q','Quiero','yes'),B('nq','No quiero','ghost'));
      if(P.level<4)bs.push(B('tru',TNAME[P.level+1],'call'));
      if(canEnvido(ME)){bs.push('<span class="sep"></span>');['E','R','F'].forEach(o=>bs.push(B('env:'+o,ENAME[o],'call')));}
    }
  }else if(actor()===ME){
    st=`<div class="status">Tu turno<small>Tocá una carta para jugarla${canEnvido(ME)||canTruco(ME)?', o cantá':''}.</small></div>`;
    if(canEnvido(ME))['E','R','F'].forEach(o=>bs.push(B('env:'+o,ENAME[o],'call')));
    if(canTruco(ME))bs.push(B('tru',TNAME[G.truco.level+1],'call'));
    bs.push(B('mazo','Irse al mazo','ghost'));
  }else{
    const a=actor();
    st=`<div class="status">Le toca a ${esc(nm(a))}<small>${G.pending?'Tiene que responder un canto.':(G.cpu[a]?'Está pensando…':'Esperando su jugada.')}</small></div>`;
  }
  $('bar').innerHTML=st+(bs.length?`<div class="btns">${bs.join('')}</div>`:'');
}
function renderRules(){
  const M=G.muestra,s=PL[M.s],rey=PZ.includes(M.n);
  const order=PZ.map(n=>n===M.n?`Rey (12)`:(FIG[n]?`${FIG[n]} (${n})`:n)).join(' · ');
  $('rules').innerHTML=`
    <p><b>Orden de las cartas:</b> piezas, luego las matas (1 de espadas, 1 de bastos, 7 de espadas, 7 de oros), después 3, 2, 1 de copas y oros, 12, 11, 10, 7 de copas y bastos, 6, 5, 4.</p>
    ${G.n===6&&G.picoOn?`<p><b>Pico a pico:</b> mientras ${G.picoRule==='alguno'?'alguno de los dos equipos esté':'los dos equipos están'} en malas, se alterna una mano redonda con una de picos. En la de picos cada uno juega uno contra uno con el rival que tiene enfrente, de a un pico por vez. La falta envido vale 6 y la contra flor al resto 12.</p>`:''}
    ${G.n>2?`<p><b>En equipo:</b> se juega ${G.n/2} contra ${G.n/2}, sentados alternados. Cada baza la gana el equipo de la carta más alta; si la carta más alta empata entre los dos equipos, es parda. En el envido y la flor cuenta el mejor de cada equipo. Responde los cantos el rival que sigue en la ronda.</p>`:''}
    <p><b>Cantos de envido:</b> se van sumando. Envido vale 2, real envido 3; ${RULE().envidoRep?'se puede decir envido, envido, real envido, real envido y falta envido':'cada canto se dice una sola vez: envido, real envido y falta envido'}. Querido, gana el envido acumulado; no querido, el que cantó último se lleva lo acumulado hasta el canto anterior.</p>
    <p><b>Envido:</b> con pieza vale la pieza (2=30, 4=29, 5=28, 11 y 10=27) más tu mejor otra carta. Sin pieza: dos del mismo palo suman 20 más sus valores; las figuras valen 0. Si empatan, gana el más cerca del mano.</p>
    ${!RULE().flor?'<p><b>Flor:</b> en esta mesa se juega sin flor.</p>':`<p><b>Flor:</b> tres del mismo palo, o pieza más dos del mismo palo, o dos piezas. Vale 3 y anula el envido. Si los dos equipos tienen flor: <i>la mía flor</i> se compara al final de la mano por 3; <i>con flor envido</i> se compara en el momento por 5 (no querido, 3); <i>contra flor al resto</i> va por lo que falta para la partida (no querido, lo que estaba en juego).${RULE().contraflor?'':' En esta mesa no se canta contraflor: las flores se comparan al final.'}</p>`}
    <p><b>Truco:</b> gana quien lleve dos de tres bazas. Si la primera es parda, decide la segunda. Truco 2, retruco 3, vale cuatro 4. Solo puede subir el equipo que aceptó el último canto. El envido va primero: podés cantarlo como respuesta al truco en la primera baza.</p>
    <p><b>Partida:</b> a ${TGT()} puntos, ${TGT()/2} malas y ${TGT()/2} buenas. En el pizarrón se anota con rayas de a cinco.</p>`;
}

/* ---------- pantallas ---------- */
function show(view){
  document.body.classList.toggle('in-game',view==='game');
  $('lobby').hidden=view!=='lobby'; $('waiting').hidden=view!=='waiting'; $('game').hidden=view!=='game';
  if(view!=='game'){$('score').innerHTML='';document.title='Truco Uruguayo';}
}
function localNames(n){
  if(n===2)return ['Vos','Máquina'];
  if(n===4)return ['Vos','Rival 1','Compañero','Rival 2'];
  return ['Vos','Rival 1','Compañero 1','Rival 2','Compañero 2','Rival 3'];
}
function startLocal(){
  leaveTable(); MODE='local'; ME=0; HOST=true; SEATNAME=localNames(PLAYERS);
  newGame(TARGET,PLAYERS,null,PICO,RULES); show('game'); step();
}
function toLobby(){
  // Jugando solo, "Volver al inicio" vuelve a la pantalla previa común sin perder la partida
  if(SOLO_PREVIA&&MODE==='local'){ previa.mostrar(); return; }
  leaveTable(); MODE='local'; G=null; show('lobby'); renderLobby();
}
function leaveTable(){ if(mesas&&mesas.enMesa()) mesas.salir(); TCODE=null; tick++; }

/* ---------- en línea: js/mesas.js, igual para todos los juegos ---------- */
const URU=window.URUGAMES||{}, URU_MULTI=URU.modo==='multi';
function initOnline(){
  if(!window.UruMesas){ if(URU_MULTI)$('aviso').hidden=false; return; }
  mesas=UruMesas.crear({
    juego:'truco', panel:$('online'),
    espera:{mostrar:h=>{$('waiting').innerHTML=h;show('waiting');}, ocultar:()=>{if(!$('waiting').hidden)show(G?'game':'lobby');}},
    clases:{boton:'btn yes',secundario:'btn ghost',chico:'sm',nota:'note'},
    jugadores:()=>PLAYERS,
    datosMesa:()=>({target:TARGET,pico:PICO,rules:RULES}),
    nuevaPartida:m=>{const keep=G;newGame(m.target||TARGET,m.seats.length,m.cpu,m.pico===false?'no':(m.pico===true||m.pico===undefined)?'ambos':m.pico,m.rules);const g=G;G=keep;return g;},
    etiquetaAsiento:(i,m,yo)=>i%2===yo%2?'Nosotros':'Ellos',
    resumen:(m,yo)=>m.g?`, ${m.g.score[yo%2]} a ${m.g.score[1-yo%2]}`:', jugando',
    alEstado:(g,info)=>{
      tick++; MODE='online'; TCODE=info.codigo; ME=info.asiento; HOST=info.host; SEATNAME=info.nombres;
      G=g; show('game'); render(); maybeCpu(); maybeAuto();
    },
    alSalir:()=>{ MODE='local'; G=null; TCODE=null; show('lobby'); renderLobby(); }
  });
  mesas.iniciar().then(ok=>{ if(!ok&&URU_MULTI&&!(window.UruOnline&&UruOnline.disponible()))$('aviso').hidden=false; });
}
function renderLobby(){
  renderPicks();
  $('fan').innerHTML=['espada','oro','basto'].map((s,i)=>cardHTML({n:[1,7,1][i],s,id:'f'+i})).join('');
  if(mesas)mesas.redibujar();
}
function renderPicks(){
  const t=$('tgtBtns');if(t)t.innerHTML=[30,40].map(v=>`<button class="btn sm ${v===TARGET?'yes':'ghost'}" data-act="tgt:${v}" aria-pressed="${v===TARGET}">${v}</button>`).join('');
  const pick=(act,cur,opts)=>opts.map(([v,l])=>`<button class="btn sm ${v===cur?'yes':'ghost'}" data-act="${act}:${v}" aria-pressed="${v===cur}">${l}</button>`).join('');
  const k=$('picoRow');if(k){k.hidden=PLAYERS!==6;$('picoBtns').innerHTML=pick('pico',PICO,[['no','No'],['ambos','Los dos en malas'],['alguno','Alguno en malas']]);}
  const yn=[['si','Sí'],['no','No']], b=v=>v?'si':'no';
  const rf=$('rFlor');if(rf)rf.innerHTML=pick('rule-flor',b(RULES.flor),yn);
  const rc=$('rCflor');if(rc){rc.innerHTML=pick('rule-contraflor',b(RULES.contraflor),yn);rc.closest('.joinrow').hidden=!RULES.flor;}
  const re=$('rEnv');if(re)re.innerHTML=pick('rule-envidoRep',b(RULES.envidoRep),[['si','Envido-envido y real-real'],['no','Uno de cada']]);
  const p=$('plyBtns');if(p)p.innerHTML=[2,4,6].map(v=>`<button class="btn sm ${v===PLAYERS?'yes':'ghost'}" data-act="ply:${v}" aria-pressed="${v===PLAYERS}">${v}</button>`).join('');
}
function push(){ if(mesas)mesas.publicar(G,G.phase==='over'); }

/* ---------- eventos ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const [a,arg]=b.dataset.act.split(':');
  if(a==='local')return startLocal();
  if(a==='tgt'){TARGET=+arg;try{localStorage.setItem('truco.puntos',String(TARGET));}catch(e){}renderLobby();return;}
  if(a==='pico'){PICO=arg;try{localStorage.setItem('truco.pico',PICO);}catch(e){}renderLobby();return;}
  if(a.startsWith('rule-')){RULES[a.slice(5)]=arg==='si';try{localStorage.setItem('truco.reglas',JSON.stringify(RULES));}catch(e){}renderLobby();return;}
  if(a==='opts'){openOpts();return;}
  if(a==='unopts'){closeOpts();return;}
  if(a.startsWith('pref-')){const k=a.slice(5);PREF[k]=arg==='si'?true:arg==='no'?false:arg;savePref();renderOpts();if(G)render();return;}
  if(a==='ply'){PLAYERS=+arg;try{localStorage.setItem('truco.jugadores',String(PLAYERS));}catch(e){}renderLobby();return;}
  if(a==='leave')return toLobby();
  if(a==='snd'){SOUND_ON=!SOUND_ON;try{localStorage.setItem('truco.sonido',SOUND_ON?'si':'no');}catch(e){}render();return;}
  if(!G)return;
  if(a==='zoom'){openZoom();return;}
  if(a==='unzoom'){closeZoom();return;}
  if(a==='new'){if(MODE==='local'||HOST){newGame(G.target,G.n,G.cpu,G.picoRule,G.rules);step();}return;}
  if(a==='deal'){if(G.phase==='handover'&&dealer()===ME){if(G.duelNext)startDuel(G.duelIdx+1);else dealHand();step();}return;}
  if(G.phase!=='play'||actor()!==ME)return;
  if(a==='play'){if(!G.pending&&G.turn===ME)play(ME,+arg);}
  else if(a==='env')callEnvido(ME,arg);
  else if(a==='tru')callTruco(ME);
  else if(a==='q')quiero(ME);
  else if(a==='nq')noQuiero(ME);
  else if(a==='mazo')mazo(ME);
  else if(a==='flok')florOk(ME);
  else if(a==='cflor'&&RULE().contraflor)contraFlor(ME);
  else if(a==='cfe'&&RULE().contraflor)conFlorEnvido(ME);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeZoom();closeOpts();}});
function openZoom(){
  let z=$('zoom');
  if(!z){z=document.createElement('div');z.id='zoom';z.setAttribute('role','dialog');z.setAttribute('aria-modal','true');z.setAttribute('data-act','unzoom');document.body.appendChild(z);}
  z.innerHTML=`<div class="zbox">${cardHTML(G.muestra,{cls:'zc'})}<p>Muestra: ${cname(G.muestra)}</p><button type="button" class="btn yes" data-act="unzoom">Cerrar</button></div>`;
  z.hidden=false; z.querySelector('button').focus();
}
function openOpts(){
  let z=$('opts');
  if(!z){z=document.createElement('div');z.id='opts';z.setAttribute('role','dialog');z.setAttribute('aria-modal','true');z.setAttribute('aria-labelledby','optsT');
    z.addEventListener('click',e=>{if(e.target===z)closeOpts();});
    z.addEventListener('input',e=>{if(e.target.id==='optVol'){PREF.vol=+e.target.value;$('optVolV').textContent=PREF.vol+' %';savePref();}});
    document.body.appendChild(z);}
  renderOpts(); z.hidden=false; const f=z.querySelector('button,input'); if(f)f.focus();
}
function closeOpts(){const z=$('opts');if(z&&!z.hidden){z.hidden=true;}}
function renderOpts(){
  const z=$('opts'); if(!z)return;
  const pick=(k,opts)=>`<span class="btns">${opts.map(([v,l])=>{const on=String(PREF[k])===String(v==='si'?true:v==='no'?false:v);return `<button type="button" class="btn sm ${on?'yes':'ghost'}" data-act="pref-${k}:${v}" aria-pressed="${on}">${l}</button>`;}).join('')}</span>`;
  const R=RULE(), rl=[
    `${G?G.n:PLAYERS} jugadores, a ${G?TGT():TARGET} puntos`,
    (G?G.n:PLAYERS)===6?`Pico a pico: ${{no:'no',ambos:'con los dos en malas',alguno:'con alguno en malas'}[G?G.picoRule:PICO]}`:null,
    R.flor?(R.contraflor?'Con flor y contraflor':'Con flor, sin contraflor'):'Sin flor',
    R.envidoRep?'Envido-envido y real-real':'Un envido y un real envido como máximo'].filter(Boolean);
  z.innerHTML=`<div class="obox">
    <div class="ohead"><h2 id="optsT">Opciones</h2><button type="button" class="btn ghost sm" data-act="unopts">Cerrar</button></div>
    <section><h3>Sonido</h3>
      <label class="orow" for="optVol"><span>Volumen de los cantos</span><span class="vol"><input id="optVol" type="range" min="0" max="100" step="5" value="${PREF.vol}"><b id="optVolV">${PREF.vol} %</b></span></label></section>
    <section><h3>Juego</h3>
      <div class="orow"><span>Velocidad de la compu</span>${pick('cpu',[['lenta','Lenta'],['normal','Normal'],['rapida','Rápida']])}</div>
      <div class="orow"><span>Repartir solo al terminar la mano</span>${pick('auto',[['si','Sí'],['no','No']])}</div>
      <div class="orow"><span>Animaciones</span>${pick('anim',[['si','Sí'],['no','No']])}</div></section>
    <section><h3>Vista</h3>
      <div class="orow"><span>Tamaño de las cartas</span>${pick('size',[['chica','Chicas'],['normal','Normales'],['grande','Grandes']])}</div>
      <div class="orow"><span>Pizarrón</span>${pick('board',[['full','Completo'],['score','Solo los puntos']])}</div></section>
    <section><h3>Reglas de esta mesa</h3><ul class="rlist">${rl.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      <p class="note">Se eligen antes de empezar, en "Reglas de la mesa".</p></section>
  </div>`;
}
function closeZoom(){const z=$('zoom');if(z&&!z.hidden){z.hidden=true;}}
// Configuración según cómo se entró desde el menú (window.URUGAMES): en multijugador va directo a la parte en línea
// "Jugar solo" muestra solo la mesa contra la máquina; "Crear mesa" o "Ver mesas" solo la parte en línea
(function(){
  const solo=document.querySelector('#lobby .tile.mesa'), online=$('onlineTile');
  if(URU_MULTI){
    // las opciones de jugadores y puntos pasan arriba del panel en línea, que sigue usándolas
    ['plyBtns','picoRow','tgtBtns','reglasMesa'].forEach(id=>{const el=$(id);const row=el&&(el.closest('.joinrow')||el);if(row&&online)online.insertBefore(row,$('online'));});
    if(solo)solo.hidden=true;
  }else if(online)online.hidden=true;
})();
applyPref();
// "Jugar solo": la pantalla previa común (js/previa.js) elige dificultad, jugadores, puntos y reglas de la mesa, y arranca directo.
// "Volver al inicio" durante la partida la vuelve a abrir.
const previa=window.UruPrevia?UruPrevia.crear({
  juego:'truco',
  dificultad:{
    facil:'A veces tira cualquier carta y canta peor.',
    normal:'Juega según sus cartas y de vez en cuando se tira un farol.',
    dificil:'No tira cartas al azar y elige mejor cuándo cantar.'
  },
  opciones:[
    {id:'jugadores',nombre:'Jugadores',valores:[[2,'2'],[4,'4, de a dos'],[6,'6, de a tres']],defecto:PLAYERS,
      nota:c=>c.jugadores>2?'Se juega en equipos: la compu juega por tus compañeros y por tus rivales.':''},
    {id:'pico',nombre:'Pico a pico',valores:[['ambos','Con los dos en malas'],['alguno','Con alguno en malas'],['no','No']],defecto:PICO,visible:c=>c.jugadores===6,
      nota:c=>c.pico==='no'?'':'Mientras tanto se alterna una mano redonda con una de picos, uno contra uno.'},
    {id:'partida',nombre:'Partida a',valores:[[30,'30 puntos'],[40,'40 puntos']],defecto:TARGET},
    {id:'flor',nombre:'Flor',valores:[[true,'Sí'],[false,'No']],defecto:RULES.flor},
    {id:'contraflor',nombre:'Contraflor y con flor envido',valores:[[true,'Sí'],[false,'No']],defecto:RULES.contraflor,visible:c=>c.flor,
      nota:c=>c.contraflor?'':'Si los dos tienen flor, se comparan al final de la mano.'},
    {id:'envidoRep',nombre:'Envidos',valores:[[true,'Envido-envido y real-real'],[false,'Uno de cada']],defecto:RULES.envidoRep}
  ],
  empezar:c=>{
    DIF=c.dificultad; DIFT={facil:.1,normal:0,dificil:-.04}[DIF]||0;
    PLAYERS=c.jugadores; TARGET=c.partida; PICO=c.pico;
    RULES={flor:c.flor,contraflor:c.flor&&c.contraflor,envidoRep:c.envidoRep};
    try{localStorage.setItem('truco.jugadores',String(PLAYERS));localStorage.setItem('truco.puntos',String(TARGET));localStorage.setItem('truco.pico',PICO);localStorage.setItem('truco.reglas',JSON.stringify(RULES));}catch(e){}
    startLocal();
  }
}):null;
const SOLO_PREVIA=!!previa&&!URU_MULTI;
if(!SOLO_PREVIA) show('lobby');
renderLobby(); initOnline();
if(SOLO_PREVIA){ $('lobby').hidden=true; previa.iniciar(); }
