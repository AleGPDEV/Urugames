// Mesas en línea comunes a todos los juegos: la misma forma de entrar en cualquier juego.
//
// Hace todo lo que no depende del juego:
//   - Panel "Con amigos en línea": tu nombre, abrir mesa, unirse con código, tus mesas y las que esperan gente.
//   - Lo elegido en el menú principal: ?sala=nueva | rapida | CÓDIGO.
//   - Sala de espera con el código grande, los lugares y "Empezar con la máquina en los libres".
//   - Guardar y recibir la partida en orden (rev), y la presencia de quién está en cada mesa.
//   - Borrar las mesas en las que no queda nadie.
//
// Cada mesa es <juego>/mesas/<CÓDIGO> = { seats:[uid|null], host, status:'waiting'|'playing'|'done', g, rev, n, createdAt, ...datosMesa }
//
// Uso:
//   const mesas = UruMesas.crear({
//     juego: 'conga',
//     panel: elemento donde va el panel en línea,
//     espera: { mostrar(html), ocultar() },              // dónde se dibuja la sala de espera
//     clases: { boton, secundario, chico, nota },         // clases de botones y textos del juego
//     jugadores: () => 3,                                 // lugares de una mesa nueva
//     datosMesa: () => ({ target: 30 }),                  // (opcional) datos extra que se guardan en la mesa
//     nuevaPartida: mesa => g,                            // arma la partida; mesa.cpu dice qué lugares juega la máquina
//     etiquetaAsiento: (i, mesa, miAsiento) => 'Nosotros',// (opcional) en la sala de espera
//     resumen: (mesa, miAsiento) => ', 15 a 10',          // (opcional) en "Tus mesas"
//     alEstado: (g, info) => {},                          // llegó una partida nueva; info = { codigo, asiento, host, nombres, hostNombre }
//     alSalir: motivo => {}                               // la mesa se cerró o te fuiste; motivo es '' o un texto para mostrar
//   });
//   mesas.iniciar();                 // conecta y dibuja el panel
//   mesas.publicar(g, terminada);    // guarda tu jugada
//   mesas.salir();                   // dejar la mesa (si no queda nadie, se borra)
(function () {
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var GRACIA = 90e3;      // una mesa recién abierta no se borra hasta que pase este tiempo
  var BARRIDO = 30e3;     // cada cuánto se revisan las mesas vacías

  function crear(o) {
    var cl = Object.assign({ boton: 'btn', secundario: 'btn', chico: 'sm', nota: 'note' }, o.clases || {});
    var URU = window.URUGAMES || {}, multi = URU.modo === 'multi';
    var DB = null, USER = null, PRES = null, MYID = null, presOk = false;
    var docs = [], error = '', listo = false, primera = true, autoHecho = false, ultimoBarrido = 0;
    var ref = null, codigo = null, desuscribir = null, recibido = 0, rev = 0, cadena = Promise.resolve();

    function nombres(ids) {
      var out = {}; ids = ids.filter(Boolean);
      if (!USER || !ids.length) return Promise.resolve(out);
      return USER.profiles(ids).then(function (ps) { ids.forEach(function (id) { out[id] = ps[id] && ps[id].name || ''; }); return out; })
        .catch(function () { return out; });
    }
    function abiertas() {
      return docs.filter(function (d) { return d.status === 'waiting' && d.seats.indexOf(MYID) < 0 && d.seats.indexOf(null) >= 0 && Date.now() - (d.createdAt || 0) < 6 * 3600e3; });
    }
    function setError(m) {
      error = m || '';
      var e = o.panel && o.panel.querySelector('[data-mesa-error]'); if (e) e.textContent = error;
      if (error && o.alError) o.alError(error);
    }

    /* ---- conexión y panel ---- */
    function iniciar() {
      dibujar();
      var p = window.UruOnline ? UruOnline.init(o.juego) : Promise.resolve(null);
      return p.catch(function () { return null; }).then(function (on) {
        if (on) { DB = on.db; USER = on.user; MYID = on.uid; PRES = on.presencia || null; }
        listo = true;
        if (!DB) { dibujar(); return false; }
        if (PRES) PRES.disponible().then(function (ok) { presOk = ok; barrer(); });
        DB.collection('mesas').where('status', 'in', ['waiting', 'playing', 'done']).onSnapshot(function (s) {
          docs = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (d) { return Array.isArray(d.seats); });
          if (primera) { primera = false; auto(); }
          dibujar(); barrer();
        }, function () { setError('No se pudo leer la lista de mesas.'); dibujar(); });
        dibujar();
        return true;
      });
    }
    function auto() {
      if (!multi || autoHecho || !URU.sala) return;
      autoHecho = true;
      if (URU.sala === 'nueva') return abrir();
      if (URU.sala === 'rapida') {
        var n = o.jugadores();
        var a = abiertas().sort(function (x, y) { return (y.seats.length === n) - (x.seats.length === n) || (y.createdAt || 0) - (x.createdAt || 0); });
        return a.length ? unirse(a[0].id) : abrir();
      }
      unirse(URU.sala);
    }
    function dibujar() {
      var box = o.panel; if (!box) return;
      if (!listo) { box.innerHTML = '<p class="' + cl.nota + '">Conectando con las mesas en línea…</p>'; return; }
      if (!DB) {
        box.innerHTML = window.UruOnline && UruOnline.disponible()
          ? '<p>No se pudo conectar con las mesas en línea. Revisá la conexión y recargá la página.</p>' + (UruOnline.error() ? '<p class="' + cl.nota + '">Detalle: ' + esc(UruOnline.error()) + '</p>' : '') + '<p class="' + cl.nota + '">Mientras tanto podés jugar contra la máquina.</p>'
          : '<p>El modo en línea todavía no está configurado.</p><p class="' + cl.nota + '">Mientras tanto podés jugar contra la máquina.</p>';
        return;
      }
      // La parte fija se dibuja una sola vez para no borrar lo que se está escribiendo
      if (!box.querySelector('[data-mesa-lista]')) {
        box.innerHTML =
          '<div class="mesa-campo"><label class="' + cl.nota + '" for="mesa-nombre-' + o.juego + '">Tu nombre</label><input id="mesa-nombre-' + o.juego + '" data-mesa-nombre maxlength="20" autocomplete="nickname" placeholder="Cómo te ven los demás" value="' + esc(UruOnline.nombre()) + '"></div>' +
          '<button type="button" class="' + cl.boton + '" data-mesa="abrir"></button>' +
          '<div class="mesa-campo"><label class="' + cl.nota + '" for="mesa-codigo-' + o.juego + '">Código de mesa</label><div class="mesa-fila"><input id="mesa-codigo-' + o.juego + '" data-mesa-codigo maxlength="4" autocomplete="off" placeholder="ABCD"><button type="button" class="' + cl.secundario + '" data-mesa="unirme">Unirme</button></div></div>' +
          '<p class="mesa-error" data-mesa-error role="alert"></p>' +
          '<div data-mesa-lista></div>';
        box.querySelector('[data-mesa-nombre]').addEventListener('change', function (e) { e.target.value = UruOnline.setNombre(e.target.value); });
        box.querySelector('[data-mesa-codigo]').addEventListener('keydown', function (e) { if (e.key === 'Enter') unirse(e.target.value); });
      }
      box.querySelector('[data-mesa="abrir"]').textContent = 'Abrir una mesa de ' + o.jugadores();
      box.querySelector('[data-mesa-error]').textContent = error;
      var mias = docs.filter(function (d) { return d.seats.indexOf(MYID) >= 0 && d.status !== 'done'; }), ab = abiertas();
      var hosts = []; mias.concat(ab).forEach(function (d) { if (hosts.indexOf(d.host) < 0) hosts.push(d.host); });
      nombres(hosts).then(function (N) {
        var libres = function (d) { return d.seats.filter(function (x) { return !x; }).length; };
        var li = function (d, texto, acc, btn) { return '<li><span class="mesa-codigo">' + esc(d.id) + '</span><span class="mesa-meta">' + texto + '</span><button type="button" class="' + cl.secundario + ' ' + cl.chico + '" data-mesa="' + acc + '" data-codigo="' + esc(d.id) + '">' + btn + '</button></li>'; };
        var lista = box.querySelector('[data-mesa-lista]'); if (!lista) return;
        lista.innerHTML =
          (mias.length ? '<p class="' + cl.nota + '">Tus mesas</p><ul class="mesa-lista">' + mias.map(function (d) {
            var extra = d.status === 'waiting' ? ', esperando gente' : (o.resumen ? o.resumen(d, d.seats.indexOf(MYID)) : ', jugando');
            return li(d, 'de ' + d.seats.length + extra, 'seguir', 'Seguir');
          }).join('') + '</ul>' : '') +
          '<p class="' + cl.nota + '">Mesas esperando gente</p>' +
          (ab.length ? '<ul class="mesa-lista">' + ab.map(function (d) {
            var l = libres(d);
            return li(d, 'de ' + d.seats.length + ', abrió ' + esc(N[d.host] || 'alguien') + ', ' + l + (l === 1 ? ' lugar libre' : ' lugares libres'), 'sentarme', 'Sentarme');
          }).join('') + '</ul>' : '<p class="mesa-vacia">No hay mesas abiertas. Abrí una y pasale el código a tus amigos.</p>');
      });
    }

    /* ---- crear, unirse, empezar ---- */
    function nuevoCodigo() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', s = ''; for (var i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
    function abrir() {
      if (!DB) return;
      setError('');
      var c = nuevoCodigo(), r = DB.doc('mesas/' + c), n = o.jugadores();
      return r.get().then(function (ex) {
        if (ex.exists) return abrir();
        var seats = []; for (var i = 0; i < n; i++) seats.push(i === 0 ? MYID : null);
        var d = Object.assign({}, o.datosMesa ? o.datosMesa() : {}, { seats: seats, host: MYID, status: 'waiting', g: null, rev: 0, n: n, createdAt: Date.now() });
        return r.set(d).then(function () { entrar(c); });
      }).catch(function () { setError('No se pudo abrir la mesa. Probá de nuevo.'); });
    }
    function partidaPara(d, seats) {
      return o.nuevaPartida(Object.assign({}, d, { seats: seats, cpu: seats.map(function (x) { return !x; }) }));
    }
    function unirse(c) {
      if (!DB) return;
      setError('');
      c = String(c || '').trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(c)) return setError('El código tiene cuatro letras.');
      var r = DB.doc('mesas/' + c);
      return r.acquire({ holder: MYID, ttlMs: 4000 }).then(function (lease) {
        if (!lease.acquired) return setError('Alguien se está sentando en esa mesa. Probá en unos segundos.');
        return r.get().then(function (s) {
          if (!s.exists) return setError('No encontré esa mesa.');
          var d = s.data();
          if (!Array.isArray(d.seats)) return setError('Esa mesa es de una versión anterior del juego. Abrí una nueva.');
          if (d.seats.indexOf(MYID) >= 0) return entrar(c);
          var libre = d.seats.indexOf(null);
          if (libre < 0 || d.status !== 'waiting') return setError('Esa mesa ya está completa.');
          var seats = d.seats.slice(); seats[libre] = MYID;
          // El último que se sienta reparte y arranca la partida
          var cambio = seats.indexOf(null) < 0
            ? { seats: seats, status: 'playing', g: JSON.parse(JSON.stringify(partidaPara(d, seats))), rev: (d.rev || 0) + 1 }
            : { seats: seats };
          return r.update(cambio).then(function () { entrar(c); });
        });
      }).catch(function () { setError('No pude sentarte en la mesa. Probá de nuevo.'); });
    }
    function empezarConMaquina() {
      if (!ref) return;
      var r = ref;
      return r.get().then(function (s) {
        var d = s.data(); if (!d || d.status !== 'waiting') return;
        return r.update({ status: 'playing', g: JSON.parse(JSON.stringify(partidaPara(d, d.seats))), rev: (d.rev || 0) + 1 });
      }).catch(function () { setError('No se pudo empezar la partida.'); });
    }

    /* ---- estar en una mesa ---- */
    function entrar(c) {
      soltar();
      codigo = c; ref = DB.doc('mesas/' + c); recibido = 0; rev = 0;
      if (PRES) PRES.entrar(c);
      o.espera.mostrar('<h2>Abriendo la mesa…</h2>');
      var r = ref;
      desuscribir = r.onSnapshot(function (s) {
        if (codigo !== c) return;
        if (!s.exists) { cerrar('La mesa se cerró.'); return; }
        var d = s.data();
        if (!Array.isArray(d.seats)) { cerrar('Esa mesa es de una versión anterior del juego.'); return; }
        var asiento = d.seats.indexOf(MYID);
        if (asiento < 0) { cerrar('Esa mesa ya está completa.'); return; }
        nombres(d.seats).then(function (N) {
          if (codigo !== c) return;
          var cpus = d.seats.filter(function (x) { return !x; }).length, k = 0;
          var info = {
            codigo: c, asiento: asiento, host: d.host === MYID, mesa: d,
            nombres: d.seats.map(function (id, i) { return id ? (N[id] || 'Jugador ' + (i + 1)) : (cpus === 1 ? 'La máquina' : 'Máquina ' + (++k)); }),
            hostNombre: d.host === MYID ? 'vos' : (N[d.host] || 'quien abrió la mesa')
          };
          if (d.status === 'waiting') { salaDeEspera(d, info, N); return; }
          o.espera.ocultar();
          if (d.g && (d.rev || 0) > recibido) { recibido = rev = d.rev || 0; o.alEstado(JSON.parse(JSON.stringify(d.g)), info); }
        });
      }, function () { cerrar('Se perdió la conexión con la mesa.'); });
    }
    function salaDeEspera(d, info, N) {
      var lista = d.seats.map(function (id, i) {
        var et = o.etiquetaAsiento ? '<span class="mesa-codigo">' + esc(o.etiquetaAsiento(i, d, info.asiento)) + '</span>' : '';
        return '<li>' + et + '<span class="mesa-meta">' + (id ? esc(id === MYID ? 'Vos' : (N[id] || 'Jugador')) : 'Lugar libre') + '</span></li>';
      }).join('');
      o.espera.mostrar(
        '<h2>Mesa de ' + d.seats.length + ' abierta</h2><p>Pasale este código a tus amigos para que se sienten:</p><div class="mesa-codigo-grande">' + esc(info.codigo) + '</div>' +
        '<ul class="mesa-lista">' + lista + '</ul>' +
        '<p class="' + cl.nota + '">' + (info.host ? 'La partida empieza sola cuando se llena. Si no querés esperar, los lugares libres los juega la máquina.' : 'Esperando que se llene la mesa o que quien la abrió empiece.') + '</p>' +
        '<div class="mesa-botones">' + (info.host
          ? '<button type="button" class="' + cl.boton + '" data-mesa="maquina">Empezar con la máquina en los libres</button><button type="button" class="' + cl.secundario + '" data-mesa="cerrar">Cerrar la mesa</button>'
          : '<button type="button" class="' + cl.secundario + '" data-mesa="salir">Salir de la mesa</button>') + '</div>');
    }
    function publicar(g, terminada) {
      if (!ref) return;
      var r = ref, cuerpo = { g: JSON.parse(JSON.stringify(g)), rev: ++rev, status: terminada ? 'done' : 'playing' };
      recibido = rev;
      // Una jugada por vez y en orden, para que los demás las vean todas
      cadena = cadena.then(function () { return r.update(cuerpo); }).catch(function () { setError('No se pudo guardar la jugada. Revisá la conexión.'); });
      return cadena;
    }
    // Deja de escuchar la mesa y avisa que ya no estoy. Si no queda nadie, la mesa se borra.
    function soltar() {
      if (desuscribir) { desuscribir(); desuscribir = null; }
      var c = codigo, r = ref;
      codigo = null; ref = null;
      if (!c) return Promise.resolve();
      if (!PRES) return Promise.resolve();
      return PRES.salir(c).then(function () { return vaciaBorrar(c, r); });
    }
    function vaciaBorrar(c, r) {
      if (!presOk || !PRES) return Promise.resolve();
      return PRES.contar(c).then(function (n) { if (n === 0) return (r || DB.doc('mesas/' + c)).delete(); }).catch(function () {});
    }
    function cerrar(motivo) { soltar(); o.espera.ocultar(); o.alSalir(motivo || ''); setError(motivo || ''); }
    function salir() { var p = soltar(); o.espera.ocultar(); return p; }
    function salirDeEspera() {
      // Libera mi lugar en una mesa que todavía no empezó
      var r = ref;
      cerrar('');
      if (r) r.get().then(function (s) { var d = s.data(); if (d && d.status === 'waiting') return r.update({ seats: d.seats.map(function (x) { return x === MYID ? null : x; }) }); }).catch(function () {});
    }
    function cerrarMesa() { var r = ref; cerrar(''); if (r) r.delete().catch(function () {}); }

    // Borra las mesas que llevan un rato sin nadie adentro (por ejemplo, si todos cerraron la pestaña)
    function barrer() {
      if (!presOk || !PRES || Date.now() - ultimoBarrido < BARRIDO) return;
      ultimoBarrido = Date.now();
      docs.forEach(function (d) {
        if (d.id === codigo || Date.now() - (d.createdAt || 0) < GRACIA) return;
        PRES.contar(d.id).then(function (n) { if (n === 0) DB.doc('mesas/' + d.id).delete().catch(function () {}); }).catch(function () {});
      });
    }

    // Botones del panel y de la sala de espera
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mesa]'); if (!b) return;
      var a = b.dataset.mesa;
      if (a === 'abrir') abrir();
      else if (a === 'unirme') { var i = o.panel.querySelector('[data-mesa-codigo]'); unirse(i && i.value); }
      else if (a === 'sentarme') unirse(b.dataset.codigo);
      else if (a === 'seguir') entrar(b.dataset.codigo);
      else if (a === 'maquina') empezarConMaquina();
      else if (a === 'cerrar') cerrarMesa();
      else if (a === 'salir') salirDeEspera();
    });
    window.addEventListener('pagehide', function () { if (codigo && PRES) PRES.salir(codigo); });

    return {
      iniciar: iniciar, publicar: publicar, salir: salir, abrir: abrir, unirse: unirse, redibujar: dibujar,
      conectado: function () { return !!DB; },
      enMesa: function () { return !!codigo; },
      codigo: function () { return codigo; }
    };
  }

  window.UruMesas = { crear: crear };
})();
