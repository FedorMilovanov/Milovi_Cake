/**
 * MILOVI CAKE — V20 FAQ Fix
 * Исправляет accordion FAQ для главной страницы И пригородов.
 *
 * Проблемы:
 * 1. В пригородах FAQ на <details>/<summary> — не открывается плавно
 * 2. На главной — «дрыгается» при открытии из-за одновременного
 *    изменения padding + margin + max-height
 *
 * Решение:
 * - Единый JS accordion для ВСЕХ страниц
 * - height через requestAnimationFrame (без layout thrash)
 * - Плавный open/close через max-height + opacity
 * - <details> конвертируем в наш accordion на лету
 */

(function faqFix() {
  'use strict';

  /* ── Утилиты ── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  /* ── Определяем все FAQ items на странице ── */
  function findFaqItems() {
    // Классический JS accordion
    var jsItems = $$('.faq-item');
    // <details> элементы
    var detailsItems = $$('details').filter(function(d) {
      return !d.closest('.faq-item');
    });
    return { jsItems: jsItems, detailsItems: detailsItems };
  }

  /* ── Найти answer-элемент внутри faq-item ── */
  function findAnswer(item) {
    // Порядок поиска: конкретные классы → первый div/p не являющийся вопросом
    return (
      item.querySelector('.faq-answer') ||
      item.querySelector('.faq-body') ||
      item.querySelector('.faq-content') ||
      item.querySelector('.cb-faq-a') ||
      item.querySelector('.faq-a') ||
      (function() {
        var children = Array.from(item.children);
        return children.find(function(el) {
          return !el.matches('.faq-question, .faq-q, .faq-toggle, summary, [role="button"], button, h3, h4');
        });
      })()
    );
  }

  /* ── Найти question-элемент внутри faq-item ── */
  function findQuestion(item) {
    return (
      item.querySelector('.faq-question') ||
      item.querySelector('.faq-q') ||
      item.querySelector('.cb-faq-q') ||
      item.querySelector('.faq-toggle') ||
      item.querySelector('button:first-child') ||
      item.querySelector('[role="button"]')
    );
  }

  /* ── Плавное открытие/закрытие без layout thrash ── */
  function openItem(item, answer) {
    if (!answer) return;

    // Сначала снимаем все transition для мгновенного измерения
    answer.style.transition = 'none';
    answer.style.maxHeight = 'none';
    answer.style.opacity = '1';
    answer.style.paddingBottom = '22px';
    answer.style.paddingTop = '0';

    var fullHeight = answer.scrollHeight + 22; // + padding-bottom

    // Сбрасываем для анимации
    answer.style.maxHeight = '0';
    answer.style.opacity = '0';
    answer.style.paddingBottom = '0';

    // Форсируем reflow ОДИН РАЗ — здесь
    // eslint-disable-next-line no-unused-expressions
    answer.offsetHeight;

    // Теперь включаем transition
    answer.style.transition = [
      'max-height 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
      'opacity 0.32s ease',
      'padding-bottom 0.32s ease'
    ].join(', ');

    // rAF — применяем целевые значения
    requestAnimationFrame(function() {
      answer.style.maxHeight = fullHeight + 'px';
      answer.style.opacity = '1';
      answer.style.paddingBottom = '22px';
      item.classList.add('open');
    });
  }

  function closeItem(item, answer) {
    if (!answer) return;

    // Сначала фиксируем текущую высоту
    var currentHeight = answer.scrollHeight;
    answer.style.maxHeight = currentHeight + 'px';
    answer.style.opacity = '1';

    // Форсируем reflow
    // eslint-disable-next-line no-unused-expressions
    answer.offsetHeight;

    answer.style.transition = [
      'max-height 0.36s cubic-bezier(0.4, 0, 0.2, 1)',
      'opacity 0.24s ease',
      'padding-bottom 0.28s ease'
    ].join(', ');

    requestAnimationFrame(function() {
      answer.style.maxHeight = '0';
      answer.style.opacity = '0';
      answer.style.paddingBottom = '0';
      item.classList.remove('open');
    });
  }

  /* ── Инициализация JS accordion ── */
  function initJsAccordion(items) {
    items.forEach(function(item) {
      var question = findQuestion(item);
      var answer = findAnswer(item);

      if (!question || !answer) return;
      if (item._faqInited) return;
      item._faqInited = true;

      // Начальное состояние
      answer.style.maxHeight = '0';
      answer.style.opacity = '0';
      answer.style.overflow = 'hidden';
      answer.style.paddingBottom = '0';

      // Если уже open — открываем без анимации
      if (item.classList.contains('open')) {
        answer.style.transition = 'none';
        answer.style.maxHeight = answer.scrollHeight + 22 + 'px';
        answer.style.opacity = '1';
        answer.style.paddingBottom = '22px';
      }

      question.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        var isOpen = item.classList.contains('open');

        // Закрываем все остальные (accordion behaviour)
        var parentList = item.closest('.faq-list, .faq-section, section');
        if (parentList) {
          var siblings = parentList.querySelectorAll('.faq-item.open');
          siblings.forEach(function(sib) {
            if (sib !== item) {
              var sibAnswer = findAnswer(sib);
              if (sibAnswer) closeItem(sib, sibAnswer);
            }
          });
        }

        if (isOpen) {
          closeItem(item, answer);
        } else {
          openItem(item, answer);
        }
      });
    });
  }

  /* ── Инициализация <details> accordion ── */
  function initDetailsAccordion(details) {
    details.forEach(function(det) {
      if (det._faqInited) return;
      det._faqInited = true;

      var summary = det.querySelector('summary');
      if (!summary) return;

      // Все дочерние элементы кроме summary — это content
      var content = Array.from(det.children).filter(function(el) {
        return el.tagName !== 'SUMMARY';
      });

      if (!content.length) return;

      // Оборачиваем content в один div для удобства
      var wrapper;
      if (content.length === 1 && content[0].tagName === 'DIV') {
        wrapper = content[0];
      } else {
        wrapper = document.createElement('div');
        wrapper.className = 'faq-answer';
        content.forEach(function(el) { wrapper.appendChild(el); });
        det.appendChild(wrapper);
      }

      // Начальное состояние
      wrapper.style.maxHeight = '0';
      wrapper.style.opacity = '0';
      wrapper.style.overflow = 'hidden';
      wrapper.style.paddingBottom = '0';

      // Если уже open
      if (det.hasAttribute('open')) {
        wrapper.style.transition = 'none';
        wrapper.style.maxHeight = wrapper.scrollHeight + 22 + 'px';
        wrapper.style.opacity = '1';
        wrapper.style.paddingBottom = '22px';
      }

      // Перехватываем клик по summary
      summary.addEventListener('click', function(e) {
        e.preventDefault(); // Отменяем нативное поведение <details>

        var isOpen = det.hasAttribute('open');

        if (isOpen) {
          // Закрываем
          wrapper.style.transition = [
            'max-height 0.36s cubic-bezier(0.4, 0, 0.2, 1)',
            'opacity 0.24s ease',
            'padding-bottom 0.28s ease'
          ].join(', ');

          requestAnimationFrame(function() {
            wrapper.style.maxHeight = '0';
            wrapper.style.opacity = '0';
            wrapper.style.paddingBottom = '0';
            det.classList.remove('open');
          });

          // Убираем open атрибут после анимации
          setTimeout(function() { det.removeAttribute('open'); }, 380);

        } else {
          // Открываем
          det.setAttribute('open', '');

          wrapper.style.transition = 'none';
          wrapper.style.maxHeight = 'none';
          wrapper.style.paddingBottom = '22px';

          var h = wrapper.scrollHeight + 22;

          wrapper.style.maxHeight = '0';
          wrapper.style.opacity = '0';
          wrapper.style.paddingBottom = '0';

          // eslint-disable-next-line no-unused-expressions
          wrapper.offsetHeight;

          wrapper.style.transition = [
            'max-height 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
            'opacity 0.32s ease',
            'padding-bottom 0.32s ease'
          ].join(', ');

          requestAnimationFrame(function() {
            wrapper.style.maxHeight = h + 'px';
            wrapper.style.opacity = '1';
            wrapper.style.paddingBottom = '22px';
            det.classList.add('open');
          });
        }
      });
    });
  }

  /* ── Найти ikonку + / × ── */
  function ensureFaqIcon(question) {
    // Ищем существующую иконку
    var icon = question.querySelector('.faq-icon, .faq-plus, span:last-child');

    if (icon && (icon.textContent.trim() === '+' || icon.textContent.trim() === '×' ||
        icon.classList.contains('faq-icon') || icon.classList.contains('faq-plus'))) {
      // Уже есть — добавляем класс для правильной стилизации
      icon.classList.add('faq-icon');
      // Меняем содержимое на «+» (CSS rotate сделает «×»)
      icon.textContent = '+';
      return;
    }

    // Создаём иконку
    var newIcon = document.createElement('span');
    newIcon.className = 'faq-icon';
    newIcon.setAttribute('aria-hidden', 'true');
    newIcon.textContent = '+';
    question.appendChild(newIcon);
  }

  /* ── Главная инициализация ── */
  function init() {
    var found = findFaqItems();

    // Добавляем иконку к каждому question
    found.jsItems.forEach(function(item) {
      var q = findQuestion(item);
      if (q) ensureFaqIcon(q);
    });

    initJsAccordion(found.jsItems);
    initDetailsAccordion(found.detailsItems);

    // MutationObserver для динамически добавленных FAQ
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mut) {
          mut.addedNodes.forEach(function(node) {
            if (node.nodeType !== 1) return;
            var newJsItems = Array.from(node.querySelectorAll('.faq-item')).filter(function(i) { return !i._faqInited; });
            var newDetails = Array.from(node.querySelectorAll('details')).filter(function(d) { return !d._faqInited && !d.closest('.faq-item'); });
            if (newJsItems.length) initJsAccordion(newJsItems);
            if (newDetails.length) initDetailsAccordion(newDetails);
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ── Запуск ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
