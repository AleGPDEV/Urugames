// Escoba de 15: vos contra la compu, partida a 15 puntos.
// Mazo de 40 cartas (sin 8 ni 9) tomado de img/baraja.jpg.
const CFG = window.URUGAMES || {};
let DIF = CFG.dificultad || 'normal';
const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const FIG = { 10: 'sota', 11: 'caballo', 12: 'rey' };
const META = 15;
const val = n => n <= 7 ? n : n - 2;
const $ = id => document.getElementById(id);
const sum = a => a.reduce((t, c) => t + c.v, 0);
const name = c => (c.n > 7 ? FIG[c.n] : c.n) + ' de ' + c.s;
// Posición en la grilla: columna = número - 1, fila = palo
const pos = c => `${((c.n - 1) / 11 * 100).toFixed(4)}% ${SUITS.indexOf(c.s) / 4 * 100}%`;

let st, timer = null, t0 = Date.now();

function freshGame() {
  clearTimeout(timer);
  st = { score: { me: 0, cpu: 0 }, dealer: 'cpu', round: 0 };
  t0 = Date.now();
  newRound();
}

function newRound() {
  const deck = [];
  for (const s of SUITS) for (const n of NUMS) deck.push({ s, n, v: val(n), id: s + n });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  Object.assign(st, { deck, table: [], hand: { me: [], cpu: [] }, cap: { me: [], cpu: [] }, esc: { me: 0, cpu: 0 }, last: null, selH: null, selT: new Set(), hint: null, pending: null, busy: false, msg: '' });
  st.round++;
  st.table = st.deck.splice(0, 4);
  const d = st.dealer, tsum = sum(st.table);
  if (tsum === 15 || tsum === 30) {
    const n = tsum / 15;
    st.esc[d] += n; st.cap[d].push(...st.table); st.table = []; st.last = d;
    st.msg = (d === 'me' ? 'Repartiste y la mesa sumaba ' + tsum + '. ' : 'La compu repartió con mesa de ' + tsum + '. ') + (n > 1 ? 'Dos escobas.' : 'Escoba.');
  }
  deal();
  st.turn = d === 'me' ? 'cpu' : 'me';
  if (!st.msg) st.msg = st.turn === 'me' ? 'Te toca. Elegí una carta de tu mano.' : 'Empieza la compu.';
  render();
  if (st.turn === 'cpu') timer = setTimeout(cpuTurn, 900);
}

function deal() { st.hand.me = st.deck.splice(0, 3); st.hand.cpu = st.deck.splice(0, 3); }

// Todas las combinaciones de la mesa que con la carta suman 15
function captures(card, table) {
  const out = [], n = table.length;
  for (let m = 1; m < (1 << n); m++) {
    let s = card.v; const pick = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) { s += table[i].v; pick.push(table[i]); }
    if (s === 15) out.push(pick);
  }
  return out;
}

function capScore(card, take, table) {
  let s = 0;
  for (const c of [card, ...take]) {
    s += 1;
    if (c.s === 'oros') s += 3;
    if (c.n === 7) s += 6;
    if (c.s === 'oros' && c.n === 7) s += 25;
  }
  if (take.length === table.length) s += 100;
  return s;
}

// Qué tan peligroso es dejar esta carta en la mesa
function dropRisk(card, table) {
  const nt = [...table, card]; let r = 0;
  for (let v = 1; v <= 10; v++) if (captures({ v }, nt).length) r += 2;
  const t = sum(nt);
  if (t >= 5 && t <= 14) r += 25; // el rival puede hacer escoba
  if (card.n === 7) r += 4;
  if (card.s === 'oros') r += 2;
  if (card.s === 'oros' && card.n === 7) r += 15;
  return r - card.v * 0.1;
}

function bestMove(hand, table, smartDrop = true) {
  let best = null;
  for (const c of hand) for (const t of captures(c, table)) {
    const sc = capScore(c, t, table);
    if (!best || sc > best.sc) best = { card: c, take: t, sc };
  }
  if (best) return best;
  if (!smartDrop) return { card: hand[Math.floor(Math.random() * hand.length)], take: [] };
  let drop = null;
  for (const c of hand) { const r = dropRisk(c, table); if (!drop || r < drop.r) drop = { card: c, take: [], r }; }
  return drop;
}

// Fácil: a veces no ve la jugada y tira cualquier cosa. Normal: no cuida lo que deja en la mesa. Difícil: todo.
function cpuMove() {
  const h = st.hand.cpu, t = st.table;
  if (DIF === 'facil') {
    if (Math.random() < 0.35) return { card: h[Math.floor(Math.random() * h.length)], take: [] };
    const opts = []; for (const c of h) for (const tk of captures(c, t)) opts.push({ card: c, take: tk });
    if (opts.length) return opts[Math.floor(Math.random() * opts.length)];
    return { card: h[Math.floor(Math.random() * h.length)], take: [] };
  }
  return bestMove(h, t, DIF === 'dificil' || Math.random() < 0.5);
}

