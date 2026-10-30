// Culo sucio con baraja española: vos contra 1, 2 o 3 rivales de la compu, sentados en anillo.
// El 1 de oros no forma par con nada: quien se queda con él al final es el culo sucio.
const SUITS=["oros","copas","espadas","bastos"];
const NAMES=["Abuela","Tío Walter","Sofi"];
const $=id=>document.getElementById(id);
let S=null,busy=false,timer=null;

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rankName(r){return r===10?"sota":r===11?"caballo":r===12?"rey":String(r)}
const pos=(col,row)=>`background-position:${(col/11*100).toFixed(4)}% ${(row/4*100).toFixed(4)}%`;
const BACK=pos(1,4);
const isCS=c=>c.r===1&&c.s==="oros";
function cardHTML(c,extra="",attrs=""){
  if(!c)return `<div class="cs-card ${extra}" style="${BACK}" ${attrs}></div>`;
  const n=`${rankName(c.r)} de ${c.s}`;
  return `<div class="cs-card ${extra}" style="${pos(c.r-1,SUITS.indexOf(c.s))}" role="img" aria-label="${n}" title="${n}" ${attrs}></div>`;
}
function removePairs(hand){
  const by={},keep=[],gone=[];
  hand.forEach(c=>isCS(c)?keep.push(c):(by[c.r]=by[c.r]||[]).push(c));
  Object.values(by).forEach(g=>{while(g.length>=2)gone.push(g.pop(),g.pop());keep.push(...g)});
  return {keep,gone};
}
function sortHand(h){return h.slice().sort((a,b)=>a.r-b.r||SUITS.indexOf(a.s)-SUITS.indexOf(b.s))}

function newGame(){
  clearTimeout(timer);busy=false;
  const n=+$("nr").value;
  const RANKS=$("deck").value==="48"?[1,2,3,4,5,6,7,8,9,10,11,12]:[1,2,3,4,5,6,7,10,11,12];
  let deck=[];SUITS.forEach(s=>RANKS.forEach(r=>deck.push({s,r,id:s+r})));
  // se saca un as que no sea el de oros, así el 1 de oros queda solo y nunca forma par
  const aces=deck.filter(c=>c.r===1&&c.s!=="oros");
  const quitado=aces[Math.floor(Math.random()*aces.length)];
  deck=shuffle(deck.filter(c=>c!==quitado));
  const players=[{name:"Vos",human:true,hand:[]},...NAMES.slice(0,n).map(name=>({name,hand:[]}))];
  deck.forEach((c,i)=>players[i%players.length].hand.push(c));
  const pile=[];
  players.forEach(p=>{const {keep,gone}=removePairs(p.hand);p.hand=p.human?sortHand(keep):shuffle(keep);pile.push(...gone);p.out=false;p.place=0});
  S={players,pile,turn:Math.floor(Math.random()*players.length),places:0,over:false,lastNew:null,
     log:"Repartido. Cada uno tiró sus pares. ¡Cuidado con el 1 de oros!"};
  checkOuts();advanceIfNeeded();step();
}
function active(){return S.players.map((p,i)=>i).filter(i=>!S.players[i].out)}
function nextActive(i){const L=S.players.length;for(let k=1;k<L;k++){const j=(i+k)%L;if(!S.players[j].out)return j}return -1}
function checkOuts(){
  S.players.forEach(p=>{if(!p.out&&p.hand.length===0){p.out=true;p.place=++S.places}});
  const act=active();if(act.length<=1){S.over=true;S.loser=act[0]}
}
function advanceIfNeeded(){if(!S.over&&S.players[S.turn].out)S.turn=nextActive(S.turn)}

// Geometría del anillo: el asiento 0 (vos) va abajo y la ronda avanza en sentido horario en pantalla.
function geo(){const T=$("table"),W=T.clientWidth,H=T.clientHeight;return {W,H,cx:W/2,cy:H/2,rx:W*0.37,ry:H*0.38}}
function seatXY(i){
  const g=geo(),a=(90+i*360/S.players.length)*Math.PI/180;
  return {x:g.cx+Math.cos(a)*g.rx,y:g.cy+Math.sin(a)*g.ry};
}

