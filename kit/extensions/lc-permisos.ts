/**
 * lc-permisos.ts — permisos de la terminal para little-coder (q38.mjs). Su modo auto bloqueaba sin preguntar
 * todo lo que no está en su lista blanca (en la prueba: `cd` y `rm`, un turno perdido cada uno). Aquí:
 *   en la lista blanca (la suya, importada: una sola fuente)  → pasa; `timeout N` y variables inocuas (SDL_VIDEODRIVER…)
 *                                                               delante no cuentan: se juzga el comando de adentro
 *   fuera de la lista                                         → te pregunta: Sí · Sí y no preguntar más por ese programa · No
 *   sin pantalla (pi -p, evals)                               → se bloquea (no hay a quién preguntar), salvo los programas
 *                                                               de QWEN_LC_SIN_PANTALLA (python3, node); rm nunca va ahí
 * Su permission-gate queda en accept-all (lo pone q38.mjs); los sub-agentes (plan mode) siguen con el suyo en auto.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Gate = { isSafeBash(c: string): boolean; firstUnsafeInvocation?(c: string): string | null; splitCommandChain(c: string): string[]; detectWriteTargets(c: string): unknown[] };
const SHELL = new Set(["bash", "Bash", "ShellSession", "ShellStart"]);

// Variables que solo cambian cómo se muestra o registra algo. Una cualquiera no: `PATH=. ls` corre otro `ls`.
const VARS_INOCUAS = new Set(["SDL_VIDEODRIVER", "SDL_AUDIODRIVER", "PYTHONUNBUFFERED", "NODE_ENV", "CI", "LANG", "LC_ALL"]);

/** Quita el envoltorio que el kit enseña a usar, para juzgar el comando de adentro:
 *  "SDL_VIDEODRIVER=dummy timeout 15 ./venv/bin/python x.py" → "./venv/bin/python x.py". */
export function desenvolver(segmento: string): string {
	let s = segmento.trim();
	for (;;) {
		const m = s.match(/^(\w+)=\S*\s+/);
		if (!m || !VARS_INOCUAS.has(m[1])) break;
		s = s.slice(m[0].length);
	}
	// timeout [-k N] [-s SEÑAL] [--opción] DURACIÓN comando…
	return s.replace(/^timeout\s+(?:-[ks]\s+\S+\s+|--?[\w-]+(?:=\S+)?\s+)*\S+\s+(?=\S)/, "");
}

/** "FOO=1 ./venv/bin/python -c x" → "python": el nombre con que se pregunta y se recuerda el permiso. */
export const programa = (segmento: string) =>
	(segmento.trim().split(/\s+/).find((w) => !/^\w+=/.test(w)) ?? segmento.trim()).split("/").pop() || segmento.trim();

/** seguro = pasa sin preguntar. fuera = programas que no están en la lista (vacío si escribe a un archivo: ahí se
 *  pregunta siempre). enLinea = lo frenado es código en la línea de comandos (`python3 -c`, `node -e`). */
export function juzgar(cmd: string, g: Gate): { seguro: boolean; fuera: string[]; enLinea: boolean } {
	if (g.isSafeBash(cmd)) return { seguro: true, fuera: [], enLinea: false };
	if (g.detectWriteTargets(cmd).length) return { seguro: false, fuera: [], enLinea: false };
	const tramos = g.splitCommandChain(cmd).map(desenvolver);
	const malos = tramos.filter((t) => !g.isSafeBash(t));
	return {
		seguro: tramos.length > 0 && malos.length === 0,
		fuera: [...new Set(malos.map(programa))],
		enLinea: malos.some((t) => !!g.firstUnsafeInvocation?.(t)),
	};
}

export default function (pi: ExtensionAPI) {
	if (process.env.LITTLE_CODER_SUBAGENT === "1") return;
	const ext = `${process.env.QWEN_LC_PKG ?? ""}/.pi/extensions`;
	let gate: Promise<Gate | undefined> | undefined;
	const cargar = () =>
		(gate ??= Promise.all([import(`${ext}/permission-gate/index.ts`), import(`${ext}/_shared/shell-write.ts`)])
			.then(([p, s]) => ({ isSafeBash: p.isSafeBash, firstUnsafeInvocation: p.firstUnsafeInvocation, splitCommandChain: s.splitCommandChain, detectWriteTargets: s.detectWriteTargets }))
			.catch(() => undefined)); // sin la lista: se pregunta todo
	const permitidos = new Set<string>(); // programas autorizados para el resto de la sesión
	const sinPantalla = new Set((process.env.QWEN_LC_SIN_PANTALLA ?? "").split(",").map((p) => p.trim()).filter(Boolean));
	pi.on("session_start", async () => permitidos.clear());

	pi.on("tool_call", async (event, ctx) => {
		if (!SHELL.has(event.toolName)) return;
		const cmd = String((event.input as { command?: unknown }).command ?? "");
		const g = await cargar();
		const { seguro, fuera, enLinea } = g ? juzgar(cmd, g) : { seguro: false, fuera: [], enLinea: false }; // sin lista: se pregunta todo
		if (seguro) return;
		if (fuera.length && fuera.every((p) => permitidos.has(p))) return;
		// `python3 -c` / `node -e`: el programa SÍ está en la lista; lo que no pasa es el código en línea. Decir solo
		// «python3 fuera de la lista» hizo creer al modelo que no podía correr ningún script (13-nov, corrida H).
		// Sin pantalla, estos programas valen como «Sí, y no preguntar más» (variable de entorno, vacía por defecto; sirve para los chequeos
		// en línea que el propio kit enseña). Lo que escribe a un archivo sigue bloqueado: ahí `fuera` viene vacío.
		if (!ctx.hasUI && fuera.length && fuera.every((p) => permitidos.has(p) || sinPantalla.has(p))) return;
		if (!ctx.hasUI && enLinea)
			return {
				block: true,
				reason: `Bloqueado: código escrito en la línea de comandos (\`-c\`, \`-e\`) en ${fuera.map((p) => `«${p}»`).join(", ")}, y no hay a quién preguntar (sesión sin pantalla). Correr un ARCHIVO sí se puede: \`python3 x.py\` y \`node x.js\` pasan. Escribe el chequeo con \`write\` en /tmp/qwen/ y córrelo, o usa grep/wc.`,
			};
		if (!ctx.hasUI)
			return {
				block: true,
				reason: `Bloqueado: fuera de la lista blanca (${fuera.map((p) => `«${p}»`).join(", ") || "escribe a un archivo"}) y no hay a quién preguntar (sesión sin pantalla).`,
			};
		const SI = "Sí", NO = "No";
		const SIEMPRE = fuera.length ? `Sí, y no preguntar más por ${fuera.join(", ")} en esta sesión` : "";
		const r = await ctx.ui.select(`¿Ejecutar este comando?\n\n${cmd}`, SIEMPRE ? [SI, SIEMPRE, NO] : [SI, NO]);
		if (r === SIEMPRE) fuera.forEach((p) => permitidos.add(p));
		if (r === SI || r === SIEMPRE) return;
		return {
			block: true,
			reason: "El usuario no autorizó este comando. No busques otra vía para lo mismo: si lo necesitas, explica por qué y pregúntale.",
		};
	});
}
