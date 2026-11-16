#!/usr/bin/env python3
"""Просмотрщик сайта с переключением ширины: телефоны, планшет, десктоп.

Зачем это нужно
---------------
Владельцу нужен живой просмотр работы в нескольких ширинах («мобильный,
даже на несколько ширин… и десктоп, чтобы переключаться можно было»).
Этот сервер отдаёт конструктор кадров на `/`, а сам сайт — как обычно
из собранного артефакта `_site` (страницы доступны и по своим путям).

Особенности
-----------
* `/` и `/__preview` — панель переключения (одна HTML-страница внутри
  этого файла, чтобы не плодить .html в репозитории: аудиты и cache-bust
  трогают каждый .html в дереве);
* сайт открывается в iframe того же origin: тема переключается через
  `mc_theme` + `data-theme` ровно так же, как это делают сами страницы;
* `/sw.js` отдаётся 404: во время просмотра service worker не должен
  подмешивать старый кэш после пересборки артефакта;
* «Вписать» масштабирует аппарат под окно — удобно смотреть десктоп
  с телефона.

Usage:
    npm run build:pages
    python3 scripts/viewport_preview.py --port 4300 --root _site
"""

from __future__ import annotations

import argparse
import gzip
import http.server
import pathlib
import socketserver
import sys
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from serve_pages_artifact import CONTENT_TYPES, COMPRESSIBLE  # noqa: E402

HARNESS = r"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Milovi Cake — просмотр размеров</title>
<style>
  :root{
    --bg:#14110d; --panel:#1d1812; --line:rgba(201,147,74,.22);
    --gold:#c9934a; --gold-soft:#e0b579; --cream:#f2e9d8; --muted:#b3a289;
    --chip:#241d15; --chip-on:#3a2c1b;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:var(--bg); color:var(--cream);
    font-family:'Jost',-apple-system,'Segoe UI',Roboto,sans-serif;
    display:flex; flex-direction:column; overflow:hidden;
  }
  .bar{
    display:flex; flex-wrap:wrap; align-items:center; gap:10px;
    padding:10px 14px; background:var(--panel);
    border-bottom:1px solid var(--line); flex-shrink:0;
  }
  .bar.bottom{border-bottom:0;border-top:1px solid var(--line);font-size:12px;color:var(--muted);justify-content:space-between}
  .brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-soft);margin-right:6px;white-space:nowrap}
  .brand span{display:block;font-family:'Jost',sans-serif;font-size:9px;letter-spacing:.34em;color:var(--muted)}
  .group{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:12px;padding:4px}
  .group b{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:0 6px 0 8px}
  button,select,input,a.btn{
    font:inherit; color:var(--cream); background:var(--chip);
    border:1px solid transparent; border-radius:9px; padding:8px 12px;
    cursor:pointer; text-decoration:none; line-height:1.1; white-space:nowrap;
  }
  button:hover,select:hover,a.btn:hover{border-color:var(--line)}
  button.on{background:var(--chip-on);border-color:var(--gold);color:var(--gold-soft)}
  select{appearance:none;padding-right:26px;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 14px) 55%,calc(100% - 9px) 55%;background-size:5px 5px;background-repeat:no-repeat}
  input[type=number]{width:66px;padding:8px 8px;text-align:center;-moz-appearance:textfield}
  input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}
  .sep{color:var(--muted);font-size:13px}
  #stage{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;padding:22px}
  #wrap{position:relative;flex-shrink:0}
  #device{
    position:absolute;top:0;left:0;transform-origin:top left;
    background:#0b0906;border:1px solid rgba(201,147,74,.35);
    border-radius:16px;padding:9px;box-shadow:0 30px 80px rgba(0,0,0,.55);
  }
  #screen{position:relative;background:#fff;border-radius:8px;overflow:hidden}
  #frame{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#fff}
  .hint kbd{background:var(--chip);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:10px}
  #stateInfo b{color:var(--gold-soft);font-weight:500}
  @media (max-width:900px){
    .bar{gap:6px;padding:8px 10px}
    .brand{display:none}
    button,select,input,a.btn{padding:7px 9px;font-size:13px}
    .group b{display:none}
    .bar.bottom .hint{display:none}
  }
