// Chancho va con baraja española: vos contra 3 rivales de la compu.
// Cada vuelta todos pasan una carta a la izquierda; quien junta 4 iguales golpea la mesa
// y el último en golpear se lleva una letra de CHANCHO. Los rivales pueden amagar.
const WORD = "CHANCHO";
const SUITS = ["oros", "copas", "espadas", "bastos"];
const RANKS = [1, 7, 10, 12];
const NAMES = ["Vos", "Tito", "La Negra", "Pocho"];
const $ = id => document.getElementById(id);

// La dificultad del menú define qué tan rápido reaccionan los rivales y cuánto amagan.
// first: cuánto tarda en golpear el que juntó cuatro; react: reacción del resto; feint: chance de amague por vuelta.
const DIF = {
  facil:   { first: [1300, 2800], react: [650, 1700], feint: .2,  fall: .18 },
  normal:  { first: [900, 2300],  react: [420, 1350], feint: .3,  fall: .12 },
  dificil: { first: [500, 1300],  react: [280, 850],  feint: .38, fall: .06 }
};
const URU = window.URUGAMES || {};
const cfg = DIF[URU.dificultad] || DIF.normal;

let feints = true, players, phase, selected, order, timers = [], pending = null, shout = null, lastLoser = null, arrived = -1, message = "";

function rankName(r) { return r === 10 ? "sota" : r === 12 ? "rey" : String(r); }
const pos = (col, row) => `background-position:${(col / 11 * 100).toFixed(4)}% ${(row / 4 * 100).toFixed(4)}%`;
const BACK = pos(1, 4);
const cardName = c => `${rankName(c.r)} de ${c.s}`;
const withArt = c => (c.r === 10 ? "la " : "el ") + cardName(c);
const plural = r => r === 10 ? "las cuatro sotas" : r === 12 ? "los cuatro reyes" : `los cuatro ${r}`;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const rand = (a, b) => a + Math.random() * (b - a);
const between = ([a, b]) => rand(a, b);
function hasFour(i) { const h = players[i].hand; return h.length === 4 && h.every(c => c.r === h[0].r); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; if (pending) { clearTimeout(pending.t); pending = null; } }

function newGame() {
  players = NAMES.map((name, i) => ({ name, human: i === 0, hand: [], letters: 0 }));
  deal();
}
function deal() {
  clearTimers();
  do {
    const deck = shuffle(RANKS.flatMap(r => SUITS.map(s => ({ r, s }))));
    players.forEach((p, i) => { p.hand = deck.slice(i * 4, i * 4 + 4); });
  } while (players.some((_, i) => hasFour(i)));
  players[0].hand.sort((a, b) => a.r - b.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));
  phase = "play"; shout = null; selected = null; order = []; lastLoser = null; arrived = -1;
  message = `Repartido. Elegí qué carta pasarle a <strong>${players[1].name}</strong>.`;
  render();
}

// La compu se queda con el número que más tiene y pasa uno del que menos tiene. A veces se equivoca.
function botPick(hand) {
  const cnt = {}; hand.forEach(c => { cnt[c.r] = (cnt[c.r] || 0) + 1; });
  const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || Math.random() - .5)[0];
  let cands = hand.map((c, i) => i).filter(i => String(hand[i].r) !== best);
  if (!cands.length) cands = [0, 1, 2, 3];
  const min = Math.min(...cands.map(i => cnt[hand[i].r]));
  const worst = cands.filter(i => cnt[hand[i].r] === min);
  if (Math.random() < .12) return cands[Math.floor(Math.random() * cands.length)];
  return worst[Math.floor(Math.random() * worst.length)];
}

function doPass() {
  if (phase !== "play" || selected === null) return;
  if (pending) {
    clearTimeout(pending.t); const pb = pending; pending = null;
    if (pb.real) { shoutThen(pb.i, true); return; } // el rival ya tenía chancho: golpea antes de que pases
  }
  const n = players.length;
  const out = players.map((p, i) => p.hand.splice(i === 0 ? selected : botPick(p.hand), 1)[0]);
  // cada uno le pasa a su izquierda: el jugador i recibe del i-1
  players.forEach((p, i) => p.hand.push(out[(i - 1 + n) % n]));
  arrived = 3; selected = null;
  message = `Pasaste ${withArt(out[0])}. Te llegó <strong>${withArt(out[n - 1])}</strong> de ${players[n - 1].name}.`;
  const winners = players.map((_, i) => i).filter(i => i > 0 && hasFour(i));
  if (winners.length) {
    const i = winners[Math.floor(Math.random() * winners.length)];
    pending = { i, real: true, t: setTimeout(() => { pending = null; shoutThen(i, true); }, between(cfg.first)) };
  } else if (feints && Math.random() < cfg.feint) {
    const i = 1 + Math.floor(Math.random() * 3);
    pending = { i, real: false, t: setTimeout(() => { pending = null; shoutThen(i, false); }, rand(700, 2600)) };
  }
  render();
}

// Un rival grita "¡CHAN…!": si tiene chancho golpea enseguida, si no es un amague y se arrepiente.
function shoutThen(i, real) {
  if (phase !== "play") return;
  phase = "shout"; shout = { i, real };
  message = `<strong>${players[i].name}:</strong> ¡CHAN…!`;
  render();
  if (real) {
    timers.push(setTimeout(() => { shout = null; phase = "play"; slam(i); }, rand(180, 320)));
    return;
  }
  players.forEach((p, j) => {
    if (j !== 0 && j !== i && Math.random() < cfg.fall) timers.push(setTimeout(() => {
      if (phase !== "shout") return;
      shout = null; message = `${p.name} golpeó la mesa, pero ${players[i].name} solo amagó.`; endRound(j);
    }, rand(200, 500)));
  });
  timers.push(setTimeout(() => {
    if (phase !== "shout") return;
    shout = null; phase = "play";
    message = `<strong>${players[i].name}:</strong> «…cho va». Era un amague.`;
    render();
  }, rand(650, 950)));
}

