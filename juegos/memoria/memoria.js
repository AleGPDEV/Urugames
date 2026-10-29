// Memoria con baraja española: solo, vs 1, vs 2 o vs 3 (compu o amigos en el mismo dispositivo).
const SUITS=["oros","copas","espadas","bastos"];
const VALUES=[1,2,3,4,5,6,7,8,9,10,11,12];
const COLORS=["#e2b546","#e0645f","#6fa8e8","#9cc95a"];
const pos=(col,row)=>`${(col/11*100).toFixed(4)}% ${(row/4*100).toFixed(4)}%`;
const $=id=>document.getElementById(id);
let first=null,lock=false,found=0,total=8,t0=0,timer=null,players=[],cur=0,memory=new Map(),cards=[],game=0;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function fmt(s){return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function tick(){$("time").textContent=fmt(Math.floor((Date.now()-t0)/1000))}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function makePlayers(){
  const n=+$("mode").value, cpu=$("rivals").value==="cpu";
  $("rivals").disabled=n===0;
  players=[{name:cpu||n===0?"Vos":"Jugador 1",cpu:false,score:0,moves:0}];
  for(let i=1;i<=n;i++)players.push({name:cpu?(n===1?"Compu":"Compu "+i):"Jugador "+(i+1),cpu,score:0,moves:0});
}
function renderPlayers(){
  $("players").innerHTML=players.map((p,i)=>`<div class="pl${i===cur?" on":""}" style="--c:${COLORS[i]}"><span class="n"><span class="dot"></span>${p.name}</span><span class="s">${players.length===1?p.moves+" jug.":p.score}</span></div>`).join("");
  const p=players[cur];
  $("turn").textContent=found===total?"":players.length===1?"":p.cpu?`Juega ${p.name}…`:`Turno de ${p.name}`;
  $("board").classList.toggle("wait",!!p.cpu);
}
function newGame(){
  game++;
  total=+$("level").value;makePlayers();cur=0;memory=new Map();
  const deck=shuffle(SUITS.flatMap((s,r)=>VALUES.map(v=>({s,v,r})))).slice(0,total);
  cards=shuffle(deck.flatMap((c,i)=>[{...c,id:i},{...c,id:i}]));
  found=0;first=null;lock=false;clearInterval(timer);timer=null;
  $("time").textContent="0:00";$("pairs").textContent=`0/${total}`;$("win").hidden=true;
  $("board").style.setProperty("--cols", total===12 ? (innerWidth<480?4:6) : 4);
  $("board").innerHTML="";
  cards.forEach((c,i)=>{
    const b=document.createElement("button");
    b.className="card";b.dataset.id=c.id;b.dataset.i=i;b.setAttribute("aria-label","Carta boca abajo");
    b.innerHTML=`<div class="inner"><div class="face back sprite"></div><div class="face front sprite" style="background-position:${pos(c.v-1,c.r)}"></div></div>`;
    b.onclick=()=>{if(!players[cur].cpu)flip(b)};
    c.el=b;$("board").appendChild(b);
  });
  renderPlayers();
}
function remember(b){if(Math.random()<0.8)memory.set(+b.dataset.i,+b.dataset.id)}
function flip(b){
  if(lock||b.classList.contains("up")||b.classList.contains("done"))return false;
  if(!timer){t0=Date.now();timer=setInterval(tick,1000)}
  const c=cards[+b.dataset.i];
  b.classList.add("up");b.setAttribute("aria-label",`${c.v} de ${c.s}`);remember(b);
  if(!first){first=b;return true}
  const p=players[cur];p.moves++;
  if(first.dataset.id===b.dataset.id){
    [first,b].forEach(x=>{x.classList.add("done");x.classList.remove("up");x.style.boxShadow=`0 0 0 3px ${COLORS[cur]}`;x.style.borderRadius="8px";memory.delete(+x.dataset.i)});
    first=null;found++;p.score++;$("pairs").textContent=`${found}/${total}`;
    renderPlayers();
    if(found===total)return finish(),true;
    if(p.cpu)cpuTurn();
  }else{
    lock=true;const a=first;first=null;const g=game;
    setTimeout(()=>{if(g!==game)return;[a,b].forEach(x=>{x.classList.remove("up");x.setAttribute("aria-label","Carta boca abajo")});lock=false;
      cur=(cur+1)%players.length;renderPlayers();if(players[cur].cpu)cpuTurn()},900);
  }
  return true;
}
async function cpuTurn(){
  const g=game;await wait(700);if(g!==game)return;
  const open=cards.map((c,i)=>i).filter(i=>!cards[i].el.classList.contains("done"));
  const known=[...memory.entries()].filter(([i])=>open.includes(i));
  let pair=null;const seen={};
  for(const [i,id] of known){if(seen[id]!==undefined){pair=[seen[id],i];break}seen[id]=i}
  let a,b;
  if(pair){a=pair[0]}else{const unk=open.filter(i=>!memory.has(i));a=(unk.length?unk:open)[Math.floor(Math.random()*(unk.length||open.length))]}
  flip(cards[a].el);
  await wait(700);if(g!==game)return;
  if(pair)b=pair[1];
  else{
    const id=cards[a].id;
    const match=[...memory.entries()].find(([i,v])=>v===id&&i!==a&&open.includes(i));
    if(match)b=match[0];
    else{const rest=open.filter(i=>i!==a&&!memory.has(i));const pool=rest.length?rest:open.filter(i=>i!==a);b=pool[Math.floor(Math.random()*pool.length)]}
  }
  flip(cards[b].el);
}
function finish(){
  clearInterval(timer);tick();renderPlayers();
  if(players.length===1){$("winTitle").textContent="¡Ganaste!";$("winText").textContent=`Encontraste las ${total} parejas en ${players[0].moves} jugadas y ${$("time").textContent}.`}
  else{
    const max=Math.max(...players.map(p=>p.score));const w=players.filter(p=>p.score===max);
    $("winTitle").textContent=w.length>1?"¡Empate!":w[0].name==="Vos"?"¡Ganaste!":`¡Ganó ${w[0].name}!`;
    $("winText").textContent=players.map(p=>`${p.name}: ${p.score}`).join(" · ");
  }
  $("win").hidden=false;
}
// Configuración inicial según cómo se entró desde el menú (window.URUGAMES)
(function(){
  const u=window.URUGAMES||{};
  const pares={facil:"6",normal:"8",dificil:"12"};
  if(u.modo==="multi"){$("rivals").value="amigos";$("aviso").hidden=false}
  else{$("rivals").value="cpu";if(pares[u.dificultad])$("level").value=pares[u.dificultad]}
})();
$("new").onclick=newGame;["mode","rivals","level"].forEach(id=>$(id).onchange=newGame);
newGame();
