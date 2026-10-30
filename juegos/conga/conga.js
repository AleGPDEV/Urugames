// Conga con baraja española, de 2 o 3 jugadores, a 100 puntos: contra la compu o en línea con amigos (js/online.js).
// Usa window.URUGAMES (js/juego-base.js) para la dificultad y para entrar directo a una mesa desde el menú.
(function(){
const SUITS=['o','c','e','b'];
const SUIT_NAME={o:'oros',c:'copas',e:'espadas',b:'bastos'};
const LIMIT=100;
const REDUCE=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const val=c=>c.s==='j'?50:c.n;
const cname=c=>c.s==='j'?'comodín':`${c.n} de ${SUIT_NAME[c.s]}`;
const sleep=ms=>new Promise(r=>setTimeout(r, REDUCE?Math.min(ms,80):ms));
const URU=window.URUGAMES||{};
const DIF=['facil','normal','dificil'].includes(URU.dificultad)?URU.dificultad:'normal';

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* ---------- combinaciones ---------- */
function meldType(cs){
  if(cs.length<3) return null;
  const nj=cs.filter(c=>c.s!=='j'); if(!nj.length) return null;
  if(nj.every(c=>c.n===nj[0].n) && cs.length<=6) return 'p';
  if(cs.length<=12 && nj.every(c=>c.s===nj[0].s)){
    const ns=nj.map(c=>c.n); if(new Set(ns).size!==ns.length) return null;
    if(Math.max(...ns)-Math.min(...ns)+1<=cs.length) return 'e';
  }
  return null;
}
function solve(hand){
  const n=hand.length, full=(1<<n)-1, melds=[];
  for(let m=1;m<=full;m++){
    let cnt=0; for(let i=0;i<n;i++) if(m>>i&1) cnt++;
    if(cnt<3) continue;
    const cs=[]; for(let i=0;i<n;i++) if(m>>i&1) cs.push(hand[i]);
    if(meldType(cs)) melds.push(m);
  }
  const memo=new Map();
  function go(used){
    if(used===full) return {dw:0,ms:[]};
    if(memo.has(used)) return memo.get(used);
    let i=0; while(used>>i&1) i++;
    const r0=go(used|1<<i); let best={dw:r0.dw+val(hand[i]), ms:r0.ms};
    for(const m of melds){
      if((m&used)||!(m>>i&1)) continue;
      const r=go(used|m);
      if(r.dw<best.dw) best={dw:r.dw, ms:[m,...r.ms]};
    }
    memo.set(used,best); return best;
  }
  const r=go(0); let usedAll=0;
  const ms=r.ms.map(m=>{usedAll|=m; const cs=[];for(let i=0;i<n;i++) if(m>>i&1) cs.push(hand[i]); return orderMeld(cs)});
  const loose=hand.filter((c,i)=>!(usedAll>>i&1));
  return {dw:r.dw, melds:ms, loose};
}
function orderMeld(cs){
  const nj=cs.filter(c=>c.s!=='j'), j=cs.filter(c=>c.s==='j');
  if(meldType(cs)==='e' && !(nj.length>1 && nj.every(c=>c.n===nj[0].n))){
    nj.sort((a,b)=>a.n-b.n); const out=[]; const jl=j.slice(); let k=nj[0].n;
    for(const c of nj){ while(k<c.n && jl.length){out.push(jl.pop()); k++} out.push(c); k=c.n+1 }
    while(jl.length) out.push(jl.pop());
    return out;
  }
  return [...nj.sort((a,b)=>SUITS.indexOf(a.s)-SUITS.indexOf(b.s)), ...j];
}
const suitSort=(a,b)=>(a.s==='j')-(b.s==='j') || SUITS.indexOf(a.s)-SUITS.indexOf(b.s) || a.n-b.n;

/* ---------- IA ---------- */
function hval(hand){
  const r=solve(hand); let bonus=0;
  for(const c of r.loose){
    if(c.s==='j') continue;
    for(const d of hand){ if(d===c) continue;
      if(d.s==='j' || d.n===c.n || (d.s===c.s && Math.abs(d.n-c.n)<=2)){ bonus+=c.n*0.35; break }
    }
  }
  return r.dw-bonus;
}
// Dificultad: Fácil a veces tira cualquier carta; Difícil además evita tirarte cartas que se parecen a las que levantaste del pozo.
function feeds(c, s){
  const picked=(G.picked||[]).filter((_,p)=>p!==s).flat();
  return picked.some(d=>c.s!=='j' && (d.n===c.n || (d.s===c.s && Math.abs(d.n-c.n)<=2)));
}
function bestDiscard(hand, forbid, s){
  let cut=null;
  for(const c of hand){ if(c.id===forbid) continue;
    const dw=solve(hand.filter(x=>x!==c)).dw;
    if(dw<=5 && (!cut || dw<cut.dw)) cut={card:c,dw};
  }
  if(cut) return {card:cut.card, cut:true};
  const opts=hand.filter(c=>c.id!==forbid);
  if(DIF==='facil' && Math.random()<.35){
    const pool=opts.filter(c=>c.s!=='j'); const card=pool[Math.floor(Math.random()*pool.length)]||opts[0];
    return {card, h:hval(hand.filter(x=>x!==card)), cut:false};
  }
  let best=null;
  for(const c of opts){
    let h=hval(hand.filter(x=>x!==c)); if(c.s==='j') h+=30;
    if(DIF==='dificil' && feeds(c, s)) h+=3;
    if(!best || h<best.h || (h===best.h && val(c)>val(best.card))) best={card:c,h};
  }
  return {card:best.card, h:best.h, cut:false};
}

/* ---------- animación ---------- */
const myMap=new Map(), pozoMap=new Map();
const EASE='cubic-bezier(.22,.8,.26,1)';

// FLIP: anima los hermanos desde donde estaban hasta su nuevo lugar
function flip(container, mutate){
  const first=new Map([...container.children].map(e=>[e,e.getBoundingClientRect()]));
  mutate();
  if(REDUCE) return;
  for(const e of container.children){
    if(e.classList.contains('dragging')) continue;
    const f=first.get(e); if(!f) continue;
    const l=e.getBoundingClientRect(), dx=f.left-l.left, dy=f.top-l.top;
    if(Math.abs(dx)>.5||Math.abs(dy)>.5) e.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:240,easing:EASE});
  }
}
function syncKeyed(container, cards, make, map, fan){
  (fan?(c,f)=>f():flip)(container, ()=>{
    const ids=new Set(cards.map(c=>c.id));
    for(const [id,el] of map) if(!ids.has(id)){ el.remove(); map.delete(id) }
    cards.forEach((c,i)=>{
      let el=map.get(c.id);
      if(!el){ el=make(c); el.dataset.id=c.id; map.set(c.id,el) }
      if(!el.parentElement || (container.children[i]!==el && !(fan && drag && drag.started))) container.insertBefore(el, container.children[i]||null);
    });
  });
}
// Vuela una carta desde un rectángulo hasta un elemento; si startEl difiere, se da vuelta a mitad de camino
function fly(from, toEl, startEl){
  if(!from || !toEl || REDUCE) return Promise.resolve();
  const to=geom(toEl), r0=from.rot||0, r1=to.rot||0;
  toEl.style.visibility='hidden';
  const place=el=>{
    el.classList.remove('sel','new','under','dragging'); el.removeAttribute('id');
    Object.assign(el.style,{position:'fixed',left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',
      margin:'0',zIndex:'80',pointerEvents:'none',visibility:'visible',transformOrigin:'50% 50%',rotate:'0deg',translate:'0 0',transition:'none'});
    document.body.appendChild(el); return el;
  };
  const endEl=toEl.cloneNode(true);
  const fx=from.left+from.width/2-(to.left+to.width/2), fy=from.top+from.height/2-(to.top+to.height/2), s=from.width/to.width;
  const T0=`translate(${fx}px,${fy}px) scale(${s}) rotate(${r0}deg)`, TM=`translate(${fx/2}px,${fy/2}px) scale(${(s+1)/2}) rotate(${(r0+r1)/2}deg)`;
  const D=460;
  return new Promise(res=>{
    const done=()=>{ endEl.remove(); toEl.style.visibility=''; res() };
    if(startEl){
      place(startEl);
      startEl.animate([{transform:T0},{transform:TM+' scaleX(0)'}],{duration:D/2,easing:'ease-in'}).onfinish=()=>{
        startEl.remove(); place(endEl);
        endEl.animate([{transform:TM+' scaleX(0)'},{transform:`rotate(${r1}deg)`}],{duration:D/2,easing:'ease-out'}).onfinish=done;
      };
    } else {
      place(endEl);
      endEl.animate([{transform:T0},{transform:`translateY(-10px) scale(1.04) rotate(${r1}deg)`,offset:.75},{transform:`rotate(${r1}deg)`}],{duration:D,easing:EASE}).onfinish=done;
    }
  });
}
const deckRect=()=>$('deckSlot').getBoundingClientRect();
function geom(el){
  if(el.parentElement===$('myHand')){
    const hr=$('myHand').getBoundingClientRect();
    return {left:hr.left+el.offsetLeft, top:hr.top+el.offsetTop, width:el.offsetWidth, height:el.offsetHeight, rot:parseFloat(el.style.rotate)||0};
  }
  const r=el.getBoundingClientRect(); return {left:r.left, top:r.top, width:r.width, height:r.height, rot:0};
}
const rectOf=(map,id)=>{const e=map.get(id);return e?geom(e):null};

