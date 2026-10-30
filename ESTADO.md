# Estado del proyecto · Urugames

Última actualización: 29/10/2026

Este documento resume hasta dónde está desarrollada la app y qué falta, para que quien siga sepa por dónde arrancar. La estructura de carpetas y cómo agregar un juego están en el [README](README.md).

## La idea

Una plataforma de juegos de cartas clásicos con baraja española, todos accesibles desde un mismo lobby y en modo competitivo. Cada jugador tiene **fichas diarias limitadas** para entrar a las partidas.

## Qué está hecho

### Lobby (`index.html`, `css/lobby.css`, `js/lobby.js`, `js/juegos.js`)
- Menú principal con la grilla de juegos, generada desde `js/juegos.js`.
- Selector de modo: **Individual** (con dificultad Fácil, Normal o Difícil) y **Multijugador** (partida rápida, crear sala o unirse con código).
- El botón Jugar abre `juegos/<id>/index.html` con parámetros en la URL. La tabla completa está en el README.
- El modo, la dificultad y el juego elegido se recuerdan en `localStorage` (clave `urugames-lobby`).
- `js/juego-base.js` lee los parámetros y los deja en `window.URUGAMES = { id, modo, dificultad, sala }`.

### Mazo (`img/baraja.jpg`)
- Imagen con las 48 cartas y el dorso, ordenada en una grilla de 12 columnas × 5 filas:
  - Columnas: del 1 al 12.
  - Filas: oros, copas, espadas, bastos, y en la última fila una carta en blanco y el dorso.
- Se usa como *sprite* con CSS: `background-size: 1200% 500%` y `background-position: (columna/11·100)% (fila/4·100)%`. El ejemplo está en `juegos/memoria/memoria.css` y en la función `pos()` de `memoria.js`.
- `img/baraja-recortada.webp` es la misma grilla sin el borde negro de cada celda, más liviana (la usa Conga).
- Es el mazo "Naipes Libres", de licencia libre. **Antes de publicar, revisar qué atribución pide su licencia.**

### Memoria (`juegos/memoria/`) · jugable
- Modos: Solo, vs 1, vs 2 o vs 3, contra la compu o con amigos por turnos en el mismo dispositivo.
- Toma la configuración del lobby:
  - Individual: juega contra la compu, y la dificultad define las parejas (Fácil 6, Normal 8, Difícil 12).
  - Multijugador: queda "con amigos" en local y muestra un aviso de que el modo en línea no existe todavía.
- La compu recuerda cada carta vista con un 80 % de probabilidad.
- Cuenta parejas, jugadas y tiempo, y al final declara ganador o empate.

### Culo sucio (`juegos/culosucio/`) · jugable
- Vos contra 1, 2 o 3 rivales de la compu, con mazo de 40 o 48 cartas.
- El 1 de oros es el culo sucio y no hace par con nada. Antes de repartir se saca uno de los otros ases para que queden parejos.
- Mesa en anillo: flechas con el sentido de la ronda y una flecha dorada que muestra de quién saca el jugador de turno.
- Desde Multijugador muestra el aviso de que el modo en línea no existe y se juega contra la compu.
- Todavía no usa la dificultad del menú: la compu saca al azar.

### Conga (`juegos/conga/`) · jugable, también en línea
- 2 o 3 jugadores, contra la compu o con amigos en línea. Contra la compu se elige con los botones de abajo de la planilla y queda guardado en `localStorage` (clave `urugames-conga`).
- Baraja de 50 cartas: del 1 al 12 de cada palo y 2 comodines. Se reparten 7.
- Reglas implementadas:
  - Piernas (3 o 4 del mismo número) y escaleras (3 o más seguidas del mismo palo). El comodín reemplaza cualquier carta.
  - Se corta al tirar si lo suelto suma 5 o menos. Cortar con todo ligado vale −10.
  - El comodín suelto vale 50.
  - La carta levantada del pozo no se puede tirar en el mismo turno.
  - Conga (cortar con una escalera de 7 del mismo palo) gana la partida en el acto.
  - Con 2 jugadores, el que pasa de 100 pierde. Con 3, queda afuera y gana el último que queda.
