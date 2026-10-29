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

## Qué falta

### Juegos
Truco, Chinchón, Conga, Escoba, Brisca, Tute, Mus y Siete y medio son **páginas provisorias** que dicen "Próximamente" y tienen las reglas sin escribir.

### Fichas diarias (sin empezar)
Es el núcleo de la idea competitiva. Pensado así:
- Cada partida descuenta una ficha antes de repartir. Si el jugador abandona, la ficha se pierde igual.
- Cada juego debería avisar al terminar con un resultado común, por ejemplo `{ juego, resultado: 'gano'|'perdio'|'empate', puntaje, tiempo }`, para alimentar el ranking.
- Las fichas y el ranking **tienen que estar en un servidor**. Si se guardan solo en el navegador, alcanza con borrar los datos o cambiar de dispositivo para tener fichas nuevas.

### Multijugador en línea (sin empezar)
- El lobby ya arma los enlaces de sala (`rapida`, `nueva` o un código), pero no hay servidor detrás.
- Hace falta definir un backend: WebSockets o un servicio como Firebase o Supabase.

### Lobby
Estos elementos están en la pantalla pero todavía no hacen nada:
- Perfil (`#perfil`)
- Botón de configuración
- Enlaces del pie: Cómo jugar, Ranking y Ajustes

## Próximos pasos sugeridos

1. Definir el backend: usuarios, fichas diarias y ranking.
2. Armar un módulo común en `js/` para consumir una ficha al entrar y reportar el resultado al salir, y conectarlo primero con Memoria.
3. Programar los juegos uno por uno, usando `img/baraja.jpg` y `window.URUGAMES`.
4. Multijugador en línea.

## Historial de cambios

| Fecha | Cambio |
|---|---|
| — | Lobby con enlaces a cada juego y páginas provisorias (commit `c466d8d`) |
| 29/10/2026 | Juego **Memoria** completo (solo, vs 1, vs 2, vs 3), mazo `img/baraja.jpg`, Memoria agregada a `js/juegos.js` y README actualizado |
| 29/10/2026 | Este documento de estado |
| 29/10/2026 | Juego **Culo sucio** completo (vs 1, 2 o 3 rivales de la compu) y agregado a `js/juegos.js` |