/* ---------- estado ---------- */
// G es el estado compartido de la partida: en línea viaja entero a Firebase. Los asientos van de 0 a n-1 y ME es el mío.
// V es lo que se dibuja: normalmente G; durante el reparto, una copia que se va llenando carta por carta.
// L guarda lo que es solo de esta pantalla: el orden de mi mano, la carta elegida y los avisos.
let G=null, V=null, ME=0;
let MODE='local', HOST=true, TCODE=null, SEATNAME=[], HOSTNAME='';
const L={order:[], sel:null, tip:'', lastDrawn:null, dragRect:null, shownK:0, holdResult:false, reported:0};
const oppMaps=[new Map(),new Map(),new Map()];
const clone=o=>JSON.parse(JSON.stringify(o));
const active=()=>G.cpu.map((_,s)=>s).filter(s=>!G.out.includes(s));
function nextOf(s){ const a=active(); return a[(a.indexOf(s)+1)%a.length] }
const who=s=>s===ME?'Vos':(SEATNAME[s]||`Jugador ${s+1}`);
let NPLAYERS=2; try{ NPLAYERS=+localStorage.getItem('urugames-conga')||2 }catch(_){}
function localNames(n){ return n===2?['Vos','La máquina']:['Vos','Máquina 1','Máquina 2'] }

