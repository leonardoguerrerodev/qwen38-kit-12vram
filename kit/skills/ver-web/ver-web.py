#!/usr/bin/python3
"""ver-web: abre una página en Chromium headless y devuelve TEXTO (sin imágenes: el 3.8 no tiene visión).

  ver-web.py index.html                          checks automáticos en escritorio (1280) y móvil (390)
  ver-web.py index.html click:.chip count:.card key:Escape visible:.lightbox
                                                 acciones en orden, en cada tamaño

Acciones: click:SEL  hover:SEL  key:TECLA  count:SEL  visible:SEL  text:SEL  attr:SEL@atributo  wait:MS  shot:ruta.png
          reload (recarga la página: lo guardado en localStorage sigue ahí)  contraste (repite el chequeo de contraste)
          colores (los colores de texto y de fondo más usados, en hex)
Un selector con espacios puede ir sin comillas: `visible:#nav a`.
count = cuántos elementos VISIBLES; visible = sí/no; text = texto del primero visible.
Cada tamaño parte de cero (página y almacenamiento nuevos).
"""
import sys
from pathlib import Path
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("ver-web: este python no tiene el módulo playwright. No lo instales por tu cuenta: dile al usuario que corra "
             "`pip install playwright` y después `python -m playwright install chromium`.")

sys.stdout.reconfigure(encoding="utf-8")   # Windows: a pipe defaults to cp1252 and "→" would raise UnicodeEncodeError

VIEWPORTS = [("escritorio", 1280, 800), ("móvil", 390, 844)]
VISIBLE = """el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 }"""
# nota: el JS de checks va en una sola evaluación; si crece, partirlo.
AUTO = """() => {
  const w = innerWidth, out = {};
  out.scrollX = document.documentElement.scrollWidth - w;
  out.fuera = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect();
    return r.width > 0 && r.right > w + 1 && getComputedStyle(e).position !== 'fixed' }).slice(0, 5)
    .map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : ''));
  out.imgRotas = [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.getAttribute('src')).slice(0, 5);
  out.anclasHuerfanas = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
    .filter(h => h.length > 1 && !document.querySelector(h.replace(/([^\\w#-])/g, '\\\\$1'))).slice(0, 5);
  out.h1 = document.querySelectorAll('h1').length;
  out.sinAlt = [...document.images].filter(i => !i.hasAttribute('alt')).length;
  out.lang = document.documentElement.lang || '(falta)';
  out.viewportMeta = !!document.querySelector('meta[name=viewport]');
  return out;
}"""

# Lo que se puede medir del aspecto sin verlo. Solo se imprime si falla.
# nota: se salta el texto sobre imagen, degradado o fondo semitransparente (no hay un color contra el que comparar)
# y el texto sin letras ni números (un emoji se pinta con sus propios colores). No mira hover ni foco.
HEX = "const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');"
CONTRASTE = """() => {
  """ + HEX + """
  const rgb = c => c.startsWith('rgb') ? c.match(/[\\d.]+/g).map(Number) : null;
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) };
  const fondo = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgb(s.backgroundColor); if (!c) return null;
      if (c.length < 4 || c[3] >= 0.99) return c;
      if (c[3] > 0.01) return null }
    return [255, 255, 255] };
  const out = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && /[\\p{L}\\p{N}]/u.test(n.textContent))) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden' || +s.opacity < 0.99) continue;
    const fg = rgb(s.color), bg = fondo(el);
    if (!fg || !bg || (fg.length > 3 && fg[3] < 0.99)) continue;
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(s.fontSize), min = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5;
    const k = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '');
    if (ratio < min && !out.has(k)) out.set(k, k + ' ' + ratio.toFixed(2) + ' (texto ' + hex(fg) + ' sobre ' + hex(bg) + ', mín. ' + min + ')');
  }
  return [...out.values()].slice(0, 5);
}"""
CHICOS = """() => [...document.querySelectorAll('button, select, [role=button], input:not([type=hidden])')].map(e => [e, e.getBoundingClientRect()])
  .filter(([e, r]) => r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 24 && getComputedStyle(e).visibility !== 'hidden')
  .slice(0, 5).map(([e, r]) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))"""

