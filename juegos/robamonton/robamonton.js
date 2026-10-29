// Roba montón con baraja española: vos contra 1, 2 o 3 rivales de la compu, sentados en anillo.
// En tu turno jugás una carta: robás el montón de un rival, levantás del centro, sumás a tu montón o la dejás en el centro.
// Las cartas viajan entre lugares en una capa aparte (#fly) con la Web Animations API.
const SUITS = ["oros", "copas", "espadas", "bastos"];
const NAMES = ["Abuela Nelly", "Tío Raúl", "Prima Flor"];
const HAND = 4, TABLE_START = 4, CPU_DELAY = 700;
const $ = id => document.getElementById(id);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = ms => RM ? 0 : ms;
const wait = ms => new Promise(r => setTimeout(r, T(ms)));
const cid = c => c.s * 12 + c.v;
const RATIO = 261.6 / 170.67; // alto/ancho de cada carta en img/baraja.jpg

// Dificultad del menú: Fácil juega casi al azar, Normal busca la mejor jugada, Difícil además cuida su montón y recuerda lo que salió.
const CFG = window.URUGAMES || {};
const DIF = ["facil", "normal", "dificil"].includes(CFG.dificultad) ? CFG.dificultad : "normal";

// Posición de cada asiento (en % de la mesa), en el orden del turno después de "Vos" (abajo), girando hacia la derecha.
const SEATS = { 1: [[50, 12]], 2: [[82, 22], [18, 22]], 3: [[90, 50], [50, 11], [10, 50]] };
const YOU_SEAT = [50, 89];
const angleOf = ([x, y]) => Math.atan2(y - 50, x - 50) * 180 / Math.PI;

let S = null;

