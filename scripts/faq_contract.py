#!/usr/bin/env python3
"""Compare FAQPage JSON-LD with the actual visible FAQ items on a page.

Only the site's supported FAQ components are collected. A question elsewhere in
body copy does not satisfy the contract. Whitespace and HTML entities are
normalised; collapsed <details> and accordions count because readers can open
these answers. No third-party parser is required.
"""
from __future__ import annotations

import html
import re
from html.parser import HTMLParser


VOID_ELEMENTS = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr',
}
DETAIL_CLASSES = {'lp-faq-item', 'mr-faq-item', 'hub-faq-item'}
ACCORDION_CLASSES = {'cb-faq-item', 'faq-item'}


def normalize(value: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(value)).strip()


class FAQCollector(HTMLParser):
    """Collect the question and answer from each supported FAQ item."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[tuple[str, str]] = []
        self._parts: dict[str, list[str]] | None = None
        # Each stack entry is (tag, hidden, field started by this element).
        self._stack: list[tuple[str, bool, str | None]] = []
        self._details = False

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        classes = set((values.get('class') or '').split())
        if self._parts is None:
            is_detail = tag == 'details' and bool(classes & DETAIL_CLASSES)
            is_accordion = tag == 'div' and bool(classes & ACCORDION_CLASSES)
            if is_detail or is_accordion:
                self._details = is_detail
                self._parts = {'question': [], 'answer': []}
                self._stack = [(tag, False, None)]
            return
        if tag in VOID_ELEMENTS:
            if tag == 'br' and self._stack:
                self.handle_data(' ')
            return
        hidden = (
            self._stack[-1][1]
            or values.get('aria-hidden') == 'true'
            or 'hidden' in values
            or tag in {'svg', 'script', 'style'}
        )
        field = None
        if (self._details and tag == 'summary') or 'cb-faq-q' in classes:
            field = 'question'
        elif (self._details and tag == 'p') or 'cb-faq-a-inner' in classes:
            field = 'answer'
        self._stack.append((tag, hidden, field))

    def handle_startendtag(self, tag: str, attrs) -> None:
        if tag == 'br' and self._parts is not None:
            self.handle_data(' ')

    def handle_endtag(self, tag: str) -> None:
        if self._parts is None or tag in VOID_ELEMENTS:
            return
        for idx in range(len(self._stack) - 1, -1, -1):
            if self._stack[idx][0] == tag:
                del self._stack[idx:]
                break
        if not self._stack:
            self.items.append((
                normalize(''.join(self._parts['question'])),
                normalize(''.join(self._parts['answer'])),
            ))
            self._parts = None
            self._details = False

    def handle_data(self, data: str) -> None:
        if self._parts is None or not self._stack or self._stack[-1][1]:
            return
        field = next((entry[2] for entry in reversed(self._stack) if entry[2]), None)
        if field:
            self._parts[field].append(data)


def schema_faq_pairs(node: dict) -> list[tuple[str, str]]:
    """Extract FAQ questions/accepted answers from a parsed FAQPage node."""
    entities = node.get('mainEntity', [])
    if isinstance(entities, dict):
        entities = [entities]
    if not isinstance(entities, list):
        return []
    pairs = []
    for item in entities:
        if not isinstance(item, dict):
            continue
        answer = item.get('acceptedAnswer', {})
        if not isinstance(answer, dict):
            answer = {}
        question_text = item.get('name', '')
        answer_text = answer.get('text', '')
        pairs.append((
            normalize(question_text if isinstance(question_text, str) else ''),
            normalize(answer_text if isinstance(answer_text, str) else ''),
        ))
    return pairs


def compare_faq(page_html: str, faq_nodes: list[dict]) -> list[str]:
    """Return issues when schema and the page's FAQ question/answer pairs differ."""
    parser = FAQCollector()
    parser.feed(page_html)
    visible = parser.items
    marked = [pair for node in faq_nodes for pair in schema_faq_pairs(node)]
    issues: list[str] = []

    def index_pairs(pairs: list[tuple[str, str]], label: str) -> dict[str, str]:
        indexed: dict[str, str] = {}
        for question, answer in pairs:
            if not question or not answer:
                issues.append(f'{label}: empty question or answer')
            elif question in indexed:
                issues.append(f'{label}: duplicate question: {question}')
            else:
                indexed[question] = answer
        return indexed

    visible_by_question = index_pairs(visible, 'HTML FAQ')
    marked_by_question = index_pairs(marked, 'FAQPage')
    for question, answer in marked_by_question.items():
        if question not in visible_by_question:
            issues.append(f'FAQPage question missing from HTML FAQ: {question}')
        elif visible_by_question[question] != answer:
            issues.append(f'FAQPage answer differs from HTML FAQ: {question}')
    for question in visible_by_question.keys() - marked_by_question.keys():
        issues.append(f'HTML FAQ question missing from FAQPage: {question}')
    return issues
