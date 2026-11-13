---
name: ver-web
description: Comprueba una página web en un navegador real sin ver imágenes. Abre el HTML en Chromium headless en escritorio y móvil y devuelve texto con errores de consola, scroll horizontal, imágenes rotas, anclas sin destino y el resultado de acciones (clic, tecla, contar, visible). Usar al terminar o revisar una página con filtros, lightbox, menú hamburguesa o diseño responsive, y siempre antes de escribir "No comprobado" sobre el comportamiento en vivo. Avisa contraste bajo, botones chicos, filas huérfanas y secciones a medio ancho, y lista los colores usados; no juzga el resto de la estética.
---

# Ver web

No tienes visión: este script es tu navegador, y responde con texto. Úsalo en vez de decir "no hay navegador en este entorno".
El script está junto a este archivo: `"$Q38_KIT/skills/ver-web/ver-web.py"` (la variable `Q38_KIT` la pone el launcher). Necesita Playwright con Chromium: si falla el import, dile al usuario que corra `pip install playwright` y después `python -m playwright install chromium`. En Windows, si `python3` no existe, usa `python`.

## Uso
```
python3 "$Q38_KIT/skills/ver-web/ver-web.py" index.html                       # checks automáticos, escritorio 1280 y móvil 390
python3 "$Q38_KIT/skills/ver-web/ver-web.py" index.html ACCION ACCION ...     # además, las acciones en orden, en cada tamaño
```
Acciones (el selector es CSS y puede llevar espacios: `visible:#nav a`): `click:SEL` `hover:SEL` `key:Escape` `count:SEL` `visible:SEL` `text:SEL` `attr:SEL@href` `wait:MS` `reload` `contraste` `colores`
`count` cuenta solo los visibles; `click` pulsa el primero visible. `reload` recarga la página y conserva `localStorage`. Cada tamaño parte de cero (página y almacenamiento nuevos): no leas el script para averiguarlo.

## Procedimiento
1. Corre sin acciones primero: te dice scroll horizontal, qué elemento se sale, errores de consola, imágenes rotas, anclas rotas. Si aparece `contraste bajo` (texto que cuesta leer; trae la razón de contraste y los dos colores medidos: no los recalcules), `botones chicos` o `composición:` (en escritorio: una grilla con un elemento solo en la última fila, o una sección con la mitad derecha vacía), corrige y vuelve a correr. Es una pista medida: si el elemento es decorativo, dilo en el reporte y sigue.
2. Lee tu HTML y saca los selectores reales (`grep -n "class=" index.html | head -30`). No inventes selectores: si dice "el selector no existe", corrígelo.
3. Escribe UNA secuencia por función y compara antes/después. Ejemplos:
   - Filtros: `count:.card click:.chip count:.card` → el segundo número debe cambiar.
   - Lightbox: `visible:.lightbox click:.card visible:.lightbox key:ArrowRight text:.lightbox-caption key:Escape visible:.lightbox` → no, sí, texto distinto, no.
   - Hamburguesa: `visible:.hamburger` debe dar no en escritorio y sí en móvil; luego `click:.hamburger visible:nav`.
   - Paleta del encargo: `colores` lista los colores de texto y de fondo realmente usados; no debe haber ninguno ajeno a la paleta.
   - Modo oscuro que se recuerda: `click:#tema attr:html@data-theme contraste reload attr:html@data-theme` → el mismo valor antes y después de `reload`, y `contraste → ok` también en oscuro.
4. Corrige lo que falle y vuelve a correr la misma secuencia. Una función está bien cuando viste el cambio, no cuando el código "se ve bien".

## Reporte
- En `Comprobado:` pon el comando y las líneas literales que importan.
- En `No comprobado:` deja solo lo estético (aspecto, proporciones, armonía de colores, animaciones). Eso lo mira el usuario. Con `shot:ruta.png` puedes guardar una captura para que la vea él (no la intentes leer).