function cardName(c) {
  const n = c.v === 1 ? "As" : c.v === 10 ? "Sota" : c.v === 11 ? "Caballo" : c.v === 12 ? "Rey" : c.v;
  return `${n} de ${SUITS[c.s]}`;
}
function cardEl(c, extra = "") {
  const d = document.createElement("div");
  d.className = "rm-card " + extra;
  if (!c) { d.classList.add("rm-empty"); return d; }
  const col = c === "back" ? 1 : c.v - 1, row = c === "back" ? 4 : c.s;
  d.style.backgroundPosition = `${(col / 11 * 100).toFixed(4)}% ${(row / 4 * 100).toFixed(4)}%`;
  if (c !== "back") { d.dataset.id = cid(c); d.setAttribute("aria-label", cardName(c)); d.title = cardName(c); }
  return d;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const topOf = p => p.pile[p.pile.length - 1];

/* ---------- cartas que vuelan ---------- */
const R = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width }; };
function cardRectAt(el, w) { const r = el.getBoundingClientRect(); return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - w * RATIO / 2, width: w }; }
const nudge = (r, d) => ({ left: r.left + d, top: r.top - d, width: r.width });
function flyer(card, r) {
  const el = cardEl(card);
  el.style.setProperty("--cw", r.width + "px");
  el.style.left = r.left + "px"; el.style.top = r.top + "px";
  $("fly").append(el);
  return el;
}
function move(el, from, to, dur = 420, lift = 26) {
  const dx = to.left - from.left, dy = to.top - from.top, sc = to.width / from.width;
  const mid = (1 + sc) / 2 * 1.1, rot = dx >= 0 ? 7 : -7;
  return el.animate([
    { transform: "translate(0px, 0px) scale(1) rotate(0deg)" },
    { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(${mid}) rotate(${rot}deg)`, offset: .5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(0deg)` },
  ], { duration: T(dur), easing: "cubic-bezier(.35,.6,.3,1)", fill: "forwards" }).finished.catch(() => {});
}
function retrigger(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

/* ---------- partida ---------- */
async function newGame() {
  const n = +$("nr").value;
  try { localStorage.setItem("urugames-robamonton-rivales", n); } catch (e) {}
  $("fly").innerHTML = "";
  const deck = [];
  for (let s = 0; s < 4; s++) for (let v = 1; v <= 12; v++) deck.push({ s, v });
  shuffle(deck);
  const players = [{ name: "Vos", human: true, hand: [], pile: [], pos: YOU_SEAT }];
  for (let i = 0; i < n; i++) players.push({ name: NAMES[i], human: false, hand: [], pile: [], pos: SEATS[n][i] });
  S = { deck, table: [], players, turn: 0, busy: true, seen: {}, pending: new Set(), counts: players.map(() => 0) };
  const G = S;
  $("final").hidden = true;
  buildRing();
  say("Repartiendo…");
  render();
  await wait(200);
  await dealRound(true);
  if (S !== G) return;
  S.busy = false;
  say("Cartas repartidas. Empezás vos.");
  render();
}
function see(c) { S.seen[c.v] = (S.seen[c.v] || 0) + 1; }

// Reparte una vuelta (y las cartas iniciales del centro), con las cartas volando desde el mazo.
async function dealRound(withTable) {
  const G = S, items = [];
  if (withTable) for (let i = 0; i < TABLE_START; i++) { const c = S.deck.pop(); S.table.push(c); see(c); items.push(["t", c]); }
  const np = S.players.length;
  const k = Math.min(HAND, Math.floor(S.deck.length / np));
  if (k === 0) { while (S.deck.length) { const c = S.deck.pop(); S.table.push(c); see(c); items.push(["t", c]); } }
  for (let r = 0; r < k; r++) S.players.forEach((p, pi) => { const c = S.deck.pop(); p.hand.push(c); items.push([pi, c]); });
  items.forEach(([, c]) => S.pending.add(cid(c)));
  render();
  const src = R($("mazoCard"));
  await Promise.all(items.map(([dst, c], i) => wait(i * 80).then(async () => {
    if (S !== G) return;
    let target = null;
    if (dst === "t") target = document.querySelector(`#table [data-id="${cid(c)}"]`);
    else if (dst === 0) target = document.querySelector(`#hand [data-id="${cid(c)}"]`);
    const to = target ? R(target) : cardRectAt($("seat" + dst).querySelector(".rm-dots"), $("pile" + dst).getBoundingClientRect().width);
    const f = flyer("back", src);
    await move(f, src, to, 380, 18);
    if (S !== G) return;
    S.pending.delete(cid(c));
    if (target) { target.classList.remove("rm-ghost"); retrigger(target, "rm-reveal"); }
    else renderSeat(dst);
    f.remove();
  })));
}

function outcome(pi, c) {
  const me = S.players[pi];
  let best = null;
  S.players.forEach((p, i) => {
    if (i !== pi && p.pile.length && topOf(p).v === c.v && (!best || p.pile.length > best.pile.length)) best = p;
  });
  if (best) return { kind: "robar", target: best, gain: best.pile.length + 1 };
  const matches = S.table.filter(t => t.v === c.v);
  if (matches.length) return { kind: "levantar", matches, gain: matches.length + 1 };
  if (me.pile.length && topOf(me).v === c.v) return { kind: "sumar", gain: 1 };
  return { kind: "tirar", gain: 0 };
}

async function play(pi, idx, srcEl) {
  const G = S;
  S.busy = true;
  const me = S.players[pi], c = me.hand[idx], o = outcome(pi, c);
  const pileEl = $("pile" + pi);
  const pileR = R(pileEl);
  const from = srcEl ? R(srcEl) : cardRectAt($("seat" + pi).querySelector(".rm-dots"), pileR.width);
  const f = flyer(c, from);
  const flyers = [f];
  if (srcEl) srcEl.classList.add("rm-ghost");
  me.hand.splice(idx, 1); see(c);
  if (!srcEl) renderSeat(pi);
  $("hand").classList.add("waiting");
  const who = me.human ? "Jugaste" : `<b>${me.name}</b> jugó`;
  let msg;

  if (o.kind === "tirar") {
    S.table.push(c); S.pending.add(cid(c));
    renderTable();
    const slot = document.querySelector(`#table [data-id="${cid(c)}"]`);
    await move(f, from, R(slot), 460);
    if (S !== G) return;
    S.pending.delete(cid(c)); slot.classList.remove("rm-ghost");
    f.remove();
    msg = `${who} ${cardName(c)}. No coincide con nada: queda en el centro.`;
  } else {
    // 1) la carta jugada vuela hasta donde "pega": la carta igual del centro, el montón robado o el propio montón
    const ti = o.kind === "robar" ? S.players.indexOf(o.target) : -1;
    const meetEl = o.kind === "robar" ? $("pile" + ti) : o.kind === "levantar" ? document.querySelector(`#table [data-id="${cid(o.matches[0])}"]`) : pileEl;
    const meet = nudge(R(meetEl), 5);
    await move(f, from, meet, 440);
    if (S !== G) return;
    // 2) lo que se gana viaja junto al montón del jugador
    if (o.kind !== "sumar") {
      await wait(160);
      if (S !== G) return;
      f.remove(); flyers.length = 0;
      const group = [];
      if (o.kind === "levantar") {
        o.matches.forEach(m => { const el = document.querySelector(`#table [data-id="${cid(m)}"]`); const r = R(el); el.classList.add("rm-ghost"); group.push([flyer(m, r), r]); });
      } else {
        const r = R(meetEl);
        meetEl.classList.add("rm-ghost");
        retrigger($("seat" + ti), "rm-robbed");
        const extra = Math.min(3, o.target.pile.length - 1);
        for (let k = extra; k >= 1; k--) { const rr = nudge(r, -k * 2); group.push([flyer("back", rr), rr]); }
        group.push([flyer(topOf(o.target), r), r]);
      }
      group.push([flyer(c, meet), meet]);
      group.forEach(([el]) => flyers.push(el));
      await Promise.all(group.map(([el, r], k) => wait(k * 70).then(() => move(el, r, pileR, 430, 34))));
      if (S !== G) return;
    }
    if (o.kind === "robar") {
      const t = o.target;
      msg = `${who} ${cardName(c)} y <span class="steal">${me.human ? "le robaste" : "le robó"} el montón ${t.human ? "a vos" : "a " + t.name}</span> (${t.pile.length} cartas).`;
      me.pile.push(...t.pile, c); t.pile = [];
    } else if (o.kind === "levantar") {
      S.table = S.table.filter(t => t.v !== c.v);
      me.pile.push(...o.matches, c);
      msg = `${who} ${cardName(c)} y ${me.human ? "levantaste" : "levantó"} ${o.matches.map(cardName).join(", ")} del centro.`;
    } else {
      me.pile.push(c);
      msg = `${who} ${cardName(c)} y ${me.human ? "la sumaste a tu" : "la sumó a su"} montón.`;
    }
    render();
    flyers.forEach(el => el.remove());
    retrigger($("pile" + pi), "rm-flash");
  }
  say(msg);
  render();
  next();
}

async function next() {
  const G = S;
  S.turn = (S.turn + 1) % S.players.length;
  if (S.players.every(p => p.hand.length === 0)) {
    if (S.deck.length) {
      render();
      await wait(450);
      if (S !== G) return;
      say("Se reparte de nuevo.");
      await dealRound(false);
      if (S !== G) return;
    }
    if (S.players.every(p => p.hand.length === 0)) { render(); return finish(); }
  }
  S.busy = !S.players[S.turn].human;
  render();
  if (S.busy) {
    await wait(CPU_DELAY);
    if (S !== G) return;
    cpuTurn();
  }
}

function cpuTurn() {
  const pi = S.turn, me = S.players[pi];
  if (DIF === "facil" && Math.random() < 0.6) return play(pi, Math.floor(Math.random() * me.hand.length), null);
  let bestI = 0, bestScore = -Infinity;
  me.hand.forEach((c, i) => {
    const o = outcome(pi, c);
    let score = o.kind === "robar" ? 100 + o.gain * 3 : o.gain * 4;
    if (DIF === "dificil") {
      // cuida el montón: cuántas cartas de ese número pueden quedar en manos de los rivales
      const remaining = 4 - (S.seen[c.v] || 0) - 1 - me.hand.filter((h, j) => j !== i && h.v === c.v).length;
      const risk = Math.max(0, remaining) / 4 * (me.pile.length + o.gain) * 0.6;
      if (o.kind === "tirar") score = -remaining * 0.5; else if (o.kind !== "robar") score -= risk;
    }
    score += Math.random() * 0.3;
    if (score > bestScore) { bestScore = score; bestI = i; }
  });
  play(pi, bestI, null);
}

async function finish() {
  S.busy = true;
  $("turno").textContent = "Fin de la partida";
  await wait(500);
  const ranked = [...S.players].sort((a, b) => b.pile.length - a.pile.length);
  const max = ranked[0].pile.length;
  const winners = ranked.filter(p => p.pile.length === max);
  $("finalTitle").textContent = winners.length > 1 ? "¡Empate!" : winners[0].human ? "¡Ganaste!" : `Ganó ${winners[0].name}`;
  $("finalTable").innerHTML = ranked.map(p => `<tr><td>${p.name}</td><td>${p.pile.length} cartas</td></tr>`).join("") +
    (S.table.length ? `<tr><td>Quedaron en el centro</td><td>${S.table.length}</td></tr>` : "");
  $("final").hidden = false;
  $("again").focus();
}

function say(html) { const l = $("msg"); l.innerHTML = html; retrigger(l, "fresh"); }

/* ---------- dibujo ---------- */
function buildRing() {
  const ring = $("ring");
  ring.querySelectorAll(".rm-seat").forEach(s => s.remove());
  const svg = ring.querySelector(".rm-track");
  svg.querySelectorAll("path").forEach(p => p.remove());
  S.players.forEach((p, pi) => {
    const seat = document.createElement("div");
    seat.className = "rm-seat"; seat.id = "seat" + pi;
    seat.style.left = p.pos[0] + "%"; seat.style.top = p.pos[1] + "%";
    ring.append(seat);
    // flecha sobre el anillo entre este asiento y el siguiente, en el sentido del turno
    const a1 = angleOf(p.pos);
    let a2 = angleOf(S.players[(pi + 1) % S.players.length].pos);
    while (a2 >= a1) a2 -= 360;
    if (S.players.length === 2) a2 = a1 - 180;
    const mid = (a1 + a2) / 2 * Math.PI / 180;
    const cx = 50 + 38 * Math.cos(mid), cy = 50 + 38 * Math.sin(mid);
    const tx = Math.sin(mid), ty = -Math.cos(mid), nx = Math.cos(mid), ny = Math.sin(mid), s = 2.6;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${cx + tx * s} ${cy + ty * s} L${cx - tx * s + nx * s * .8} ${cy - ty * s + ny * s * .8} L${cx - tx * s - nx * s * .8} ${cy - ty * s - ny * s * .8} Z`);
    svg.append(path);
  });
}

function renderSeat(pi) {
  const p = S.players[pi], seat = $("seat" + pi);
  seat.classList.toggle("turn", S.turn === pi && !S.dealing);
  seat.innerHTML = "";
  const pile = cardEl(p.pile.length ? topOf(p) : null);
  pile.id = "pile" + pi;
  const name = document.createElement("div"); name.className = "nm"; name.textContent = p.human ? "Tu montón" : p.name;
  const cnt = document.createElement("div"); cnt.className = "ct";
  cnt.textContent = p.pile.length === 1 ? "1 carta" : `${p.pile.length} cartas`;
  seat.append(name, pile, cnt);
  if (!p.human) {
    const visible = p.hand.filter(c => !S.pending.has(cid(c))).length;
    const dots = document.createElement("div"); dots.className = "rm-dots"; dots.title = `${visible} cartas en la mano`;
    for (let i = 0; i < visible; i++) dots.append(document.createElement("i"));
    seat.append(dots);
  }
  if (p.pile.length > S.counts[pi]) retrigger(cnt, "rm-bump");
  S.counts[pi] = p.pile.length;
}

// Elige el tamaño de carta más grande que entra en el centro según cuántas cartas haya.
function fitTable() {
  const box = $("center"), tb = $("table");
  const n = Math.max(S.table.length, 1), gap = 7;
  const W = box.clientWidth;
  const H = box.clientHeight - $("turno").offsetHeight - box.querySelector(".rm-mazo").offsetHeight - 16;
  let cw = 24;
  for (let w = 110; w >= 24; w -= 2) {
    const per = Math.max(1, Math.floor((W + gap) / (w + gap)));
    const rows = Math.ceil(n / per);
    if (rows * w * RATIO + (rows - 1) * gap <= H) { cw = w; break; }
  }
  tb.style.setProperty("--cw", cw + "px");
  tb.querySelectorAll(".rm-card").forEach(c => c.style.setProperty("--cw", cw + "px"));
}

function renderTable() {
  const tb = $("table"); tb.innerHTML = "";
  if (!S.table.length) tb.innerHTML = `<span class="rm-hint">Centro vacío</span>`;
  S.table.forEach(c => tb.append(cardEl(c, S.pending.has(cid(c)) ? "rm-ghost" : "")));
  fitTable();
  $("mazo").textContent = S.deck.length ? `Mazo: ${S.deck.length}` : "Mazo agotado";
  $("mazoCard").style.backgroundPosition = `${(1 / 11 * 100).toFixed(4)}% 100%`;
  $("mazoCard").classList.toggle("rm-gone", !S.deck.length);
}

function renderHand() {
  const me = S.players[0];
  const hd = $("hand"); hd.innerHTML = "";
  hd.classList.toggle("waiting", S.turn !== 0 || S.busy);
  me.hand.forEach((c, i) => {
    const e = cardEl(c, "rm-play" + (S.pending.has(cid(c)) ? " rm-ghost" : ""));
    e.tabIndex = 0; e.setAttribute("role", "button");
    const o = outcome(0, c);
    const tag = document.createElement("span");
    tag.className = "rm-tag " + o.kind;
    tag.textContent = o.kind === "robar" ? `Robás ${o.target.pile.length}` : o.kind === "levantar" ? `Levantás ${o.matches.length}` : o.kind === "sumar" ? "Sumás" : "Al centro";
    e.append(tag);
    e.setAttribute("aria-label", `${cardName(c)}: ${tag.textContent}`);
    const go = () => { if (S.turn === 0 && !S.busy) play(0, i, e); };
    e.addEventListener("click", go);
    e.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
    hd.append(e);
  });
}

function render() {
  S.dealing = S.pending.size > 0;
  S.players.forEach((_, pi) => renderSeat(pi));
  renderTable();
  renderHand();
  const cur = S.players[S.turn];
  $("turno").textContent = S.dealing ? "Repartiendo" : cur.human ? "Tu turno" : `Juega ${cur.name}`;
}

$("newg").addEventListener("click", newGame);
$("again").addEventListener("click", newGame);
$("nr").addEventListener("change", newGame);
addEventListener("resize", () => { if (S) fitTable(); });
try { const n = localStorage.getItem("urugames-robamonton-rivales"); if (n) $("nr").value = n; } catch (e) {}
// Desde el menú: el multijugador en línea todavía no existe, así que se juega contra la compu.
if (CFG.modo === "multi") $("aviso").hidden = false;
newGame();
