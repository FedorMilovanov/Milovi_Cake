#!/usr/bin/env python3
"""Round 7: guarantee readable reviews, responsive manual arrows, and real mobile cart path."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
FORENSIC = ROOT / "tests" / "index-forensic-audit.spec.js"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"round7 source mismatch: {label}")


main = MAIN.read_text(encoding="utf-8")

old_timeout = """    typeTimer = setTimeout(()=>{ if(typeGen !== capturedTypeGen) { typeTimer = null; return; } typeTimer = null; zoomP = 1; startWaiting(); }, totalDur);"""
new_timeout = """    typeTimer = setTimeout(()=>{
      if(typeGen !== capturedTypeGen) { typeTimer = null; return; }
      /* Forensic R80: requestAnimationFrame may be throttled while the reviews
         section is off-screen. Always finish in a readable state instead of
         leaving every glyph at opacity:0 after the timer completes. */
      letterEls.forEach((el) => {
        el.style.opacity = '1';
        el.style.filter = 'none';
        el.style.transform = 'none';
      });
      emojiEls.forEach((el) => {
        el.style.opacity = '1';
        el.style.filter = 'none';
        el.style.transform = 'scale(1) rotate(0deg)';
      });
      typeTimer = null;
      zoomP = 1;
      startWaiting();
    }, totalDur);"""
main = replace_exact(main, old_timeout, new_timeout, "review visibility finalizer")

old_arrows = """  if (_btnPrev) _btnPrev.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur-1); });
  if (_btnNext) _btnNext.addEventListener('click', ()=> { if (!_goToBusy) goTo(cur+1); });"""
new_arrows = """  /* Manual navigation must always win over autoplay. The previous busy guard
     could silently discard a real user click when autoplay had just advanced. */
  if (_btnPrev) _btnPrev.addEventListener('click', ()=> goTo(cur-1));
  if (_btnNext) _btnNext.addEventListener('click', ()=> goTo(cur+1));"""
main = replace_exact(main, old_arrows, new_arrows, "manual review arrows")
MAIN.write_text(main, encoding="utf-8")

forensic = FORENSIC.read_text(encoding="utf-8")
old_cart_open = """      await page.locator('#cartBtn').click();
      if ((await page.locator('#cartDrawer').getAttribute('aria-hidden')) !== 'false') throw new Error('Корзина не открылась');"""
new_cart_open = """      if (mobile) {
        const mobileCart = page.locator('#mcNav .mc-btn--order');
        if (!(await mobileCart.isVisible())) throw new Error('Мобильная кнопка корзины «Заказать» не видна');
        await mobileCart.click();
      } else {
        await page.locator('#cartBtn').click();
      }
      if ((await page.locator('#cartDrawer').getAttribute('aria-hidden')) !== 'false') throw new Error('Корзина не открылась');"""
forensic = replace_exact(forensic, old_cart_open, new_cart_open, "real mobile cart trigger")

old_review_nav = """      const before = await current();
      await page.locator('#btnNext').click();
      await page.waitForTimeout(650);
      const next = await current();
      if (next === before) throw new Error(`Индекс не изменился: ${before}`);
      await page.locator('#btnPrev').click();
      await page.waitForTimeout(650);"""
new_review_nav = """      const before = await current();
      await page.locator('#btnNext').click();
      await page.waitForFunction((previous) => {
        const slides = Array.from(document.querySelectorAll('#track .review-slide'));
        return slides.findIndex((slide) => slide.classList.contains('active')) !== previous;
      }, before, { timeout: 2500 });
      const next = await current();
      if (next === before) throw new Error(`Индекс не изменился: ${before}`);
      await page.locator('#btnPrev').click();
      await page.waitForTimeout(650);"""
forensic = replace_exact(forensic, old_review_nav, new_review_nav, "deterministic review arrows test")
FORENSIC.write_text(forensic, encoding="utf-8")

print("Applied forensic INDEX round 7")
