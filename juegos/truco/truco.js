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
let DB=null, USER=null, MYID=null, CAN_WRITE=null;
let TREF=null, TCODE=null, TUNSUB=null, LOCALREV=0, writing=false, dirty=false;
const seen={};
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
let PICO=true; try{PICO=localStorage.getItem('truco.pico')!=='no';}catch(e){}
let PLAYERS=2; try{const t=+localStorage.getItem('truco.jugadores');if([2,4,6].includes(t))PLAYERS=t;}catch(e){}
function newGame(target,n,cpu,pico){
  n=n||2;
  const m=Math.floor(Math.random()*n);
  G={n,target:target||TARGET,score:[0,0],cpu:cpu||Array.from({length:n},(_,s)=>s!==0),mano:m,dealMano:m,
     picoOn:n===6&&pico!==false,lastPico:true,pico:false,log:[],phase:'play',started:Date.now()};
  dealHand();
}
function dealHand(){
  G.dealMano=((G.dealMano??G.mano)+1)%G.n; G.handNo=(G.handNo||0)+1;
  const order=Array.from({length:G.n},(_,k)=>(G.dealMano+k)%G.n);
  const d=newDeck(); G.hands=Array.from({length:G.n},()=>[]);
  for(let i=0;i<3;i++)for(const s of order)G.hands[s].push(d.pop());
  G.muestra=d.pop(); G.orig=G.hands.map(h=>[...h]);
  // pico a pico: en 6, mientras los dos equipos están en malas, se alterna una redonda y una de picos
  const malas=G.score[0]<TGT()/2&&G.score[1]<TGT()/2;
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
  G.flor=G.hands.map((h,s)=>isAct(s)&&hasFlor(h));
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
  if(!G||G.phase!=='handover'||dealer()!==ME)return;
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
  setTimeout(()=>{if(my===tick&&G&&G.phase==='play'&&G.cpu[actor()])cpuAct(actor());},G.n>2?850:1050);
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
  if(!F&&r===0&&e<2)o.push('E'); if(!F&&r<2)o.push('R'); if(!F)o.push('F'); return o;
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
const DIF=(window.URUGAMES&&window.URUGAMES.dificultad)||'normal';
const DIFT={facil:.1,normal:0,dificil:-.04}[DIF]||0;
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
      if((v>=35&&r<.6)||r<.04) return contraFlor(s);
      if((v>=31&&r<.5)||r<.06) return conFlorEnvido(s);
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
  const n=SND[t]; if(!n||!SOUND_ON)return;
  const f=`snd/${team(s)===myTeam()?'grave':'aguda'}/${n}.mp3`;
  try{const a=audioCache[f]||(audioCache[f]=new Audio(f));
    const now=Date.now(),wait=Math.max(0,sndBusy-now),len=(a.duration&&isFinite(a.duration)?a.duration*1000:2000);
    sndBusy=now+wait+len;
    setTimeout(()=>{a.currentTime=0;const p=a.play();if(p)p.catch(()=>{});},wait);}catch(e){}
}
function bubbleFor(s){
  const b=G.bubble&&G.bubble[s]; if(!b)return '';
  const key=s+':'+b.at; if(!seen[key]){seen[key]=Date.now(); if(Math.abs(Date.now()-b.at)<6000)playSnd(b.t,s);}
  const left=2600-(Date.now()-seen[key]);
  if(left<=0)return '';
  clearTimeout(bubbleTimer); bubbleTimer=setTimeout(render,left+30);
  return `<div class="bubble">${esc(b.t)}</div>`;
}
const SBTN=()=>`<button class="btn ghost sm" data-act="snd">${SOUND_ON?'Sonido: sí':'Sonido: no'}</button><button class="btn ghost sm" data-act="leave">Volver al inicio</button>`;
function render(){
  if(!G)return;
  const MT=myTeam();
  $('score').innerHTML=[MT,1-MT].map(t=>{
    const n=G.score[t];return `<div class="srow"><span class="sname">${esc(teamName(t))} <span class="stage">en ${n<TGT()/2?'malas':'buenas'}</span></span>${sticks(n,TGT())}<span class="spts">${n}</span></div>`;}).join('');
  const picoTxt=G.pico?`, pico a pico ${G.duelIdx+1} de 3: ${esc(nm(G.active[0]))} contra ${esc(nm(G.active[1]))}`:'';
  const modeTxt0=G.n===2?(MODE==='online'?`contra ${esc(nm(1-ME))}`:'contra la máquina'):`${G.n} jugadores, ${G.n/2} contra ${G.n/2}`;
  const modeTxt=modeTxt0+picoTxt;
  $('ghead').innerHTML=`<span>${MODE==='online'?`Mesa <b>${esc(TCODE)}</b>, `:''}${modeTxt}</span><span class="btns">${SBTN()}</span>`;

  const reveal=G.phase!=='play';
  // ronda: los demás alrededor, cada carta jugada delante de quien la tiró, el mazo con la muestra al lado del mano
  const SEAT={2:[[50,112],[50,1]],4:[[50,112],[84,50],[50,1],[16,50]],6:[[50,112],[84,64],[84,30],[50,1],[16,30],[16,64]]}[G.n];
  const SEATC={2:[[50,112],[50,10]],4:[[50,112],[84,50],[50,10],[16,50]],6:[[50,112],[84,64],[84,30],[50,10],[16,30],[16,64]]}[G.n];
  const PLAY={2:[[50,74],[50,30]],4:[[50,76],[67,50],[50,28],[33,50]],6:[[50,77],[66,62],[66,38],[50,27],[34,38],[34,62]]}[G.n];
  const PILE={2:[[20,78],[80,22]],4:[[22,80],[86,78],[78,14],[14,78]],6:[[22,84],[86,86],[84,47],[22,12],[16,47],[14,86]]}[G.n];
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
    st=`<div class="status">${won?(we?'Ganamos la mano':'Ganaste la mano'):(we?'Ellos ganan la mano':`${esc(nm(1-ME))} gana la mano`)} <small>Truco en juego: ${G.truco.level} ${G.truco.level===1?'punto':'puntos'}.${G.duelNext?` Sigue el pico ${G.duelIdx+2} de 3…`:' Repartiendo…'}</small></div>`;
    if(d===ME) bs.push(B('deal',G.duelNext?'Siguiente pico ya':'Repartir ya','ghost sm'));
  }else if(actor()===ME&&G.pending){
    const P=G.pending, by=esc(nm(P.by));
    if(P.kind==='flor'||P.kind==='flor2'){
      st=`<div class="status">${by} ${P.kind==='flor'?'canta <b>Flor</b>':'canta <b>La mía flor</b>'}<small>${P.kind==='flor'?'La mía flor: se comparan al final (3).':'Está bien: se comparan al final (3).'} Con flor envido: se comparan ahora por 5. Contra flor al resto: van ${faltaFlor()} puntos.</small></div>`;
      bs.push(B('flok',P.kind==='flor'?'La mía flor':'Está bien','yes'),B('cfe','Con flor envido','call'),B('cflor','Contra flor al resto','call'));
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
    ${G.n===6&&G.picoOn?`<p><b>Pico a pico:</b> mientras los dos equipos están en malas, se alterna una mano redonda con una de picos. En la de picos cada uno juega uno contra uno con el rival que tiene enfrente, de a un pico por vez. La falta envido vale 6 y la contra flor al resto 12.</p>`:''}
    ${G.n>2?`<p><b>En equipo:</b> se juega ${G.n/2} contra ${G.n/2}, sentados alternados. Cada baza la gana el equipo de la carta más alta; si la carta más alta empata entre los dos equipos, es parda. En el envido y la flor cuenta el mejor de cada equipo. Responde los cantos el rival que sigue en la ronda.</p>`:''}
    <p><b>Cantos de envido:</b> se van sumando. Envido vale 2, real envido 3; se puede decir envido, envido, real envido, real envido y falta envido. Querido, gana el envido acumulado; no querido, el que cantó último se lleva lo acumulado hasta el canto anterior.</p>
    <p><b>Envido:</b> con pieza vale la pieza (2=30, 4=29, 5=28, 11 y 10=27) más tu mejor otra carta. Sin pieza: dos del mismo palo suman 20 más sus valores; las figuras valen 0. Si empatan, gana el más cerca del mano.</p>
    <p><b>Flor:</b> tres del mismo palo, o pieza más dos del mismo palo, o dos piezas. Vale 3 y anula el envido. Si los dos equipos tienen flor: <i>la mía flor</i> se compara al final de la mano por 3; <i>con flor envido</i> se compara en el momento por 5 (no querido, 3); <i>contra flor al resto</i> va por lo que falta para la partida (no querido, lo que estaba en juego).</p>
    <p><b>Truco:</b> gana quien lleve dos de tres bazas. Si la primera es parda, decide la segunda. Truco 2, retruco 3, vale cuatro 4. Solo puede subir el equipo que aceptó el último canto. El envido va primero: podés cantarlo como respuesta al truco en la primera baza.</p>
    <p><b>Partida:</b> a ${TGT()} puntos, ${TGT()/2} malas y ${TGT()/2} buenas. En el pizarrón se anota con rayas de a cinco.</p>`;
}

/* ---------- pantallas ---------- */
function show(view){
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
  newGame(TARGET,PLAYERS,null,PICO); show('game'); step();
}
function toLobby(){ leaveTable(); MODE='local'; G=null; show('lobby'); renderLobby(); }
function leaveTable(){ if(TUNSUB){TUNSUB();TUNSUB=null;} TREF=null; TCODE=null; LOCALREV=0; tick++; }

/* ---------- en línea ---------- */
let LOBBY_DOCS=[], LOBBY_ERR='', lobbyUnsub=null, ONLINE_READY=false;
let FIRST_LIST=false;
async function initOnline(){
  // Conexión común de Urugames (js/online.js, Firebase)
  try{
    const on=window.UruOnline?await UruOnline.init('truco'):null;
    if(on){DB=on.db; USER=on.user; MYID=on.uid; CAN_WRITE=true;}
  }catch(e){DB=null;}
  if(DB&&MYID){
    lobbyUnsub=DB.collection('mesas').where('status','in',['waiting','playing','done']).onSnapshot(s=>{
      LOBBY_DOCS=s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>Array.isArray(d.seats));
      if(!FIRST_LIST){FIRST_LIST=true;autoSala();}
      renderLobby();
    },()=>{LOBBY_ERR='No se pudo leer la lista de mesas.';renderLobby();});
  }else if(URU_MULTI&&!(window.UruOnline&&UruOnline.disponible())){$('aviso').hidden=false;}
  ONLINE_READY=true; renderLobby();
}
// Lo que eligió el jugador en el menú principal: partida rápida, sala nueva o un código
const URU=window.URUGAMES||{}, URU_MULTI=URU.modo==='multi';
let AUTO_DONE=false;
function autoSala(){
  if(!URU_MULTI||AUTO_DONE||!URU.sala)return;
  AUTO_DONE=true;
  if(URU.sala==='nueva')return createTable();
  if(URU.sala==='rapida'){
    const open=LOBBY_DOCS.filter(d=>d.status==='waiting'&&!d.seats.includes(MYID)&&d.seats.includes(null)&&Date.now()-(d.createdAt||0)<3600e3)
      .sort((a,b)=>(b.seats.length===PLAYERS)-(a.seats.length===PLAYERS)||(b.createdAt||0)-(a.createdAt||0));
    return open.length?joinTable(open[0].id):createTable();
  }
  return joinTable(URU.sala);
}
async function names(ids){
  const out={}; ids=ids.filter(Boolean);
  if(USER&&ids.length){try{const ps=await USER.profiles(ids);for(const id of ids)out[id]=ps[id]&&ps[id].name||'';}catch(e){}}
  return out;
}
function renderPicks(){
  const t=$('tgtBtns');if(t)t.innerHTML=[30,40].map(v=>`<button class="btn sm ${v===TARGET?'yes':'ghost'}" data-act="tgt:${v}" aria-pressed="${v===TARGET}">${v}</button>`).join('');
  const k=$('picoRow');if(k){k.hidden=PLAYERS!==6;$('picoBtns').innerHTML=[['si','Sí'],['no','No']].map(([v,l])=>`<button class="btn sm ${(v==='si')===PICO?'yes':'ghost'}" data-act="pico:${v}" aria-pressed="${(v==='si')===PICO}">${l}</button>`).join('');}
  const p=$('plyBtns');if(p)p.innerHTML=[2,4,6].map(v=>`<button class="btn sm ${v===PLAYERS?'yes':'ghost'}" data-act="ply:${v}" aria-pressed="${v===PLAYERS}">${v}</button>`).join('');
}
async function renderLobby(){
  renderPicks();
  $('fan').innerHTML=['espada','oro','basto'].map((s,i)=>cardHTML({n:[1,7,1][i],s,id:'f'+i})).join('');
  const box=$('online'); if(!box)return;
  if(!ONLINE_READY){box.innerHTML='<p class="note">Conectando con la mesa compartida…</p>';return;}
  if(!DB||!MYID){
    box.innerHTML=window.UruOnline&&UruOnline.disponible()
      ?`<p>No se pudo conectar con el servidor de mesas. Revisá la conexión y recargá la página.</p>${UruOnline.error()?`<p class="note">Detalle: ${esc(UruOnline.error())}</p>`:''}<p class="note">Mientras tanto podés jugar contra la máquina.</p>`
      :`<p>El modo en línea todavía no está configurado.</p><p class="note">Mientras tanto podés jugar contra la máquina.</p>`;
    return;
  }
  // La parte fija (nombre, botones, código) se dibuja una sola vez para no borrar lo que se está escribiendo
  if(!$('onlineList')){
    box.innerHTML=`
      <div class="joinrow"><label class="note" for="nick">Tu nombre</label><input id="nick" maxlength="20" autocomplete="nickname" placeholder="Cómo te ven los demás" value="${esc(UruOnline.nombre())}"></div>
      <p id="onlineIntro"></p>
      <div class="btns"><button class="btn yes" data-act="create" id="createBtn"></button></div>
      <div class="joinrow"><label class="note" for="code">Código</label><input id="code" maxlength="4" autocomplete="off" placeholder="ABCD"><button class="btn ghost" data-act="joincode">Unirme</button></div>
      <div class="err" id="lobbyErr"></div>
      <div id="onlineList"></div>`;
  }
  $('onlineIntro').textContent=`Abrí una mesa de ${PLAYERS} y pasale el código a tus amigos, o sentate en una que esté esperando. Los lugares que nadie ocupe los juega la máquina.`;
  $('createBtn').textContent=`Abrir una mesa de ${PLAYERS}`;
  $('lobbyErr').textContent=LOBBY_ERR;
  const mine=LOBBY_DOCS.filter(d=>d.seats.includes(MYID));
  const open=LOBBY_DOCS.filter(d=>d.status==='waiting'&&!d.seats.includes(MYID)&&d.seats.includes(null)&&Date.now()-(d.createdAt||0)<6*3600e3);
  const ids=[...new Set([...mine,...open].map(d=>d.host))];
  const N=await names(ids);
  const who=id=>esc(N[id]||'Alguien');
  const free=d=>d.seats.filter(x=>!x).length;
  const li=(d,label,act,btn)=>`<li><span class="code">${esc(d.id)}</span><span class="meta">${label}</span><button class="btn yes sm" data-act="${act}:${esc(d.id)}">${btn}</button></li>`;
  $('onlineList').innerHTML=`
    ${mine.length?`<h2 style="font-size:1.15rem">Tus mesas</h2><ul class="tables">${mine.map(d=>{const me=d.seats.indexOf(MYID),mt=me%2;
      return li(d,`de ${d.seats.length}${d.status==='waiting'?', esperando gente':d.g?`, ${d.g.score[mt]} a ${d.g.score[1-mt]}`:''}${d.status==='done'?', terminada':''}`,'resume','Seguir');}).join('')}</ul>`:''}
    <h2 style="font-size:1.15rem">Mesas esperando gente</h2>
    ${open.length?`<ul class="tables">${open.map(d=>li(d,`de ${d.seats.length}, abrió ${who(d.host)}, ${free(d)} ${free(d)===1?'lugar':'lugares'} libres`,'join','Sentarse')).join('')}</ul>`:'<p class="empty">No hay mesas abiertas ahora. Abrí una y avisale a tus amigos.</p>'}`;
}
function lobbyError(msg){LOBBY_ERR=msg;const e=$('lobbyErr');if(e)e.textContent=msg;}
function newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<4;i++)s+=A[Math.floor(Math.random()*A.length)];return s;}
async function createTable(){
  lobbyError('');
  const code=newCode(); const ref=DB.doc('mesas/'+code);
  try{
    const ex=await ref.get(); if(ex.exists) return createTable();
    const seats=Array.from({length:PLAYERS},(_,i)=>i===0?MYID:null);
    await ref.set({seats,host:MYID,status:'waiting',g:null,rev:0,target:TARGET,pico:PICO,createdAt:Date.now()});
    openTable(code);
  }catch(e){lobbyError(e&&e.code==='quota_exceeded'?'No hay lugar para más mesas.':'No se pudo abrir la mesa. Probá de nuevo.');}
}
async function joinTable(code){
  lobbyError('');
  code=(code||'').trim().toUpperCase();
  if(!/^[A-Z]{4}$/.test(code)) return lobbyError('El código tiene cuatro letras.');
  const ref=DB.doc('mesas/'+code);
  try{
    const lease=await ref.acquire({holder:MYID,ttlMs:4000});
    if(!lease.acquired) return lobbyError('Alguien se está sentando en esa mesa. Probá en unos segundos.');
    const s=await ref.get();
    if(!s.exists) return lobbyError('No encontré esa mesa.');
    const d=s.data();
    if(!Array.isArray(d.seats)) return lobbyError('Esa mesa es de una versión anterior del juego. Abrí una nueva.');
    if(d.seats.includes(MYID)) return openTable(code);
    const free=d.seats.indexOf(null);
    if(free<0||d.status!=='waiting') return lobbyError('Esa mesa ya está completa.');
    const seats=[...d.seats]; seats[free]=MYID;
    if(!seats.includes(null)){
      newGame(d.target||TARGET,seats.length,seats.map(()=>false),d.pico!==false);
      LOCALREV=1;
      await ref.update({seats,status:'playing',g:JSON.parse(JSON.stringify(G)),rev:1});
    }else await ref.update({seats});
    openTable(code);
  }catch(e){lobbyError('No pude sentarte en la mesa. Probá de nuevo.');}
}
async function startWithCpu(){
  const s=await TREF.get(); const d=s.data(); if(!d||d.status!=='waiting')return;
  newGame(d.target||TARGET,d.seats.length,d.seats.map(x=>!x),d.pico!==false);
  LOCALREV=(d.rev||0)+1;
  await TREF.update({status:'playing',g:JSON.parse(JSON.stringify(G)),rev:LOCALREV});
}
async function cancelTable(){const r=TREF;toLobby();try{await r.delete();}catch(e){}}
function openTable(code){
  leaveTable(); MODE='online'; TCODE=code; TREF=DB.doc('mesas/'+code);
  $('waiting').innerHTML=`<h2>Abriendo la mesa…</h2>`; show('waiting');
  TUNSUB=TREF.onSnapshot(async s=>{
    if(TCODE!==code)return;
    if(!s.exists){toLobby();lobbyError('La mesa se cerró.');return;}
    const d=s.data();
    if(!Array.isArray(d.seats)){toLobby();lobbyError('Esa mesa es de una versión anterior del juego.');return;}
    const seat=d.seats.indexOf(MYID);
    if(seat<0){toLobby();lobbyError('Esa mesa ya está completa.');return;}
    ME=seat; HOST=d.host===MYID;
    const N=await names(d.seats);
    let cpuNo=0;
    SEATNAME=d.seats.map((id,i)=>id?(N[id]||`Jugador ${i+1}`):`Máquina ${++cpuNo}`);
    if(d.status==='waiting'){
      const n=d.seats.length;
      const list=d.seats.map((id,i)=>`<li><span class="code">${i%2===seat%2?'Nosotros':'Ellos'}</span><span class="meta">${id?esc(id===MYID?'Vos':(N[id]||'Jugador')):'libre'}</span></li>`).join('');
      $('waiting').innerHTML=`<h2>Mesa de ${n} abierta</h2><p>Pasale este código a tus amigos para que se sienten:</p><div class="bigcode">${esc(code)}</div>
        ${n>2?`<ul class="tables">${list}</ul>`:''}
        <p class="note">${HOST?'La partida empieza sola cuando se llena. Si no querés esperar, los lugares libres los juega la máquina.':'Esperando que se llene la mesa o que quien la abrió empiece.'}</p>
        <div class="btns">${HOST?`${n>2?'<button class="btn yes" data-act="cpustart">Empezar con la máquina en los libres</button>':''}<button class="btn ghost" data-act="cancel">Cerrar la mesa</button>`:'<button class="btn ghost" data-act="leave">Volver al inicio</button>'}</div>`;
      show('waiting');return;
    }
    if(d.g&&(d.rev||0)>=LOCALREV){LOCALREV=d.rev||0;G=JSON.parse(JSON.stringify(d.g));show('game');render();maybeCpu();maybeAuto();}
  },()=>{toLobby();lobbyError('Se perdió la conexión con la mesa.');});
}
async function push(){
  if(!TREF||!G)return;
  if(writing){dirty=true;return;}
  writing=true;
  do{
    dirty=false; LOCALREV++;
    const body={g:JSON.parse(JSON.stringify(G)),rev:LOCALREV,status:G.phase==='over'?'done':'playing'};
    try{await TREF.update(body);}catch(e){ $('bar').insertAdjacentHTML('afterbegin','<div class="err">No se pudo guardar la jugada. Revisá la conexión.</div>'); }
  }while(dirty);
  writing=false;
}

/* ---------- eventos ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const [a,arg]=b.dataset.act.split(':');
  if(a==='local')return startLocal();
  if(a==='tgt'){TARGET=+arg;try{localStorage.setItem('truco.puntos',String(TARGET));}catch(e){}renderLobby();return;}
  if(a==='pico'){PICO=arg==='si';try{localStorage.setItem('truco.pico',PICO?'si':'no');}catch(e){}renderLobby();return;}
  if(a==='ply'){PLAYERS=+arg;try{localStorage.setItem('truco.jugadores',String(PLAYERS));}catch(e){}renderLobby();return;}
  if(a==='leave')return toLobby();
  if(a==='snd'){SOUND_ON=!SOUND_ON;try{localStorage.setItem('truco.sonido',SOUND_ON?'si':'no');}catch(e){}render();return;}
  if(a==='create')return createTable();
  if(a==='join'||a==='resume')return a==='join'?joinTable(arg):openTable(arg);
  if(a==='joincode')return joinTable($('code').value);
  if(a==='cancel')return cancelTable();
  if(a==='cpustart')return startWithCpu();
  if(!G)return;
  if(a==='zoom'){openZoom();return;}
  if(a==='unzoom'){closeZoom();return;}
  if(a==='new'){if(MODE==='local'||HOST){newGame(G.target,G.n,G.cpu,G.picoOn);step();}return;}
  if(a==='deal'){if(G.phase==='handover'&&dealer()===ME){if(G.duelNext)startDuel(G.duelIdx+1);else dealHand();step();}return;}
  if(G.phase!=='play'||actor()!==ME)return;
  if(a==='play'){if(!G.pending&&G.turn===ME)play(ME,+arg);}
  else if(a==='env')callEnvido(ME,arg);
  else if(a==='tru')callTruco(ME);
  else if(a==='q')quiero(ME);
  else if(a==='nq')noQuiero(ME);
  else if(a==='mazo')mazo(ME);
  else if(a==='flok')florOk(ME);
  else if(a==='cflor')contraFlor(ME);
  else if(a==='cfe')conFlorEnvido(ME);
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='code')joinTable(e.target.value);if(e.key==='Escape')closeZoom();});
function openZoom(){
  let z=$('zoom');
  if(!z){z=document.createElement('div');z.id='zoom';z.setAttribute('role','dialog');z.setAttribute('aria-modal','true');z.setAttribute('data-act','unzoom');document.body.appendChild(z);}
  z.innerHTML=`<div class="zbox">${cardHTML(G.muestra,{cls:'zc'})}<p>Muestra: ${cname(G.muestra)}</p><button type="button" class="btn yes" data-act="unzoom">Cerrar</button></div>`;
  z.hidden=false; z.querySelector('button').focus();
}
function closeZoom(){const z=$('zoom');if(z&&!z.hidden){z.hidden=true;}}
document.addEventListener('change',e=>{if(e.target.id==='nick'&&window.UruOnline)e.target.value=UruOnline.setNombre(e.target.value);});
// Configuración según cómo se entró desde el menú (window.URUGAMES): en multijugador va directo a la parte en línea
show('lobby'); renderLobby(); initOnline();
if(URU_MULTI){const t=$('onlineTile');if(t)t.scrollIntoView({block:'start'});}
