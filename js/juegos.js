// Lista de juegos del lobby.
// Para agregar un juego nuevo: sumá un objeto acá y creá su carpeta en /juegos/<id>/
// "palo" define el ícono: oros | copas | espadas | bastos
window.JUEGOS = [
  { id: 'truco',       nombre: 'Truco',         palo: 'espadas', jugadores: '2, 4 o 6',    desc: 'Envido, truco y flor. Engañá al rival y cantá en el momento justo.' },
  { id: 'chinchon',    nombre: 'Chinchón',      palo: 'oros',    jugadores: '2 a 6',       desc: 'Armá escaleras y grupos para cortar antes que nadie.' },
  { id: 'conga',       nombre: 'Conga',         palo: 'copas',   jugadores: '2 a 6',       desc: 'Juntá combinaciones y bajate con la menor cantidad de puntos.' },
  { id: 'escoba',      nombre: 'Escoba',        palo: 'bastos',  jugadores: '2 a 4',       desc: 'Sumá 15 con las cartas de la mesa y barré para hacer escoba.' },
  { id: 'brisca',      nombre: 'Brisca',        palo: 'oros',    jugadores: '2 a 4',       desc: 'Ganá bazas con el triunfo y llevate las cartas que más valen.' },
  { id: 'tute',        nombre: 'Tute',          palo: 'copas',   jugadores: '2 a 4',       desc: 'Cantá las veinte y las cuarenta, o cerrá con un tute.' },
  { id: 'mus',         nombre: 'Mus',           palo: 'espadas', jugadores: '4 (parejas)', desc: 'Grande, chica, pares y juego. Señas con tu compañero y órdago.' },
  { id: 'sieteymedio', nombre: 'Siete y medio', palo: 'bastos',  jugadores: '2 o más',     desc: 'Acercate a siete y medio sin pasarte. Las figuras valen medio.' }
];