- Sin ayudas en pantalla: no se marcan las combinaciones ni se muestran los puntos sueltos. Si el jugador intenta cortar sin poder, se le avisa.
- Mano en abanico que se ordena arrastrando las cartas (o con las flechas del teclado). Para tirar, se toca una carta y se aprieta Tirar, o se suelta sobre el pozo.
- Animaciones de reparto de a una carta, de levantar del mazo o del pozo y de tirar. Se saltean si el sistema pide reducir movimiento.
- Planilla en hoja de cuadernola con el total acumulado por mano.
- Usa la dificultad del menú:
  - Fácil: la compu solo levanta del pozo si le sirve para cortar, y a veces tira cualquier carta.
  - Normal: juega por heurística (puntos sueltos y cartas que casi forman jugada).
  - Difícil: igual que Normal, y además evita tirar cartas parecidas a las que el jugador levantó del pozo.
- **En línea (Firebase):** usa `js/online.js`, igual que el Truco.
  - Desde el menú, *Crear sala* abre una mesa nueva, *Partida rápida* se sienta en la primera mesa abierta (o abre una) y *Unirse con código* entra a esa mesa.
  - En la página, el desplegable "Jugar en línea con amigos" tiene tu nombre, abrir mesa (de 2 o 3, según lo elegido abajo), unirse con código y la lista de mesas.
  - Entra con `js/mesas.js`, igual que el Truco. Cada mesa es `conga/mesas/<CÓDIGO>`; `g` es la partida entera.
  - Escribe la partida quien juega: cada persona su turno, y quien abrió la mesa juega los lugares de la compu y reparte cada mano.
  - Cada jugada se guarda como un evento (`g.ev`: reparto, levantar o tirar) y las demás pantallas la animan igual que la propia.
  - Los lugares libres los puede jugar la máquina ("Empezar con la máquina en los libres").
  - Con 3, el que pasa de 100 queda afuera y sigue mirando la partida.
  - Probado con dos pantallas simuladas (mesa de 2 y mesa de 3 con la máquina), incluido el corte y la mano siguiente.
- **Resultado:** al terminar la partida emite `urugames:resultado` con `{ juego, resultado, puntaje, tiempo, jugadores }`, como Truco y Escoba.
- **Pendiente en línea:**
  - Igual que en el Truco, las cartas de todos viajan en el mismo documento: alguien con conocimientos podría ver las ajenas o hacer trampa. Para competir con fichas, el reparto y la validación tienen que pasar a un servidor.
  - Si alguien se va en medio de la partida, la mesa queda esperando su turno. Si se va quien abrió la mesa, se frena la compu y no se reparte la mano siguiente. Falta un tiempo límite por turno o que otro tome su lugar.
- Diseño propio, distinto al del lobby (mesa de madera). Tiene su propio `conga.css` y no carga `css/lobby.css`.
- No descuenta fichas: queda para cuando exista el módulo común.

### Chancho va (`juegos/chanchova/`) · jugable
- Vos contra 3 rivales de la compu (Tito, La Negra y Pocho), con los 1, 7, 10 y 12 de los cuatro palos: 16 cartas, cuatro por jugador.
- Cada vuelta elegís una carta (tocándola) y todos pasan a la izquierda al mismo tiempo. Tocar dos veces la misma carta también la pasa.
- Botón grande **¡CHANCHO!** para golpear la mesa. El último en golpear se lleva una letra; golpear sin cuatro iguales también cuesta letra. Quien completa CHANCHO pierde.
- **Amagues**: después de algunas pasadas un rival grita "¡CHAN…!" y su recuadro se sacude igual que cuando golpea de verdad. Si era amague y tocás la mesa, te llevás letra. Los otros rivales también pueden caer. Se apaga con el botón "Amagues".
- Usa la dificultad del menú: cambia qué tan rápido golpean los rivales, cuánto amagan y qué tan seguido caen en amagues ajenos (tabla `DIF` en `chanchova.js`).
- La compu se queda con el número que más tiene y pasa del que menos tiene, con un 12 % de error.
- Desde Multijugador muestra el aviso de que el modo en línea no existe y se juega contra la compu.

