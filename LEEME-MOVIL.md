# Copahue Field Campaign — versión MÓVIL (proyecto independiente)

Copia de `copahue-v8` (estado 14 oct 2026, v8.23) con capa móvil. **No comparte git ni carpeta con la versión de escritorio.**
Respaldo previo de v8: `SYSTEM/NEw/_respaldos/copahue-v8_antes-version-movil-2/` (verificado idéntico con `diff -r`).

## Qué cambia respecto a v8
- Solo modo cómic (se quitó `real.js`; el post-proceso cómic es el estilo del juego).
- Orientación **horizontal** (manifest `landscape` + aviso de girar en vertical).
- **Flujo de cámara**: personaje (grande) → COMENZAR → **mapa cenital** → al llegar a pie a un sitio (700 m; sale a 1,15 km) → **primera persona** (bidón, sonda, filtración 3D) → al terminar el sitio o alejarte vuelve al **mapa**. La radio solo suena conduciendo (v8.23).
- Mapa: zoom automático que encuadra jugador + objetivo, pellizco para zoom, doble toque = reencuadrar, tocar un sitio (radio 48 px) lo elige, flecha + distancia al objetivo, marcador "tú" con rumbo.
- Táctil: joystick, botones grandes (≥ 48 px), `safe-area-inset`, pantalla completa (⛶), PWA instalable (`manifest.webmanifest`, `sw.js`, iconos).
- Rendimiento: ver tabla. Overlay de métricas en el teléfono: abrir `…/index.html?perf=1`.

## Archivos nuevos / tocados
- Nuevos: `js/mobile.js`, `mobile.css`, `sw.js`, `manifest.webmanifest`, `icons/`.
- Ganchos mínimos (`MOB` / `__MOBILE` / `__CFC`) en `js/game.js`, `js/world.js`, `js/fpworld.js`, `index.html`.

## Mediciones (emulador Chromium 844×390 con render por software → solo valen en relativo; en un teléfono real usar `?perf=1`)
| | v8 (escritorio) | móvil, mapa | móvil, 1.ª persona |
|---|---|---|---|
| Triángulos por cuadro (MED) | 523 k | **307 k (−41 %)** | 471 k (−10 %) |
| Draw calls (MED) | 593 | **436 (−26 %)** | 625 |
| FPS relativos (software, MED) | 1,45 | 2,11 (+45 %) | 1,3 |
| Memoria JS | 100 MB | 102 MB | 103 MB |
| Descarga inicial (sin música) | 3,87 MB | 3,87 MB (2.ª visita ≈ 0 con service worker) | |

Con/sin post-proceso cómic: coste prácticamente igual en el emulador (cuello de botella = geometría), por eso se mantiene.
Hecho: tope 60 fps (en pantallas 120 Hz), DPR ≤ 1,5, sin sombras (no existe nivel HIGH), distancias de dibujo menores, menos nieve/lluvia (−58 %), capa de pasto de 1.ª persona oculta en el mapa, LOD más corto en el mapa, audio Opus con respaldo AAC y carga diferida (de v8), service worker.
Pendiente / no hecho: árboles de menor polígono (≈170 k tris), pasto en 1.ª persona aún pesado, KTX2 (la memoria de GPU no se midió en un teléfono real), WebGPU descartado a propósito.

## Publicar (necesita tu cuenta de GitHub)
```
cd /Users/issotta/proyectos/copahue-mobile
git remote add origin https://github.com/fissotta/copahue-mobile.git   # crea antes el repo vacío en GitHub
git push -u origin main
# GitHub → Settings → Pages → Branch: main / root
```
Link esperado: https://fissotta.github.io/copahue-mobile/
