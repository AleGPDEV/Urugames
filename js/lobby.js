// Lógica del menú principal: modo de juego, dificultad y enlaces a cada juego.
(function () {
  var ICONOS = {
    oros: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
    copas: '<path d="M6 3h12v4a6 6 0 0 1-12 0z"/><path d="M12 13v5"/><path d="M8 21h8"/>',
    espadas: '<path d="M12 2l2 3v10h-4V5z"/><path d="M7 15h10"/><path d="M12 15v6"/>',
    bastos: '<path d="M10 21c0-5 .5-11 1.5-16 .4-2 3.5-2 3.4.2C14.5 10 13.5 16 13 21z"/><path d="M10.8 10l-2.3-1M13.9 13l2.4-.8"/>'
  };

  // Estado guardado entre visitas (si el navegador lo permite)
  var estado = { modo: 'solo', dificultad: 'normal', elegido: 'truco' };
  try {
    var guardado = JSON.parse(localStorage.getItem('urugames-lobby') || '{}');
    Object.assign(estado, guardado);
  } catch (e) {}
  function guardar() {
    try { localStorage.setItem('urugames-lobby', JSON.stringify(estado)); } catch (e) {}
  }

  // Arma el enlace a un juego con el modo y la dificultad elegidos.
  // Cada juego recibe: juegos/<id>/index.html?modo=solo&dificultad=normal
  //                o:  juegos/<id>/index.html?modo=multi[&sala=CODIGO]
  function enlaceJuego(id, extra) {
    var p = new URLSearchParams({ modo: estado.modo });
    if (estado.modo === 'solo') p.set('dificultad', estado.dificultad);
    if (extra) Object.keys(extra).forEach(function (k) { p.set(k, extra[k]); });
    return 'juegos/' + id + '/index.html?' + p.toString();
  }

  var grilla = document.getElementById('games');

  function dibujarJuegos() {
    var cta = estado.modo === 'solo' ? 'Jugar' : 'Buscar mesa';
    grilla.innerHTML = '';
    window.JUEGOS.forEach(function (j) {
      var art = document.createElement('article');
      art.className = 'game' + (estado.elegido === j.id ? ' selected' : '');
      art.innerHTML =
        '<button class="game-select" aria-label="Seleccionar ' + j.nombre + '">' +
          '<div class="game-top">' +
            '<span class="suit ' + j.palo + '"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[j.palo] + '</svg></span>' +
            '<span class="players">' + j.jugadores + '</span>' +
          '</div>' +
          '<span class="game-name">' + j.nombre + '</span>' +
          '<span class="game-desc">' + j.desc + '</span>' +
        '</button>' +
        '<div class="game-actions">' +
          '<a class="btn-play" href="' + enlaceJuego(j.id) + '">' + cta + '</a>' +
          '<a class="btn-rules" href="juegos/' + j.id + '/index.html#reglas">Reglas</a>' +
        '</div>';
      art.querySelector('.game-select').addEventListener('click', function () {
        estado.elegido = j.id; guardar(); dibujarJuegos();
      });
      grilla.appendChild(art);
    });
  }

  function aplicarModo() {
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === estado.modo));
    });
    document.querySelectorAll('[data-level]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.level === estado.dificultad));
    });
    document.getElementById('panel-solo').hidden = estado.modo !== 'solo';
    document.getElementById('panel-multi').hidden = estado.modo !== 'multi';
    document.getElementById('mode-hint').textContent = estado.modo === 'solo'
      ? 'Modo individual · contra la máquina'
      : 'Modo multijugador · en línea';
    var rapida = document.querySelector('.multi-card.gold');
    var sala = document.querySelector('.multi-card:not(.gold):not(form)');
    rapida.href = enlaceJuego(estado.elegido, { sala: 'rapida' });
    sala.href = enlaceJuego(estado.elegido, { sala: 'nueva' });
    dibujarJuegos();
  }

  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { estado.modo = b.dataset.mode; guardar(); aplicarModo(); });
  });
  document.querySelectorAll('[data-level]').forEach(function (b) {
    b.addEventListener('click', function () { estado.dificultad = b.dataset.level; guardar(); aplicarModo(); });
  });

  // Unirse a una sala con código: va al juego seleccionado con ese código
  document.getElementById('join-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var codigo = document.getElementById('codigo-sala').value.trim().toUpperCase();
    if (!codigo) return;
    location.href = enlaceJuego(estado.elegido, { sala: codigo });
  });

  aplicarModo();
})();
