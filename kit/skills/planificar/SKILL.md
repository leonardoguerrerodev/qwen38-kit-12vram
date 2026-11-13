---
name: planificar
description: >-
  Arma un plan corto y verificable antes de programar una tarea nueva sin tarjeta, y lo deja escrito en tareas/NNN-*.md del proyecto cuando es largo. Lee lo que se toca, fija el objetivo y lo que queda fuera, comprueba los supuestos con comandos, resuelve ambigüedades chicas y elige librería o enfoque con criterios. Usar cuando la tarea tiene 3 o más pasos o toca más de un archivo, cuando el pedido es ambiguo o al elegir entre librerías o enfoques, «implementa», «agrega», «crea», «refactoriza», «plan», «build», «add feature». No usar si te piden trabajar una tarea que ya está en tareas/NNN-*.md (usar etapas) ni para arreglar un fallo (usar diagnosticar).
---

# Planificar

Primero entiendes, después escribes el plan y recién entonces ejecutas. Cada etapa se puede comprobar con un comando.

## Antes del plan
0. **Carpeta de trabajo:** `pwd && ls`. Si bash dice que el directorio no existe, detente y avísalo al usuario. No busques ni reconstruyas el proyecto desde otra carpeta.
1. **Lee lo que vas a tocar y quién lo usa:** `grep -rn "<nombre>" --include='*.<ext>' .` Lista los archivos.
2. **Copia la forma de la casa:** busca cómo resuelve el proyecto algo parecido (nombres, estructura, tests) y hazlo igual.
3. **Supuestos:** todo hecho del que dependes y no viste (que existe una función, una versión, un formato, que una librería está instalada) se comprueba con un comando **antes** de usarlo.
4. **Ambigüedad:**
   - Si cambia **qué** se construye: haz una pregunta con tu opción por defecto, y espera.
   - Si no: elige lo más chico y reversible, y anótalo en Decisiones.
5. **Elegir librería o enfoque** (solo si hace falta):
   - Primero lo que ya hay: stdlib, dependencias instaladas, código del proyecto. "No agregar nada" también es una opción.
   - Criterios antes que opciones: que encaje con el proyecto, cuánto cuesta sacarlo después, que funcione en este Python o Node (compruébalo, no lo recuerdes).
   - Para una dependencia nueva, consulta antes.

## Proyecto nuevo o pantalla nueva
En una carpeta vacía los pasos 1 y 2 no aplican. A cambio, deja escrito en Decisiones:
- **Estructura:** qué archivo es dueño de qué (datos, lógica, vista, estilos) y la forma exacta de los datos (claves y tipos). Cada dato vive en un solo lugar: si la lista está en el JS, el HTML no la repite. Los nombres que comparten archivos (ids, clases, atributos `data-*`, claves de `localStorage`) se anotan aquí una vez; las etapas los usan tal cual.
- **Diseño** (si hay interfaz): lee `diseno.md` (está junto a esta skill) y llena la casilla `Diseño:` del formato. Se decide aquí una vez; después solo se aplica.

## Formato
El mismo que ejecuta la skill `etapas`:
```
# Plan: <título>
Objetivo: <qué existe al terminar> · Fuera: <lo que no harás>
Pedido: R1 <requisito> · R2 <requisito> · … (todo lo que el pedido exige, con sus números: «al menos 9», «en pesos»)
Decisiones: <duda → elección (por qué)>
Diseño: fuente <pedido | DISENO.md | elegido> · <rol>=<color> … · tipografías <títulos / texto> · iconos <cuáles o ninguno> (solo si hay interfaz)
Supuestos: `<comando>` → <lo que esperas>

## Etapa 1 — <título corto>
Archivos: <rutas>
Hacer: <el cambio en una línea, con los nombres exactos de funciones, archivos y claves; sin código>
Verificación: `<comando>` → <señal>

## Etapa N — Integral
Verificación: cada R del Pedido con su `<comando>` → <señal> · lo que ya andaba sigue andando: `<comando>` → <señal>
```

**Dónde va:**
- Hasta 3 etapas: en tu respuesta.
- Más de 3: solo en `tareas/NNN-<tema>.md` del proyecto (NNN = el siguiente número libre en `tareas/`, 001 si no hay; tema en minúsculas con guiones). Escríbelo con `write` **antes** de la etapa 1, sin copiarlo además en tu respuesta: si el contexto se resume, ahí está. No lo borres al terminar: queda como registro y se puede retomar con `etapas`. Es el único archivo fuera de lo pedido que puedes crear.

## Revisa el plan antes de empezar
- ¿Cada etapa tiene una verificación que puedes ejecutar ahora?
- ¿Alguna verificación solo mira la sintaxis (`node --check`, `py_compile`, `bash -n`)? Súmale un caso cuyo resultado calculaste a mano: `node -e "import('./src/x.js').then(m => console.log(m.f(2, 3)))"` → `5`. La sintaxis no dice si la función calcula bien.
- ¿Alguna verificación solo cuenta texto (`grep -c`, contar llaves)? Eso dice que el texto está, no que funciona. En una página web, la verificación de cada etapa es correr `ver-web` (skill) sobre el HTML, desde la primera etapa en que exista; en la etapa Integral, encadena todas las acciones de la página en un solo `ver-web` (se repiten en escritorio y móvil). En lo demás, correr el programa.
- ¿Cada R del Pedido aparece en alguna etapa y en la verificación integral?
- ¿Cada supuesto se comprueba antes de usarse?
- ¿Hay algo que no se pidió? Pásalo a "Fuera".
- ¿Los nombres (funciones, archivos, claves) son iguales en todas las etapas?

Si algo falla, corrige el plan y vuelve a revisarlo.

## Ejecuta
- Si te pidieron solo el plan, detente después de escribirlo y di dónde quedó.
- Corre los supuestos. Después, una etapa por vez: cambio → verificación → siguiente. No adelantes etapas.
- Archivo que ya existe: `read` y luego `edit`. `write` solo crea archivos nuevos; no reescribas un archivo entero para cambiar una parte.
- Verificación en rojo: aplica `diagnosticar` en corto (reproduce, localiza, una hipótesis, un cambio). Máximo 3 vueltas por etapa; después reporta BLOQUEADO con la línea de error.
- Si un supuesto resultó falso, dilo y reescribe solo las etapas que dependían de él (también en el archivo, si lo hay).
- Si encuentras algo fuera del plan (un bug vecino, una mejora), anótalo en `Hallazgos:` del reporte y no lo toques.
- Al final: compuerta de cierre y reporte de `AGENTS.md`. Si el plan quedó en `tareas/`, nombra el archivo en el reporte.