</style>
</head>
<body>

<header class="bar">
  <div class="brand">Milovi Cake<span>просмотр</span></div>

  <div class="group" id="modeGroup">
    <b>Режим</b>
    <button data-mode="phone">📱 Телефон</button>
    <button data-mode="tablet">💊 Планшет</button>
    <button data-mode="desktop">🖥 Десктоп</button>
  </div>

  <div class="group" id="widthGroup">
    <b>Ширина</b>
  </div>

  <div class="group">
    <b>Свой</b>
    <input id="wIn" type="number" min="280" max="2400" step="10" value="390">
    <span class="sep">×</span>
    <input id="hIn" type="number" min="400" max="2000" step="10" value="844">
    <button id="applySize">Применить</button>
    <button id="rotate" title="Повернуть">⟲</button>
  </div>

  <div class="group" id="themeGroup">
    <b>Тема</b>
    <button data-theme="auto">Авто</button>
    <button data-theme="light">☀ День</button>
    <button data-theme="dark">☾ Ночь</button>
  </div>

  <div class="group">
    <b>Страница</b>
    <select id="pageSel"></select>
  </div>

  <div class="group">
    <b>Масштаб</b>
    <select id="zoomSel">
      <option value="fit">Вписать</option>
      <option value="1">100%</option>
      <option value="0.75">75%</option>
      <option value="0.5">50%</option>
      <option value="0.25">25%</option>
    </select>
  </div>

  <button id="reload" title="Перезагрузить кадр">⟳</button>
  <a class="btn" id="openNew" target="_blank" rel="noopener" title="Открыть страницу в новой вкладке">↗ Открыть</a>
</header>

<main id="stage">
  <div id="wrap">
    <div id="device">
      <div id="screen">
        <iframe id="frame" title="Просмотр сайта"></iframe>
      </div>
    </div>
  </div>
</main>

<footer class="bar bottom">
  <span id="stateInfo"></span>
  <span class="hint">Кадр рабочий: можно листать, открывать шит, переходить по ссылкам. <kbd>Тема</kbd> меняет день/ночь без перезагрузки.</span>
</footer>