function apply(p, card, take) {
  st.hand[p] = st.hand[p].filter(c => c.id !== card.id);
  if (take.length) {
    const ids = new Set(take.map(c => c.id));
    st.table = st.table.filter(c => !ids.has(c.id));
    st.cap[p].push(card, ...take); st.last = p;
    if (!st.table.length) { st.esc[p]++; st.msg = (p === 'me' ? '¡Escoba! ' : '¡Escoba de la compu! ') + 'Mesa limpia.'; }
    else st.msg = `${p === 'me' ? 'Te llevaste' : 'La compu se llevó'} ${take.length + 1} cartas con el ${name(card)}.`;
  } else {
    st.table.push(card);
    st.msg = p === 'me' ? `Tiraste el ${name(card)}.` : `La compu tiró el ${name(card)}.`;
  }
  st.turn = p === 'me' ? 'cpu' : 'me';
}

function next() {
  if (!st.hand.me.length && !st.hand.cpu.length) {
    if (st.deck.length >= 6) { deal(); st.msg += ' Nueva repartida.'; }
    else return endRound();
  }
  render();
  if (st.turn === 'cpu') timer = setTimeout(cpuTurn, 800);
}

function cpuTurn() {
  const m = cpuMove();
  st.busy = true; st.pending = m;
  st.hand.cpu = st.hand.cpu.filter(c => c.id !== m.card.id);
  st.msg = m.take.length ? 'La compu juega el ' + name(m.card) + '…' : 'La compu piensa…';
  render();
  timer = setTimeout(() => {
    st.hand.cpu.push(m.card);
    apply('cpu', m.card, m.take);
    st.pending = null; st.busy = false;
    next();
  }, 1200);
}

function tally(p) {
  const cs = st.cap[p];
  return { cards: cs.length, oros: cs.filter(c => c.s === 'oros').length, sietes: cs.filter(c => c.n === 7).length, siete: cs.some(c => c.s === 'oros' && c.n === 7), esc: st.esc[p] };
}

function endRound() {
  if (st.table.length && st.last) { st.cap[st.last].push(...st.table); st.table = []; }
  const a = tally('me'), b = tally('cpu');
  const more = (x, y) => x > y ? [1, 0] : y > x ? [0, 1] : [0, 0];
  const rows = [
    ['Escobas', a.esc, b.esc, [a.esc, b.esc]],
    ['Cartas', a.cards, b.cards, more(a.cards, b.cards)],
    ['Oros', a.oros, b.oros, more(a.oros, b.oros)],
    ['Sietes', a.sietes, b.sietes, more(a.sietes, b.sietes)],
    ['7 de oros', a.siete ? 'Sí' : '—', b.siete ? 'Sí' : '—', [a.siete ? 1 : 0, b.siete ? 1 : 0]]
  ];
  let pm = 0, pc = 0; rows.forEach(r => { pm += r[3][0]; pc += r[3][1]; });
  st.score.me += pm; st.score.cpu += pc;
  const over = (st.score.me >= META || st.score.cpu >= META) && st.score.me !== st.score.cpu;
  const win = st.score.me > st.score.cpu;
  const cell = (v, p) => `${v}${p ? ` <span class="pt">+${p}</span>` : ''}`;
  $('finalBox').innerHTML = `<h2>${over ? (win ? '¡Ganaste la partida!' : 'Ganó la compu') : 'Fin de la mano ' + st.round}</h2>
    <p>${over ? `Resultado final: ${st.score.me} a ${st.score.cpu}.` : `Esta mano: vos +${pm}, compu +${pc}.`}</p>
    <table><thead><tr><th></th><th>Vos</th><th>Compu</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r[0]}</td><td>${cell(r[1], r[3][0])}</td><td>${cell(r[2], r[3][1])}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td>${st.score.me}</td><td>${st.score.cpu}</td></tr></tfoot></table>
    <button type="button" id="nextBtn">${over ? 'Jugar otra' : 'Siguiente mano'}</button>`;
  $('final').hidden = false;
  render();
  if (over) {
    try {
      window.dispatchEvent(new CustomEvent('urugames:resultado', { detail: {
        juego: 'escoba', resultado: win ? 'gano' : 'perdio',
        puntaje: st.score.me, tiempo: Math.round((Date.now() - t0) / 1000), jugadores: 2 } }));
    } catch (e) {}
  }
  $('nextBtn').onclick = () => {
    $('final').hidden = true;
    if (over) freshGame();
    else { st.dealer = st.dealer === 'me' ? 'cpu' : 'me'; newRound(); }
  };
  $('nextBtn').focus();
}

function cardHTML(c, cls = '') {
  return `<button type="button" class="es-card ${cls}" data-id="${c.id}" aria-label="${name(c)}" style="background-position:${pos(c)}">${c.n > 7 ? `<span class="es-val">vale ${c.v}</span>` : ''}</button>`;
}

