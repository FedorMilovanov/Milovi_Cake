const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT_ROOT = path.join(process.cwd(), 'test-results', 'ui-audit', 'index-forensic');
const SECTIONS = [
  ['home', '#home'],
  ['about', '#about'],
  ['catalog', '#catalog'],
  ['fillings', '#fillings'],
  ['calculator', '.calc-wrap'],
  ['reviews', '#reviews'],
  ['why', '#why'],
  ['delivery', '.geo-section'],
  ['content', '.content-block'],
  ['contacts', '#contacts'],
  ['footer', '.site-footer'],
];

let projectName = 'unknown';
let checks = 0;
const findings = [];
const evidence = {};

function safe(value) {
  return String(value).replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function ensureOut() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
}

function filePath(name, extension = 'png') {
  ensureOut();
  return path.join(OUT_ROOT, `${safe(projectName)}-${safe(name)}.${extension}`);
}

function record(severity, checkName, ok, message, data = null) {
  checks += 1;
  if (!ok || severity === 'info') {
    findings.push({ severity: ok ? 'info' : severity, check: checkName, message, data });
  }
  return ok;
}

async function attempt(checkName, task, severity = 'critical') {
  try {
    const result = await task();
    record('info', checkName, true, 'Выполнено', result === undefined ? null : result);
    return result;
  } catch (error) {
    record(severity, checkName, false, error && error.message ? error.message : String(error));
    return null;
  }
}

async function setThemeAndConsent(page, theme, consent = 'denied') {
  await page.addInitScript(({ themeValue, consentValue }) => {
    try {
      localStorage.setItem('mc_theme', themeValue);
      if (consentValue === null) localStorage.removeItem('milovi_analytics_consent_v1');
      else localStorage.setItem('milovi_analytics_consent_v1', consentValue);
    } catch (_) {}
    if (document.documentElement) document.documentElement.setAttribute('data-theme', themeValue);
  }, { themeValue: theme, consentValue: consent });
}

async function openIndex(page, theme = 'light', consent = 'denied') {
  await setThemeAndConsent(page, theme, consent);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('ready'), null, { timeout: 10000 });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    document.querySelectorAll('video').forEach((video) => {
      try {
        video.pause();
        if (Number.isFinite(video.duration) && video.duration > 0.2) video.currentTime = 0.1;
      } catch (_) {}
    });
  });
  await page.addStyleTag({ content: `
    html { scroll-behavior: auto !important; }
    body *, body *::before, body *::after { caret-color: transparent !important; }
  ` });
  await page.waitForTimeout(180);
}

async function warmLazyContent(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const bottom = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const step = Math.max(420, Math.round(innerHeight * 0.72));
    for (let y = 0; y <= bottom; y += step) {
      scrollTo(0, y);
      await sleep(45);
    }
    scrollTo(0, bottom);
    await sleep(140);
    scrollTo(0, 0);
    await sleep(100);
  });
}

async function shot(locator, name) {
  if (await locator.count() === 0) return false;
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().screenshot({ path: filePath(name), animations: 'disabled' });
  return true;
}