function newDeckFor(g){
  // ids únicos por partida y por mano, para que una carta nueva nunca reuse el dibujo de otra
  const d=[]; let i=0, base=g.gid*10000+g.round*100;
  for(const s of SUITS) for(let n=1;n<=12;n++) d.push({id:base+i++,n,s});
  d.push({id:base+i++,n:0,s:'j'},{id:base+i++,n:0,s:'j'});
  return shuffle(d);
}
function newGame(n, cpu){
  G={n, cpu, out:[], scores:Array(n).fill(0), rows:[], round:0, gid:1+Math.floor(Math.random()*90000),
     starter:Math.floor(Math.random()*n), ev:{k:G?G.ev.k:0}, log:[], over:false, winner:null, started:Date.now()};
  dealRound();
}
function dealRound(){
  G.round++; const deck=newDeckFor(G);
  G.hands=Array.from({length:G.n},()=>[]); G.picked=Array.from({length:G.n},()=>[]);
  if(G.out.includes(G.starter)) G.starter=nextOf(G.starter);
  const seq=[]; let p=G.starter; for(let k=0;k<active().length;k++){ seq.push(p); p=nextOf(p) }
  const order=[];
  for(let i=0;i<7*seq.length;i++){ const s=seq[i%seq.length], c=deck.pop(); G.hands[s].push(c); order.push([s,c.id]) }
  G.pozo=[deck.pop()]; G.deck=deck;
  G.turn=seq[0]; G.phase='draw'; G.fromPozo=null; G.result=null; G.log=[]; G.lastDraw=null;
  G.starter=nextOf(seq[0]);
  setEv({t:'deal', order});
}
function setEv(e){ G.ev={...e, k:(G.ev?G.ev.k:0)+1} }

/* acciones: cambian G y dejan anotado el evento para animarlo */
function actDraw(s, src){
  let c;
  if(src==='pozo'){ c=G.pozo.pop(); G.fromPozo=c.id; G.picked[s].push(c) }
  else {
    if(!G.deck.length && G.pozo.length>1){ const top=G.pozo.pop(); G.deck=shuffle(G.pozo); G.pozo=[top] }
    c=G.deck.pop();
    if(!c){ endRound(null); setEv({t:'empty'}); return }
    G.fromPozo=null;
  }
  G.hands[s].push(c); G.phase='discard'; G.lastDraw={s, src, c:src==='pozo'?c:null};
  setEv({t:'draw', s, src, id:c.id, c:src==='pozo'?c:null});
}
function actDiscard(s, id, cut){
  const c=G.hands[s].find(x=>x.id===id);
  G.hands[s]=G.hands[s].filter(x=>x!==c); G.pozo.push(c);
  const took=G.lastDraw&&G.lastDraw.s===s&&G.lastDraw.src==='pozo'?G.lastDraw.c:null;
  G.log.push({s, took, threw:c}); G.fromPozo=null; G.lastDraw=null;
  if(cut) endRound(s);
  else { G.turn=nextOf(s); G.phase='draw' }
  setEv({t:'discard', s, id, cut:!!cut});
}
function endRound(cutter){
  const act=active(), res={};
  let conga=false;
  for(const p of act){
    const r=solve(G.hands[p]); let pts=cutter==null?0:r.dw;
    if(p===cutter){ if(r.dw===0) pts=-10; conga = r.dw===0 && r.melds.length===1 && r.melds[0].length===7 }
    res[p]={melds:r.melds, loose:r.loose, pts}; G.scores[p]+=pts;
  }
  G.rows.push({pts:G.cpu.map((_,p)=>res[p]?res[p].pts:null), cut:cutter});
  const newlyOut=[];
  if(!conga) for(const p of act) if(G.scores[p]>LIMIT){ G.out.push(p); newlyOut.push(p) }
  let winner=null;
  if(conga) winner=cutter;
  else {
    const a=active();
    if(a.length===1) winner=a[0];
    else if(a.length===0){ winner=act.reduce((b,p)=>G.scores[p]<G.scores[b]?p:b); G.out=G.out.filter(p=>p!==winner) }
  }
  // Contra la compu, si quedás afuera se termina la partida
  if(winner==null && MODE==='local' && G.out.includes(ME)) winner=active().reduce((b,p)=>G.scores[p]<G.scores[b]?p:b);
  G.over=winner!=null; G.winner=winner;
  G.phase='over'; G.turn=null;
  G.result={cutter, conga, newlyOut, res};
}