function render() {
  $('sMe').textContent = st.score.me; $('sCpu').textContent = st.score.cpu;
  $('cpuCards').textContent = st.cap.cpu.length; $('cpuEsc').textContent = st.esc.cpu;
  const a = tally('me');
  $('meCards').textContent = a.cards; $('meEsc').textContent = a.esc; $('meOros').textContent = a.oros;
  $('meSiete').textContent = a.sietes + (a.siete ? ' (con el 7 de oros)' : '');
  $('dealer').textContent = 'Mano ' + st.round + ' · reparte ' + (st.dealer === 'me' ? 'vos' : 'la compu') + ' · a ' + META;
  $('cpuHand').innerHTML = st.hand.cpu.map(() => '<div class="es-card es-dorso" aria-hidden="true"></div>').join('');
  const takeIds = new Set(st.pending ? st.pending.take.map(c => c.id) : []);
  const hintIds = new Set(st.hint ? st.hint.take.map(c => c.id) : []);
  let t = st.table.map(c => cardHTML(c, (st.selT.has(c.id) ? 'sel ' : '') + (takeIds.has(c.id) ? 'taking ' : '') + (hintIds.has(c.id) ? 'hint' : ''))).join('');
  if (st.pending) t += cardHTML(st.pending.card, 'incoming');
  $('table').innerHTML = t || '<span class="es-empty">Mesa vacía</span>';
  $('deckInfo').textContent = st.deck.length ? `Mazo: ${st.deck.length} cartas` : 'Última repartida';
  $('mazoCard').classList.toggle('es-gone', !st.deck.length);
  $('hand').innerHTML = st.hand.me.map(c => cardHTML(c, (st.selH === c.id ? 'sel ' : '') + (st.hint && st.hint.card.id === c.id ? 'hint' : ''))).join('');
  const myTurn = st.turn === 'me' && !st.busy;
  const h = st.hand.me.find(c => c.id === st.selH);
  const tsel = st.table.filter(c => st.selT.has(c.id));
  const total = (h ? h.v : 0) + sum(tsel);
  $('takeBtn').disabled = !(myTurn && h && tsel.length && total === 15);
  $('dropBtn').disabled = !(myTurn && h && !tsel.length);
  $('hintBtn').disabled = !myTurn;
  let s = st.msg;
  if (myTurn && (h || tsel.length)) {
    s = total === 15 && h && tsel.length
      ? `<span class="ok">Suma <b>15</b>: podés llevar.</span>`
      : `Suma <b>${total}</b>${total < 15 ? ` · faltan ${15 - total}` : ' · te pasaste'}`;
  }
  $('status').innerHTML = s;
}

$('hand').addEventListener('click', e => {
  const b = e.target.closest('.es-card'); if (!b || st.turn !== 'me' || st.busy) return;
  st.selH = st.selH === b.dataset.id ? null : b.dataset.id; st.hint = null; render();
});
$('table').addEventListener('click', e => {
  const b = e.target.closest('.es-card'); if (!b || st.turn !== 'me' || st.busy) return;
  const id = b.dataset.id; if (!st.table.some(c => c.id === id)) return;
  st.selT.has(id) ? st.selT.delete(id) : st.selT.add(id); st.hint = null; render();
});
$('takeBtn').onclick = () => {
  const h = st.hand.me.find(c => c.id === st.selH), take = st.table.filter(c => st.selT.has(c.id));
  if (!h || h.v + sum(take) !== 15) return;
  st.selH = null; st.selT = new Set(); apply('me', h, take); next();
};
$('dropBtn').onclick = () => {
  const h = st.hand.me.find(c => c.id === st.selH); if (!h) return;
  st.selH = null; st.selT = new Set(); apply('me', h, []); next();
};
$('hintBtn').onclick = () => {
  let best = null;
  for (const c of st.hand.me) for (const t of captures(c, st.table)) { const sc = capScore(c, t, st.table); if (!best || sc > best.sc) best = { card: c, take: t, sc }; }
  st.selH = null; st.selT = new Set();
  if (best) { st.hint = best; st.msg = 'En verde: el ' + name(best.card) + ' con ' + best.take.length + (best.take.length > 1 ? ' cartas' : ' carta') + ' de la mesa.'; }
  else { st.hint = null; const d = bestMove(st.hand.me, st.table); st.msg = 'No hay 15 posible. Conviene tirar el ' + name(d.card) + '.'; }
  render();
};
$('newg').onclick = freshGame;

// Desde el menú: el multijugador en línea todavía no existe, así que se juega contra la compu.
if (CFG.modo === 'multi') $('aviso').hidden = false;

// "Jugar solo": la pantalla previa común (js/previa.js) elige la dificultad antes de repartir
const previa = window.UruPrevia ? UruPrevia.crear({
  juego: 'escoba',
  dificultad: {
    facil: 'A veces no ve la levantada y tira cualquier carta.',
    normal: 'Elige la levantada que más le conviene, pero no siempre cuida lo que deja en la mesa.',
    dificil: 'Además tira la carta que menos chances te da, sobre todo de hacer escoba.'
  },
  empezar: c => { DIF = c.dificultad; freshGame(); }
}) : null;
if (previa && previa.iniciar()) { $('optsBtn').hidden = false; $('optsBtn').onclick = () => previa.mostrar(); }
else freshGame();