### Roba montón (`juegos/robamonton/`) · jugable
- Vos contra 1, 2 o 3 rivales de la compu, con el mazo de 48 cartas.
- Se ponen 4 cartas en el centro y se reparten 4 a cada uno; cuando se vacían las manos se vuelve a repartir hasta agotar el mazo.
- Al jugar una carta, en este orden: roba el montón del rival que tenga arriba el mismo número (el más grande si hay varios), levanta las cartas iguales del centro, la suma al propio montón o la deja en el centro. Gana el montón más grande.
- Mesa en anillo con flechas del sentido del turno. El centro es grande y achica las cartas solo cuando se juntan muchas.
- Animaciones con la Web Animations API: reparto desde el mazo, cartas que vuelan al centro o al montón y montones robados que viajan al que los roba. Respeta `prefers-reduced-motion`.
- Cada carta de tu mano muestra antes de jugarla qué va a pasar (Robás, Levantás, Sumás, Al centro).
- **Usa la dificultad del menú**: Fácil juega casi al azar, Normal elige la jugada que más cartas le da y Difícil además cuida su montón según las cartas que ya salieron.
- Desde Multijugador muestra el aviso de que el modo en línea no existe y se juega contra la compu.

### Truco uruguayo (`juegos/truco/`) · jugable
- Archivos: `index.html`, `truco.css`, `truco.js` y los audios de los cantos en `snd/grave/` y `snd/aguda/`.
- **Reglas:** truco uruguayo con muestra y piezas.
  - Piezas: 2, 4, 5, caballo y sota del palo de la muestra. Si la muestra es pieza, el rey toma su lugar.
  - Matas: 1 de espadas, 1 de bastos, 7 de espadas y 7 de oros.
  - Pardas con las reglas habituales.
- **Envido:** envido, real envido y falta envido. Se acumulan hasta envido-envido y real-real. No querido vale lo acumulado hasta el canto anterior.
- **Flor:** vale 3 y anula el envido. Si los dos equipos tienen flor, se responde con *la mía flor* (se compara al final, 3 puntos), *con flor envido* (5) o *contra flor al resto*.
- **Truco:** truco, retruco y vale cuatro. Solo sube el equipo que aceptó el último canto. "El envido va primero" como respuesta al truco en la primera baza. Se puede ir al mazo.
- **Jugadores:** 2, 4 o 6, en equipos sentados alternados. En equipo, el envido y la flor cuentan el mejor de cada equipo. Los cantos los responde el rival que sigue en la ronda.
- **Pico a pico (6 jugadores, opcional):** mientras los dos equipos están en malas, se alterna una mano redonda con una de picos. En la de picos se juegan tres picos uno contra uno, con el rival de enfrente. La falta envido vale 6 y la contra flor al resto 12.
- **Partida:** a 30 o a 40 puntos, con malas y buenas.
- **Mesa en ronda:**
  - Vos abajo y los demás alrededor en el orden de juego.
  - Cada carta jugada aparece delante de su jugador.
  - El mazo con la muestra queda al lado del mano. Al tocarlo, la muestra se ve en grande.
  - Se ven las cartas de los compañeros, nunca las de los rivales.
- **Pizarrón** con los puntos en rayas de a cinco, la crónica de la mano y reglas rápidas.
- **Animaciones:** reparto, carta que vuela a la mesa, mazo que pasa al nuevo mano y pulso en la carta ganadora. Respetan "reducir movimiento".
- **Reparto automático:** la siguiente mano o pico arranca solo a los 3 segundos. También hay un botón "Repartir ya".
- **Audios de todos los cantos:** grabaciones limpias de ruido. Tu equipo suena con voz grave y el rival con voz aguda. Hay un botón para silenciar.
- **Sin ayudas en la mesa:** no se marcan piezas ni matas ni se muestra el envido.
- **Configuración del lobby:**
  - Toma `window.URUGAMES`. La dificultad cambia a la compu: en Fácil tira al azar a veces y canta peor; en Difícil arriesga menos.
  - **En línea (Firebase):** usa `js/online.js` y las mesas comunes de `js/mesas.js`. Desde el menú, *Crear sala* abre una mesa nueva, *Partida rápida* se sienta en la primera mesa abierta (o abre una) y *Unirse con código* entra a esa mesa. En la página del Truco está el recuadro "Con amigos en línea" con tu nombre, el código y la lista de mesas. Los lugares libres los puede jugar la máquina. Probado con dos jugadores simulados en una partida completa.
- **Resultado:** al terminar la partida emite el evento `urugames:resultado` con `{ juego, resultado, puntaje, tiempo, jugadores }`, pensado para el ranking.
- **Probado** con 600 partidas simuladas (200 de 2, de 4 y de 6) sin trabarse.
- **Pendiente:**
  - En línea, las cartas de todos viajan en el mismo documento y cada jugador escribe la partida: alguien con conocimientos podría ver las cartas ajenas o hacer trampa. Para competir con fichas, el reparto y la validación tienen que pasar a un servidor (por ejemplo Cloud Functions).
  - Las señas entre compañeros no existen (se ven las cartas del compañero).
  - Faltan audios para "Está bien" y "Son buenas".

