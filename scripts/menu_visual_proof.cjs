#!/usr/bin/env node
/**
 * Mobile menu visual proof.
 *
 * Dev-only tooling (never shipped): renders the mobile menu at the widths the
 * visual acceptance protocol requires (320 / 360 / 390 / 430 / 768 plus a
 * short landscape) in both themes and stores real screenshots under
 * `_review_screens/menu/` (git-ignored local artefact, force-added by the
 * `Menu visual proof` workflow so the PR carries actual pixels).
 *
 * Usage:
 *   node scripts/menu_visual_proof.cjs --base=http://127.0.0.1:4173 --prefix=after
 *   node scripts/menu_visual_proof.cjs --base=https://milovicake.ru --prefix=before
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = {};
for (const raw of process.argv.slice(2)) {
  const m = /^--([\w-]+)=(.*)$/.exec(raw);
  if (m) args[m[1]] = m[2];
}

const BASE = args.base || 'http://127.0.0.1:4173';
const OUT = path.resolve(args.out || '_review_screens/menu');
const PREFIX = args.prefix || 'after';
const ONLY = args.only ? args.only.split(',') : null;

/** Width × height pairs from the visual protocol + short-viewport stress cases. */
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 390, height: 420 },   // низкая высота (открытая клавиатура / малый экран)
  { width: 667, height: 375 },   // телефон в landscape (ширина остаётся мобильной)
];

const THEMES = ['light', 'dark'];

async function openMenu(page) {
  const burger = page.locator('#burgerBtn');
  if (!(await burger.count())) return false;
  if (!(await burger.isVisible())) return false;
  await burger.click();
  await page.waitForTimeout(420);
  return page.evaluate(() => {
    const menu = document.getElementById('mobileMenu');
    return !!menu && menu.classList.contains('open');
  });
}

/** Geometry summary used for regression annotations. */
function measure() {
  const menu = document.getElementById('mobileMenu');
  if (!menu) return null;
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const rows = Array.from(menu.querySelectorAll('.mobile-menu-nav a, .mm-chip, .mm-sublink, .mm-msg, .mm-call, .mm-theme-opt'));
  const body = menu.querySelector('.mobile-menu-body');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clipped = rows
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ el }) => (el.textContent || '').trim().slice(0, 28));
  const overflowX = rows
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.left < -0.5 || r.right > vw + 0.5)
    .map(({ el }) => (el.textContent || '').trim().slice(0, 28));
  return {
    open: menu.classList.contains('open'),
    vw,
    vh,
    menu: box(menu),
    head: box(menu.querySelector('.mobile-menu-head')),
    foot: box(menu.querySelector('.mobile-menu-foot')),
    bodyScrolls: body ? body.scrollHeight > body.clientHeight + 1 : false,
    bodyOverflow: body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0,
    rows: rows.length,
    rowsAboveFold: rows.filter((el) => el.getBoundingClientRect().bottom <= vh + 0.5).length,
    tapTooSmall: clipped,
    overflowX,
    theme: document.documentElement.getAttribute('data-theme'),
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  for (const viewport of VIEWPORTS) {
    if (ONLY && !ONLY.includes(String(viewport.width))) continue;
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 2,
        isMobile: viewport.width <= 430,
        hasTouch: viewport.width <= 430,
        locale: 'ru-RU',
      });
      await context.addInitScript((themeValue) => {
        try {
          localStorage.setItem('mc_theme', themeValue);
          localStorage.setItem('milovi_analytics_consent_v1', 'denied');
        } catch (e) {}
        document.documentElement.setAttribute('data-theme', themeValue);
      }, theme);
      const page = await context.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      const opened = await openMenu(page);
      const file = path.join(OUT, `${PREFIX}-${viewport.width}x${viewport.height}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: false });
      let stats = null;
      if (opened) {
        stats = await page.evaluate(measure);
        report.push({ viewport, theme, ...stats });
      }
      await context.close();
    }
  }
  // Вторая историческая разметка жила в пригородах — снимаем её отдельно,
  // чтобы «было/стало» было видно и там, а не только на главной.
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
    await context.addInitScript((themeValue) => {
      try {
        localStorage.setItem('mc_theme', themeValue);
        localStorage.setItem('milovi_analytics_consent_v1', 'denied');
      } catch (e) {}
      document.documentElement.setAttribute('data-theme', themeValue);
    }, theme);
    const page = await context.newPage();
    await page.goto(`${BASE}/prigorody/pushkin/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const opened = await openMenu(page);
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-390x844-${theme}-suburb.png`), fullPage: false });
    if (opened) {
      const stats = await page.evaluate(measure);
      report.push({ viewport: { width: 390, height: 844 }, theme, page: '/prigorody/pushkin/', ...stats });
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, `${PREFIX}-report.json`), JSON.stringify(report, null, 2));
  for (const row of report) {
    const flags = [];
    if (!row.open) flags.push('NOT-OPEN');
    if (row.tapTooSmall.length) flags.push(`tap<44:${row.tapTooSmall.join('|')}`);
    if (row.overflowX.length) flags.push(`overflowX:${row.overflowX.join('|')}`);
    if (row.menu && row.menu.h > row.vh + 1) flags.push(`menu taller than viewport (${row.menu.h}>${row.vh})`);
    console.log(`::notice title=Menu ${PREFIX} ${row.vw}x${row.vh} ${row.theme}::` +
      `rows=${row.rows} aboveFold=${row.rowsAboveFold} bodyScroll=${row.bodyOverflow}px ` +
      `head=${row.head ? row.head.h : '?'} foot=${row.foot ? row.foot.h : '?'}` +
      (flags.length ? ` | ${flags.join(' ')}` : ' | ok'));
  }
  console.log(`Saved ${report.length} menu screenshots to ${OUT}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