function take(drawer,src,idx){
  busy=true;
  const a=seatXY(src),b=seatXY(drawer);
  const fly=document.createElement("div");
  fly.className="cs-card cs-fly";fly.setAttribute("style",BACK);
  fly.style.left=a.x+"px";fly.style.top=a.y+"px";
  $("table").appendChild(fly);
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{fly.style.left=b.x+"px";fly.style.top=b.y+"px"}));
  setTimeout(()=>{fly.remove();busy=false;applyTake(drawer,src,idx)},reduce?50:520);
}
function applyTake(drawer,src,idx){
  const P=S.players,from=P[src],to=P[drawer];
  const c=from.hand.splice(idx,1)[0];
  const mate=isCS(c)?-1:to.hand.findIndex(x=>x.r===c.r&&!isCS(x));
  const cn=(to.human||from.human)?`el <b>${rankName(c.r)} de ${c.s}</b>`:"una carta";
  const a=from.human?"vos":from.name;
  if(mate>=0){
    S.pile.push(c,to.hand.splice(mate,1)[0]);S.lastNew=null;
    S.log=to.human?`Sacaste ${cn} de ${from.name}: ¡par! Lo tiraste.`:`${to.name} le sacó ${cn} a ${a} e hizo par.`;
  }else{
    if(to.human){to.hand=sortHand([...to.hand,c]);S.lastNew=c.id}
    else{to.hand.splice(Math.floor(Math.random()*(to.hand.length+1)),0,c);if(from.human)S.lastNew=null}
    S.log=to.human?`Sacaste ${cn} de ${from.name}. No hizo par.`:`${to.name} le sacó ${cn} a ${a}. No hizo par.`;
  }
  if(!from.human)shuffle(from.hand);
  checkOuts();
  if(!S.over){S.turn=nextActive(drawer);advanceIfNeeded()}
  step();
}
function step(){
  render();
  if(S.over||S.players[S.turn].human)return;
  busy=true;
  timer=setTimeout(()=>{busy=false;const src=nextActive(S.turn);take(S.turn,src,Math.floor(Math.random()*S.players[src].hand.length))},900);
}

function drawRing(src){
  const {W,H,cx,cy,rx,ry}=geo(),N=S.players.length;
  let g=`<defs><marker id="cs-ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--gold)"/></marker></defs>`;
  g+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="fill:none;stroke:var(--muted);stroke-opacity:.35;stroke-width:1.5;stroke-dasharray:4 6"/>`;
  // chevrones con el sentido de la ronda, entre asiento y asiento
  for(let i=0;i<N;i++){
    const a=(90+(i+.5)*360/N)*Math.PI/180;
    const x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    const ang=Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx)*180/Math.PI;
    g+=`<path d="M-6 -7L4 0L-6 7" transform="translate(${x} ${y}) rotate(${ang})" style="fill:none;stroke:var(--muted);stroke-opacity:.8;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/>`;
  }
  // flecha dorada: la carta va del que entrega al que saca
  if(src>=0){
    const a=seatXY(src),b=seatXY(S.turn);
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,qx=mx+(cx-mx)*0.55,qy=my+(cy-my)*0.55;
    const sh=(p,d)=>{const dx=qx-p.x,dy=qy-p.y,l=Math.hypot(dx,dy)||1;return{x:p.x+dx/l*d,y:p.y+dy/l*d}};
    const p0=sh(a,50),p1=sh(b,50);
    g+=`<path d="M${p0.x} ${p0.y}Q${qx} ${qy} ${p1.x} ${p1.y}" marker-end="url(#cs-ah)" style="fill:none;stroke:var(--gold);stroke-width:3;stroke-linecap:round"/>`;
  }
  const R=$("ring");R.setAttribute("viewBox",`0 0 ${W} ${H}`);R.innerHTML=g;
}