<script>
(function(){
  'use strict';
  var $ = function(s){ return document.querySelector(s); };

  var PRESETS = [
    { w:320,  h:568,  label:'320',  mode:'phone' },
    { w:360,  h:800,  label:'360',  mode:'phone' },
    { w:390,  h:844,  label:'390',  mode:'phone' },
    { w:430,  h:932,  label:'430',  mode:'phone' },
    { w:768,  h:1024, label:'768',  mode:'tablet' },
    { w:1024, h:768,  label:'1024', mode:'desktop' },
    { w:1440, h:900,  label:'1440', mode:'desktop' }
  ];
  var MODE_SIZE = { phone:{w:390,h:844}, tablet:{w:768,h:1024}, desktop:{w:1440,h:900} };

  var PAGES = [
    ['Главная', '/index.html'],
    ['Меренговый рулет', '/meringue-roll/'],
    ['Сертификаты', '/certificates/'],
    ['Заказать звонок', '/call/'],
    ['Галерея', '/gallery/'],
    ['Доставка и оплата', '/dostavka-i-oplata/'],
    ['Отзывы', '/otzyvy/'],
    ['О кондитере', '/o-konditere/'],
    ['Бенто-торты', '/bento-torty/'],
    ['Свадебные торты', '/svadebnye-torty/'],
    ['Торт на день рождения', '/tort-na-den-rozhdeniya/'],
    ['Торт с доставкой', '/tort-s-dostavkoy/'],
    ['Заказать торт СПб', '/zakazat-tort-spb/'],
    ['Пригороды', '/prigorody/'],
    ['Приватность', '/privacy/'],
    ['Страница 404', '/404.html']
  ];
  var PAGE_LABEL = {};
  PAGES.forEach(function(p){ PAGE_LABEL[p[1]] = p[0]; });

  var state = { w:390, h:844, mode:'phone', page:'/index.html', theme:'auto', zoom:'fit' };
  try {
    var saved = JSON.parse(localStorage.getItem('mcvp') || 'null');
    if (saved && saved.w && saved.h && saved.page) {
      state = Object.assign(state, saved);
    }
  } catch (e) {}

  function persist(){
    try { localStorage.setItem('mcvp', JSON.stringify(state)); } catch (e) {}
  }

  // ── элементы ──
  var frame = $('#frame'), device = $('#device'), screenEl = $('#screen'),
      wrap = $('#wrap'), stage = $('#stage');

  // chips ширины
  var widthGroup = $('#widthGroup');
  PRESETS.forEach(function(p){
    var b = document.createElement('button');
    b.textContent = p.label;
    b.dataset.w = p.w; b.dataset.h = p.h; b.dataset.mode = p.mode;
    b.addEventListener('click', function(){
      state.w = p.w; state.h = p.h; state.mode = p.mode;
      render(true);
    });
    widthGroup.appendChild(b);
  });

  // страницы
  var pageSel = $('#pageSel');
  PAGES.forEach(function(p){
    var o = document.createElement('option');
    o.value = p[1]; o.textContent = p[0];
    pageSel.appendChild(o);
  });
  pageSel.addEventListener('change', function(){
    state.page = pageSel.value;
    render(true);
  });

  // режимы
  Array.prototype.forEach.call(document.querySelectorAll('#modeGroup button'), function(b){
    b.addEventListener('click', function(){
      var m = b.dataset.mode;
      state.mode = m;
      state.w = MODE_SIZE[m].w; state.h = MODE_SIZE[m].h;
      render(true);
    });
  });

  // тема
  Array.prototype.forEach.call(document.querySelectorAll('#themeGroup button'), function(b){
    b.addEventListener('click', function(){
      var next = b.dataset.theme;
      var wasAuto = state.theme === 'auto';
      state.theme = next;
      render(next === 'auto' || wasAuto); // авто требует перезагрузки кадра
    });
  });

  // своя ширина
  $('#applySize').addEventListener('click', function(){
    var w = parseInt($('#wIn').value, 10), h = parseInt($('#hIn').value, 10);
    if (!(w >= 280 && w <= 2400 && h >= 400 && h <= 2000)) return;
    state.w = w; state.h = h;
    state.mode = w <= 480 ? 'phone' : (w <= 1024 ? 'tablet' : 'desktop');
    render(true);
  });
  $('#rotate').addEventListener('click', function(){
    var t = state.w; state.w = state.h; state.h = t;
    render(true);
  });

  // масштаб
  $('#zoomSel').addEventListener('change', function(){
    state.zoom = $('#zoomSel').value;
    render(false);
  });

  // перезагрузка
  $('#reload').addEventListener('click', function(){
    try {
      frame.contentWindow.location.replace(state.page + '?_pv=' + Date.now());
    } catch (e) {
      frame.src = state.page + '?_pv=' + Date.now();
    }
  });

  // ── тема внутри кадра ──
  function themeStore(){
    try {
      if (state.theme === 'auto') localStorage.removeItem('mc_theme');
      else localStorage.setItem('mc_theme', state.theme);
    } catch (e) {}
  }
  function themeForce(){
    if (state.theme === 'auto') return;
    try {
      var d = frame.contentDocument;
      if (d && d.documentElement) {
        d.documentElement.setAttribute('data-theme', state.theme);
      }
    } catch (e) {}
  }
  frame.addEventListener('load', themeForce);

  // ── масштабирование аппарата ──
  function fit(){
    var bezel = 18; // padding 9 + border 1
    var s;
    if (state.zoom === 'fit') {
      var availW = Math.max(240, stage.clientWidth - 40);
      var availH = Math.max(240, stage.clientHeight - 40);
      s = Math.min(availW / (state.w + bezel), availH / (state.h + bezel), 1);
    } else {
      s = parseFloat(state.zoom) || 1;
    }
    device.style.transform = 'scale(' + s + ')';
    wrap.style.width = Math.round((state.w + bezel) * s) + 'px';
    wrap.style.height = Math.round((state.h + bezel) * s) + 'px';
    screenEl.style.width = state.w + 'px';
    screenEl.style.height = state.h + 'px';
  }
  window.addEventListener('resize', fit);

  // ── отрисовка состояния ──
  function render(reloadFrame){
    // chips
    Array.prototype.forEach.call(document.querySelectorAll('#widthGroup button'), function(b){
      b.classList.toggle('on', +b.dataset.w === state.w && +b.dataset.h === state.h);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#modeGroup button'), function(b){
      b.classList.toggle('on', b.dataset.mode === state.mode);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#themeGroup button'), function(b){
      b.classList.toggle('on', b.dataset.theme === state.theme);
    });
    $('#wIn').value = state.w;
    $('#hIn').value = state.h;
    pageSel.value = state.page;
    $('#zoomSel').value = state.zoom;
    $('#openNew').href = state.page;

    themeStore();
    fit();

    if (reloadFrame || frame.dataset.page !== state.page) {
      frame.dataset.page = state.page;
      frame.src = state.page;
    } else {
      themeForce();
    }

    var zoomLabel = state.zoom === 'fit' ? 'вписать' : Math.round((parseFloat(state.zoom) || 1) * 100) + '%';
    $('#stateInfo').innerHTML =
      '<b>' + state.w + '×' + state.h + '</b> · ' +
      (PAGE_LABEL[state.page] || state.page) + ' · ' +
      (state.theme === 'auto' ? 'тема страницы' : (state.theme === 'light' ? 'день' : 'ночь')) +
      ' · ' + zoomLabel;

    persist();
  }

  render(true);
})();
</script>
</body>
</html>
"""


class PreviewHandler(http.server.BaseHTTPRequestHandler):
    """Панель просмотра + статика артефакта без service worker."""

    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, root: pathlib.Path, **kwargs):
        self.root = root
        super().__init__(*args, **kwargs)

    def _send(self, body: bytes, content_type: str, status: int = 200,
              compress: bool = True) -> None:
        accepts_gzip = 'gzip' in (self.headers.get('Accept-Encoding') or '')
        if compress and accepts_gzip and len(body) > 512:
            body = gzip.compress(body, 6)
            self.send_response(status)
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
        else:
            self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        # Просмотр всегда свежий: и панель, и артефакт.
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 — имя задано базовым классом
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)

        if path in ('/', '/__preview'):
            return self._send(HARNESS.encode('utf-8'),
                              'text/html; charset=utf-8')

        # Service worker во время просмотра мешает: кэш прячет свежую сборку.
        if path == '/sw.js':
            return self._send(b'service worker disabled in preview',
                              'text/plain; charset=utf-8', 404, compress=False)

        target = (self.root / path.lstrip('/')).resolve()
        if not target.is_relative_to(self.root):
            return self._send(b'not found', 'text/plain; charset=utf-8',
                              404, compress=False)
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_file():
            return self._send(b'not found', 'text/plain; charset=utf-8',
                              404, compress=False)

        suffix = target.suffix.lower()
        content_type = CONTENT_TYPES.get(suffix)
        if content_type:
            return self._send(target.read_bytes(), content_type,
                              compress=suffix in COMPRESSIBLE)
        data = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def log_message(self, *args) -> None:
        pass


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='_site', help='каталог собранного артефакта')
    parser.add_argument('--port', type=int, default=4300)
    # 0.0.0.0: страницу показываем через прокси живого просмотра.
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args(argv)

    root = pathlib.Path(args.root).resolve()
    if not root.is_dir():
        print(f'каталог артефакта не найден: {root} (сначала npm run build:pages)',
              file=sys.stderr)
        return 1

    handler = lambda *a, **kw: PreviewHandler(*a, root=root, **kw)  # noqa: E731
    with ReusableServer((args.host, args.port), handler) as srv:
        print(f'viewport preview: http://{args.host}:{args.port}/ '
              f'(артефакт {root})', flush=True)
        srv.serve_forever()
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
