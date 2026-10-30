# Urugames · Mesa de Naipes

Juegos de baraja española en el navegador: Truco, Conga, Escoba, Siete y medio, Memoria, Culo sucio, Chancho va y Roba montón, en modo individual o multijugador.

Estado actual del desarrollo y próximos pasos: ver [ESTADO.md](ESTADO.md).

## Estructura

```
index.html            Menú principal (lobby)
css/lobby.css         Estilos del menú (colores en :root)
css/juego.css         Estilos de la página provisoria de cada juego
js/juegos.js          Lista de juegos que muestra el menú
js/lobby.js           Lógica del menú: modo, dificultad y enlaces
js/juego-base.js      Lee cómo se entró al juego (window.URUGAMES)
js/online.js          Conexión con Firebase (js/firebase-config.js tiene los datos del proyecto)
js/mesas.js           Mesas en línea comunes a todos los juegos: crear, unirse, sala de espera y limpieza
js/previa.js          Pantalla previa común de "Jugar solo": dificultad y opciones antes de repartir (css/previa.css)
juegos/<id>/index.html  Un juego por carpeta
img/baraja.jpg        Mazo completo (12 columnas x 5 filas: oros, copas, espadas, bastos, dorso)
img/baraja-recortada.webp  La misma grilla sin el borde de cada celda
```

## Cómo se conecta el menú con cada juego

Cada carta del menú lleva a `juegos/<id>/index.html` con parámetros:

| Botón del menú | URL                        | Qué pasa en el juego                                   |
|----------------|----------------------------|--------------------------------------------------------|
| Jugar solo     | `?modo=solo`               | Pantalla previa común (`js/previa.js`): dificultad y opciones |
| Reglas         | `#reglas`                  | Va a las reglas del juego                              |
| Crear mesa     | `?modo=multi&sala=nueva`   | Abre una mesa en línea                                 |
| Ver mesas      | `?modo=multi`              | Muestra el panel de mesas en línea                     |

También se aceptan `?modo=multi&sala=rapida`, `?modo=multi&sala=CODIGO` y `?modo=solo&dificultad=facil|normal|dificil` (preselecciona la dificultad).

Dentro del juego, `window.URUGAMES` trae `{ id, modo, dificultad, sala }`.

## Agregar un juego nuevo

1. Sumalo a `js/juegos.js` (id, nombre, palo, jugadores, descripción).
2. Creá `juegos/<id>/index.html` (podés copiar el de otro juego).
3. Para jugar solo, usá `UruPrevia.crear` de `js/previa.js` (ver cualquier juego), así todos arrancan igual.
4. Para jugarlo en línea, usá `UruMesas.crear` de `js/mesas.js` (ver Truco o Conga), así todos los juegos se entran igual.

## Probarlo

Abrí `index.html` en el navegador, o activá **GitHub Pages** (Settings → Pages → rama `main`, carpeta raíz).