function slam(i) {
  if (phase === "shout" && i === 0) {
    const s = shout; clearTimers(); shout = null; phase = "play";
    if (s.real) { slam(s.i); slam(0); return; }
    message = `¡Caíste en el amague de ${players[s.i].name}!`;
    return endRound(0);
  }
  if (phase === "play") {
    if (pending) { clearTimeout(pending.t); pending = null; }
    if (!hasFour(i)) { message = "¡Golpe en falso! No tenías cuatro iguales."; return endRound(i); }
    phase = "slam"; order = [i];
    message = i === 0 ? `¡Chancho! Juntaste ${plural(players[0].hand[0].r)}.` : `¡<strong>${players[i].name}</strong> golpeó la mesa! ¡Golpeá ya!`;
    players.forEach((p, j) => { if (j !== 0 && j !== i) timers.push(setTimeout(() => slam(j), between(cfg.react))); });
    render();
  } else if (phase === "slam" && !order.includes(i)) {
    order.push(i);
    if (order.length === players.length - 1) {
      const loser = players.findIndex((_, j) => !order.includes(j));
      const w = players[order[0]];
      message = `${w.name} juntó ${plural(w.hand[0].r)}. ${loser === 0 ? "Fuiste" : players[loser].name + " fue"} el último en golpear.`;
      return endRound(loser);
    }
    render();
  }
}

function endRound(loser) {
  clearTimers();
  const p = players[loser];
  p.letters++; lastLoser = loser;
  if (p.letters >= WORD.length) {
    phase = "over";
    message += ` <strong>${p.human ? "¡Sos" : "¡" + p.name + " es"} CHANCHO!</strong>`;
  } else {
    phase = "end";
    message += ` ${p.human ? "Te llevás" : p.name + " se lleva"} la <strong>${WORD[p.letters - 1]}</strong>.`;
  }
  render();
}

function lettersHTML(n) { return [...WORD].map((c, k) => `<b class="${k < n ? "on" : ""}">${c}</b>`).join(""); }

function render() {
  const done = phase === "end" || phase === "over";
  $("rivals").innerHTML = players.slice(1).map((p, k) => {
    const i = k + 1, at = order.indexOf(i), isShout = shout && shout.i === i;
    const cls = ["cv-rival", at >= 0 ? "slammed" : "", isShout ? "shout" : "", done && lastLoser === i ? "loser" : ""].join(" ");
    const badge = isShout ? `<span class="cv-badge">¡CHAN…!</span>`
      : done && lastLoser === i ? `<span class="cv-badge">+${WORD[p.letters - 1]}</span>`
      : at >= 0 ? `<span class="cv-badge">Mano ${at + 1}</span>` : "";
    const backs = done && order[0] === i && hasFour(i)
      ? `<span class="cv-four">4 × ${rankName(p.hand[0].r)}</span>`
      : `<div class="cv-card" style="${BACK}"></div>`.repeat(4);
    return `<div class="${cls}">${badge}<span class="cv-name">${p.name}</span>
      <div class="cv-backs">${backs}</div><span class="cv-letters">${lettersHTML(p.letters)}</span></div>`;
  }).join("");
  $("myLetters").innerHTML = lettersHTML(players[0].letters);
  $("msg").innerHTML = message;
  $("order").innerHTML = order.map((i, k) => `<span><em>${k + 1}°</em>${players[i].name}</span>`).join("");
  const four = hasFour(0);
  $("hand").innerHTML = players[0].hand.map((c, k) => `<button class="cv-card ${selected === k ? "sel" : ""} ${arrived === k ? "llega" : ""} ${four && phase !== "play" ? "four" : ""}"
    data-k="${k}" style="${pos(c.r - 1, SUITS.indexOf(c.s))}" aria-label="${cardName(c)}" ${phase !== "play" ? "disabled" : ""}></button>`).join("");
  arrived = -1;
  const sb = $("slam");
  sb.disabled = !(phase === "play" || phase === "shout" || (phase === "slam" && !order.includes(0)));
  sb.classList.toggle("hot", phase === "shout" || (phase === "slam" && !order.includes(0)));
  sb.hidden = done;
  const nx = $("next"); nx.hidden = !done; nx.textContent = phase === "over" ? "Jugar de nuevo" : "Otra mano";
  const pass = $("pass");
  pass.disabled = phase !== "play" || selected === null;
  pass.textContent = phase === "shout" ? "…" : phase !== "play" ? "Mano cortada"
    : selected === null ? "Elegí una carta para pasar" : `Pasar ${withArt(players[0].hand[selected])}`;
}

$("hand").addEventListener("click", e => {
  const b = e.target.closest(".cv-card"); if (!b || phase !== "play") return;
  const k = +b.dataset.k;
  if (selected === k) { doPass(); return; }
  selected = k; render();
});
$("pass").addEventListener("click", doPass);
$("slam").addEventListener("pointerdown", e => { e.preventDefault(); slam(0); });
$("slam").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); slam(0); } });
$("next").addEventListener("click", () => (phase === "over" ? newGame() : deal()));
$("reset").addEventListener("click", newGame);
$("feint").addEventListener("click", e => { feints = !feints; e.currentTarget.setAttribute("aria-pressed", feints); });

if (URU.modo === "multi") $("aviso").hidden = false;
newGame();