### Escoba de 15 (`juegos/escoba/`) · jugable
- Archivos: `index.html`, `escoba.css` y `escoba.js`. Usa `img/baraja.jpg` como los demás juegos.
- Vos contra la compu, partida a 15 puntos. Mazo de 40 cartas (sin 8 ni 9): la sota vale 8, el caballo 9 y el rey 10. Las figuras muestran "vale 8/9/10" en la carta.
- Reglas implementadas:
  - 4 cartas en la mesa y 3 a cada uno. Si la mesa inicial suma 15 (o 30), el que reparte se la lleva y hace una escoba (o dos).
  - Se levanta con una carta de la mano más cartas de la mesa que sumen 15. Dejar la mesa vacía es escoba.
  - Se vuelve a repartir de a 3 hasta agotar el mazo. Lo que queda en la mesa es para el último que levantó.
  - Puntos por mano: cada escoba, más cartas, más oros, más sietes y el 7 de oros (1 cada uno; empate no suma). Gana el primero que llega a 15 con más puntos que el otro.
- Para jugar se toca una carta de la mano, después las de la mesa, y se aprieta **Llevar**; o **Tirar** para dejarla en la mesa. Debajo de la mesa se ve la suma de lo elegido.
- Botón **Pista**: marca en verde la mejor levantada, o dice qué carta conviene tirar.
- Las cartas que levanta la compu se marcan antes de llevárselas.
- Planilla al final de cada mano con escobas, cartas, oros, sietes y 7 de oros.
- Usa la dificultad del menú:
  - Fácil: a veces no ve la levantada y tira cualquier carta, y si levanta elige al azar.
  - Normal: elige la levantada que más le conviene, pero la mitad de las veces no cuida lo que deja en la mesa.
  - Difícil: además tira siempre la carta que menos chances le da al jugador (sobre todo, que no pueda hacer escoba).
- Desde Multijugador muestra el aviso de que el modo en línea no existe y se juega contra la compu.
- **Resultado:** al terminar la partida emite `urugames:resultado` con `{ juego, resultado, puntaje, tiempo, jugadores }`, igual que Truco.
- **Probado** con 34 partidas automáticas en dificultad Difícil, sin errores.
- **Pendiente:** solo 2 jugadores (el menú lo indica así). Falta la variante de 3 o 4 jugadores y en parejas.

## Qué falta

### Juegos
Siete y medio es una **página provisoria** que dice "Próximamente" y tiene las reglas sin escribir. Chinchón, Brisca, Tute y Mus se sacaron del menú el 30/10/2026 porque no se van a hacer por ahora.

### Fichas diarias (sin empezar)
Es el núcleo de la idea competitiva. Pensado así:
- Cada partida descuenta una ficha antes de repartir. Si el jugador abandona, la ficha se pierde igual.
- Cada juego debería avisar al terminar con un resultado común, por ejemplo `{ juego, resultado: 'gano'|'perdio'|'empate', puntaje, tiempo }`, para alimentar el ranking.
- Las fichas y el ranking **tienen que estar en un servidor**. Si se guardan solo en el navegador, alcanza con borrar los datos o cambiar de dispositivo para tener fichas nuevas.

