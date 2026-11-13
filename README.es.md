# qwen38-kit-12vram

**[English](README.md)**

Un agente de programación que corre **entero en tu PC**, sin nube y sin cuentas. Usa el modelo **Qwen3.8-27B (GSQ-RCO IQ3_XXS + MTP)** sobre una GPU NVIDIA, con **[little-coder](https://github.com/itayinbarr/little-coder)** como agente y un kit de skills encima.

Un solo comando hace todo: prende el modelo, abre el agente y, cuando sales, apaga el modelo.

Probado en una RTX 3060 de 12 GB con 32 GB de RAM.

> **Cómo lo corro yo:** la tarjeta NVIDIA queda dedicada al modelo y el escritorio corre en la **GPU integrada** (monitor conectado a la placa madre), así los 12 GB de VRAM son todos del modelo. Si la misma tarjeta también dibuja tu pantalla, el escritorio le quita parte de esa VRAM y tendrás que bajar el contexto en `models/q38.json`.

---

## 1. Qué necesitas

| | Linux | Windows 10/11 |
|---|---|---|
| GPU | NVIDIA con 12 GB de VRAM y su driver instalado | igual |
| Sistema | x86_64 con glibc 2.38+: Ubuntu 24.04+, Debian 13+, Fedora 39+, Mint 22+, Arch | x64, con el **[Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)** (muchos PCs ya lo tienen) |
| Programas | `curl`, `tar`, `xz` (casi siempre vienen instalados) | **[Git for Windows](https://git-scm.com/download/win)** (instálalo con las opciones por defecto) |
| Disco libre | ~12 GB (10,4 GB del modelo y ~1,3 GB de herramientas) | igual |

No hace falta instalar Python, Node, CUDA ni llama.cpp. El launcher descarga lo que necesita dentro de su propia carpeta.

---

## 2. Instalación

### Linux

```bash
git clone <url-de-este-repo> qwen38-kit-12vram
cd qwen38-kit-12vram
./q38
```

### Windows

1. Descarga este repo: botón verde **Code → Download ZIP** y descomprímelo, o usa `git clone` si sabes.
2. Abre la carpeta `qwen38-kit-12vram` y haz **doble clic en `q38.cmd`**.
   Si Windows muestra «Windows protegió su PC», elige **Más información → Ejecutar de todas formas**.
   Usa `q38.cmd` (doble clic, cmd o PowerShell), no `./q38` desde Git Bash.

### Qué pasa la primera vez (en los dos sistemas)

1. Descarga Node, llama.cpp y las piezas de little-coder (~1,3 GB). Se hace una sola vez.
2. Te pregunta con qué nombre quieres abrirlo desde cualquier carpeta (recomendado: `qwen`; ver [Uso diario](#3-uso-diario)).
3. Te pregunta:
   ```
   Falta el modelo: Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf (10.4 GB)
     Hugging Face: https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF
   ¿Descargarlo ahora en …/models? [S/n]
   ```
   - Pulsa **Enter** y lo descarga solo. Si se corta, vuelve a ejecutarlo y retoma donde quedó.
   - Si prefieres bajarlo a mano: responde `n`, descarga **`Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf`** desde [ese link](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF/blob/main/Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf), déjalo en la carpeta `models/` y vuelve a ejecutarlo.
4. Carga el modelo en la GPU (unos segundos la primera vez; verás `cargando… 12s`) y abre el agente.

Cada descarga se verifica con su huella sha256: si algo llega dañado, no se usa.

---

## 3. Uso diario

**El agente trabaja en la carpeta desde donde lo abres.** Abre la terminal en tu proyecto y lánzalo desde ahí.

### Un comando para abrirlo desde cualquier carpeta

La primera vez, el instalador pregunta:

```
Puedes abrirlo desde cualquier carpeta con un comando corto.
  Nombre del comando [qwen] (Enter = qwen, - = ninguno):
```

- Pulsa **Enter** para usar `qwen`, o escribe el nombre que prefieras (`ia`, `coder`, lo que quieras).
- Si ese nombre ya lo usa otro programa, te avisa y pide otro.
- Escribe `-` si no quieres ningún comando.

Después, en la carpeta de cualquier proyecto:

```
qwen
```

En Windows funciona igual en PowerShell y en cmd. Para abrir la terminal en una carpeta: clic derecho → «Abrir en Terminal».

**Cambiar o quitar el comando:**

```
qwen --alias          # pregunta un nombre nuevo (el anterior se borra)
qwen --alias ia       # lo cambia directamente a «ia»
qwen --alias -        # lo quita
```

> Si en tu terminal ya tienes un alias o una función con ese nombre (por ejemplo, en `~/.bashrc`), esa gana. Elige otro nombre.

<details><summary>Dónde queda (por si quieres borrarlo a mano)</summary>

- Linux: un enlace en `~/.local/bin/<nombre>`. Si esa carpeta no está en tu PATH, el instalador te dice qué línea agregar a `~/.bashrc`.
- Windows: un archivo `<nombre>.cmd` en `%LOCALAPPDATA%\Microsoft\WindowsApps`, carpeta que Windows 10/11 ya tiene en el PATH.

</details>

### Comandos

| Quiero… | Escribo |
|---|---|
| Abrir el agente | `qwen` (o el nombre que elegiste; `./q38` en Linux o `.\q38` en Windows siempre funcionan dentro de la carpeta) |
| Retomar la última conversación de esta carpeta | `qwen --continue` |
| Hacer una sola pregunta sin abrir la interfaz | `qwen -p "explícame este repo"` |
| Ver el comando de llama-server que se usa | `qwen --print` |
| Reparar la instalación (baja lo que falte) | `qwen --setup` |
| Salir | `Ctrl+D` con el cuadro de texto vacío, o `Ctrl+C` dos veces |

Al salir, el modelo se apaga solo y libera la GPU.

---

## 4. Mini tutorial: tu primera sesión

Escribe lo que necesitas en lenguaje normal, en español o en inglés. El agente lee archivos, los edita y corre comandos en tu proyecto.

### Las skills se cargan solas

Una *skill* es un método de trabajo que el agente sigue paso a paso. No tienes que llamarlas: la extensión **oficio** mira tu pedido y carga la que corresponde.

| Si escribes algo como… | Se carga | Qué hace el agente |
|---|---|---|
| «el juego se cae al abrir el menú», «antes funcionaba» | `diagnosticar` | busca la causa con evidencia **antes** de tocar código |
| «agrega login con Google», «crea una API de tareas» | `planificar` | arma un plan por etapas y lo guarda en `tareas/001-….md` |
| «haz la etapa 1 de tareas/001-login.md» | `etapas` | ejecuta **solo** esa etapa, la comprueba y se detiene |
| «revisa este cambio», «audita el módulo de pagos» | `revisar` | revisa y entrega los hallazgos ordenados por gravedad |
| «comprueba que la página funcione en móvil» | `ver-web` | abre la página en un navegador real (sin pantalla) y te informa en texto |

Al terminar cada tarea, el agente informa `LISTO`, `PARCIAL` o `BLOQUEADO`, con el comando que usó para comprobarlo y lo que **no** pudo comprobar.

### Flujo recomendado para algo grande

1. **Pide el plan.** Escribe «planifica: agregar exportar a PDF», o pulsa **`Ctrl+Q`** (modo plan: el agente solo lee y propone). Al aprobarlo queda guardado en `tareas/001-exportar-pdf.md`.
2. **Etapa por etapa.** «haz la etapa 1 de tareas/001-exportar-pdf.md». Cuando responda `ETAPA 1 LISTA`, escribe **`/sigue 2`**, luego `/sigue 3`, etc.
3. **¿La conversación se hizo larga?** Escribe **`/handoff sigue con la etapa 3`**. El agente resume lo importante y abre una sesión nueva y liviana con ese resumen ya escrito, para que lo revises antes de enviarlo. Funciona mejor que dejar que la conversación se comprima sola.

### Atajos útiles

| Atajo / comando | Para qué |
|---|---|
| `Alt+K` (o `/oficio`) | panel para prender y apagar skills |
| `/oficio off` · `/oficio on` | desactivar o activar la carga automática de skills |
| `Ctrl+Q` | entrar o salir del modo plan |
| `/sigue N` | pasar a la etapa N |
| `/handoff <qué sigue>` | empezar una sesión limpia con el contexto resumido |
| `!ls -la` | correr un comando tú mismo, sin pasar por el modelo |
| `¿qué hay en !{git status --short}?` | meter la salida de un comando dentro de tu mensaje |
| `/resume` | elegir una conversación anterior |

### Permisos

Antes de correr un comando que no está en su lista segura (por ejemplo `rm`), el agente te pregunta: **Sí** · **Sí, y no preguntar más por este programa** · **No**.

### Barra de estado

Abajo ves la velocidad del modelo en tokens por segundo mientras escribe.

### `ver-web` (opcional)

Para que el agente pueda abrir tus páginas en un navegador hace falta Python con Playwright: `pip install playwright` y después `python -m playwright install chromium`. Sin eso, las demás skills funcionan igual.

---

## 5. Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| `el puerto 8001 está ocupado` | ya hay otro modelo corriendo. Ciérralo, o usa otro puerto: `Q38_PORT=8002 qwen` (Linux) / `$env:Q38_PORT=8002; qwen` (PowerShell en Windows) |
| `llama-server terminó antes de estar listo` | revisa `.state/llama-server.log`. Lo más común es que no haya VRAM suficiente: cierra juegos, el navegador u otros programas que usen la GPU |
| `se necesita una GPU NVIDIA` | instala el driver de NVIDIA; `nvidia-smi` tiene que funcionar |
| `tu sistema tiene glibc 2.xx y llama.cpp necesita 2.38+` (Linux) | el llama.cpp precompilado pide una distro más nueva (ver [Qué necesitas](#1-qué-necesitas)) |
| `falta Microsoft Visual C++ Redistributable (x64)` (Windows) | instálalo desde [ese link](https://aka.ms/vs/17/release/vc_redist.x64.exe) y vuelve a abrirlo |
| `little-coder necesita Git Bash` (Windows) | instala [Git for Windows](https://git-scm.com/download/win) |
| Algo quedó a medio instalar | borra la carpeta `.state` y ejecuta `./q38` (o `q38.cmd`) otra vez |

---

## 6. Para curiosos

### El perfil

`models/q38.json` define el perfil afinado para 12 GB:
- 49 000 tokens de contexto;
- caché KV `q4_0`;
- decodificación especulativa MTP (la cabeza que trae el propio GGUF) más ngram;
- tope de 6000 tokens para el razonamiento antes de pasar a la acción.

### Otro modelo

Copia `models/q38.json` a `models/<nombre>.json` y edítalo:
- `pattern`: nombre del archivo; acepta un `*`;
- `hf`, `url`, `sha256`, `size`: para la descarga;
- los parámetros de llama-server, y `extra` para flags adicionales.

Se usa con `qwen <nombre>`. Los valores van entre comillas para que lleguen tal cual.

### Variables

| Variable | Por defecto | Qué hace |
|---|---|---|
| `Q38_PORT` | `8001` | puerto de llama-server |
| `Q38_MODELS_DIR` | `models/` | carpeta de los `.gguf` |
| `Q38_LANG` | según tu sistema | `es` o `en`: idioma de los mensajes y de las respuestas |

### Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `q38`, `q38.cmd`, `q38.ps1` | arranques para Linux y Windows: bajan Node y corren `q38.mjs` |
| `q38.mjs` | el launcher: instalación, modelo, llama-server y little-coder |
| `kit/extensions/` | `oficio` (carga de skills y guardas), `handoff`, `tps` (velocidad), `inline-bash` (`!{cmd}`), `lc-permisos`, `lc-plan` (plan → `tareas/`), `lc-temperatura`, `razonamiento` (saca el razonamiento viejo del contexto) |
| `kit/skills/` | las 5 skills; para sumar una, agrega su carpeta |
| `kit/oficio.md` | las reglas de trabajo que se agregan al prompt del agente |
| `little-coder/` | copia de little-coder 1.20.0 fija sobre Pi 1.5.0 |
| `.state/` | todo lo descargado y la configuración del agente; bórrala para empezar de cero |
| `q38.test.mjs` · `check.mjs` | `node --test q38.test.mjs` comprueba el perfil; `node check.mjs` revisa que no haya rutas personales antes de publicar |

### Actualizar llama.cpp o Node

- **llama.cpp:** cambia `TAG`, los nombres y los sha256 en `q38.mjs`, y corre `qwen --setup`. Los datos salen de la página del release o de `https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/<tag>`.
- **Node:** cambia `NODE_VER`/`NODE_SHA` en `q38` y `q38.ps1`, y borra `.state/node`.

---

## Créditos y licencia

MIT (ver `LICENSE`). `little-coder/` es © Itay Inbar, Apache-2.0 (`little-coder/LICENSE`, `little-coder/NOTICE`). `kit/extensions/inline-bash.ts` y `handoff.ts` son ejemplos de Pi (MIT). Modelo: [ISTA-DASLab](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF). Construido sobre [llama.cpp](https://github.com/ggml-org/llama.cpp) y [Pi](https://github.com/earendil-works/pi).
