#!/usr/bin/env python3
"""One-shot migration: insert the [P100] first-paint layout skip snippet
before </head> of every source page that has a <main> element.

The snippet is idempotent: a page that already contains the marker is skipped.
Regenerate prigorody city pages afterwards via `npm run build:prigorody`.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SNIPPET = """  <!-- [P100] Детерминированный пропуск offscreen-layout на первом кадре:
       content-visibility:auto для секций ниже сгиба работает только до 2 кадров
       после FCP (или до первого взаимодействия / жёсткого таймаута 1500 мс),
       затем класс снимается и документ раскладывается точно как раньше.
       Без JavaScript и в браузерах без content-visibility класс не добавляется —
       обычная отрисовка. Геометрия после загрузки идентична базовой. -->
  <style id="mc-fast-init-css">
    html.mc-fast-init main > *:not(#home):not(.section-fade-divider){content-visibility:auto;contain-intrinsic-size:auto 1000px}
  </style>
  <script>
    (function(){
      var d=document.documentElement;
      d.classList.add('mc-fast-init');
      var done=false;
      function rm(){if(done)return;done=true;d.classList.remove('mc-fast-init');}
      function after2raf(){requestAnimationFrame(function(){requestAnimationFrame(rm);});}
      try{var po=new PerformanceObserver(function(list){for(var i=0;i<list.getEntries().length;i++){if(list.getEntries()[i].name==='first-contentful-paint'){po.disconnect();after2raf();}}});po.observe({type:'paint',buffered:true});}catch(e){after2raf();}
      window.addEventListener('load',function(){setTimeout(after2raf,0);},false);
      setTimeout(rm,1500);
      window.addEventListener('pageshow',function(){setTimeout(rm,50);},false);
      window.addEventListener('pointerdown',rm,{once:true,passive:true,capture:true});
      window.addEventListener('keydown',rm,{once:true,passive:true,capture:true});
      window.addEventListener('wheel',rm,{once:true,passive:true,capture:true});
      window.addEventListener('touchstart',rm,{once:true,passive:true,capture:true});
    })();
  </script>
"""

TARGETS = [
    'index.html',
    'bento-torty/index.html',
    'detskie-torty/index.html',
    'dostavka-i-oplata/index.html',
    'gallery/index.html',
    'meringue-roll/index.html',
    'o-konditere/index.html',
    'otzyvy/index.html',
    'privacy/index.html',
    'svadebnye-torty/index.html',
    'tort-na-den-rozhdeniya/index.html',
    'tort-s-dostavkoy/index.html',
    'zakazat-tort-spb/index.html',
    'prigorody/index.html',
    'prigorody/_template.html',
]

MARKER = '[P100] Детерминированный пропуск'


def main() -> None:
    for rel in TARGETS:
        p = ROOT / rel
        html = p.read_text(encoding='utf-8')
        if MARKER in html:
            print(f'skip (already present): {rel}')
            continue
        if '<main' not in html:
            print(f'skip (no <main>): {rel}')
            continue
        if html.count('</head>') != 1:
            raise SystemExit(f'{rel}: expected exactly one </head>')
        p.write_text(html.replace('</head>', SNIPPET + '</head>'), encoding='utf-8')
        print(f'patched: {rel}')


if __name__ == '__main__':
    main()