function render(){
  const P=S.players,src=S.over?-1:nextActive(S.turn);
  const humanTurn=!S.over&&P[S.turn].human;

  $("seats").innerHTML=P.map((p,i)=>{
    const {x,y}=seatXY(i),isL=S.over&&S.loser===i;
    const cls=["cs-seat",p.human?"me":"",i===S.turn&&!S.over?"turn":"",i===src?"src":"",p.out?"out":"",isL?"loser":""].join(" ");
    const fan=isL?p.hand.map(c=>cardHTML(c)).join(""):Array.from({length:Math.min(p.hand.length,8)},()=>cardHTML(null)).join("");
    const tag=p.out?`<span class="cs-tag">Salvado · ${p.place}º</span>`:isL?`<span class="cs-tag lose">Culo sucio</span>`:`<span class="ct">${p.hand.length} carta${p.hand.length===1?"":"s"}</span>`;
    return `<div class="${cls}" style="left:${x}px;top:${y}px"><span class="nm">${p.name}</span><div class="cs-fan">${fan}</div>${tag}</div>`;
  }).join("");
  drawRing(src);

  $("pile").innerHTML=S.pile.slice(-5).map(c=>cardHTML(c)).join("")||cardHTML(null,"",'style="opacity:.25;'+BACK+'"');
  $("pairs").textContent=`${S.pile.length/2} pares`;
  $("culo").innerHTML=cardHTML({r:1,s:"oros"});
  $("flow").innerHTML=S.over?"Fin de la mano":`<b>${P[S.turn].name}</b> ${P[S.turn].human?"sacás":"saca"} de <b>${P[src].human?"vos":P[src].name}</b>`;

  let m=S.log;
  if(S.over){
    const L=P[S.loser];
    m+=L.human?`<br><b>Te quedaste con el 1 de oros. ¡Sos el culo sucio!</b>`:`<br><b>${L.name} se quedó con el 1 de oros: es el culo sucio.</b> ${P[0].place===1?"¡Saliste primero!":"Zafaste."}`;
  }else if(!humanTurn)m+=`<br>Juega ${P[S.turn].name}…`;
  $("msg").innerHTML=m;

  const pk=$("pick");
  if(humanTurn){
    pk.hidden=false;pk.className="cs-panel hot";
    pk.innerHTML=`<div class="cs-ph"><span>Sacale una carta a ${P[src].name}</span><span class="ct">${P[src].hand.length} boca abajo</span></div><div class="cs-hand cs-pickable">${P[src].hand.map((c,k)=>cardHTML(null,"",`tabindex="0" role="button" aria-label="Carta ${k+1} de ${P[src].name}" data-k="${k}"`)).join("")}</div>`;
    pk.querySelectorAll(".cs-card").forEach(el=>{
      const go=()=>{if(busy||S.over)return;take(0,src,+el.dataset.k)};
      el.addEventListener("click",go);
      el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}});
    });
  }else{pk.hidden=true;pk.innerHTML=""}

  const me=P[0];
  $("me").className="cs-panel cs-mine"+(S.over&&S.loser===0?" hot":"");
  $("me").innerHTML=`<div class="cs-ph"><span>Tu mano</span><span class="ct">${me.out?`Salvado · ${me.place}º`:me.hand.length+" cartas"}</span></div><div class="cs-hand">${me.hand.length?me.hand.map(c=>cardHTML(c,c.id===S.lastNew?"new":"")).join(""):`<span class="ct">Sin cartas, ya te salvaste.</span>`}</div>`;
}

// Desde el menú: el multijugador en línea todavía no existe, así que se juega contra la compu.
if(window.URUGAMES&&window.URUGAMES.modo==="multi")$("aviso").hidden=false;

$("newg").addEventListener("click",newGame);
$("nr").addEventListener("change",newGame);
$("deck").addEventListener("change",newGame);
let rz;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>S&&render(),120)});

// "Jugar solo": la pantalla previa común (js/previa.js). La compu saca al azar, así que no hay dificultad.
const previa=window.UruPrevia?UruPrevia.crear({
  juego:"culosucio",
  dificultad:null,
  opciones:[
    {id:"rivales",nombre:"Rivales",valores:[[1,"1"],[2,"2"],[3,"3"]],defecto:3},
    {id:"mazo",nombre:"Mazo",valores:[[40,"40 cartas"],[48,"48 cartas"]],defecto:40,
      nota:c=>c.mazo===48?"Con ochos y nueves: la partida dura más.":"Sin ochos ni nueves, como se juega casi siempre."}
  ],
  empezar:c=>{$("nr").value=String(c.rivales);$("deck").value=String(c.mazo);newGame()}
}):null;
if(previa&&previa.iniciar()){
  $("nr").hidden=true;$("deck").hidden=true;$("newg").textContent="Repartir de nuevo";
  $("optsBtn").hidden=false;$("optsBtn").onclick=()=>previa.mostrar();
}else newGame();
