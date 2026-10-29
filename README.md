# Urugames · Mesa de Naipes

Juegos de baraja española en el navegador: Truco, Chinchón, Conga, Escoba, Brisca, Tute, Mus, Siete y medio, Memoria, Culo sucio, Chancho va y Roba montón, en modo individual o multijugador.

Estado actual del desarrollo y próximos pasos: ver [ESTADO.md](ESTADO.md).

## Estructura

```
index.html            Menú principal (lobby)
css/lobby.css         Estilos del menú (colores en :root)
css/juego.css         Estilos de la página provisoria de cada juego
js/juegos.js          Lista de juegos que muestra el menú
js/lobby.js           Lógica del menú: modo, dificultad y enlaces
js/juego-base.js      Lee cómo se entró al juego (window.URUGAMES)
juegos/<id>/index.html  Un juego por carpeta
img/baraja.jpg        Mazo completo (12 columnas x 5 filas: oros, copas, espadas, bastos, dorso)
img/baraja-recortada.webp  La misma grilla sin el borde de cada celda
```

## Cómo se conecta el menú con cada juego

El botón **Jugar** de cada carta lleva a `juegos/<id>/index.html` con parámetros:

| Desde el menú                | URL                                               |
|------------------------------|---------------------------------------------------|
| Individual                   | `?modo=solo&dificultad=facil\|normal\|dificil`     |
| Multijugador · partida rápida| `?modo=multi&sala=rapida`                          |
| Multijugador · crear sala    | `?modo=multi&sala=nueva`                           |
| Multijugador · con código    | `?modo=multi&sala=CODIGO`                          |

Dentro del juego, `window.URUGAMES` trae `{ id, modo, dificultad, sala }`.

## Agregar un juego nuevo

1. Sumalo a `js/juegos.js` (id, nombre, palo, jugadores, descripción).
2. Creá `juegos/<id>/index.html` (podés copiar el de otro juego).

## Probarlo

Abrí `index.html` en el navegador, o activá **GitHub Pages** (Settings → Pages → rama `main`, carpeta raíz).
