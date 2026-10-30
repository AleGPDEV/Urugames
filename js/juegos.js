// Lista de juegos del lobby.
// Para agregar un juego nuevo: sumá un objeto acá y creá su carpeta en /juegos/<id>/
// "palo" define el ícono: oros | copas | espadas | bastos
// "online: true" habilita Crear mesa y Ver mesas (el juego tiene que usar js/mesas.js)
window.JUEGOS = [
  { id: 'truco',       nombre: 'Truco',         palo: 'espadas', jugadores: '2, 4 o 6',    desc: 'Envido, truco y flor. Engañá al rival y cantá en el momento justo.', online: true },
  { id: 'conga',       nombre: 'Conga',         palo: 'copas',   jugadores: '2 o 3',       desc: 'Ligá piernas y escaleras, cortá con 5 o menos y no te pases de 100.', online: true },
  { id: 'escoba',      nombre: 'Escoba',        palo: 'bastos',  jugadores: '2',           desc: 'Sumá 15 con las cartas de la mesa y barré para hacer escoba.' },
  { id: 'sieteymedio', nombre: 'Siete y medio', palo: 'bastos',  jugadores: '2 o más',     desc: 'Acercate a siete y medio sin pasarte. Las figuras valen medio.' },
  { id: 'culosucio',   nombre: 'Culo sucio',    palo: 'oros',    jugadores: '2 a 4',       desc: 'Sacá cartas a ciegas, tirá pares y no te quedes con el 1 de oros.' },
  { id: 'chanchova',   nombre: 'Chancho va',    palo: 'copas',   jugadores: '4',           desc: 'Pasá cartas, juntá cuatro iguales y golpeá la mesa. Ojo con los amagues.' },
  { id: 'robamonton',  nombre: 'Roba montón',   palo: 'copas',   jugadores: '2 a 4',       desc: 'Jugá una carta igual a la de arriba de un montón rival y robátelo entero.' },
  { id: 'memoria',     nombre: 'Memoria',       palo: 'oros',    jugadores: '1 a 4',       desc: 'Dá vuelta dos cartas y encontrá las parejas antes que tus rivales.' }
];