async function scanDocument(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const idOrClass = (el) => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${Array.from(el.classList || []).slice(0, 3).join('.')}`;
    const duplicateIds = Object.entries(Array.from(document.querySelectorAll('[id]')).reduce((map, el) => {
      map[el.id] = (map[el.id] || 0) + 1;
      return map;
    }, {})).filter(([, count]) => count > 1);
    const unlabeledFields = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')).filter((el) => {
      if (!visible(el)) return false;
      const explicit = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      return !explicit && !el.closest('label') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
    }).map(idOrClass);
    const unnamedButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter((el) => {
      if (!visible(el)) return false;
      return !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    }).map(idOrClass);
    const missingAlt = Array.from(document.images).filter((img) => visible(img) && !img.hasAttribute('alt')).map(idOrClass);
    const brokenImages = Array.from(document.images).filter((img) => visible(img) && img.complete && img.naturalWidth < 2).map((img) => img.currentSrc || img.src || idOrClass(img));
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const offscreen = Array.from(document.querySelectorAll('main *, footer *')).filter((el) => {
      if (!visible(el)) return false;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') return false;
      if (el.closest('.review-track,.reviews-track,.carousel,.slider,.lightbox,.lb-overlay,.cart-drawer,.mobile-menu,.mc-sheet')) return false;
      const rect = el.getBoundingClientRect();
      return rect.left < -6 || rect.right > innerWidth + 6;
    }).slice(0, 30).map((el) => ({ element: idOrClass(el), rect: el.getBoundingClientRect().toJSON() }));
    const clippedText = Array.from(document.querySelectorAll('main p,main span,main a,main button,main h1,main h2,main h3,footer span,footer a')).filter((el) => {
      if (!visible(el) || !(el.textContent || '').trim()) return false;
      const style = getComputedStyle(el);
      const clips = ['hidden', 'clip'].includes(style.overflow) || ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
      return clips && (el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3);
    }).slice(0, 40).map((el) => ({ element: idOrClass(el), text: (el.textContent || '').trim().slice(0, 100) }));
    const tinyLeafText = Array.from(document.querySelectorAll('main *,footer *')).filter((el) => {
      if (!visible(el) || el.children.length || !(el.textContent || '').trim()) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 10;
    }).slice(0, 40).map((el) => ({ element: idOrClass(el), size: getComputedStyle(el).fontSize, text: el.textContent.trim().slice(0, 80) }));
    const blankWithoutNoopener = Array.from(document.querySelectorAll('a[target="_blank"]')).filter((a) => !/\bnoopener\b/.test(a.getAttribute('rel') || '')).map((a) => a.href);
    const nestedInteractive = Array.from(document.querySelectorAll('a button,button a,a input,button input')).filter(visible).map((el) => idOrClass(el));
    const headingLevels = Array.from(document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')).filter(visible).map((el) => ({ level: Number(el.tagName.slice(1)), text: el.textContent.trim().slice(0, 80) }));
    const headingJumps = [];
    for (let index = 1; index < headingLevels.length; index += 1) {
      if (headingLevels[index].level - headingLevels[index - 1].level > 1) headingJumps.push([headingLevels[index - 1], headingLevels[index]]);
    }
    const anchors = Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => {
      const href = a.getAttribute('href');
      let exists = href === '#';
      try { if (!exists) exists = Boolean(document.querySelector(href)); } catch (_) { exists = false; }
      return { href, text: a.textContent.trim().slice(0, 80), exists };
    });
    const fixed = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (!visible(el)) return false;
      return ['fixed', 'sticky'].includes(getComputedStyle(el).position);
    }).map((el) => ({ element: idOrClass(el), position: getComputedStyle(el).position, zIndex: getComputedStyle(el).zIndex, rect: el.getBoundingClientRect().toJSON() }));
    return {
      title: document.title,
      lang: document.documentElement.lang,
      theme: document.documentElement.getAttribute('data-theme'),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, overflow },
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      duplicateIds,
      unlabeledFields,
      unnamedButtons,
      missingAlt,
      brokenImages,
      offscreen,
      clippedText,
      tinyLeafText,
      blankWithoutNoopener,
      nestedInteractive,
      headingJumps,
      anchors,
      fixed,
    };
  });
}

function gradeScan(scan, theme) {
  record('critical', `${theme}: один H1`, scan.h1Count === 1, `Найдено H1: ${scan.h1Count}`, scan.h1Count);
  record('critical', `${theme}: один main`, scan.mainCount === 1, `Найдено main: ${scan.mainCount}`, scan.mainCount);
  record('critical', `${theme}: язык документа`, scan.lang === 'ru', `lang=${scan.lang}`, scan.lang);
  record('critical', `${theme}: горизонтальный overflow`, scan.document.overflow <= 4, `Overflow: ${scan.document.overflow}px`, scan.document);
  record('critical', `${theme}: уникальные id`, scan.duplicateIds.length === 0, `Дубли ID: ${scan.duplicateIds.length}`, scan.duplicateIds);
  record('critical', `${theme}: подписанные поля`, scan.unlabeledFields.length === 0, `Неподписанные поля: ${scan.unlabeledFields.length}`, scan.unlabeledFields);
  record('critical', `${theme}: именованные кнопки`, scan.unnamedButtons.length === 0, `Кнопки без имени: ${scan.unnamedButtons.length}`, scan.unnamedButtons);
  record('critical', `${theme}: alt у изображений`, scan.missingAlt.length === 0, `Изображения без alt: ${scan.missingAlt.length}`, scan.missingAlt);
  record('critical', `${theme}: изображения загружены`, scan.brokenImages.length === 0, `Битые изображения: ${scan.brokenImages.length}`, scan.brokenImages);
  record('critical', `${theme}: внутренние якоря`, scan.anchors.every((item) => item.exists), `Битые якоря: ${scan.anchors.filter((item) => !item.exists).length}`, scan.anchors.filter((item) => !item.exists));
  record('critical', `${theme}: noopener`, scan.blankWithoutNoopener.length === 0, `target=_blank без noopener: ${scan.blankWithoutNoopener.length}`, scan.blankWithoutNoopener);
  record('critical', `${theme}: вложенные интерактивы`, scan.nestedInteractive.length === 0, `Вложенные интерактивы: ${scan.nestedInteractive.length}`, scan.nestedInteractive);
  record('info', `${theme}: элементы за viewport`, scan.offscreen.length === 0, `Подозрительных элементов: ${scan.offscreen.length}`, scan.offscreen);
  record('info', `${theme}: обрезанный текст`, scan.clippedText.length === 0, `Подозрений: ${scan.clippedText.length}`, scan.clippedText);
  record('info', `${theme}: текст меньше 10px`, scan.tinyLeafText.length === 0, `Элементов: ${scan.tinyLeafText.length}`, scan.tinyLeafText);
  record('info', `${theme}: иерархия заголовков`, scan.headingJumps.length === 0, `Скачков уровней: ${scan.headingJumps.length}`, scan.headingJumps);
}

async function contactMetrics(page) {
  return page.evaluate(() => {
    const style = (selector, pseudo = null) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo);
      const rect = el.getBoundingClientRect();
      return {
        color: cs.color,
        fill: cs.fill,
        stroke: cs.stroke,
        strokeWidth: cs.strokeWidth,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        borderColor: cs.borderColor,
        opacity: Number(cs.opacity),
        display: cs.display,
        position: cs.position,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      };
    };
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      body: style('body'),
      contacts: style('#contacts'),
      darkCard: style('#contacts .card.card--dark'),
      formCard: style('#contacts .card:not(.card--dark)'),
      phone: style('#contacts .contact-primary-icon'),
      phonePath: style('#contacts .contact-primary-icon svg path'),
      dividerBefore: style('#contacts .social-divider', '::before'),
      dividerAfter: style('#contacts .social-divider', '::after'),
      footerBottom: style('.site-footer .footer-bottom'),
    };
  });
}

async function labelGeometry(page, inputSelector) {
  return page.evaluate((selector) => {
    const input = document.querySelector(selector);
    const group = input && input.parentElement;
    const label = group && group.querySelector('label');
    if (!input || !group || !label) return null;
    const groupRect = group.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const after = getComputedStyle(group, '::after');
    return {
      groupTop: groupRect.top,
      labelTop: labelRect.top,
      labelCenter: labelRect.top + labelRect.height / 2,
      distanceToContour: Math.abs(labelRect.top + labelRect.height / 2 - groupRect.top),
      afterDisplay: after.display,
      afterContent: after.content,
      groupBorder: getComputedStyle(group).border,
      inputBorder: getComputedStyle(input).border,
    };
  }, inputSelector);
}

function numberFrom(text) {
  return Number(String(text || '').replace(/[^0-9]/g, ''));
}

function writeReport() {
  ensureOut();
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const ordered = [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const screenshotCount = fs.readdirSync(OUT_ROOT).filter((name) => name.startsWith(`${safe(projectName)}-`) && name.endsWith('.png')).length;
  const report = {
    project: projectName,
    generatedAt: new Date().toISOString(),
    checks,
    screenshotCount,
    critical: ordered.filter((item) => item.severity === 'critical').length,
    warnings: ordered.filter((item) => item.severity === 'warning').length,
    findings: ordered,
    evidence,
  };
  fs.writeFileSync(filePath('report', 'json'), JSON.stringify(report, null, 2), 'utf8');
  const lines = [
    `# INDEX forensic audit — ${projectName}`,
    '',
    `- Проверок: **${report.checks}**`,
    `- Скриншотов: **${report.screenshotCount}**`,
    `- Критических замечаний: **${report.critical}**`,
    `- Предупреждений: **${report.warnings}**`,
    '',
    '## Замечания',
    '',
  ];
  if (!ordered.filter((item) => item.severity !== 'info').length) lines.push('Критических и визуальных предупреждений не найдено.');
  for (const item of ordered.filter((entry) => entry.severity !== 'info')) {
    lines.push(`### ${item.severity === 'critical' ? 'КРИТИЧНО' : 'ДОШЛИФОВАТЬ'} — ${item.check}`);
    lines.push('');
    lines.push(item.message);
    if (item.data !== null && item.data !== undefined) {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(item.data, null, 2).slice(0, 5000));
      lines.push('```');
    }
    lines.push('');
  }
  fs.writeFileSync(filePath('report', 'md'), lines.join('\n'), 'utf8');
}

