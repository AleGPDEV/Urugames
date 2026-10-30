// Pantalla previa de "Jugar solo", común a todos los juegos.
//
// Antes de repartir muestra la misma pantalla en cualquier juego: la dificultad (con lo que cambia en ese juego)
// y las opciones propias del juego, con un botón Empezar. Recuerda lo último elegido en cada juego.
// Se ve con los colores del menú, sea cual sea el diseño del juego.
//
// Uso:
//   const previa = UruPrevia.crear({
//     juego: 'conga',
//     subtitulo: 'Partida contra la compu',                                  // (opcional) texto o cfg => texto
//     dificultad: { facil: 'La compu...', normal: '...', dificil: '...' },   // null si el juego no tiene dificultad
//     opciones: [
//       { id: 'jugadores', nombre: 'Jugadores', valores: [[2, '2'], [3, '3']], defecto: 2 },
//       { id: 'pico', nombre: 'Pico a pico', valores: [[true, 'Sí'], [false, 'No']], defecto: true,
//         visible: cfg => cfg.jugadores === 6, nota: cfg => 'Texto chico debajo' }
//     ],
//     empezar: cfg => { ... }          // cfg = { dificultad, jugadores, ... }
//   });
//   previa.iniciar();   // en "Jugar solo" la muestra; en Multijugador no hace nada y devuelve false
//   previa.mostrar();   // la vuelve a abrir (por ejemplo, desde un botón "Cambiar opciones")
//   previa.config();    // lo último elegido
(function () {
  var DIFS = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']];
  var ICONOS = {
    oros: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
    copas: '<path d="M6 3h12v4a6 6 0 0 1-12 0z"/><path d="M12 13v5"/><path d="M8 21h8"/>',
    espadas: '<path d="M12 2l2 3v10h-4V5z"/><path d="M7 15h10"/><path d="M12 15v6"/>',
    bastos: '<path d="M10 21c0-5 .5-11 1.5-16 .4-2 3.5-2 3.4.2C14.5 10 13.5 16 13 21z"/><path d="M10.8 10l-2.3-1M13.9 13l2.4-.8"/>'
  };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var igual = function (a, b) { return String(a) === String(b); };

  function crear(o) {
    var URU = window.URUGAMES || (window.URUGAMES = {});
    var clave = 'urugames-previa-' + o.juego;
    var info = (window.JUEGOS || []).find(function (j) { return j.id === o.juego; }) || { nombre: o.juego, palo: 'oros', desc: '' };
    var opciones = o.opciones || [];
    var cfg = {}, el = null, empezada = false, foco = null;

    // Lo último elegido; si se llegó con ?dificultad=, esa manda
    var guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(clave) || '{}') || {}; } catch (e) {}
    if (o.dificultad) {
      var d = URU.dificultad || guardado.dificultad;
      cfg.dificultad = DIFS.some(function (x) { return x[0] === d; }) ? d : 'normal';
    }
    opciones.forEach(function (op) {
      var v = guardado[op.id];
      cfg[op.id] = op.valores.some(function (x) { return igual(x[0], v); }) ? op.valores.find(function (x) { return igual(x[0], v); })[0] : op.defecto;
    });

    function grupo(nombre, id, valores, actual, extra) {
      return '<fieldset class="pv-grupo"' + (extra || '') + '><legend>' + esc(nombre) + '</legend><div class="pv-seg" role="radiogroup" aria-label="' + esc(nombre) + '">' +
        valores.map(function (x, i) {
          var on = igual(x[0], actual);
          return '<button type="button" role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-pv="' + esc(id) + '" data-i="' + i + '">' + esc(x[1]) + '</button>';
        }).join('') + '</div><p class="pv-nota" data-pv-nota="' + esc(id) + '"></p></fieldset>';
    }

    function construir() {
      el = document.createElement('div');
      el.className = 'previa';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'pv-titulo');
      el.hidden = true;
      var difs = '';
      if (o.dificultad) {
        difs = '<fieldset class="pv-grupo"><legend>Dificultad</legend><div class="pv-difs" role="radiogroup" aria-label="Dificultad">' +
          DIFS.map(function (x, i) {
            return '<button type="button" role="radio" class="pv-dif" data-pv="dificultad" data-i="' + i + '">' +
              '<span class="pv-dif-cab"><span class="pv-pips" aria-hidden="true">' + '<i></i>'.repeat(i + 1) + '</span>' + x[1] + '</span>' +
              '<span class="pv-dif-txt">' + esc(o.dificultad[x[0]] || '') + '</span></button>';
          }).join('') + '</div></fieldset>';
      }
      el.innerHTML =
        '<div class="pv-marco">' +
          '<a class="pv-volver" href="../../index.html">← Volver al menú</a>' +
          '<section class="pv-carta">' +
            '<header class="pv-cab">' +
              '<span class="pv-palo pv-' + esc(info.palo) + '"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[info.palo] || ICONOS.oros) + '</svg></span>' +
              '<div><h2 id="pv-titulo">' + esc(info.nombre) + '</h2><p class="pv-sub" data-pv-sub></p></div>' +
            '</header>' +
            difs +
            opciones.map(function (op) { return grupo(op.nombre, op.id, op.valores, cfg[op.id], ' data-pv-op="' + esc(op.id) + '"'); }).join('') +
            '<div class="pv-acciones">' +
              '<button type="button" class="pv-empezar" data-pv-accion="empezar">Empezar partida</button>' +
              '<button type="button" class="pv-seguir" data-pv-accion="seguir" hidden>Seguir con la partida</button>' +
            '</div>' +
          '</section>' +
        '</div>';
      document.body.appendChild(el);

      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pv]');
        if (b) {
          var id = b.dataset.pv, i = +b.dataset.i;
          cfg[id] = id === 'dificultad' ? DIFS[i][0] : opciones.find(function (op) { return op.id === id; }).valores[i][0];
          pintar(); b.focus(); return;
        }
        var a = e.target.closest('[data-pv-accion]');
        if (a && a.dataset.pvAccion === 'empezar') empezar();
        if (a && a.dataset.pvAccion === 'seguir') cerrar();
      });
      // Flechas dentro de cada grupo, como en cualquier grupo de opciones
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && empezada) { cerrar(); return; }
        var b = e.target.closest('[data-pv]'); if (!b) return;
        var paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!paso) return;
        e.preventDefault();
        var hermanos = Array.prototype.slice.call(b.parentNode.querySelectorAll('[data-pv]'));
        var sig = hermanos[(hermanos.indexOf(b) + paso + hermanos.length) % hermanos.length];
        sig.click();
      });
    }

    function pintar() {
      var sub = typeof o.subtitulo === 'function' ? o.subtitulo(cfg) : (o.subtitulo || 'Partida contra la compu');
      el.querySelector('[data-pv-sub]').textContent = sub;
      el.querySelectorAll('[data-pv]').forEach(function (b) {
        var id = b.dataset.pv, i = +b.dataset.i;
        var v = id === 'dificultad' ? DIFS[i][0] : opciones.find(function (op) { return op.id === id; }).valores[i][0];
        var on = igual(v, cfg[id]);
        b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
      });
      opciones.forEach(function (op) {
        var g = el.querySelector('[data-pv-op="' + op.id + '"]');
        if (g) g.hidden = op.visible ? !op.visible(cfg) : false;
        var n = el.querySelector('[data-pv-nota="' + op.id + '"]');
        if (n) n.textContent = op.nota ? (op.nota(cfg) || '') : '';
      });
    }

    function mostrar() {
      if (!el) construir();
      el.querySelector('[data-pv-accion="seguir"]').hidden = !empezada;
      pintar();
      foco = document.activeElement;
      el.hidden = false;
      document.documentElement.classList.add('previa-abierta');
      el.scrollTop = 0;
      var b = el.querySelector('.pv-empezar'); if (b) b.focus({ preventScroll: true });
    }
    function cerrar() {
      if (!el) return;
      el.hidden = true;
      document.documentElement.classList.remove('previa-abierta');
      if (foco && foco.focus && document.contains(foco)) foco.focus();
    }
    function empezar() {
      var elegido = {};
      if (o.dificultad) elegido.dificultad = cfg.dificultad;
      opciones.forEach(function (op) { if (!op.visible || op.visible(cfg)) elegido[op.id] = cfg[op.id]; else elegido[op.id] = op.defecto; });
      try { localStorage.setItem(clave, JSON.stringify(cfg)); } catch (e) {}
      if (o.dificultad) URU.dificultad = cfg.dificultad;
      textoModo();
      empezada = true;
      cerrar();
      o.empezar(elegido);
    }

    // El renglón de arriba del juego ("Individual · dificultad Difícil"); sin dificultad dice solo "Individual"
    function textoModo() {
      var m = document.getElementById('modo'); if (!m) return;
      m.textContent = o.dificultad ? 'Individual · dificultad ' + DIFS.find(function (x) { return x[0] === cfg.dificultad; })[1] : 'Individual';
    }

    return {
      // En "Jugar solo" abre la pantalla y devuelve true; en Multijugador no hace nada
      iniciar: function () { if (URU.modo === 'multi') return false; textoModo(); mostrar(); return true; },
      mostrar: mostrar,
      cerrar: cerrar,
      config: function () { return Object.assign({}, cfg); }
    };
  }

  window.UruPrevia = { crear: crear };
})();
