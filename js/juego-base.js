// Página provisoria de cada juego. Lee el modo que eligió el jugador en el menú
// y lo muestra. Cuando programes el juego, reemplazá el contenido de
// juegos/<id>/index.html y usá window.URUGAMES para saber cómo se entró.
(function () {
  var id = document.body.dataset.juego;
  var p = new URLSearchParams(location.search);
  var info = {
    id: id,
    modo: p.get('modo') || 'solo',
    dificultad: p.get('dificultad'),
    sala: p.get('sala')
  };
  window.URUGAMES = info;

  var juego = (window.JUEGOS || []).find(function (j) { return j.id === id; }) || { nombre: id };
  document.title = juego.nombre + ' · Mesa de Naipes';
  document.getElementById('nombre').textContent = juego.nombre;

  var nombresDif = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
  var detalle;
  if (info.modo === 'multi') {
    if (info.sala === 'rapida') detalle = 'Multijugador · partida rápida';
    else if (info.sala === 'nueva') detalle = 'Multijugador · sala privada nueva';
    else if (info.sala) detalle = 'Multijugador · sala ' + info.sala;
    else detalle = 'Multijugador';
  } else {
    detalle = 'Individual · dificultad ' + (nombresDif[info.dificultad] || 'Normal');
  }
  document.getElementById('modo').textContent = detalle;
})();
