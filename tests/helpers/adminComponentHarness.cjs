const fs = require('node:fs');
const React = require('react');
const { act } = React;
const { JSDOM } = require('jsdom');
const { transform } = require('esbuild');

async function mountAdminComponent(file, api = {}, options = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: options.url || 'https://admin.example.test/admin' });
  const previous = Object.fromEntries(['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, global[key]]));
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const notices = [];
  const toast = notice => notices.push(notice);
  const source = fs.readFileSync(file, 'utf8');
  const name = options.componentName || source.match(/export default function (\w+)/)[1];
  const compiled = await transform(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function').replace(/export function /g, 'function ').replace(/^export \{.*\};\n/gm, ''), { loader: 'jsx', jsx: 'transform', format: 'cjs' });
  const icon = () => null;
  const native = type => ({ children, variant: _variant, fittingType: _fittingType, ...props }) => React.createElement(type, props, children);
  const mocks = {
    React, useState: React.useState, useEffect: React.useEffect, useRef: React.useRef,
    useMemo: React.useMemo, useCallback: React.useCallback, createContext: React.createContext, useContext: React.useContext,
    useToast: () => ({ toast }), useLocation: () => ({ pathname: options.pathname || '/admin/editorial' }),
    Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children),
    Button: native('button'), Input: native('input'), Textarea: native('textarea'), Image: native('img'),
    AdminOperationsControls: icon, SearchVisibilitySettings: icon, AmazonSeasonalPromotionSettings: icon,
    bookmarksApi: api.bookmarks || {}, functions: api.functions || {}, dealsApi: api.deals || {}, editorialApi: api.editorial || {},
    formatPrice: value => `$${value}`, describePriceCheck: () => 'Price check result',
  };
  const icons = source.match(/import \{ (.+) \} from 'lucide-react'/)?.[1].split(', ') || [];
  for (const key of icons) mocks[key] = icon;
  Object.assign(mocks, options.mocks || {});
  const exported = new Function(...Object.keys(mocks), `${compiled.code}\nreturn { Component: ${name}${(options.extraExports || []).map(name => `, ${name}`).join('')} };`)(...Object.values(mocks));
  const Component = exported.Component;
  const container = dom.window.document.getElementById('root');
  const { createRoot } = require('react-dom/client');
  const root = createRoot(container);
  const flush = async (ms = 0) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
  await act(async () => { root.render(React.createElement(Component, options.props || {}, options.renderChildren ? options.renderChildren(exported) : options.props?.children)); });
  await flush(5);
  return {
    container, window: dom.window, notices, flush,
    button: text => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === text),
    click: async element => { if (!element) throw new Error('Control not found'); await act(async () => { element.click(); }); await flush(); },
    submit: async form => { await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await flush(); },
    change: async (input, value) => { await act(async () => {
      Object.getOwnPropertyDescriptor(input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }); },
    close: async () => { await act(async () => { root.unmount(); }); dom.window.close(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } },
  };
}

function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
module.exports = { mountAdminComponent, deferred, act };
