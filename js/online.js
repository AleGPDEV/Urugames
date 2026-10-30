// Conexión en línea común a todos los juegos (Firebase Realtime Database).
//
// Uso desde un juego:
//   const on = await UruOnline.init('truco');   // null si no hay conexión configurada
//   on.db.doc('mesas/ABCD')         → get / set / update / delete / onSnapshot / acquire
//   on.db.collection('mesas').where('status','in',[...]).onSnapshot(cb)
//   on.user.profiles([uid,...])     → { uid: { name } }
//   on.uid                          → id anónimo de este jugador
//   UruOnline.nombre() / UruOnline.setNombre('Ale')
//   on.presencia.entrar('ABCD') / salir('ABCD') / contar('ABCD') → quién está mirando cada mesa
//
// Para las mesas (lista, crear, unirse, sala de espera y limpieza) usá js/mesas.js, que es igual para todos los juegos.
//
// Cada documento se guarda como texto JSON en <juego>/<colección>/<id>/json, porque la
// Realtime Database borra los null y deforma los arreglos con huecos.
(function () {
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var promesa = null, uid = null, raiz = null, ultimoError = '';

  function cargar(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { mal(new Error('No cargó ' + src)); };
      document.head.appendChild(s);
    });
  }

  function disponible() {
    var c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.databaseURL);
  }

  function leerNombre() {
    try { return localStorage.getItem('urugames-nombre') || ''; } catch (e) { return ''; }
  }

  function setNombre(n) {
    n = String(n || '').trim().slice(0, 20);
    try { localStorage.setItem('urugames-nombre', n); } catch (e) {}
    if (raiz && uid) raiz.child('perfiles/' + uid).set({ nombre: n }).catch(function () {});
    return n;
  }

  function snap(id, s) {
    var v = s.val(), datos = null;
    if (v && typeof v.json === 'string') { try { datos = JSON.parse(v.json); } catch (e) {} }
    return { id: id, exists: datos !== null, data: function () { return datos; } };
  }

  function guardar(datos) {
    return { json: JSON.stringify(datos), status: datos.status || null, createdAt: datos.createdAt || Date.now() };
  }

  function crearDB(juego) {
    var base = raiz.child(juego);

    function doc(ruta) {
      var ref = base.child(ruta), id = ruta.split('/').pop();
      return {
        id: id,
        get: function () { return ref.once('value').then(function (s) { return snap(id, s); }); },
        set: function (datos) { return ref.set(guardar(datos)); },
        update: function (cambios) {
          // Mezcla los cambios con lo que ya hay, en una transacción para no pisar a otro jugador
          return ref.transaction(function (actual) {
            var d = {};
            if (actual && typeof actual.json === 'string') { try { d = JSON.parse(actual.json); } catch (e) {} }
            Object.keys(cambios).forEach(function (k) { d[k] = cambios[k]; });
            return guardar(d);
          }).then(function (r) { if (!r.committed) throw new Error('No se guardó'); });
        },
        delete: function () { return ref.remove(); },
        onSnapshot: function (cb, err) {
          var f = ref.on('value', function (s) { cb(snap(id, s)); }, err);
          return function () { ref.off('value', f); };
        },
        // Reserva corta para que dos personas no se sienten en el mismo lugar a la vez
        acquire: function (o) {
          var lock = raiz.child('locks/' + juego + '/' + ruta.replace(/\//g, '_'));
          return lock.transaction(function (l) {
            if (l && l.holder !== o.holder && l.until > Date.now()) return;
            return { holder: o.holder, until: Date.now() + (o.ttlMs || 4000) };
          }).then(function (r) { return { acquired: r.committed }; });
        }
      };
    }

    function collection(nombre) {
      var filtro = null;
      var api = {
        where: function (campo, op, valores) { filtro = { campo: campo, valores: valores }; return api; },
        onSnapshot: function (cb, err) {
          var q = base.child(nombre).orderByChild('createdAt').limitToLast(60);
          var f = q.on('value', function (s) {
            var docs = [];
            s.forEach(function (h) {
              var d = snap(h.key, h);
              if (!d.exists) return;
              if (filtro && filtro.valores.indexOf(d.data()[filtro.campo]) < 0) return;
              docs.push(d);
            });
            cb({ docs: docs });
          }, err);
          return function () { q.off('value', f); };
        }
      };
      return api;
    }

    return { doc: doc, collection: collection };
  }

  // Presencia: presencia/<juego>/<mesa>/<uid>. Se borra sola cuando se cierra la pestaña o se corta la conexión.
  function crearPresencia(juego) {
    var base = raiz.child('presencia/' + juego);
    var ok = null;
    return {
      // Comprueba que las reglas de la base permitan anotar la presencia (si no, no se borra ninguna mesa)
      disponible: function () {
        if (ok !== null) return Promise.resolve(ok);
        var r = base.child('_prueba/' + uid);
        return r.set(true).then(function () { return r.remove(); })
          .then(function () { ok = true; return ok; }, function () { ok = false; return ok; });
      },
      entrar: function (mesa) {
        var r = base.child(mesa + '/' + uid);
        r.onDisconnect().remove();
        return r.set({ desde: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
      },
      salir: function (mesa) {
        var r = base.child(mesa + '/' + uid);
        r.onDisconnect().cancel();
        return r.remove().catch(function () {});
      },
      contar: function (mesa) {
        return base.child(mesa).once('value').then(function (s) { return s.numChildren(); });
      }
    };
  }

  var user = {
    id: function () { return Promise.resolve(uid); },
    can: function () { return Promise.resolve(true); },
    profiles: function (ids) {
      return Promise.all(ids.map(function (id) {
        return raiz.child('perfiles/' + id + '/nombre').once('value').then(function (s) { return [id, s.val() || '']; })
          .catch(function () { return [id, '']; });
      })).then(function (pares) {
        var out = {};
        pares.forEach(function (p) { out[p[0]] = { name: p[1] }; });
        return out;
      });
    }
  };

  function conectar() {
    if (!disponible()) return Promise.resolve(false);
    if (promesa) return promesa;
    promesa = cargar(SDK + 'firebase-app-compat.js')
      .then(function () { return Promise.all([cargar(SDK + 'firebase-auth-compat.js'), cargar(SDK + 'firebase-database-compat.js')]); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
        return firebase.auth().signInAnonymously();
      })
      .then(function (cred) {
        uid = cred.user.uid;
        raiz = firebase.database().ref();
        var n = leerNombre();
        if (n) raiz.child('perfiles/' + uid).set({ nombre: n }).catch(function () {});
        return true;
      })
      .catch(function (e) { console.warn('Urugames en línea:', e); ultimoError = (e && (e.code || e.message)) || String(e); promesa = null; return false; });
    return promesa;
  }

  window.UruOnline = {
    disponible: disponible,
    nombre: leerNombre,
    setNombre: setNombre,
    error: function () { return ultimoError; },
    init: function (juego) {
      return conectar().then(function (ok) {
        return ok ? { db: crearDB(juego), user: user, uid: uid, presencia: crearPresencia(juego) } : null;
      });
    }
  };
})();