### Multijugador en línea (Truco y Conga)
- Backend elegido: **Firebase** (Realtime Database + inicio de sesión anónimo).
- `js/firebase-config.js`: datos del proyecto. Si está vacío, los juegos avisan que el modo en línea no está configurado y se juega contra la compu.
- `js/online.js`: módulo común. `UruOnline.init('<juego>')` devuelve `{ db, user, uid }`; `db.doc('mesas/ABCD')` y `db.collection('mesas')` guardan cada mesa como JSON en `<juego>/mesas/<código>`. El nombre del jugador se guarda en `perfiles/<uid>`.
- `js/mesas.js`: **la misma forma de entrar en todos los juegos.** `UruMesas.crear({...})` arma el panel "en línea" (nombre, abrir mesa, unirse con código, tus mesas y las que esperan gente), toma la sala elegida en el menú (`nueva`, `rapida` o un código), muestra la sala de espera con el código y "Empezar con la máquina en los libres", y guarda la partida en orden (`rev`). Cada juego solo dice cómo arma la partida (`nuevaPartida`) y qué hace cuando llega una jugada (`alEstado`). El comentario de arriba del archivo explica cómo conectarlo. Truco y Conga ya lo usan.
- **Mesas vacías:** cada pantalla anota que está en la mesa en `presencia/<juego>/<código>/<uid>`, y Firebase lo borra solo al cerrar la pestaña o cortarse la conexión. Cuando el último sale de una mesa, la mesa se borra. Si todos cerraron la pestaña, la borra cualquiera que abra la lista de mesas de ese juego (después de 90 segundos sin nadie).
- `database.rules.json`: reglas de la base. **Se agregó `presencia`: hay que volver a copiarlas en la consola.** Mientras las reglas viejas sigan puestas, no se borra ninguna mesa (se comprueba antes). Hay que copiarlas en la consola de Firebase (Realtime Database → Reglas), porque el modo de prueba vence a los 30 días.
- Para sumar un juego: cargar `js/firebase-config.js`, `js/online.js` y `js/mesas.js`, y llamar a `UruMesas.crear`.
- Falta: Culo sucio, Chancho va, Roba montón y Memoria.

### Lobby
Estos elementos están en la pantalla pero todavía no hacen nada:
- Perfil (`#perfil`)
- Botón de configuración
- Enlaces del pie: Cómo jugar, Ranking y Ajustes

## Próximos pasos sugeridos

1. Definir el backend: usuarios, fichas diarias y ranking.
2. Armar un módulo común en `js/` para consumir una ficha al entrar y reportar el resultado al salir, y conectarlo primero con Memoria.
3. Programar los juegos que faltan, usando `img/baraja.jpg` y `window.URUGAMES`.
   Para el ranking, Truco, Escoba y Conga ya emiten `urugames:resultado`; conviene que los demás juegos hagan lo mismo.
4. Multijugador en línea.

## Historial de cambios

| Fecha | Cambio |
|---|---|
| — | Lobby con enlaces a cada juego y páginas provisorias (commit `c466d8d`) |
| 29/10/2026 | Juego **Memoria** completo (solo, vs 1, vs 2, vs 3), mazo `img/baraja.jpg`, Memoria agregada a `js/juegos.js` y README actualizado |
| 29/10/2026 | Este documento de estado |
| 29/10/2026 | Juego **Culo sucio** completo (vs 1, 2 o 3 rivales de la compu) y agregado a `js/juegos.js` |
| 29/10/2026 | Juego **Conga** completo (2 o 3 jugadores contra la compu, dificultad del menú), `img/baraja-recortada.webp` y Conga actualizada en `js/juegos.js` (2 o 3 jugadores) |
| 29/10/2026 | Juego **Chancho va** completo (vs 3 rivales de la compu, con amagues y dificultad del menú), agregado a `js/juegos.js` y al README |
| 29/10/2026 | Juego **Roba montón** completo (vs 1, 2 o 3 rivales de la compu, con animaciones y dificultad del menú), agregado a `js/juegos.js` y al README |
| 29/10/2026 | Juego **Truco uruguayo** completo: 2, 4 o 6 jugadores, pico a pico, flor y contraflor, mesa en ronda, animaciones, reparto automático y audios de los cantos |
| 29/10/2026 | Juego **Escoba de 15** completo (vos contra la compu, a 15 puntos, pista y dificultad del menú). En `js/juegos.js` pasa a 2 jugadores |
| 29/10/2026 | **Multijugador en línea** con Firebase: módulo común `js/online.js`, reglas `database.rules.json` y Truco conectado (crear sala, partida rápida y unirse con código desde el menú) |
| 29/10/2026 | **Conga en línea** con Firebase: mesas de 2 o 3 (crear sala, partida rápida y unirse con código), jugadas animadas en todas las pantallas, lugares libres para la máquina y evento `urugames:resultado` |
| 29/10/2026 | **Mesas en línea comunes** (`js/mesas.js`): Truco y Conga entran igual (panel, sala de espera, sala del menú). Las mesas sin nadie adentro se borran solas (presencia en Firebase; hay que actualizar las reglas en la consola) |
| 30/10/2026 | Menú sin selector de modo: cada juego con Jugar solo, Reglas, Crear mesa y Ver mesas. Se sacan Chinchón, Brisca, Tute y Mus |
