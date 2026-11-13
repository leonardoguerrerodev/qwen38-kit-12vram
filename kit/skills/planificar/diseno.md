# Diseño de una interfaz

Se decide una vez, en el plan, y después solo se aplica. No traigas un diseño de memoria: sale del encargo.

## De dónde sale (en este orden)
1. **El pedido:** si trae paleta, tipografías, estilo o iconos, eso manda. Copia los colores tal cual a variables CSS: no cambies tonos, no sumes colores.
2. **`DISENO.md` en la carpeta del proyecto:** si existe, léelo; manda igual que el pedido.
3. **Si no hay nada:** elige según el rubro y el público del proyecto, y dilo en una línea del plan para que el usuario lo corrija.

## Roles, no colores sueltos
Asigna cada color del encargo a un rol y úsalo solo por su variable: fondo, superficie, texto, texto suave, acento, acento usado como texto, borde.
- Si falta un rol (el encargo trae tres colores y necesitas seis), derívalo de los que hay (el mismo tono más claro o más oscuro), no de otro color.
- El modo oscuro usa los mismos roles con otros valores.
- Si `ver-web` avisa contraste bajo, ajusta ese rol (el aviso trae los dos colores) y anota en el reporte qué tono cambiaste respecto del encargo.

## Antes de dar la etapa por buena
- ¿Cabecera, secciones y pie comparten el mismo borde izquierdo y derecho?
- ¿La última fila de cada grilla queda completa en escritorio? Si sobra un elemento, cambia las columnas o la cantidad.
- ¿Cada sección ocupa su ancho? Dos bloques cortos van lado a lado, no apilados con media pantalla vacía.
- ¿Hay un solo acento, y aparece en más de un lugar?
- ¿Los textos hablan de este negocio (nombres, lugares, horarios concretos) y no son relleno genérico?
- ¿Los iconos son los que pidió el encargo? Si usas uno por elemento, que no sea el mismo repetido en toda la grilla.
- Estados: hover, foco visible, activo, vacío, y en móvil qué queda a la vista con el menú cerrado.

## Cómo se comprueba
`ver-web` mide lo que tú no ves: `composición:` (fila huérfana, sección a medio ancho), `contraste bajo` y la acción `colores`, que lista los colores realmente usados. Compara esa lista con la paleta del encargo: no debe aparecer ninguno ajeno a los roles.