/* ---------- cola de estados: cada cambio se anima en orden, sea mío, de la compu o de otro jugador ---------- */
const Q=[]; let processing=false, SESSION=0, appliedSes=0;
function commit(){
  if(MODE==='online') push();
  enqueue(clone(G));
}
function enqueue(st){ Q.push({st, ses:SESSION}); if(!processing) runQueue() }
async function runQueue(){
  processing=true;
  while(Q.length){ const {st,ses}=Q.shift(); if(ses!==SESSION) continue; appliedSes=ses;
    try{ await applyState(st) }catch(e){ console.error(e); G=st; V=G; render() } }
  processing=false; render(); afterState();
}
async function applyState(st){
  const e=st.ev||{k:0};
  if(!G || st.gid!==G.gid) L.shownK=e.k-1;   // partida nueva: se anima desde su reparto
  const animate=e.k===L.shownK+1;
  G=st; L.shownK=e.k;
  if(!animate){ V=G; if(e.t==='deal') resetHand(); render(); return }
  if(e.t==='deal') return animDeal(e);
  if(e.t==='draw'){
    const from=e.src==='pozo'?rectOf(pozoMap,e.id):deckRect();
    V=G; if(e.s===ME){ L.order.push(e.id); L.lastDrawn=e.id; L.sel=null; L.tip='' }
    render();
    const to=e.s===ME?myMap.get(e.id):oppMaps[e.s].get(e.id);
    const start=e.s===ME&&e.src==='mazo'?backEl():(e.s!==ME&&e.c?cardEl(e.c):null);
    return fly(from, to, start);
  }
  if(e.t==='discard'){
    const from=e.s===ME?(L.dragRect||rectOf(myMap,e.id)):rectOf(oppMaps[e.s],e.id);
    L.dragRect=null; if(e.s===ME){ L.sel=null; L.lastDrawn=null }
    L.holdResult=true; V=G; render();
    await fly(from, pozoMap.get(e.id), e.s!==ME?backEl():null);
    L.holdResult=false; return;
  }
  V=G; render();
}
function resetHand(){ L.order=[]; L.sel=null; L.tip=''; L.lastDrawn=null; $('overlay').hidden=true }
async function animDeal(e){
  resetHand();
  V=clone(G); V.hands=G.hands.map(()=>[]); V.pozo=[]; V.deckCount=G.deck.length+e.order.length+1; V.dealing=true;
  render();
  const byId=new Map(G.hands.flat().map(c=>[c.id,c]));
  await sleep(250);
  for(const [s,id] of e.order){
    V.hands[s].push(byId.get(id)); V.deckCount--;
    if(s===ME) L.order.push(id);
    render();
    if(s===ME) fly(deckRect(), myMap.get(id), backEl()); else fly(deckRect(), oppMaps[s].get(id));
    await sleep(e.order.length>14?115:150);
  }
  await sleep(450);
  V.pozo=G.pozo.slice(); V.deckCount--; render();
  await fly(deckRect(), pozoMap.get(G.pozo[0].id), backEl());
  await sleep(200);
  V=G; L.order=G.hands[ME].slice().sort(suitSort).map(c=>c.id); render();
}

/* ---------- después de cada cambio: turno de la compu y resultado ---------- */
let cpuTimer=null;
function afterState(){
  clearTimeout(cpuTimer);
  if(!G || appliedSes!==SESSION || Q.length) return;
  if(G.over && L.reported!==G.gid){ L.reported=G.gid; reportResult() }
  if(G.phase==='over' || G.turn==null) return;
  const s=G.turn;
  if(!G.cpu[s] || !(MODE==='local'||HOST)) return;
  const k=G.ev.k;
  cpuTimer=setTimeout(()=>{
    if(!G||G.ev.k!==k||processing||Q.length||G.turn!==s||appliedSes!==SESSION) return;
    if(G.phase==='draw'){
      const hand=G.hands[s], top=G.pozo[G.pozo.length-1]; let take=false;
      if(top){ const bd=bestDiscard([...hand,top], top.id, s); if(bd.cut || (DIF!=='facil' && bd.h < hval(hand)-1.5)) take=true }
      actDraw(s, take?'pozo':'mazo');
    } else {
      const bd=bestDiscard(G.hands[s], G.fromPozo, s);
      actDiscard(s, bd.card.id, bd.cut);
    }
    commit();
  }, G.phase==='draw'?650:450);
}
function reportResult(){
  // Resultado común para el ranking (ver ESTADO.md)
  try{ window.dispatchEvent(new CustomEvent('urugames:resultado',{detail:{juego:'conga', resultado:G.winner===ME?'gano':'perdio',
    puntaje:G.scores[ME], tiempo:Math.round((Date.now()-(G.started||Date.now()))/1000), jugadores:G.n}})) }catch(_){}
}

