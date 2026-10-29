// Conga con baraja española: vos contra 1 o 2 máquinas, a 100 puntos.
// Usa window.URUGAMES (js/juego-base.js) para la dificultad y para avisar que el multijugador en línea no existe todavía.
(function(){
const SUITS=['o','c','e','b'];
const SUIT_NAME={o:'oros',c:'copas',e:'espadas',b:'bastos'};
const GCOL=['#d9ae57','#7fb7d6','#9ccf84','#e58f7d'];
const LIMIT=100;
const REDUCE=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const val=c=>c.s==='j'?50:c.n;
const cname=c=>c.s==='j'?'comodín':`${c.n} de ${SUIT_NAME[c.s]}`;
const sleep=ms=>new Promise(r=>setTimeout(r, REDUCE?Math.min(ms,80):ms));
let UID=0;
const URU=window.URUGAMES||{};
const DIF=['facil','normal','dificil'].includes(URU.dificultad)?URU.dificultad:'normal';

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function newDeck(){const d=[];for(const s of SUITS)for(let n=1;n<=12;n++)d.push({id:UID++,n,s});d.push({id:UID++,n:0,s:'j'},{id:UID++,n:0,s:'j'});return shuffle(d)}

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
function feeds(c){
  return (S.picked||[]).some(d=>c.s!=='j' && (d.n===c.n || (d.s===c.s && Math.abs(d.n-c.n)<=2)));
}
function bestDiscard(hand, forbid){
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
    if(DIF==='dificil' && feeds(c)) h+=3;
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
let S, busy=false, epoch=0;
const BOTS=['m1','m2'];
const oppMaps={m1:new Map(), m2:new Map()};
const bn=p=>S.players.length===2?'la máquina':(p==='m1'?'Máquina 1':'Máquina 2');
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const NAME=p=>p==='me'?'Vos':cap(bn(p));
const handOf=p=>p==='me'?S.me:S.bots[p];
const active=()=>S.players.filter(p=>!S.out.includes(p));
function nextOf(p){ const a=active(); const i=a.indexOf(p); return a[(i+1)%a.length] }
let NPLAYERS=2; try{ NPLAYERS=+localStorage.getItem('urugames-conga')||2 }catch(_){}
function freshGame(n){
  if(n){ NPLAYERS=n; try{ localStorage.setItem('urugames-conga', n) }catch(_){} }
  const players=['me',...BOTS.slice(0,NPLAYERS-1)];
  S={players, out:[], scores:Object.fromEntries(players.map(p=>[p,0])), rows:[], round:0,
     starter:players[Math.floor(Math.random()*players.length)], log:[]};
  deal();
}
async function deal(){
  const my=++epoch; busy=true;
  S.round++; S.deck=newDeck(); S.me=[]; S.bots={}; for(const p of S.players) if(p!=='me') S.bots[p]=[];
  S.pozo=[]; S.order=[]; S.log=[]; S.picked=[];
  S.phase='dealing'; S.tip=''; S.turn=null; S.fromPozo=null; S.sel=null; S.lastDrawn=null; S.result=null;
  if(S.out.includes(S.starter)) S.starter=nextOf(S.starter);
  S.msg='Repartiendo…'; render();
  const seq=[]; let p=S.starter; for(let k=0;k<active().length;k++){ seq.push(p); p=nextOf(p) }
  await sleep(250);
  for(let i=0;i<7*seq.length;i++){
    if(my!==epoch) return;
    const who=seq[i%seq.length], c=S.deck.pop(), from=deckRect();
    if(who==='me'){ S.me.push(c); S.order.push(c.id) } else S.bots[who].push(c);
    render();
    if(who==='me') fly(from, myMap.get(c.id), backEl()); else fly(from, oppMaps[who].get(c.id));
    await sleep(seq.length===3?115:150);
  }
  await sleep(480); if(my!==epoch) return;
  const c=S.deck.pop(); S.pozo.push(c); render();
  await fly(deckRect(), pozoMap.get(c.id), backEl());
  await sleep(250); if(my!==epoch) return;
  sortOrder('palo', false);
  const first=seq[0];
  S.turn=first; S.phase='draw'; S.starter=nextOf(first); busy=false;
  S.msg = first==='me' ? '<strong>Empezás vos.</strong> Levantá una carta del mazo o del pozo.' : `Empieza ${bn(first)}.`;
  render(); if(first!=='me') aiTurn(first);
}
function drawDeck(){
  if(!S.deck.length){ const top=S.pozo.pop(); S.deck=shuffle(S.pozo); S.pozo=[top] }
  return S.deck.pop()||null;
}
function sortOrder(mode, doRender=true){
  let cards;
  if(mode==='jugadas'){ const r=solve(S.me); cards=[...r.melds.flat(), ...r.loose.slice().sort(suitSort)] }
  else cards=S.me.slice().sort(suitSort);
  S.order=cards.map(c=>c.id);
  if(doRender) render();
}
function passTurn(from){
  const p=nextOf(from);
  S.turn=p; S.phase='draw';
  if(p==='me'){ S.msg='<strong>Tu turno.</strong> Levantá del mazo o del pozo.'; render() }
  else { render(); aiTurn(p) }
}

/* ---------- jugador ---------- */
async function playerDraw(src){
  if(busy||S.turn!=='me'||S.phase!=='draw') return;
  busy=true; let c, from, startEl=null;
  if(src==='pozo'){
    if(!S.pozo.length){ busy=false; return }
    c=S.pozo[S.pozo.length-1]; from=rectOf(pozoMap,c.id); S.pozo.pop(); S.fromPozo=c.id; S.picked.push(c);
    S.msg=`Levantaste el <strong>${cname(c)}</strong> del pozo. Elegí qué carta tirar.`;
  } else {
    from=deckRect(); c=drawDeck(); if(!c){ busy=false; endRound(null); return }
    S.fromPozo=null; startEl=backEl();
    S.msg=`Sacaste el <strong>${cname(c)}</strong>. Elegí qué carta tirar.`;
  }
  S.me.push(c); S.order.push(c.id); S.lastDrawn=c.id; S.phase='discard'; S.sel=null; S.tip='';
  render();
  await fly(from, myMap.get(c.id), startEl);
  busy=false; render();
}
function selectCard(id){
  if(busy||S.turn!=='me'||S.phase!=='discard') return;
  S.sel = S.sel===id?null:id;
  S.tip = S.sel!=null && S.sel===S.fromPozo ? 'Esa la levantaste del pozo, no la podés tirar en este turno.' : '';
  render();
}
function canDiscard(id){
  return !busy && S.turn==='me' && S.phase==='discard' && id!=null && id!==S.fromPozo;
}
async function playerDiscard(id, cut, fromRect){
  if(!canDiscard(id)) return;
  const c=S.me.find(x=>x.id===id); if(!c) return;
  const rest=S.me.filter(x=>x!==c);
  if(cut && solve(rest).dw>5){ S.tip='Todavía no podés cortar: lo que te queda suelto suma más de 5.'; render(); return }
  S.tip='';
  busy=true;
  const from=fromRect||rectOf(myMap,id);
  S.me=rest; S.order=S.order.filter(x=>x!==id); S.pozo.push(c);
  S.sel=null; S.lastDrawn=null; S.fromPozo=null;
  S.log.push(`Tiraste el ${cname(c)}.`); S.msg = cut?'Cortás…':'';
  render();
  await fly(from, pozoMap.get(c.id));
  busy=false;
  if(cut){ endRound('me'); return }
  passTurn('me');
}

/* ---------- turno de las máquinas ---------- */
async function aiTurn(p){
  const my=epoch; busy=true;
  const who=cap(bn(p));
  S.msg=`${who} está pensando…`; render();
  await sleep(650); if(my!==epoch) return;
  let took=null;
  if(S.bots[p].length<8){
    const hand=S.bots[p], top=S.pozo[S.pozo.length-1]; let take=false;
    if(top){ const bd=bestDiscard([...hand,top], top.id); if(bd.cut || (DIF!=='facil' && bd.h < hval(hand)-1.5)) take=true }
    if(take){
      const from=rectOf(pozoMap,top.id); S.pozo.pop(); S.bots[p].push(top); S.fromPozo=top.id; took=top;
      S.msg=`${who} levantó el <strong>${cname(top)}</strong> del pozo.`; render();
      await fly(from, oppMaps[p].get(top.id), cardEl(top));
    } else {
      const from=deckRect(), got=drawDeck();
      if(!got){ busy=false; endRound(null); return }
      S.bots[p].push(got); S.fromPozo=null; S.msg=`${who} sacó del mazo.`; render();
      await fly(from, oppMaps[p].get(got.id));
    }
  }
  await sleep(450); if(my!==epoch) return;
  const bd=bestDiscard(S.bots[p], S.fromPozo);
  const from=rectOf(oppMaps[p],bd.card.id);
  S.bots[p]=S.bots[p].filter(x=>x!==bd.card); S.pozo.push(bd.card); S.fromPozo=null;
  S.log.push(took ? `${who} levantó el ${cname(took)} y tiró el ${cname(bd.card)}.` : `${who} sacó del mazo y tiró el ${cname(bd.card)}.`);
  S.msg=''; render();
  await fly(from, pozoMap.get(bd.card.id), backEl());
  if(my!==epoch) return;
  busy=false;
  if(bd.cut){ endRound(p); return }
  passTurn(p);
}

/* ---------- fin de mano ---------- */
function endRound(cutter){
  epoch++; busy=false;
  const act=active(), res={};
  let conga=false;
  for(const p of act){
    const r=solve(handOf(p)); let pts=cutter?r.dw:0;
    if(p===cutter){ if(r.dw===0) pts=-10; conga = r.dw===0 && r.melds.length===1 && r.melds[0].length===7 }
    res[p]={r,pts}; S.scores[p]+=pts;
  }
  const row={cut:cutter}; for(const p of S.players) row[p]=res[p]?res[p].pts:null; S.rows.push(row);
  const newlyOut=[];
  if(!conga) for(const p of act) if(S.scores[p]>LIMIT){ S.out.push(p); newlyOut.push(p) }
  let over=null;
  if(conga) over=cutter;
  else {
    const a=active();
    if(a.length===1) over=a[0];
    else if(a.length===0){ over=act.reduce((b,p)=>S.scores[p]<S.scores[b]?p:b); S.out=S.out.filter(p=>p!==over) }
    else if(S.out.includes('me')) over='afuera';
  }
  S.phase='over'; S.turn=null;
  S.result={cutter, conga, over, newlyOut, res};
  S.msg = cutter==='me'?'Cortaste.':cutter?`${cap(bn(cutter))} cortó.`:'Se terminó el mazo.';
  render();
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

function render(){
  $('roundInfo').textContent=`Mano ${S.round}`;
  // rival
  renderOpps();
  // mazo
  $('deckBtn').hidden = !(S.deck.length || S.pozo.length>1);
  $('deckCount').textContent=S.deck.length;
  // pozo (las dos de arriba, para que se vea la anterior mientras vuela una nueva)
  const pz=S.pozo.slice(-2);
  syncKeyed($('pozoSlot'), pz, c=>cardEl(c,{button:true}), pozoMap);
  pz.forEach((c,i)=>{ const e=pozoMap.get(c.id), top=i===pz.length-1;
    e.classList.toggle('under',!top); e.tabIndex=top?0:-1;
    e.setAttribute('aria-label', top?'Levantar del pozo: '+cname(c):cname(c)); });
  const canDraw=!busy&&S.turn==='me'&&S.phase==='draw';
  $('deckPile').classList.toggle('live',canDraw); $('pozoPile').classList.toggle('live',canDraw&&S.pozo.length>0);
  $('msg').innerHTML=S.log.slice(-2).map(l=>`<span class="small">${l}</span>`).join('')+(S.msg?`<span>${S.msg}</span>`:'');

  // mi mano
  const byId=new Map(S.me.map(c=>[c.id,c]));
  S.order=S.order.filter(id=>byId.has(id));
  for(const c of S.me) if(!S.order.includes(c.id)) S.order.push(c.id);
  const mine=S.order.map(id=>byId.get(id));
  syncKeyed($('myHand'), mine, c=>cardEl(c,{button:true}), myMap, true);
  layoutHand();
  for(const c of mine){
    const e=myMap.get(c.id); if(!e) continue;
    e.classList.toggle('sel', S.sel===c.id);
    e.classList.toggle('new', S.lastDrawn===c.id);
  }
  // botones
  const disc=!busy&&S.turn==='me'&&S.phase==='discard';
  const ok=disc && S.sel!=null && S.sel!==S.fromPozo;
  $('btnDiscard').disabled=!ok; $('btnCut').disabled=!ok;
  $('btnSuit').disabled=!(S.me.length>0 && S.phase!=='dealing');
  $('tip').textContent=S.tip||'';

  // planilla: como en papel, cada renglón lleva el total acumulado
  const short=p=>p==='me'?'Vos':(S.players.length===2?'Máquina':(p==='m1'?'Máq. 1':'Máq. 2'));
  const key=S.players.join();
  if($('sheetHead').dataset.k!==key){
    $('sheetHead').dataset.k=key;
    $('sheetHead').innerHTML='<tr><th></th>'+S.players.map(p=>`<th>${short(p)}</th>`).join('')+'</tr>';
  }
  const rows=$('rows'); rows.replaceChildren();
  const acc=Object.fromEntries(S.players.map(p=>[p,0]));
  S.rows.forEach((x,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<th scope="row">${i+1}</th>`+S.players.map(p=>{
      if(x[p]==null) return '<td class="gone">—</td>';
      acc[p]+=x[p]; return `<td class="${x.cut===p?'cut':''}${acc[p]>LIMIT?' over':''}">${acc[p]}</td>`;
    }).join('');
    rows.append(tr);
  });
  const blank='<th scope="row"></th>'+S.players.map(()=>'<td></td>').join('');
  for(let i=S.rows.length;i<6;i++){ const tr=document.createElement('tr'); tr.innerHTML=blank; rows.append(tr) }
  $('left').textContent = S.rows.length ? `Te faltan ${Math.max(0,LIMIT-S.scores.me)} para pasarte de ${LIMIT}.`
    : `Se juega a ${LIMIT}. ${S.players.length===2?'El que se pasa, pierde.':'El que se pasa queda afuera; gana el último que queda.'}`;
  document.querySelectorAll('#seg button').forEach(b=>b.setAttribute('aria-pressed', String(+b.dataset.n===S.players.length)));

  renderResult();
}
function renderOpps(){
  const box=$('opps'), bots=S.players.filter(p=>p!=='me'), key=bots.join();
  if(box.dataset.k!==key){
    box.dataset.k=key; box.replaceChildren();
    for(const p of BOTS) oppMaps[p].clear();
    for(const p of bots){
      const sec=document.createElement('section'); sec.className='seat'; sec.id='seat-'+p;
      sec.innerHTML=`<span class="who"></span><div class="hand"></div>`;
      box.append(sec);
    }
  }
  for(const p of bots){
    const sec=$('seat-'+p), hand=S.bots?.[p]||[], out=S.out.includes(p);
    sec.classList.toggle('turn', S.turn===p); sec.classList.toggle('gone', out);
    sec.querySelector('.who').innerHTML = out ? `${NAME(p)}, afuera` : `${NAME(p)}, <b>${hand.length}</b> cartas`;
    const h=sec.querySelector('.hand');
    syncKeyed(h, hand, ()=>backEl(), oppMaps[p]);
    hand.forEach((c,i,a)=>{ const e=oppMaps[p].get(c.id), d=i-(a.length-1)/2; e.style.rotate=(-d*4)+'deg'; e.style.translate=`0 ${(d*d*1.6).toFixed(1)}px`; e.style.zIndex=i+1 });
  }
}
function miniHand(r){
  const box=document.createElement('div'); box.className='mini';
  for(const m of r.melds){ const g=document.createElement('div'); g.className='g'; m.forEach(c=>g.append(cardEl(c,{role:'img'}))); box.append(g) }
  if(r.loose.length){ const g=document.createElement('div'); g.className='g loose'; r.loose.slice().sort(suitSort).forEach(c=>g.append(cardEl(c,{role:'img'}))); box.append(g) }
  return box;
}
function renderResult(){
  const ov=$('overlay'), R=S.result;
  if(!R){ ov.hidden=true; return }
  if(!ov.hidden) return;
  ov.hidden=false;
  let title, text;
  const tot=S.players.map(p=>`${p==='me'?'vos':bn(p)} ${S.scores[p]}`).join(', ');
  const outTxt=R.newlyOut.filter(p=>!(R.over&&R.over!=='afuera'&&S.players.length===2)).map(p=>p==='me'?'Pasaste de '+LIMIT+'.':`${cap(bn(p))} pasó de ${LIMIT}${S.players.length>2?' y queda afuera':''}.`).join(' ');
  if(R.conga){ title = R.cutter==='me'?'¡Conga! Ganaste la partida':`${cap(bn(R.cutter))} hizo conga`; text='Escalera de siete del mismo palo: la partida termina en el acto.' }
  else if(R.over==='me'){ title='Ganaste la partida'; text=`${outTxt} Final: ${tot}.` }
  else if(R.over==='afuera'){ title='Quedaste afuera'; text=`Pasaste de ${LIMIT}. Final: ${tot}.` }
  else if(R.over){ title = S.players.length===2?'Perdiste la partida':`Ganó ${bn(R.over)}`; text=`${outTxt} Final: ${tot}.` }
  else if(!R.cutter){ title='Mazo agotado'; text='La mano se anula, nadie suma.' }
  else { title = R.cutter==='me'?'Cortaste':`${cap(bn(R.cutter))} cortó`; text=`${outTxt} Totales: ${tot}.`.trim() }
  $('resTitle').textContent=title; $('resText').textContent=text;
  const hs=$('resHands'); hs.replaceChildren();
  for(const p of Object.keys(R.res)){
    const {r,pts}=R.res[p];
    const row=document.createElement('div'); row.className='row'; row.innerHTML=`<span>${NAME(p)}</span><b>${pts>0?'+':''}${pts}</b>`;
    hs.append(row, miniHand(r));
  }
  $('btnNext').textContent=(R.over||R.conga)?'Jugar otra partida':'Siguiente mano';
}

/* ---------- mano en abanico ---------- */
let drag=null, suppressClick=false, slotX=[];
const hand=$('myHand');
function layoutHand(){
  const els=S.order.map(id=>myMap.get(id)).filter(Boolean), n=els.length;
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
if(window.ResizeObserver) new ResizeObserver(()=>{ if(S) layoutHand() }).observe(hand);
function overPozo(x,y){ const r=$('pozoSlot').getBoundingClientRect(); const p=14; return x>r.left-p&&x<r.right+p&&y>r.top-p&&y<r.bottom+p }
hand.addEventListener('pointerdown',e=>{
  const el=e.target.closest('.card'); if(!el||!S||S.phase==='dealing'||S.phase==='over') return;
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
  const cur=S.order.indexOf(drag.id);
  if(cur>=0 && best!==cur){ S.order.splice(cur,1); S.order.splice(best,0,drag.id); layoutHand() }
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
    playerDiscard(d.id, false, g);
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
  const i=S.order.indexOf(+el.dataset.id), j=i+(e.key==='ArrowLeft'?-1:1);
  if(j<0||j>=S.order.length) return;
  [S.order[i],S.order[j]]=[S.order[j],S.order[i]];
  render(); el.focus();
});
window.addEventListener('resize',()=>{ if(S) layoutHand() });

/* ---------- eventos ---------- */
$('deckBtn').onclick=()=>playerDraw('mazo');
$('pozoSlot').addEventListener('click',e=>{ const el=e.target.closest('.card'); if(el&&!el.classList.contains('under')) playerDraw('pozo') });
$('btnDiscard').onclick=()=>playerDiscard(S.sel,false);
$('btnCut').onclick=()=>playerDiscard(S.sel,true);
$('btnSuit').onclick=()=>sortOrder('palo');
document.querySelectorAll('#seg button').forEach(b=>b.onclick=()=>freshGame(+b.dataset.n));
$('btnNext').onclick=()=>{ const R=S.result; S.result=null; $('overlay').hidden=true; if(R.over||R.conga) freshGame(); else deal() };

/* ---------- arranque ---------- */
if(URU.modo==='multi') $('aviso').hidden=false;
freshGame();
})();
