#!/usr/bin/env python3
"""Fourth forensic pass: privacy Escape, light-footer contrast and precise mobile checks."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONSENT = ROOT / "js" / "consent-analytics.js"
FIXES = ROOT / "css" / "v20-fixes.css"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"round3 source mismatch: {label}")


consent = CONSENT.read_text(encoding="utf-8")
old_keydown = r'''  function onDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;'''
new_keydown = r'''  function onDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;'''
consent = replace_exact(consent, old_keydown, new_keydown, "dialog Escape propagation")
old_binding = r'''    dialog.addEventListener('keydown', onDialogKeydown);
    document.body.appendChild(overlay);'''
new_binding = r'''    dialog.addEventListener('keydown', onDialogKeydown);
    /* Capture Escape at document level as well. Focus may temporarily move to a
       browser-native control or a responsive sheet while the dialog is open. */
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !overlay || overlay.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
    }, true);
    document.body.appendChild(overlay);'''
consent = replace_exact(consent, old_binding, new_binding, "document Escape fallback")
CONSENT.write_text(consent, encoding="utf-8")

fixes = FIXES.read_text(encoding="utf-8")
footer_css = r'''

/* Forensic R78: the footer intentionally stays dark in both themes. Light-theme
   variables must therefore never recolor its project cards and legal line with
   dark page ink. These values meet readable contrast without making the footer
   loud or changing the approved layout. */
html:not([data-theme="dark"]) .site-footer .footer-projects-label {
  color: #c99551 !important; /* important: overrides inherited light-page ink */
}
html:not([data-theme="dark"]) .site-footer .footer-projects-link {
  color: #ead4b1 !important; /* important: existing cascade sets var(--text) */
  border-color: rgba(212,167,106,.25) !important;
  background: rgba(255,255,255,.025) !important;
}
html:not([data-theme="dark"]) .site-footer .footer-projects-link:hover {
  color: #f2dfbf !important;
  border-color: rgba(212,167,106,.48) !important;
  background: rgba(212,167,106,.07) !important;
}
html:not([data-theme="dark"]) .site-footer .footer-projects-name {
  color: #f0d9b2 !important;
}
html:not([data-theme="dark"]) .site-footer .footer-projects-desc {
  color: rgba(246,229,204,.68) !important;
}
html:not([data-theme="dark"]) .site-footer .footer-projects-arrow {
  color: #d4a76a !important;
}
html:not([data-theme="dark"]) .site-footer .footer-bottom span,
html:not([data-theme="dark"]) .site-footer .footer-bottom a {
  color: rgba(246,229,204,.58) !important;
}
html:not([data-theme="dark"]) .site-footer .footer-bottom a:hover {
  color: #e8b87a !important;
}
'''
if "Forensic R78: the footer intentionally stays dark" not in fixes:
    fixes = fixes.rstrip() + footer_css
FIXES.write_text(fixes, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_mobile_nav = r'''      for (const [label, selector] of [['Каталог', '#catalog'], ['Начинки', '#fillings'], ['Отзывы', '#reviews']]) {
        await attempt(`Mobile nav: ${label}`, async () => {
          await page.locator('#mcNav .mc-btn', { hasText: label }).click();
          await page.waitForTimeout(650);
          const top = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
          if (top > viewport.height * 0.55) throw new Error(`Цель слишком низко: ${top}px`);
        });
      }'''
new_mobile_nav = r'''      for (const [label, selector] of [['Каталог', '#catalog'], ['Начинки', '#fillings'], ['Отзывы', '#reviews']]) {
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
      }'''
forensic = replace_exact(forensic, old_mobile_nav, new_mobile_nav, "mobile navigation settling")
old_cart = r'''    await attempt('Calculator → cart', async () => {
      await page.locator('#calcType .calc-type-card[data-type="biscuit"]').click();
      const before = numberFrom(await page.locator('#cartBadge').textContent());
      await page.locator('.calc-add-btn').scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
      await page.locator('.calc-add-btn').click();
      await page.waitForTimeout(200);'''
new_cart = r'''    await attempt('Calculator → cart', async () => {
      await page.locator('#calcType .calc-type-card[data-type="biscuit"]').click();
      const before = numberFrom(await page.locator('#cartBadge').textContent());
      if (mobile) {
        const panel = page.locator('.calc-right-col');
        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) {
          await page.locator('#calcCollapsedBar').click();
          await page.waitForTimeout(480);
        }
        if (!(await panel.evaluate((el) => el.classList.contains('calc-result-open')))) throw new Error('Мобильная панель результата не раскрылась');
      } else {
        await page.locator('.calc-add-btn').scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(180);
      await page.locator('.calc-add-btn').click();
      await page.waitForTimeout(200);'''
forensic = replace_exact(forensic, old_cart, new_cart, "mobile calculator panel")
old_geometry = r'''        const geometry = await page.evaluate(() => {
          const nav = document.getElementById('mcNav').getBoundingClientRect();
          const top = document.getElementById('backToTop').getBoundingClientRect();
          const footer = document.querySelector('.site-footer .footer-bottom').getBoundingClientRect();
          return { nav: nav.toJSON(), top: top.toJSON(), footer: footer.toJSON(), viewport: { width: innerWidth, height: innerHeight } };
        });
        if (Math.abs(geometry.viewport.width - geometry.nav.right) > 2 || geometry.nav.left > 2 || Math.abs(geometry.viewport.height - geometry.nav.bottom) > 2) throw new Error(`Nav geometry: ${JSON.stringify(geometry)}`);
        if (geometry.top.bottom > geometry.nav.top - 3) throw new Error('Back-to-top пересекает nav');
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error('Footer пересекает nav');
        evidence.mobileFixedGeometry = geometry;'''
new_geometry = r'''        const geometry = await page.evaluate(() => {
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
        if (geometry.footer.bottom > geometry.nav.top + 1) throw new Error(`Footer пересекает nav: ${JSON.stringify(geometry)}`);'''
forensic = replace_exact(forensic, old_geometry, new_geometry, "mobile footer diagnostics")
forensic = replace_exact(
    forensic,
    "      await page.locator('.mc-consent-dialog').press('Escape');",
    "      await page.keyboard.press('Escape');",
    "privacy Escape keyboard",
)
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied forensic INDEX round 3")