/* ---------- mis jugadas ---------- */
const myTurn=ph=>!processing && !Q.length && G && G.turn===ME && G.phase===ph;
function myDraw(src){
  if(!myTurn('draw')) return;
  if(src==='pozo' && !G.pozo.length) return;
  actDraw(ME, src); commit();
}
function selectCard(id){
  if(!myTurn('discard')) return;
  L.sel = L.sel===id?null:id;
  L.tip = L.sel!=null && L.sel===G.fromPozo ? 'Esa la levantaste del pozo, no la podés tirar en este turno.' : '';
  render();
}
function canDiscard(id){ return myTurn('discard') && id!=null && id!==G.fromPozo && G.hands[ME].some(c=>c.id===id) }
function myDiscard(id, cut, fromRect){
  if(!canDiscard(id)) return;
  if(cut && solve(G.hands[ME].filter(x=>x.id!==id)).dw>5){ L.tip='Todavía no podés cortar: lo que te queda suelto suma más de 5.'; render(); return }
  L.tip=''; L.dragRect=fromRect||null;
  actDiscard(ME, id, cut); commit();
}
function sortOrder(){ if(!G) return; L.order=G.hands[ME].slice().sort(suitSort).map(c=>c.id); render() }

/* ---------- partida contra la compu ---------- */
function freshGame(n){
  if(n){ NPLAYERS=n; try{ localStorage.setItem('urugames-conga', n) }catch(_){} }
  if(MODE==='online'&&mesas) mesas.salir();
  TCODE=null; clearTimeout(cpuTimer); SESSION++; MODE='local'; ME=0; HOST=true; SEATNAME=localNames(NPLAYERS);
  Q.length=0;
  newGame(NPLAYERS, Array.from({length:NPLAYERS},(_,i)=>i!==0));
  commit();
}
function nextRound(){
  if(!G || G.phase!=='over' || !(MODE==='local'||HOST)) return;
  if(G.over){
    if(MODE==='local') return freshGame();
    newGame(G.n, G.cpu);
  } else dealRound();
  commit();
}

/* ---------- dibujo ---------- */
function starPath(){let p='';for(let i=0;i<10;i++){const r=i%2?7:16,a=-Math.PI/2+i*Math.PI/5;p+=(i?'L':'M')+(r*Math.cos(a)).toFixed(1)+','+(r*Math.sin(a)).toFixed(1)}return p+'Z'}
const STAR=`<path d="${starPath()}" fill="currentColor"/>`;
function cardEl(c, opts={}){
  const el=document.createElement(opts.button?'button':'div');
  el.className='card face'; if(opts.button) el.type='button';
  const col=c.s==='j'?0:c.n-1, row=c.s==='j'?4:SUITS.indexOf(c.s);
  el.style.backgroundPosition=`${col/11*100}% ${row/4*100}%`;
  if(c.s==='j') el.innerHTML=`<span class="jk" aria-hidden="true"><svg viewBox="-17 -17 34 34">${STAR}</svg><span>COMODÍN</span></span>`;
  el.setAttribute('aria-label', cname(c));
  if(opts.role==='img') el.setAttribute('role','img');
  return el;
}
function backEl(){const d=document.createElement('div'); d.className='card back'; return d}
const esc=t=>String(t).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

function message(){
  if(!G) return '';
  if(V&&V.dealing) return 'Repartiendo…';
  if(G.phase==='over'){ const c=G.result&&G.result.cutter; return c==null?'Se terminó el mazo.':c===ME?'Cortaste.':`${esc(who(c))} cortó.` }
  const s=G.turn, n=esc(who(s));
  if(s===ME){
    if(G.phase==='draw') return '<strong>Tu turno.</strong> Levantá del mazo o del pozo.';
    const d=G.lastDraw, c=d&&G.hands[ME].find(x=>x.id===L.lastDrawn);
    return d&&d.src==='pozo'?`Levantaste el <strong>${cname(d.c)}</strong> del pozo. Elegí qué carta tirar.`
      : c?`Sacaste el <strong>${cname(c)}</strong>. Elegí qué carta tirar.`:'Elegí qué carta tirar.';
  }
  if(G.phase==='draw') return G.cpu[s]?`${n} está pensando…`:`Le toca a ${n}.`;
  const d=G.lastDraw;
  return d&&d.src==='pozo'?`${n} levantó el <strong>${cname(d.c)}</strong> del pozo.`:`${n} sacó del mazo.`;
}
function logLine(l){
  if(l.s===ME) return l.took?`Levantaste el ${cname(l.took)} y tiraste el ${cname(l.threw)}.`:`Tiraste el ${cname(l.threw)}.`;
  const n=esc(who(l.s));
  return l.took?`${n} levantó el ${cname(l.took)} y tiró el ${cname(l.threw)}.`:`${n} sacó del mazo y tiró el ${cname(l.threw)}.`;
}
const others=()=>Array.from({length:G.n-1},(_,i)=>(ME+1+i)%G.n);

