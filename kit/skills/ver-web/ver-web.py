#!/usr/bin/python3
"""ver-web: abre una página en Chromium headless y devuelve TEXTO (sin imágenes: el 3.8 no tiene visión).

  ver-web.py index.html                          checks automáticos en escritorio (1280) y móvil (390)
  ver-web.py index.html click:.chip count:.card key:Escape visible:.lightbox
                                                 acciones en orden, en cada tamaño

Acciones: click:SEL  hover:SEL  key:TECLA  count:SEL  visible:SEL  text:SEL  attr:SEL@atributo  wait:MS  shot:ruta.png
count = cuántos elementos VISIBLES; visible = sí/no; text = texto del primero visible.
"""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

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
    run(t if "://" in t else Path(t).resolve().as_uri(), sys.argv[2:])