test.describe('INDEX forensic audit', () => {
  test.skip(process.env.INDEX_FORENSIC !== '1', 'Запускается отдельным forensic workflow');
  test.beforeAll(async ({}, workerInfo) => {
    projectName = workerInfo.project.name;
    ensureOut();
  });
  test.afterAll(() => writeReport());

  test('01 — полный визуальный атлас INDEX: desktop/mobile × day/night', async ({ page }) => {
    test.setTimeout(180000);
    const runtime = { consoleErrors: [], pageErrors: [], requestFailures: [] };
    page.on('console', (message) => { if (message.type() === 'error') runtime.consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => runtime.pageErrors.push(String(error && error.stack || error)));
    page.on('requestfailed', (request) => runtime.requestFailures.push({ url: request.url(), error: request.failure() && request.failure().errorText }));

    for (const theme of ['light', 'dark']) {
      await attempt(`${theme}: загрузить INDEX`, async () => openIndex(page, theme, 'denied'));
      await attempt(`${theme}: прогреть lazy-контент`, async () => warmLazyContent(page));
      await attempt(`${theme}: полный скриншот`, async () => page.screenshot({ path: filePath(`${theme}-index-full`), fullPage: true, animations: 'allow' }));
      for (const [name, selector] of SECTIONS) {
        await attempt(`${theme}: секция ${name}`, async () => {
          const locator = page.locator(selector).first();
          if (await locator.count() !== 1) throw new Error(`Селектор ${selector}: найдено ${await locator.count()}`);
          await shot(locator, `${theme}-${name}`);
        });
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(160);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(160);
      const scan = await attempt(`${theme}: DOM/геометрический скан`, async () => scanDocument(page));
      if (scan) {
        evidence[`scan_${theme}`] = scan;
        gradeScan(scan, theme);
      }
    }
    const meaningfulConsole = runtime.consoleErrors.filter((text) => !/ResizeObserver loop|favicon/i.test(text));
    const meaningfulFailures = runtime.requestFailures.filter((item) => !/fonts\.(googleapis|gstatic)\.com/.test(item.url));
    record('critical', 'Runtime: page errors', runtime.pageErrors.length === 0, `Ошибок: ${runtime.pageErrors.length}`, runtime.pageErrors);
    record('warning', 'Runtime: console errors', meaningfulConsole.length === 0, `Ошибок: ${meaningfulConsole.length}`, meaningfulConsole);
    record('warning', 'Runtime: failed requests', meaningfulFailures.length === 0, `Сбоев: ${meaningfulFailures.length}`, meaningfulFailures);
    evidence.runtime = runtime;
  });

  test('02 — тема, форма, телефон, соцсети и footer без регрессий', async ({ page }) => {
    test.setTimeout(90000);
    await attempt('Открыть контакты в светлой теме', async () => openIndex(page, 'light', 'denied'));
    await attempt('Прокрутить к контактам', async () => page.locator('#contacts').scrollIntoViewIfNeeded());
    const light = await attempt('Снять метрики светлой темы', async () => contactMetrics(page));
    await attempt('Скрин контактов light', async () => shot(page.locator('#contacts'), 'contact-light-live'));
    await attempt('Переключить тему light → dark', async () => {
      await page.evaluate(() => window.toggleTheme());
      await page.waitForTimeout(360);
    });
    const dark = await attempt('Снять метрики тёмной темы', async () => contactMetrics(page));
    await attempt('Скрин контактов dark', async () => shot(page.locator('#contacts'), 'contact-dark-live'));
    await attempt('Скрин footer dark', async () => shot(page.locator('.site-footer .footer-bottom'), 'footer-dark-live'));

    if (light && dark) {
      record('critical', 'Theme: атрибут dark', dark.theme === 'dark', `Получено: ${dark.theme}`, dark);
      record('critical', 'Theme: фон body меняется', light.body.backgroundColor !== dark.body.backgroundColor, 'Фон body одинаковый', { light: light.body, dark: dark.body });
      record('critical', 'Theme: форма меняет поверхность', `${light.formCard.backgroundColor}|${light.formCard.backgroundImage}` !== `${dark.formCard.backgroundColor}|${dark.formCard.backgroundImage}`, 'Карточка формы не меняется', { light: light.formCard, dark: dark.formCard });
      record('critical', 'Theme: footer меняет поверхность', `${light.footerBottom.backgroundColor}|${light.footerBottom.backgroundImage}` !== `${dark.footerBottom.backgroundColor}|${dark.footerBottom.backgroundImage}`, 'Footer не адаптируется', { light: light.footerBottom, dark: dark.footerBottom });
      record('critical', 'Phone: иконка видима', Boolean(dark.phone && dark.phone.width >= 32 && dark.phone.height >= 32), 'Иконка отсутствует/слишком мала', dark.phone);
      record('critical', 'Phone: тонкий outline без заливки', Boolean(dark.phonePath && dark.phonePath.fill === 'none' && dark.phonePath.stroke !== 'none' && parseFloat(dark.phonePath.strokeWidth) >= 1.3 && parseFloat(dark.phonePath.strokeWidth) <= 2.2), 'Неверный fill/stroke', dark.phonePath);
      record('critical', 'Social divider: левая линия', Boolean(dark.dividerBefore && dark.dividerBefore.opacity > 0.9 && dark.dividerBefore.width > 30 && dark.dividerBefore.backgroundImage.includes('gradient')), 'Левая линия пропала', dark.dividerBefore);
      record('critical', 'Social divider: правая линия', Boolean(dark.dividerAfter && dark.dividerAfter.opacity > 0.9 && dark.dividerAfter.width > 30 && dark.dividerAfter.backgroundImage.includes('gradient')), 'Правая линия пропала', dark.dividerAfter);
    }

    await attempt('Фокус floating-label имени', async () => {
      await page.locator('#fname').focus();
      await page.waitForTimeout(320);
    });
    const focused = await attempt('Геометрия floating-label на фокусе', async () => labelGeometry(page, '#fname'));
    if (focused) {
      record('critical', 'Floating label: точно на верхнем контуре', focused.distanceToContour <= 4, `Отклонение ${focused.distanceToContour.toFixed(2)}px`, focused);
      record('critical', 'Floating label: нет второй рамки input', /0px none/.test(focused.inputBorder) || focused.inputBorder === '0px none rgb(0, 0, 0)', `Input border: ${focused.inputBorder}`, focused);
      record('critical', 'Floating label: нет нижней декоративной полосы', focused.afterDisplay === 'none' || focused.afterContent === 'none' || focused.afterContent === 'normal', `::after display=${focused.afterDisplay}, content=${focused.afterContent}`, focused);
    }
    await attempt('Заполнить floating-label', async () => {
      await page.locator('#fname').fill('Виктория');
      await page.locator('#fphone').focus();
      await page.waitForTimeout(260);
    });
    const filled = await attempt('Геометрия заполненного floating-label', async () => labelGeometry(page, '#fname'));
    if (filled) record('critical', 'Floating label: остаётся на контуре после заполнения', filled.distanceToContour <= 4, `Отклонение ${filled.distanceToContour.toFixed(2)}px`, filled);
    await attempt('Скрин фокуса формы', async () => shot(page.locator('#contacts .card:not(.card--dark)'), 'form-floating-label-focus'));

    const social = await attempt('Проверить цветные social icons', async () => page.locator('#contacts .social-link').evaluateAll((links) => links.map((link) => ({ classes: link.className, color: getComputedStyle(link).color, borderColor: getComputedStyle(link).borderColor, background: getComputedStyle(link).backgroundColor }))));
    if (social) record('critical', 'Social: сохранена цветовая идентичность', new Set(social.map((item) => item.color)).size >= 4, 'Социальные иконки стали одноцветными/плоскими', social);

    await attempt('Переключить тему dark → light', async () => {
      await page.evaluate(() => window.toggleTheme());
      await page.waitForTimeout(360);
    });
    const lightAgain = await attempt('Метрики light после round-trip', async () => contactMetrics(page));
    if (light && lightAgain) {
      record('critical', 'Theme round-trip: вернулся light', lightAgain.theme === 'light', `Получено: ${lightAgain.theme}`, lightAgain);
      record('critical', 'Theme round-trip: divider не исчез', lightAgain.dividerBefore.opacity > 0.9 && lightAgain.dividerAfter.opacity > 0.9, 'Divider исчез после повторного переключения', lightAgain);
      record('critical', 'Theme round-trip: телефон не откатился', lightAgain.phonePath.fill === 'none' && lightAgain.phonePath.stroke !== 'none', 'Телефон откатился к старой заливке', lightAgain.phonePath);
    }
    evidence.contactThemes = { light, dark, lightAgain, focused, filled, social };
  });

  test('03 — прокликивание навигации, калькулятора, вкладок, FAQ, отзывов, корзины и privacy', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(12000);
    const mobile = testInfo.project.name.includes('mobile');
    const viewport = page.viewportSize();
    await attempt('Открыть INDEX для интерактивов', async () => openIndex(page, 'dark', 'denied'));

    const anchorAudit = await attempt('Проверить все hash-якоря', async () => page.evaluate(() => Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => {
      const href = a.getAttribute('href');
      let exists = href === '#';
      try { if (!exists) exists = Boolean(document.querySelector(href)); } catch (_) { exists = false; }
      return { href, text: a.textContent.trim().slice(0, 70), exists };
    })));
    if (anchorAudit) record('critical', 'Навигация: все якоря существуют', anchorAudit.every((item) => item.exists), 'Есть битые якоря', anchorAudit.filter((item) => !item.exists));

    await attempt('Skip-link работает', async () => {
      await page.locator('.skip-link').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      if (!/#main-content$/.test(page.url())) throw new Error(`URL после skip-link: ${page.url()}`);
    });

    if (mobile) {
      await attempt('Mobile: одна нижняя навигация', async () => {
        const visible = await page.evaluate(() => ['mcNav', 'bottomNav', 'mrBottomNav'].map((id) => document.getElementById(id)).filter(Boolean).filter((el) => {
          const s = getComputedStyle(el); const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        }).map((el) => el.id));
        if (JSON.stringify(visible) !== JSON.stringify(['mcNav'])) throw new Error(`Видимые nav: ${JSON.stringify(visible)}`);
        return visible;
      });
      await attempt('Mobile: пять действий', async () => {
        const labels = await page.locator('#mcNav .mc-btn-label').allTextContents();
        const expected = ['Каталог', 'Начинки', 'Отзывы', 'Заказать', 'Ещё'];
        if (JSON.stringify(labels) !== JSON.stringify(expected)) throw new Error(JSON.stringify(labels));
      });
      for (const [label, selector] of [['Каталог', '#catalog'], ['Начинки', '#fillings'], ['Отзывы', '#reviews']]) {
        await attempt(`Mobile nav: ${label}`, async () => {
          await page.locator('#mcNav .mc-btn', { hasText: label }).click();
          const deadline = Date.now() + 4200;
          let top = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
          while (top > viewport.height * 0.55 && Date.now() < deadline) {
            await page.waitForTimeout(120);
            top = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
          }
          if (top > viewport.height * 0.55) throw new Error(`Цель слишком низко после settle: ${top}px`);
          return { label, selector, top };
        });
      }
      await attempt('Mobile burger: открыть/закрыть', async () => {
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(420);
        await page.locator('#burgerBtn').click();
        if (!(await page.locator('#mobileMenu').evaluate((el) => el.classList.contains('open')))) throw new Error('Меню не открылось');
        await shot(page.locator('#mobileMenu'), 'mobile-burger-open');
        await page.locator('.mobile-menu-close').click();
      });
      await attempt('Mobile Ещё: sheet и privacy row', async () => {
        await page.locator('#mcMoreBtn').click();
        if (!(await page.locator('#mcPrivacyRow').isVisible())) throw new Error('Privacy row не виден');
        await shot(page.locator('#mcSheet'), 'mobile-more-open');
        await page.evaluate(() => window.closeMcSheet && window.closeMcSheet());
      });
    } else {
      for (const [label, selector] of [['О нас', '#about'], ['Каталог', '#catalog'], ['Начинки', '#fillings'], ['Отзывы', '#reviews'], ['Контакты', '#contacts']]) {
        await attempt(`Desktop nav: ${label}`, async () => {
          await page.locator('.header-nav a', { hasText: label }).first().click();
          await page.waitForTimeout(160);
          const top = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
          if (top > 210) throw new Error(`Цель слишком низко: ${top}px`);
        });
      }
    }

    await attempt('Calculator: прокрутить', async () => page.locator('.calc-wrap').scrollIntoViewIfNeeded());
    const calcVariants = [];
    for (const type of ['biscuit', 'bento', 'bentomaxi', 'cake3d']) {
      await attempt(`Calculator type: ${type}`, async () => {
        const card = page.locator(`#calcType .calc-type-card[data-type="${type}"]`);
        await card.click();
        await page.waitForTimeout(160);
        if (!(await card.evaluate((el) => el.classList.contains('selected')))) throw new Error('Карточка не selected');
        const priceText = await page.locator('#calcResult').textContent();
        const price = numberFrom(priceText);
        if (!(price > 0)) throw new Error(`Цена: ${priceText}`);
        calcVariants.push({ type, price, priceText });
        await shot(page.locator('.calc-wrap'), `calc-${type}`);
      });
    }
    await attempt('Calculator: weight stepper', async () => {
      await page.locator('#calcType .calc-type-card[data-type="biscuit"]').click();
      const before = await page.locator('#calcWeightVal').textContent();
      await page.locator('#calcWeightPlus').click();
      const after = await page.locator('#calcWeightVal').textContent();
      if (before === after) throw new Error('Вес не изменился');
      await page.locator('#calcWeightMinus').click();
    });
    await attempt('Calculator: qty stepper', async () => {
      await page.locator('#calcType .calc-type-card[data-type="bento"]').click();
      const before = await page.locator('#calcQtyVal').textContent();
      await page.locator('#calcQtyPlus').click();
      const after = await page.locator('#calcQtyVal').textContent();
      if (before === after) throw new Error('Количество не изменилось');
      await page.locator('#calcQtyMinus').click();
    });
    await attempt('Calculator → cart', async () => {
      await page.locator('#calcType .calc-type-card[data-type="biscuit"]').click();
      const before = numberFrom(await page.locator('#cartBadge').textContent());
      if (mobile) {
        const panel = page.locator('.calc-right-col');
        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) {
          const bar = page.locator('#calcCollapsedBar');
          const hit = await bar.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const top = document.elementFromPoint(x, y);
            return {
              bar: rect.toJSON(),
              topElement: top ? (top.id ? `#${top.id}` : `${top.tagName.toLowerCase()}.${Array.from(top.classList).slice(0,3).join('.')}`) : null,
              calculatorZ: document.getElementById('fillings') ? getComputedStyle(document.getElementById('fillings')).zIndex : null,
              panelZ: el.closest('.calc-right-col') ? getComputedStyle(el.closest('.calc-right-col')).zIndex : null,
            };
          });
          evidence.mobileCalculatorHitTest = hit;
          await bar.click();
          await page.waitForTimeout(480);
        }
        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) throw new Error('Мобильная панель результата не раскрылась');
      } else {
        await page.locator('.calc-add-btn').scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(180);
      await page.locator('.calc-add-btn').click();
      await page.waitForTimeout(200);
      const after = numberFrom(await page.locator('#cartBadge').textContent());
      if (after <= before) throw new Error(`Badge ${before} → ${after}`);
      if (mobile) {
        const mobileCart = page.locator('#mcNav .mc-btn--order');
        if (!(await mobileCart.isVisible())) throw new Error('Мобильная кнопка корзины «Заказать» не видна');
        await mobileCart.click();
      } else {
        await page.locator('#cartBtn').click();
      }
      if ((await page.locator('#cartDrawer').getAttribute('aria-hidden')) !== 'false') throw new Error('Корзина не открылась');
      await shot(page.locator('#cartDrawer'), 'cart-open');
      await page.locator('.cart-close').click();
    });

    for (const tabId of ['vanilla', 'choco', 'classic']) {
      await attempt(`Flavor tab: ${tabId}`, async () => {
        const tab = page.locator(`.cb-ftab[onclick*="${tabId}"]`);
        await tab.click();
        if (!(await page.locator(`#cb-${tabId}`).evaluate((el) => el.classList.contains('cb-on')))) throw new Error('Панель не активна');
      });
    }
    await attempt('FAQ: открыть первые четыре', async () => {
      const faq = page.locator('.cb-faq-item');
      const count = Math.min(4, await faq.count());
      if (count < 4) throw new Error(`FAQ count=${count}`);
      for (let index = 0; index < count; index += 1) {
        const item = faq.nth(index);
        await item.click();
        await page.waitForTimeout(80);
        const open = await item.evaluate((el) => el.classList.contains('open') || el.classList.contains('cb-open') || el.querySelector('.cb-faq-a').getBoundingClientRect().height > 10);
        if (!open) throw new Error(`FAQ ${index + 1} не открылся`);
      }
      await shot(page.locator('.cb-faq'), 'faq-open');
    });

    await attempt('Reviews: active card has readable content', async () => {
      await page.locator('#reviews').scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      const state = await page.locator('#track').evaluate((track) => {
        const active = track.querySelector('.review-slide.active') || track.querySelector('.review-slide');
        if (!active) return null;
        const style = getComputedStyle(active);
        const text = (active.innerText || '').trim();
        const glyphs = Array.from(active.querySelectorAll('.pl, .pl-emoji'));
        const visibleGlyphs = glyphs.filter((glyph) => {
          const glyphStyle = getComputedStyle(glyph);
          return Number(glyphStyle.opacity) >= .8 && glyphStyle.visibility !== 'hidden' && glyphStyle.display !== 'none';
        }).length;
        return {
          text,
          opacity: Number(style.opacity),
          visibility: style.visibility,
          display: style.display,
          glyphs: glyphs.length,
          visibleGlyphs,
          visibleRatio: glyphs.length ? visibleGlyphs / glyphs.length : 1,
        };
      });
      await page.screenshot({ path: filePath('reviews-live-viewport'), animations: 'allow' });
      if (!state || state.text.length < 20 || state.opacity < .5 || state.visibility === 'hidden' || state.display === 'none' || state.visibleRatio < .9) {
        throw new Error(`Review state: ${JSON.stringify(state)}`);
      }
      return state;
    });
    await attempt('Reviews carousel next/prev', async () => {
      const current = async () => page.locator('#track .review-slide').evaluateAll((slides) => slides.findIndex((slide) => slide.classList.contains('active')));
      const before = await current();
      await page.locator('#btnNext').click();
      await page.waitForFunction((previous) => {
        const slides = Array.from(document.querySelectorAll('#track .review-slide'));
        return slides.findIndex((slide) => slide.classList.contains('active')) !== previous;
      }, before, { timeout: 2500 });
      const next = await current();
      if (next === before) throw new Error(`Индекс не изменился: ${before}`);
      await page.locator('#btnPrev').click();
      await page.waitForTimeout(650);
    });
    await attempt('Reviews modal tabs', async () => {
      await page.locator('.map-badge-yandex').click();
      if (!(await page.locator('#reviewsModal').evaluate((el) => el.classList.contains('open')))) throw new Error('Модалка не открылась');
      await shot(page.locator('#reviewsModal'), 'reviews-modal-yandex');
      await page.locator('#tabGoogle').click();
      if (!(await page.locator('#reviewsGoogle').isVisible())) throw new Error('Google tab не виден');
      await shot(page.locator('#reviewsModal'), 'reviews-modal-google');
      await page.locator('.reviews-modal-close').click();
    });

    await attempt('Back-to-top и mobile fixed geometry', async () => {
      for (let pass = 0; pass < 5; pass += 1) {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(240);
      }
      if (!(await page.locator('#backToTop').isVisible())) throw new Error('Back-to-top не виден');
      if (mobile) {
        await page.locator('.site-footer .footer-bottom').scrollIntoViewIfNeeded();
        await page.waitForTimeout(420);
        const geometry = await page.evaluate(() => {
          const navEl = document.getElementById('mcNav');
          const topEl = document.getElementById('backToTop');
          const footerEl = document.querySelector('.site-footer .footer-bottom');
          const siteFooter = document.querySelector('.site-footer');
          const nav = navEl.getBoundingClientRect();
          const top = topEl.getBoundingClientRect();
          const footer = footerEl.getBoundingClientRect();
          return {
            nav: nav.toJSON(),
            top: top.toJSON(),
            footer: footer.toJSON(),
            siteFooter: siteFooter.getBoundingClientRect().toJSON(),
            bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
            footerPaddingBottom: getComputedStyle(siteFooter).paddingBottom,
            scrollY,
            maxScroll: document.documentElement.scrollHeight - innerHeight,
            viewport: { width: innerWidth, height: innerHeight },
          };
        });
        evidence.mobileFixedGeometry = geometry;
        await page.screenshot({ path: filePath('mobile-footer-nav-geometry'), animations: 'allow' });
        if (Math.abs(geometry.viewport.width - geometry.nav.right) > 2 || geometry.nav.left > 2 || Math.abs(geometry.viewport.height - geometry.nav.bottom) > 2) throw new Error(`Nav geometry: ${JSON.stringify(geometry)}`);
        if (geometry.top.bottom > geometry.nav.top - 3) throw new Error(`Back-to-top пересекает nav: ${JSON.stringify(geometry)}`);
        const footerVisible = geometry.footer.bottom > 0 && geometry.footer.top < geometry.viewport.height;
        if (!footerVisible) throw new Error(`Footer не доведён в viewport: ${JSON.stringify(geometry)}`);
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);
      }
      await page.locator('#backToTop').click();
      const deadline = Date.now() + 4500;
      let y = await page.evaluate(() => scrollY);
      while (y > 30 && Date.now() < deadline) {
        await page.waitForTimeout(120);
        y = await page.evaluate(() => scrollY);
      }
      if (y > 30) throw new Error(`scrollY=${y}`);
    });

    evidence.interactions = { mobile, viewport, anchorAudit, calcVariants };
  });

  test('04 — privacy, analytics boundary, контакты и внутренние ссылки', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(12000);
    const mobile = testInfo.project.name.includes('mobile');
    const analyticsRequests = [];
    page.on('request', (req) => {
      if (/googletagmanager|google-analytics|mc\.yandex\.ru|metrika/.test(req.url())) analyticsRequests.push(req.url());
    });
    await attempt('Privacy: первый визит', async () => openIndex(page, 'light', null));
    await attempt('Privacy: первое окно открывается', async () => {
      await page.waitForTimeout(850);
      const overlay = page.locator('.mc-consent-overlay');
      if (!(await overlay.evaluate((el) => el.classList.contains('is-open')))) throw new Error('Окно не открылось');
      await shot(page.locator('.mc-consent-dialog'), 'privacy-first-visit');
      const stored = await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'));
      if (stored !== null) throw new Error(`До выбора сохранено: ${stored}`);
    });
    record('critical', 'Privacy: до согласия нет analytics requests', analyticsRequests.length === 0, `Запросов: ${analyticsRequests.length}`, analyticsRequests);
    await attempt('Privacy: Escape без принудительного выбора', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(520);
      if (await page.locator('.mc-consent-overlay').isVisible()) throw new Error('Окно не закрылось');
      const stored = await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'));
      if (stored !== null) throw new Error(`После Escape сохранено: ${stored}`);
    });
    await attempt('Privacy: повторное открытие из правильного места', async () => {
      if (mobile) {
        if (await page.locator('.site-footer .mc-consent-trigger').count()) throw new Error('В mobile остался footer trigger');
        const staticPolicy = page.locator('.site-footer .footer-bottom > a[href="/privacy/"]');
        if (await staticPolicy.count() && await staticPolicy.isVisible()) throw new Error('В mobile виден статический privacy tail');
        await page.locator('#mcMoreBtn').click();
        if (!(await page.locator('#mcPrivacyRow').isVisible())) throw new Error('Privacy row не виден в Ещё');
        await page.locator('#mcPrivacyRow').click();
      } else {
        const trigger = page.locator('.site-footer .mc-consent-trigger');
        await trigger.scrollIntoViewIfNeeded();
        const placement = await trigger.evaluate((el) => ({ inFooter: Boolean(el.closest('.footer-bottom')), position: getComputedStyle(el).position }));
        if (!placement.inFooter || ['fixed', 'sticky'].includes(placement.position)) throw new Error(JSON.stringify(placement));
        await trigger.click();
      }
      await page.waitForTimeout(280);
      if (!(await page.locator('.mc-consent-overlay').evaluate((el) => el.classList.contains('is-open')))) throw new Error('Повторно не открылось');
      await page.locator('[data-choice="denied"]').click();
      await page.waitForTimeout(300);
      const stored = await page.evaluate(() => localStorage.getItem('milovi_analytics_consent_v1'));
      if (stored !== 'denied') throw new Error(`Выбор: ${stored}`);
    });

    await attempt('Contacts: messenger/social href identities', async () => {
      const expected = [
        ['.messenger-bar-wa', /wa\.me\/79119038886/],
        ['.messenger-bar-tg', /t\.me\//],
        ['.messenger-bar-max', /max\.ru\/MiloviCake/],
        ['.social-link.vk', /vk\.com\/milovi_cake/],
        ['.social-link.tg', /t\.me\/MiloviCake/],
        ['.social-link.max', /max\.ru\/MiloviCake/],
        ['.social-link.yt', /youtube\.com\/@milovi_cake/],
        ['.social-link.ya', /yandex\.ru\/maps/],
        ['.social-link.google', /maps\.app\.goo\.gl/],
      ];
      for (const [selector, pattern] of expected) {
        const href = await page.locator(`#contacts ${selector}`).first().getAttribute('href');
        if (!pattern.test(href || '')) throw new Error(`${selector}: ${href}`);
      }
    });

    const localPaths = await attempt('Собрать внутренние пути', async () => page.evaluate(() => Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')).filter((href) => href && href.startsWith('/') && !href.startsWith('//')).map((href) => href.split('#')[0]).filter(Boolean))).slice(0, 60)));
    const pathResults = [];
    if (localPaths) {
      for (const localPath of localPaths) {
        await attempt(`Internal HTTP ${localPath}`, async () => {
          const response = await request.get(`http://127.0.0.1:4173${localPath}`, { failOnStatusCode: false });
          pathResults.push({ path: localPath, status: response.status() });
          if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
        });
      }
    }
    evidence.privacyAndLinks = { mobile, analyticsRequests, pathResults };
  });

  test('05 — внешние проверки live: HTTP, release witness, W3C, PageSpeed, Observatory', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Внешние сервисы запускаются один раз');
    test.setTimeout(360000);
    const external = { checkedAt: new Date().toISOString(), target: 'https://milovicake.ru/' };

    await attempt('External: homepage HTTP', async () => {
      const response = await request.get('https://milovicake.ru/', { failOnStatusCode: false, timeout: 45000 });
      const body = await response.text();
      external.home = { status: response.status(), headers: response.headers(), bytes: Buffer.byteLength(body), titlePresent: body.includes('<title>') };
      if (response.status() !== 200 || !body.includes('<title>')) throw new Error(JSON.stringify(external.home));
    });
    await attempt('External: release witness', async () => {
      const response = await request.get(`https://milovicake.ru/release.json?audit=${Date.now()}`, { failOnStatusCode: false, timeout: 45000 });
      const text = await response.text();
      external.release = { status: response.status(), text: text.slice(0, 2000) };
      if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
      const data = JSON.parse(text);
      external.release.data = data;
      if (data.repository !== 'FedorMilovanov/Milovi_Cake') throw new Error(JSON.stringify(data));
    }, 'warning');
    for (const pathName of ['/robots.txt', '/sitemap.xml', '/privacy/']) {
      await attempt(`External: ${pathName}`, async () => {
        const response = await request.get(`https://milovicake.ru${pathName}`, { failOnStatusCode: false, timeout: 45000 });
        external[pathName] = { status: response.status(), bytes: (await response.body()).length };
        if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
      });
    }
    await attempt('External: W3C Nu HTML Checker', async () => {
      const url = 'https://validator.w3.org/nu/?doc=https%3A%2F%2Fmilovicake.ru%2F&out=json';
      const response = await request.get(url, { failOnStatusCode: false, timeout: 120000, headers: { 'User-Agent': 'MiloviCakeForensicAudit/1.0' } });
      const text = await response.text();
      external.w3c = { status: response.status(), raw: text.slice(0, 15000) };
      if (response.status() === 200) {
        const data = JSON.parse(text);
        external.w3c.errors = (data.messages || []).filter((message) => message.type === 'error');
        external.w3c.warnings = (data.messages || []).filter((message) => message.type !== 'error');
        record('warning', 'W3C: HTML errors', external.w3c.errors.length === 0, `Ошибок: ${external.w3c.errors.length}`, external.w3c.errors.slice(0, 30));
      }
    }, 'warning');
    for (const strategy of ['mobile', 'desktop']) {
      await attempt(`External: PageSpeed ${strategy}`, async () => {
        const url = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent('https://milovicake.ru/')}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`;
        const response = await request.get(url, { failOnStatusCode: false, timeout: 180000 });
        const text = await response.text();
        external[`pagespeed_${strategy}`] = { status: response.status(), raw: text.slice(0, 5000) };
        if (response.status() === 200) {
          const data = JSON.parse(text);
          const categories = data.lighthouseResult && data.lighthouseResult.categories || {};
          const audits = data.lighthouseResult && data.lighthouseResult.audits || {};
          external[`pagespeed_${strategy}`].scores = Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Math.round((value.score || 0) * 100)]));
          external[`pagespeed_${strategy}`].metrics = {
            fcp: audits['first-contentful-paint'] && audits['first-contentful-paint'].displayValue,
            lcp: audits['largest-contentful-paint'] && audits['largest-contentful-paint'].displayValue,
            cls: audits['cumulative-layout-shift'] && audits['cumulative-layout-shift'].displayValue,
            tbt: audits['total-blocking-time'] && audits['total-blocking-time'].displayValue,
            speedIndex: audits['speed-index'] && audits['speed-index'].displayValue,
          };
        }
      }, 'warning');
    }
    await attempt('External: MDN Observatory', async () => {
      const response = await request.post('https://observatory-api.mdn.mozilla.net/api/v2/scan?host=milovicake.ru', { failOnStatusCode: false, timeout: 120000 });
      const text = await response.text();
      external.observatory = { status: response.status(), raw: text.slice(0, 12000) };
      if (response.status() >= 400) throw new Error(`HTTP ${response.status()}: ${text.slice(0, 300)}`);
      try { external.observatory.data = JSON.parse(text); } catch (_) {}
    }, 'warning');
    evidence.external = external;
    fs.writeFileSync(filePath('external', 'json'), JSON.stringify(external, null, 2), 'utf8');
  });
});
