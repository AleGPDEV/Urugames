// Menú principal: la grilla de juegos, cada uno con Jugar solo, Reglas, Crear mesa y Ver mesas.
//
// Enlaces que arma para cada juego (juegos/<id>/index.html):
//   Jugar solo  → ?modo=solo&dificultad=normal
//   Reglas      → #reglas
//   Crear mesa  → ?modo=multi&sala=nueva      (solo si el juego tiene online: true)
//   Ver mesas   → ?modo=multi                  (abre el panel de mesas en línea del juego)
(function () {
  var ICONOS = {
    oros: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
    copas: '<path d="M6 3h12v4a6 6 0 0 1-12 0z"/><path d="M12 13v5"/><path d="M8 21h8"/>',
    espadas: '<path d="M12 2l2 3v10h-4V5z"/><path d="M7 15h10"/><path d="M12 15v6"/>',
    bastos: '<path d="M10 21c0-5 .5-11 1.5-16 .4-2 3.5-2 3.4.2C14.5 10 13.5 16 13 21z"/><path d="M10.8 10l-2.3-1M13.9 13l2.4-.8"/>'
  };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var grilla = document.getElementById('games');
  grilla.innerHTML = window.JUEGOS.map(function (j) {
    var base = 'juegos/' + j.id + '/index.html';
    var enLinea = j.online
      ? '<a class="btn-mesa" href="' + base + '?modo=multi&amp;sala=nueva">Crear mesa</a>' +
        '<a class="btn-mesa" href="' + base + '?modo=multi">Ver mesas</a>'
      : '<span class="btn-mesa off" aria-disabled="true">Crear mesa<small>Pronto</small></span>' +
        '<span class="btn-mesa off" aria-disabled="true">Ver mesas<small>Pronto</small></span>';
    return '<article class="game">' +
      '<div class="game-top">' +
        '<span class="suit ' + j.palo + '"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[j.palo] + '</svg></span>' +
        '<span class="players">' + esc(j.jugadores) + '</span>' +
      '</div>' +
      '<h2 class="game-name">' + esc(j.nombre) + '</h2>' +
      '<p class="game-desc">' + esc(j.desc) + '</p>' +
      '<div class="game-actions">' +
        '<a class="btn-play" href="' + base + '?modo=solo&amp;dificultad=normal">Jugar solo</a>' +
        '<a class="btn-rules" href="' + base + '#reglas">Reglas</a>' +
        enLinea +
      '</div>' +
    '</article>';
  }).join('');
})();
