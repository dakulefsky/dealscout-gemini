const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transform } = require('esbuild');
const { dealSavings } = require('../src/lib/dealSavings.js');
const source = fs.readFileSync('src/components/DealCard.jsx', 'utf8');
let component;
async function renderCard(deal, viewMode = 'grid') {
  if (!component) {
    const text = source.replace(/^import .*;\n/gm, '').replace('export function formatPrice', 'function formatPrice').replace('export default function DealCard', 'function DealCard');
    const compiled = await transform(text, { loader: 'jsx', jsx: 'transform', format: 'cjs' });
    const icon = () => null;
    const mocks = { React, useCallback: React.useCallback, useEffect: React.useEffect, useRef: React.useRef, useState: React.useState,
      Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children),
      Image: ({ src, alt }) => React.createElement('img', { src, alt }),
      useToast: () => ({ toast: () => {} }), useBookmarks: () => ({ isSaved: () => false, toggleBookmark: () => {} }),
      isDealDismissed: () => false, splitProductTitle: title => ({ name: title }), dealSavings,
      Heart: icon, ArrowRight: icon, Clock: icon, AlertCircle: icon, EyeOff: icon };
    component = new Function(...Object.keys(mocks), `${compiled.code}\nreturn { DealCard, formatPrice };`)(...Object.values(mocks));
  }
  return renderToStaticMarkup(React.createElement(component.DealCard, { deal, viewMode }));
}

test('grid and list cards announce checked price and reference savings', async () => {
  for (const mode of ['grid', 'list']) {
    const html = await renderCard({ id: 'one', title: 'Exact model', salePrice: 75, originalPrice: 100 }, mode);
    assert.match(html, /aria-label="View deal: Exact model\. Checked price \$75\.00\. Reference price \$100\.00\. 25% off the reference price\."/);
  }
});

test('ended and invalid-price cards do not announce a current discount', async () => {
  const ended = await renderCard({ id: 'one', title: 'Ended model', salePrice: 75, originalPrice: 100, status: 'EXPIRED' });
  assert.match(ended, /aria-label="Ended deal: Ended model\. Last checked price \$75\.00\. Reference price \$100\.00\."/);
  assert.doesNotMatch(ended, /25% off/);
  const invalid = await renderCard({ id: 'two', title: 'Unknown price', salePrice: Infinity, originalPrice: Infinity });
  assert.match(invalid, /aria-label="View deal: Unknown price\."/);
  assert.doesNotMatch(invalid, /Infinity|∞/);
  for (const price of [undefined, null, '', ' ', NaN, Infinity]) assert.equal(component.formatPrice(price), '');
});
