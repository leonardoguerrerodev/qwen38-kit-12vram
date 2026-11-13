/**
 * razonamiento.ts — antes de cada llamada al modelo quita el razonamiento de los turnos ya cerrados. Si se deja, el
 * razonamiento viejo ocupa la ventana (medido: ~24k tokens de 37k útiles en una sola tarea, 3 compactaciones) y
 * --no-reasoning-preserve del servidor no lo quita con esta plantilla. Se quita también el del último turno: si no,
 * el prompt cambia en medio cada turno y llama.cpp relee todo desde el prompt de sistema.
 * El historial guardado no cambia. QWEN_GUARDA_RAZONAMIENTO=0 lo apaga.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Mensaje = { role?: string; content?: unknown };

/** Los mismos mensajes sin los bloques `thinking` del asistente. */
export function sinRazonamientoViejo<T extends Mensaje>(mensajes: T[]): T[] {
	return mensajes.map((m) => {
		if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
		const resto = m.content.filter((b) => b?.type !== "thinking");
		// nota: un turno que solo razonó se deja como está (un mensaje vacío rompe la plantilla)
		return resto.length && resto.length < m.content.length ? { ...m, content: resto } : m;
	});
}

export default function (pi: ExtensionAPI): void {
	if (process.env.QWEN_GUARDA_RAZONAMIENTO !== "0") pi.on("context", async (e) => ({ messages: sinRazonamientoViejo(e.messages) }));
}