# Composición, solo en escritorio y solo si falla. Son pistas medidas, no reglas.
# nota: la fila huérfana mira hijos directos de grid/flex; el ancho mira <section> alineadas a la izquierda.
DISPOSICION = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' };
  const nom = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/)[0] : '');
  const out = [];
  for (const g of document.querySelectorAll('body *')) {
    if (!/grid|flex/.test(getComputedStyle(g).display)) continue;
    const h = [...g.children].filter(vis); if (h.length < 4) continue;
    const filas = new Map(); for (const c of h) { const t = Math.round(c.getBoundingClientRect().top); filas.set(t, (filas.get(t) || 0) + 1) }
    const n = [...filas.values()], max = Math.max(...n);
    if (n.length > 1 && max >= 3 && n[n.length - 1] === 1) out.push(nom(g) + ': la última fila tiene 1 elemento solo (filas de ' + max + ', ' + h.length + ' en total)');
  }
  for (const s of document.querySelectorAll('section')) {
    if (!vis(s) || s.querySelector('section')) continue;
    const c = s.children.length === 1 ? s.children[0] : s, cs = getComputedStyle(c), cr = c.getBoundingClientRect();
    const izq = cr.left + parseFloat(cs.paddingLeft), der = cr.right - parseFloat(cs.paddingRight), ancho = der - izq;
    if (ancho < 600) continue;
    let l = Infinity, r = -Infinity; const rango = document.createRange();
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      let b;
      if (n.nodeType === 3) { if (!n.textContent.trim()) continue; rango.selectNode(n); b = rango.getBoundingClientRect() }
      else if (/^(IMG|SVG|VIDEO|CANVAS|IFRAME|INPUT|BUTTON|SELECT|TEXTAREA)$/i.test(n.tagName)) b = n.getBoundingClientRect();
      else continue;
      if (b.width > 0 && b.height > 0) { l = Math.min(l, b.left); r = Math.max(r, b.right) }
    }
    if (r < 0) continue;
    const vacioDer = (der - r) / ancho, vacioIzq = (l - izq) / ancho;
    if (vacioDer > 0.5 && vacioIzq < 0.1) out.push(nom(s) + ': el contenido ocupa el ' + Math.round((r - l) / ancho * 100) + ' % del ancho y la derecha queda vacía');
  }
  return out.slice(0, 5);
}"""
COLORES = """() => {
  """ + HEX + """
  const rgb = c => c.startsWith('rgb') ? c.match(/[\\d.]+/g).map(Number) : null;
  const t = new Map(), f = new Map(), suma = (m, c) => { if (c && (c.length < 4 || c[3] >= 0.99)) m.set(hex(c), (m.get(hex(c)) || 0) + 1) };
  for (const el of document.querySelectorAll('body, body *')) {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden') continue;
    if ([...el.childNodes].some(n => n.nodeType === 3 && /[\\p{L}\\p{N}]/u.test(n.textContent))) suma(t, rgb(s.color));
    suma(f, rgb(s.backgroundColor));
  }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => c + '×' + n).join(' ') || 'ninguno';
  return 'texto: ' + top(t) + ' · fondo: ' + top(f);
}"""
ACCIONES = ("click", "hover", "key", "count", "visible", "text", "attr", "wait", "shot", "reload", "contraste", "colores")


def unir(args):
    """`visible:#nav a` sin comillas llega partido en dos: lo que no empieza con una acción sigue al selector anterior."""
    out = []
    for a in args:
        if out and a.partition(":")[0] not in ACCIONES:
            out[-1] += " " + a
        else:
            out.append(a)
    return out


def contraste(pg):
    bajo = pg.evaluate(CONTRASTE)
    return "contraste bajo (texto difícil de leer): " + ", ".join(bajo) if bajo else ""


def run(url, acciones):
    with sync_playwright() as p:
        b = p.chromium.launch()
        for nombre, w, h in VIEWPORTS:
            pg = b.new_page(viewport={"width": w, "height": h})
            log = []
            pg.on("console", lambda m: m.type == "error" and log.append("console.error: " + m.text[:160]))
            pg.on("pageerror", lambda e: log.append("pageerror: " + str(e)[:160]))
            pg.on("requestfailed", lambda r: log.append("falló la carga: " + r.url[-80:]))
            pg.on("response", lambda r: r.status >= 400 and log.append(f"HTTP {r.status}: {r.url[-80:]}"))
            pg.goto(url)
            pg.wait_for_timeout(400)
            print(f"== {nombre} {w}x{h}")
            a = pg.evaluate(AUTO)
            print(f"  scroll horizontal: {'SÍ, sobra ' + str(a['scrollX']) + 'px' if a['scrollX'] > 0 else 'no'}"
                  + (f" · se salen: {', '.join(a['fuera'])}" if a["fuera"] else ""))
            print(f"  h1: {a['h1']} · imágenes rotas: {a['imgRotas'] or 'ninguna'} · sin alt: {a['sinAlt']} · "
                  f"anclas sin destino: {a['anclasHuerfanas'] or 'ninguna'} · lang: {a['lang']} · meta viewport: {'sí' if a['viewportMeta'] else 'NO'}")
            if c := contraste(pg):
                print("  " + c)
            if w < 600 and (ch := pg.evaluate(CHICOS)):
                print("  botones chicos para el dedo (mín. 24 px): " + ", ".join(ch))
            if w >= 1000:
                for d in pg.evaluate(DISPOSICION):
                    print("  composición: " + d)
            for ac in acciones:
                k, _, v = ac.partition(":")
                try:
                    print("  " + paso(pg, k, v, nombre))
                except Exception as e:  # una acción fallida no corta las siguientes
                    print(f"  {ac} → ERROR {str(e).splitlines()[0][:120]}")
            for l in dict.fromkeys(log):
                print("  !", l)
            if not log:
                print("  consola: sin errores")
            pg.close()
        b.close()


def paso(pg, k, v, nombre):
    if k == "key":
        pg.keyboard.press(v)
        pg.wait_for_timeout(250)
        return f"key {v} → ok"
    if k == "wait":
        pg.wait_for_timeout(int(v))
        return f"wait {v}ms"
    if k == "reload":
        pg.reload()
        pg.wait_for_timeout(400)
        return "reload → ok"
    if k == "contraste":
        return contraste(pg) or "contraste → ok"
    if k == "colores":
        return "colores → " + pg.evaluate(COLORES)
    if k == "shot":
        ruta = v.replace(".png", f"-{nombre}.png")
        pg.screenshot(path=ruta, full_page=True)
        return f"captura → {ruta}"
    sel, _, attr = v.partition("@")
    loc = pg.locator(sel)
    n = loc.count()
    if k in ("click", "hover"):
        vis = [i for i in range(n) if loc.nth(i).evaluate(VISIBLE)]
        if not vis:
            return f"{k} {sel} → no hay ninguno visible (existen {n})"
        getattr(loc.nth(vis[0]), k)(timeout=3000)
        pg.wait_for_timeout(250)
        return f"{k} {sel} → ok"
    vis = [i for i in range(n) if loc.nth(i).evaluate(VISIBLE)]
    if k == "count":
        return f"count {sel} → {len(vis)} visibles de {n}"
    if k == "visible":
        return f"visible {sel} → {'sí' if vis else 'no'}" + ("" if n else " (el selector no existe)")
    if k == "text":
        return f"text {sel} → {loc.nth(vis[0]).inner_text()[:200]!r}" if vis else f"text {sel} → no visible"
    if k == "attr":
        return f"attr {sel}@{attr} → {loc.nth(vis[0]).get_attribute(attr)!r}" if vis else f"attr {sel} → no visible"
    raise ValueError(f"acción desconocida: {k}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        sys.exit(__doc__)
    t = sys.argv[1]
    if "://" not in t and not Path(t).is_file():
        sys.exit(f"ver-web: no existe el archivo {t} (carpeta actual: {Path.cwd()})")
    run(t if "://" in t else Path(t).resolve().as_uri(), unir(sys.argv[2:]))
