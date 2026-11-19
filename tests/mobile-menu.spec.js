const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Мобильное меню (r44) — регрессии на структуру, IA, иконку MAX, геометрию,
 * доступность и модальное поведение. Тесты сознательно измеряют реальные
 * боксы и вычисленные цвета, а не только наличие классов: «зелёные» проверки
 * не должны пропускать обрезанные строки, тап-зоны < 44 px и уехавшую вёрстку.
 */

const proofDir = path.join(process.cwd(), 'test-results', 'ui-audit');

function proofPath(testInfo, name) {
  fs.mkdirSync(proofDir, { recursive: true });
  return path.join(proofDir, `${testInfo.project.name}-${name}.png`);
}

const OWNER_MAX_URL = 'https://max.ru/u/f9LHodD0cOIzRY9VJX8MoyR41H64ULjndbose2aPPrzXJDLW8QEiyKTpqxs';

async function openMenu(page, theme = 'light', url = '/') {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('mc_theme', value);
      localStorage.setItem('milovi_analytics_consent_v1', 'denied');
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#burgerBtn').click();
  await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
  await page.waitForTimeout(280);
}

function luminance(rgb) {
  const channels = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!channels) return null;
  const [r, g, b] = [1, 2, 3].map((i) => {
    const v = Number(channels[i]) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  if (a === null || b === null) throw new Error(`unparsable colors: ${foreground} / ${background}`);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

test.describe('mobile menu @menu', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'меню существует только до 768 px');
  });

  test('меню содержит полную IA и только реальные ссылки', async ({ page }) => {
    await openMenu(page);

    const links = await page.locator('#mobileMenu a[href]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: node.getAttribute('href'),
        text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        label: node.getAttribute('aria-label'),
      }))
    );

    // Ни одной пустой/декоративной ссылки: у каждой есть адрес и доступное имя.
    for (const link of links) {
      expect(link.href, `ссылка «${link.text}» без адреса`).toBeTruthy();
      expect(link.href).not.toBe('#');
      expect((link.text || link.label || '').length, `ссылка ${link.href} без имени`).toBeGreaterThan(0);
    }

    const hrefs = links.map((link) => link.href);
    expect(new Set(hrefs).size, 'в меню не должно быть дублирующихся ссылок').toBe(hrefs.length);

    // Ключевые точки воронки обязаны присутствовать.
    for (const href of [
      '#catalog',
      '/svadebnye-torty/',
      '/gallery/',
      '/dostavka-i-oplata/',
      '/bento-torty/',
      '/detskie-torty/',
      '/meringue-roll/',
      '/prigorody/',
      '/o-konditere/',
      '/otzyvy/',
      '/certificates/',
      '#fillings',
      '#contacts',
      'tel:+79119038886',
    ]) {
      expect(hrefs, `в меню нет ${href}`).toContain(href);
    }

    // Группы подписаны — навигация читается как структура, а не список.
    const labels = await page.locator('#mobileMenu .mobile-menu-section-label').allTextContents();
    expect(labels.map((text) => text.trim())).toEqual(['Заказать', 'Форматы']);
  });

  test('главная и пригород отдают одну и ту же разметку меню', async ({ page }) => {
    // До r44 у пригородов была отдельная (старая) версия меню — фиксируем паритет.
    const collect = async (url) => {
      await openMenu(page, 'light', url);
      const state = await page.evaluate(() => {
        const menu = document.getElementById('mobileMenu');
        return {
          links: Array.from(menu.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
          groups: Array.from(menu.querySelectorAll('.mobile-menu-section-label')).map((n) => n.textContent.trim()),
          hasBrand: !!menu.querySelector('.mobile-menu-brand-name'),
          hasTheme: menu.querySelectorAll('[data-theme-set]').length,
          messengers: Array.from(menu.querySelectorAll('.mm-msg')).map((n) => n.textContent.trim()),
        };
      });
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobileMenu')).not.toHaveClass(/open/);
      return state;
    };

    const home = await collect('/');
    const suburb = await collect('/prigorody/pushkin/');
    expect(suburb.links).toEqual(home.links);
    expect(suburb.groups).toEqual(home.groups);
    expect(suburb.messengers).toEqual(home.messengers);
    expect(suburb.hasBrand).toBe(true);
    expect(suburb.hasTheme).toBe(2);
  });

  test('мессенджеры используют фирменные знаки и правильные адреса', async ({ page }) => {
    await openMenu(page);

    const messengers = await page.locator('#mobileMenu .mm-msg').evaluateAll((nodes) =>
      nodes.map((node) => {
        const icon = node.querySelector('svg');
        const pathEl = icon && icon.querySelector('path');
        return {
          text: (node.textContent || '').trim(),
          href: node.getAttribute('href'),
          aria: node.getAttribute('aria-label'),
          viewBox: icon && icon.getAttribute('viewBox'),
          d: pathEl ? pathEl.getAttribute('d') : '',
          fill: pathEl ? pathEl.getAttribute('fill') : '',
        };
      })
    );
    expect(messengers.map((m) => m.text)).toEqual(['WhatsApp', 'Telegram', 'MAX']);

    const max = messengers[2];
    expect(max.href, 'ссылка MAX должна быть личной ссылкой владельца').toBe(OWNER_MAX_URL);
    // Официальная геометрия знака MAX из брендбука (go.max.ru/brandbook):
    // силуэт облака-«M» с внутренним вырезом, а не прежняя самодельная «M».
    expect(max.viewBox).toBe('0 0 16 16');
    expect(max.d).toContain('M8.1719 15.9543');
    expect(max.d).toContain('M8.23684 3.93679');
    expect(max.fill, 'знак MAX залит фирменным градиентом').toContain('mmMaxGrad');

    const gradient = await page.locator('#mobileMenu .mm-msg--max linearGradient stop').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('stop-color'))
    );
    expect(gradient).toEqual(['#00BFFF', '#6E1AFF', '#9500FF']);

    // Прежняя «приблизительная» буква M не должна вернуться.
    const html = await page.locator('#mobileMenu').innerHTML();
    expect(html).not.toContain('M3 4h2.4l3.1 7.6');

    expect(messengers[0].href.startsWith('https://wa.me/79119038886')).toBe(true);
    expect(messengers[1].href).toBe('https://t.me/+79119038886');
    expect(html).not.toContain('t.me/MiloviCake');

    for (const messenger of messengers) {
      expect(messenger.aria, `у ${messenger.text} нет доступного имени`).toBeTruthy();
      expect(messenger.d.length, `у ${messenger.text} нет SVG-пути`).toBeGreaterThan(40);
    }
  });

  for (const theme of ['light', 'dark']) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      test(`геометрия ${viewport.width}×${viewport.height} (${theme}): тап-зоны, отсутствие обрезки и переполнения`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await openMenu(page, theme);

        const view = await page.evaluate(() => {
          const menu = document.getElementById('mobileMenu');
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          };
          const rows = Array.from(
            menu.querySelectorAll('.mobile-menu-nav a, .mm-chip, .mm-sublink, .mm-msg, .mm-call, .mm-theme-opt, .mobile-menu-close')
          );
          const body = menu.querySelector('.mobile-menu-body');
          return {
            vw: window.innerWidth,
            vh: window.innerHeight,
            menu: rect(menu),
            head: rect(menu.querySelector('.mobile-menu-head')),
            foot: rect(menu.querySelector('.mobile-menu-foot')),
            rows: rows.map((node) => ({ text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32), ...rect(node) })),
            bodyScrollable: body ? body.scrollHeight >= body.clientHeight : false,
            bodyOverflow: body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0,
            bodyScrollWidth: body ? body.scrollWidth : 0,
            docOverflow: document.documentElement.scrollWidth - window.innerWidth,
            bodyLocked: getComputedStyle(document.body).overflow,
            theme: document.documentElement.getAttribute('data-theme'),
            panelBg: getComputedStyle(menu).backgroundColor,
          };
        });

        expect(view.theme).toBe(theme);
        expect(view.menu.width, 'меню на всю ширину экрана').toBeGreaterThanOrEqual(view.vw - 1);
        expect(view.head.top, 'шапка меню не уезжает вверх').toBeGreaterThanOrEqual(-1);
        expect(view.foot.bottom, 'сервисный низ не выходит за экран').toBeLessThanOrEqual(view.vh + 1);
        expect(view.bodyLocked, 'под меню страница не прокручивается').toBe('hidden');
        expect(view.docOverflow, 'нет горизонтального переполнения документа').toBeLessThanOrEqual(1);
        expect(view.bodyScrollWidth, 'нет горизонтального переполнения меню').toBeLessThanOrEqual(view.vw + 1);

        // Каждый интерактивный элемент — не меньше 44×44 CSS px.
        for (const row of view.rows) {
          expect(row.height, `«${row.text}» ниже 44 px`).toBeGreaterThanOrEqual(43.5);
          expect(row.width, `«${row.text}» уже 44 px`).toBeGreaterThanOrEqual(43.5);
          expect(row.left, `«${row.text}» уходит влево`).toBeGreaterThanOrEqual(-0.5);
          expect(row.right, `«${row.text}» уходит вправо`).toBeGreaterThanOrEqual(row.right - 0.5);
          expect(row.right, `«${row.text}» выходит за экран`).toBeLessThanOrEqual(view.vw + 0.5);
        }

        // Первые пункты воронки видны без прокрутки, прокрутка (если нужна) — внутри меню.
        const primary = view.rows.slice(0, 4);
        for (const row of primary) {
          expect(row.top, `первый экран: «${row.text}» ниже вьюпорта`).toBeLessThan(view.vh);
        }
        // Хвост меню не должен прятаться «за сгибом» целиком: на типичных
        // телефонах (≥ 844 px) меню помещается целиком, на 740 px допускается
        // одна короткая прокрутка тела, но не «простыня» скрытого контента.
        if (viewport.height >= 844) {
          expect(view.bodyOverflow, `на ${viewport.height} px всё меню должно помещаться без прокрутки`).toBeLessThanOrEqual(2);
        } else {
          expect(view.bodyOverflow, `на ${viewport.height} px скрыто слишком много пунктов`).toBeLessThanOrEqual(180);
        }
        // Шапка и сервисный низ закреплены — контакты и тема доступны всегда.
        expect(view.foot.top, 'сервисный низ виден без прокрутки').toBeLessThan(view.vh);

        await page.screenshot({ path: proofPath(testInfo, `menu-${viewport.width}x${viewport.height}-${theme}`) });
      });
    }
  }

  test('модальное поведение: фокус, Tab-ловушка, Escape и возврат фокуса', async ({ page }) => {
    // Явно делаем бургер владельцем фокуса до открытия: тогда возврат фокуса
    // детерминирован и не зависит от того, фокусирует ли движок кнопку по клику.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mc_theme', 'light');
        localStorage.setItem('milovi_analytics_consent_v1', 'denied');
      } catch (e) {}
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#burgerBtn').focus();
    await page.locator('#burgerBtn').click();
    await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
    await page.waitForTimeout(280);

    await expect(page.locator('#burgerBtn')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobileMenu')).toHaveAttribute('aria-modal', 'true');

    // Фокус уходит в меню на кнопку закрытия.
    await expect(page.locator('#mobileMenu .mobile-menu-close')).toBeFocused({ timeout: 2000 });

    const inside = () => page.evaluate(() => !!document.getElementById('mobileMenu').contains(document.activeElement));
    expect(await inside()).toBe(true);

    // Tab и Shift+Tab не выводят фокус за пределы меню.
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      expect(await inside(), `Tab #${i + 1} увёл фокус из меню`).toBe(true);
    }
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside(), `Shift+Tab #${i + 1} увёл фокус из меню`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#mobileMenu')).not.toHaveClass(/open/);
    await expect(page.locator('#burgerBtn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#burgerBtn')).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');

    // Повторное открытие после закрытия Esc работает так же.
    await page.locator('#burgerBtn').click();
    await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
    await expect(page.locator('#mobileMenu .mobile-menu-close')).toBeFocused();
  });

  test('переключатель темы в меню: понятные состояния и доступные имена', async ({ page }) => {
    await openMenu(page, 'light');

    const lightOption = page.locator('#mobileMenu [data-theme-set="light"]');
    const darkOption = page.locator('#mobileMenu [data-theme-set="dark"]');
    await expect(lightOption).toHaveAttribute('aria-pressed', 'true');
    await expect(darkOption).toHaveAttribute('aria-pressed', 'false');
    await expect(lightOption).toHaveText(/Светлая/);
    await expect(darkOption).toHaveText(/Тёмная/);

    await darkOption.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(darkOption).toHaveAttribute('aria-pressed', 'true');
    await expect(lightOption).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => localStorage.getItem('mc_theme'))).toBe('dark');

    // Переключатель в шапке остаётся синхронным и получает понятное имя действия.
    await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-label', 'Включить светлую тему');

    await lightOption.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-label', 'Включить тёмную тему');
  });

  for (const theme of ['light', 'dark']) {
    test(`контраст текста меню не ниже 4.5:1 (${theme})`, async ({ page }) => {
      await openMenu(page, theme);
      const samples = await page.evaluate(() => {
        const read = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          return {
            selector,
            color: getComputedStyle(node).color,
            font: getComputedStyle(node).fontSize,
          };
        };
        const menu = document.getElementById('mobileMenu');
        const background = (() => {
          // Фон панели и «сервисного низа» может отличаться — считаем по обоим.
          let node = menu;
          while (node) {
            const value = getComputedStyle(node).backgroundColor;
            if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
            node = node.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        })();
        return {
          background,
          footBackground: getComputedStyle(document.querySelector('.mobile-menu-foot')).backgroundColor,
          items: [
            read('.mobile-menu-brand-name'),
            read('.mobile-menu-brand-sub'),
            read('.mobile-menu-section-label'),
            read('.mobile-menu-nav a .mm-link-text'),
            read('.mobile-menu-nav a .mm-link-note'),
            read('.mm-chip'),
            read('.mm-sublink'),
            read('.mm-msg'),
            read('.mm-call'),
            read('.mm-theme-opt[aria-pressed="false"]'),
          ].filter(Boolean),
        };
      });

      for (const item of samples.items) {
        const ratio = contrast(item.color, samples.background);
        expect(ratio, `${item.selector} (${item.font}) на ${samples.background}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
      // Подписи мессенджеров и телефон живут на фоне сервисного низа.
      const footerRatio = contrast(samples.items.find((i) => i.selector === '.mm-msg').color, samples.footBackground);
      expect(footerRatio).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('меню перекрывает нижний бар и не конфликтует с ним', async ({ page }) => {
    await openMenu(page);
    const topmost = await page.evaluate(() => {
      const nav = document.getElementById('mcNav');
      const point = { x: Math.round(window.innerWidth / 2), y: window.innerHeight - 12 };
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        navPresent: !!nav,
        navHiddenFromPointer: !nav || document.getElementById('mobileMenu').contains(hit) || hit === null,
        hitInsideMenu: !!hit && !!hit.closest('#mobileMenu'),
      };
    });
    expect(topmost.hitInsideMenu, 'нижний бар не должен перехватывать тап под меню').toBe(true);
  });

  test('prefers-reduced-motion отключает анимации меню', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMenu(page);
    const durations = await page.evaluate(() => {
      const menu = document.getElementById('mobileMenu');
      const style = getComputedStyle(menu);
      const link = getComputedStyle(document.querySelector('.mobile-menu-nav a'));
      return { menu: style.transitionDuration, link: link.transitionDuration, menuDelay: style.transitionDelay };
    });
    // style.css глобально ограничивает reduced-motion до 0.01ms — проверяем
    // именно эффективную длительность, а не буквальный ноль.
    expect(durations.menu.split(',').every((value) => parseFloat(value) <= 0.05)).toBe(true);
    expect(durations.link.split(',').every((value) => parseFloat(value) <= 0.05)).toBe(true);
    expect(parseFloat(durations.menuDelay), 'скрытие панели не должно ждать 240 мс').toBeLessThanOrEqual(0.05);
  });
});