function render(){
  if(!G||!V) return;
  $('roundInfo').textContent=`Mano ${V.round}`;
  renderOpps();
  // mazo
  const dc=V.deckCount!=null?V.deckCount:V.deck.length;
  $('deckBtn').hidden = !(dc || V.pozo.length>1);
  $('deckCount').textContent=dc;
  // pozo (las dos de arriba, para que se vea la anterior mientras vuela una nueva)
  const pz=V.pozo.slice(-2);
  syncKeyed($('pozoSlot'), pz, c=>cardEl(c,{button:true}), pozoMap);
  pz.forEach((c,i)=>{ const e=pozoMap.get(c.id), top=i===pz.length-1;
    e.classList.toggle('under',!top); e.tabIndex=top?0:-1;
    e.setAttribute('aria-label', top?'Levantar del pozo: '+cname(c):cname(c)); });
  const canDraw=myTurn('draw') && V===G;
  $('deckPile').classList.toggle('live',canDraw); $('pozoPile').classList.toggle('live',canDraw&&G.pozo.length>0);
  const lines=V.dealing?[]:(G.log||[]).slice(-2).map(logLine);
  const m=message();
  $('msg').innerHTML=lines.map(l=>`<span class="small">${l}</span>`).join('')+(m?`<span>${m}</span>`:'');

  // mi mano
  const mineArr=V.hands[ME]||[], byId=new Map(mineArr.map(c=>[c.id,c]));
  L.order=L.order.filter(id=>byId.has(id));
  for(const c of mineArr) if(!L.order.includes(c.id)) L.order.push(c.id);
  const mine=L.order.map(id=>byId.get(id));
  syncKeyed($('myHand'), mine, c=>cardEl(c,{button:true}), myMap, true);
  layoutHand();
  for(const c of mine){
    const e=myMap.get(c.id); if(!e) continue;
    e.classList.toggle('sel', L.sel===c.id);
    e.classList.toggle('new', L.lastDrawn===c.id);
  }
  const ok=canDiscard(L.sel);
  $('btnDiscard').disabled=!ok; $('btnCut').disabled=!ok;
  $('btnSuit').disabled=!mine.length || !!V.dealing;
  $('tip').textContent=L.tip || (G.out.includes(ME)&&G.phase!=='over'?'Quedaste afuera: estás mirando la partida.':'');

  // planilla: como en papel, cada renglón lleva el total acumulado
  const cols=[ME,...others()];
  const short=s=>{
    const t=who(s);
    if(t==='La máquina') return 'Máquina';
    let m=t.match(/^Máquina (\d)$/); if(m) return 'Máq. '+m[1];
    m=t.match(/^Jugador (\d)$/); if(m) return 'Jug. '+m[1];
    const w=t.split(/\s+/)[0]; return w.length>9?w.slice(0,8)+'.':w;
  };
  const key=cols.map(short).join('|');
  if($('sheetHead').dataset.k!==key){
    $('sheetHead').dataset.k=key;
    $('sheetHead').innerHTML='<tr><th></th>'+cols.map(s=>`<th>${esc(short(s))}</th>`).join('')+'</tr>';
  }
  const rows=$('rows'); rows.replaceChildren();
  const acc=Array(G.n).fill(0);
  G.rows.forEach((x,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<th scope="row">${i+1}</th>`+cols.map(p=>{
      if(x.pts[p]==null) return '<td class="gone">—</td>';
      acc[p]+=x.pts[p]; return `<td class="${x.cut===p?'cut':''}${acc[p]>LIMIT?' over':''}">${acc[p]}</td>`;
    }).join('');
    rows.append(tr);
  });
  const blank='<th scope="row"></th>'+cols.map(()=>'<td></td>').join('');
  for(let i=G.rows.length;i<6;i++){ const tr=document.createElement('tr'); tr.innerHTML=blank; rows.append(tr) }
  $('left').textContent = G.rows.length ? `Te faltan ${Math.max(0,LIMIT-G.scores[ME])} para pasarte de ${LIMIT}.`
    : `Se juega a ${LIMIT}. ${G.n===2?'El que se pasa, pierde.':'El que se pasa queda afuera; gana el último que queda.'}`;
  document.querySelectorAll('#seg button').forEach(b=>b.setAttribute('aria-pressed', String(MODE==='local' && +b.dataset.n===G.n)));
  $('tableInfo').hidden=MODE!=='online';
  if(MODE==='online') $('tableInfo').innerHTML=`Mesa en línea <b>${esc(TCODE)}</b>`;

  renderResult();
}
function renderOpps(){
  const box=$('opps'), seats=others(), key=G.gid+':'+ME+':'+seats.join();
  if(box.dataset.k!==key){
    box.dataset.k=key; box.replaceChildren();
    oppMaps.forEach(m=>m.clear());
    for(const s of seats){
      const sec=document.createElement('section'); sec.className='seat'; sec.id='seat-'+s;
      sec.innerHTML=`<span class="who"></span><div class="hand"></div>`;
      box.append(sec);
    }
  }
  for(const s of seats){
    const sec=$('seat-'+s), hand=V.hands[s]||[], out=G.out.includes(s);
    sec.classList.toggle('turn', !V.dealing && G.turn===s); sec.classList.toggle('gone', out);
    sec.querySelector('.who').innerHTML = out ? `${esc(who(s))}, afuera` : `${esc(who(s))}, <b>${hand.length}</b> cartas`;
    syncKeyed(sec.querySelector('.hand'), hand, ()=>backEl(), oppMaps[s]);
    hand.forEach((c,i,a)=>{ const e=oppMaps[s].get(c.id), d=i-(a.length-1)/2; e.style.rotate=(-d*4)+'deg'; e.style.translate=`0 ${(d*d*1.6).toFixed(1)}px`; e.style.zIndex=i+1 });
  }
}
function miniHand(r){
  const box=document.createElement('div'); box.className='mini';
  for(const m of r.melds){ const g=document.createElement('div'); g.className='g'; m.forEach(c=>g.append(cardEl(c,{role:'img'}))); box.append(g) }
  if(r.loose.length){ const g=document.createElement('div'); g.className='g loose'; r.loose.slice().sort(suitSort).forEach(c=>g.append(cardEl(c,{role:'img'}))); box.append(g) }
  return box;
}
function renderResult(){
  const ov=$('overlay'), R=G.result;
  if(!R || G.phase!=='over' || L.holdResult){ ov.hidden=true; return }
  const key=G.gid+':'+G.ev.k;
  if(!ov.hidden && ov.dataset.k===key) return;
  ov.dataset.k=key; ov.hidden=false;
  const nm=s=>s===ME?'vos':who(s);
  const tot=[ME,...others()].map(p=>`${esc(nm(p))} ${G.scores[p]}`).join(', ');
  const outTxt=R.newlyOut.map(p=>p===ME?`Pasaste de ${LIMIT}.`:`${esc(who(p))} pasó de ${LIMIT}${G.n>2?' y queda afuera':''}.`).join(' ');
  let title, text;
  if(R.conga){ title = R.cutter===ME?'¡Conga! Ganaste la partida':`${who(R.cutter)} hizo conga`; text='Escalera de siete del mismo palo: la partida termina en el acto.' }
  else if(G.over){ title = G.winner===ME?'Ganaste la partida':(G.n===2?'Perdiste la partida':`Ganó ${who(G.winner)}`); text=`${outTxt} Final: ${tot}.` }
  else if(R.newlyOut.includes(ME)){ title='Quedaste afuera'; text=`${outTxt} Podés mirar cómo sigue. Totales: ${tot}.` }
  else if(R.cutter==null){ title='Mazo agotado'; text='La mano se anula, nadie suma.' }
  else { title = R.cutter===ME?'Cortaste':`${who(R.cutter)} cortó`; text=`${outTxt} Totales: ${tot}.`.trim() }
  $('resTitle').textContent=title; $('resText').innerHTML=text;
  const hs=$('resHands'); hs.replaceChildren();
  for(const p of [ME,...others()]){
    const r=R.res[p]; if(!r) continue;
    const row=document.createElement('div'); row.className='row'; row.innerHTML=`<span>${esc(who(p))}</span><b>${r.pts>0?'+':''}${r.pts}</b>`;
    hs.append(row, miniHand(r));
  }
  const canDeal=MODE==='local'||HOST, b=$('btnNext');
  b.textContent=G.over?'Jugar otra partida':'Siguiente mano';
  b.disabled=!canDeal;
  $('resWait').textContent=canDeal?'':`Esperando que ${HOSTNAME||'quien abrió la mesa'} reparta.`;
}
/* ---------- mano en abanico ---------- */
let drag=null, suppressClick=false, slotX=[];
const hand=$('myHand');
function layoutHand(){
  const els=L.order.map(id=>myMap.get(id)).filter(Boolean), n=els.length;
  if(!n){ slotX=[]; return }
  const W=hand.clientWidth, w=els[0].offsetWidth, h=w*258/168, R=w*4.4;
  let step=7*Math.PI/180;
  if(n>1){ const maxSp=(W-w*1.3)/(n-1); if(R*Math.sin(step)>maxSp) step=Math.asin(Math.max(.04,Math.min(1,maxSp/R))) }
  const amax=step*(n-1)/2, top0=26, Py=top0+h/2+R;
  hand.style.height=Math.ceil(top0+h+R*(1-Math.cos(amax))+w*Math.sin(amax)*.6+14)+'px';
  slotX=[];
  els.forEach((el,i)=>{
    const a=(i-(n-1)/2)*step, cx=W/2+R*Math.sin(a), cy=Py-R*Math.cos(a);
    slotX.push(cx);
    el.style.zIndex=i+1;
    if(el.classList.contains('dragging')) return;
    el.style.left=(cx-w/2)+'px'; el.style.top=(cy-h/2)+'px'; el.style.rotate=(a*180/Math.PI).toFixed(2)+'deg';
  });
}
if(window.ResizeObserver) new ResizeObserver(()=>{ if(G) layoutHand() }).observe(hand);
function overPozo(x,y){ const r=$('pozoSlot').getBoundingClientRect(); const p=14; return x>r.left-p&&x<r.right+p&&y>r.top-p&&y<r.bottom+p }
hand.addEventListener('pointerdown',e=>{
  const el=e.target.closest('.card'); if(!el||!G||!V||V.dealing||G.phase==='over') return;
  if(e.button!==undefined && e.button!==0) return;
  const g=geom(el);
  drag={el, id:+el.dataset.id, x0:e.clientX, y0:e.clientY, gx:e.clientX-(g.left+g.width/2), gy:e.clientY-(g.top+g.height/2), started:false, pid:e.pointerId};
});
window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pid) return;
  const el=drag.el;
  if(!drag.started){
    if(Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0)<7) return;
    drag.started=true; el.classList.add('dragging');
  }
  e.preventDefault();
  const hr=hand.getBoundingClientRect(), w=el.offsetWidth, h=el.offsetHeight;
  const cx=e.clientX-drag.gx-hr.left, cy=e.clientY-drag.gy-hr.top;
  el.style.left=(cx-w/2)+'px'; el.style.top=(cy-h/2)+'px';
  el.style.rotate=Math.max(-8,Math.min(8,(e.clientX-drag.x0)/30)).toFixed(1)+'deg';
  // el hueco se abre en la posición más cercana del abanico
  let best=0, bd=Infinity; slotX.forEach((x,i)=>{ const d=Math.abs(x-cx); if(d<bd){bd=d;best=i} });
  const cur=L.order.indexOf(drag.id);
  if(cur>=0 && best!==cur){ L.order.splice(cur,1); L.order.splice(best,0,drag.id); layoutHand() }
  $('pozoPile').classList.toggle('drop', canDiscard(drag.id) && overPozo(e.clientX,e.clientY));
});
function endDrag(e){
  if(!drag||e.pointerId!==drag.pid) return;
  const d=drag; drag=null; $('pozoPile').classList.remove('drop');
  if(!d.started) return;
  suppressClick=true; setTimeout(()=>suppressClick=false,0);
  const el=d.el;
  if(e.type==='pointerup' && canDiscard(d.id) && overPozo(e.clientX,e.clientY)){
    const g=geom(el); el.classList.remove('dragging');
    myDiscard(d.id, false, g);
    return;
  }
  el.classList.remove('dragging');
  render();
}
window.addEventListener('pointerup',endDrag);
window.addEventListener('pointercancel',endDrag);
hand.addEventListener('click',e=>{
  if(suppressClick) return;
  const el=e.target.closest('.card'); if(el) selectCard(+el.dataset.id);
});
hand.addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
  const el=e.target.closest('.card'); if(!el) return;
  e.preventDefault();
  const i=L.order.indexOf(+el.dataset.id), j=i+(e.key==='ArrowLeft'?-1:1);
  if(j<0||j>=L.order.length) return;
  [L.order[i],L.order[j]]=[L.order[j],L.order[i]];
  render(); el.focus();
});
window.addEventListener('resize',()=>{ if(G) layoutHand() });

/* ---------- en línea: js/mesas.js, igual para todos los juegos ---------- */
// La partida entera viaja en la mesa. Escribe quien juega: cada persona su turno,
// y quien abrió la mesa los turnos de la compu y el reparto de cada mano.
const URU_MULTI=URU.modo==='multi';
function pausarLocal(){ if(MODE==='local'){ clearTimeout(cpuTimer); SESSION++; Q.length=0 } }
const mesas=window.UruMesas?UruMesas.crear({
  juego:'conga', panel:$('online'),
  espera:{ mostrar:h=>{ pausarLocal(); $('waitBody').innerHTML=h; $('waiting').hidden=false }, ocultar:()=>{ $('waiting').hidden=true } },
  clases:{ boton:'btn', secundario:'btn quiet', chico:'sm', nota:'small' },
  jugadores:()=>NPLAYERS,
  nuevaPartida:m=>{ const keep=G; newGame(m.seats.length, m.cpu); const g=G; G=keep; return g },
  alEstado:(g,info)=>{
    if(MODE!=='online'){ pausarLocal(); MODE='online' }
    ME=info.asiento; HOST=info.host; SEATNAME=info.nombres; HOSTNAME=info.hostNombre; TCODE=info.codigo;
    enqueue(g);
  },
  alSalir:()=>{ freshGame() },
  alError:()=>{ $('onlineBox').open=true }
}):null;
function push(){ if(mesas) mesas.publicar(G, G.over) }

/* ---------- eventos ---------- */
$('deckBtn').onclick=()=>myDraw('mazo');
$('pozoSlot').addEventListener('click',e=>{ const el=e.target.closest('.card'); if(el&&!el.classList.contains('under')) myDraw('pozo') });
$('btnDiscard').onclick=()=>myDiscard(L.sel,false);
$('btnCut').onclick=()=>myDiscard(L.sel,true);
$('btnSuit').onclick=()=>sortOrder();
document.querySelectorAll('#seg button').forEach(b=>b.onclick=()=>{ freshGame(+b.dataset.n); if(mesas) mesas.redibujar() });
$('btnNext').onclick=()=>nextRound();

/* ---------- arranque ---------- */
// Desde Multijugador en el menú se abre directo la parte en línea; mientras tanto se juega contra la compu
freshGame();
if(mesas) mesas.iniciar().then(ok=>{ if(!ok && URU_MULTI && !(window.UruOnline&&UruOnline.disponible())) $('aviso').hidden=false });
else if(URU_MULTI) $('aviso').hidden=false;
if(URU_MULTI) $('onlineBox').open=true;
else if($('onlineBox')) $('onlineBox').hidden=true; // "Jugar solo": sin el panel en línea
})();
