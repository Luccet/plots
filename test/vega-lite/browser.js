#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// vega-lite.js in Chromium and Firefox (test/harness.js): Vega-Lite and
// Vega fences drawn in the theme's colours, the plot palette for series,
// CSV read with quotes, expressions, width "container", unsafe links
// dropped, print copies with unique ids, Vega pinned with SRI, specifications
// that are not JSON or whose data does not load left with their errors; a
// change of scheme drawn again; a dark theme under a strict policy with no
// violation (no eval); ?base=; no Vega for a note without a chart; and both
// of the kit's add-ons on one page. Vega comes from its local copy
// (tools/vega.js), so runs are the same each time and work offline after
// the first.
//
//   LUCCET_ROOT=…/luccet node test/vega-lite/browser.js [--browsers=…] [--filter=TEXT] [--live-cdn]
'use strict';

const fs = require('fs');
const path = require('path');
const h = require('../harness');
const { packageDir } = require('../../tools/vega');

const SRC = fs.readFileSync(path.join(h.ROOT, 'vega-lite.js'), 'utf8');
const V = { vega: /vega: '([\d.]+)'/.exec(SRC)[1], 'vega-lite': /vegaLite: '([\d.]+)'/.exec(SRC)[1] };
const cdn = (name) => ({ re: new RegExp(`^https://cdn\\.jsdelivr\\.net/npm/${name}@(\\d+\\.\\d+\\.\\d+)/([^?#]+)`), dir: (v) => h.cached(name, (x) => packageDir(name, x), v) });

const PAGE = () => {
  window.__vl = {
    resolved: (value) => {
      const s = document.createElement('span');
      s.style.color = value;
      document.querySelector('main.luccet').append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    },
    prop: (k) => window.__vl.resolved(getComputedStyle(document.querySelector('main.luccet')).getPropertyValue(k).trim()),
    fill: (sel) => {
      const el = document.querySelector(sel);
      return el && window.__vl.resolved(el.getAttribute('fill'));
    },
  };
};
const drawn = (n) => `document.querySelectorAll('.t-vega > .t-vega-screen svg').length === ${n}`;

const TESTS = [
  {
    name: "charts drawn in luccet.css's colours, series in the plot palette; CSV with quotes, expressions, width container; unsafe links dropped; errors kept with their ids; print copies; SRI",
    url: '/test/vega-lite/pages/addon.html',
    init: PAGE,
    allowConsole: /404|Not Found/,
    check: async (page) => {
      await h.expect(page, `${drawn(4)} && document.querySelectorAll('.t-vega-error').length === 2 && document.querySelectorAll('.t-vega-print svg').length === 4`, 'four charts, their print copies and two errors', 20000);
      const r = await page.evaluate(() => ({
        ids: [...document.querySelectorAll('.t-vega')].map((w) => w.id),
        bar: window.__vl.fill('#bars .t-vega-screen .mark-rect path'),
        link: window.__vl.prop('--t-link'),
        points: document.querySelectorAll('#cars .t-vega-screen .mark-symbol.role-mark path').length,
        fills: [...new Set([...document.querySelectorAll('#cars .t-vega-screen .mark-symbol.role-mark path')].map((p) => window.__vl.resolved(p.getAttribute('fill'))))].length,
        js: [...document.querySelectorAll('.t-vega svg *')].some((e) => [...e.attributes].some((a) => /javascript:/.test(a.value))),
        lineWidth: document.querySelector('#line .t-vega-screen svg').getAttribute('width'),
        box: document.querySelector('#line').clientWidth,
        printBar: document.querySelector('#bars .t-vega-print .mark-rect path').getAttribute('fill'),
        errors: [...document.querySelectorAll('.t-vega-error')].map((e) => [e.previousElementSibling.id, e.textContent]),
        sri: [...document.querySelectorAll('script[src*="cdn.jsdelivr.net"]')].map((s) => [s.src.replace(/.*\/npm\//, ''), /^sha384-/.test(s.integrity), s.crossOrigin]),
        ids2: (() => {
          const all = [...document.querySelectorAll('.t-vega [id]')].map((e) => e.id);
          return all.length === new Set(all).size;
        })(),
        hidden: [...document.querySelectorAll('.t-vega > pre')].every((p) => p.hidden),
        listing: !!document.querySelector('figure#cars .t-vega, figure .t-vega#cars, figure .t-vega'),
      }));
      h.assert(JSON.stringify(r.ids) === '["bars","","line","raw"]', `ids ${r.ids}`);
      h.assert(r.bar === r.link, `one series in --t-link: ${r.bar} / ${r.link}`);
      h.assert(r.points === 9 && r.fills === 3, `9 cars from CSV, quoted names and all, 3 colours: ${r.points}, ${r.fills}`);
      h.assert(!r.js, 'the javascript: link is nowhere');
      h.assert(Math.abs(Number(r.lineWidth) - r.box) < 4, `width container: ${r.lineWidth} in ${r.box}`);
      h.assert(r.printBar === '#1f5fa8', `the print copy in the print palette: ${r.printBar}`);
      h.assert(r.errors.length === 2 && r.errors[0][0] === 'notjson' && /^This chart cannot be drawn: it is not JSON: /.test(r.errors[0][1]) && r.errors[1][0] === 'nodata' && /Loading failed: \/missing\.csv/.test(r.errors[1][1]), `errors ${JSON.stringify(r.errors)}`);
      h.assert(r.sri.length === 2 && r.sri.every((s) => s[1] && s[2] === 'anonymous'), `SRI ${JSON.stringify(r.sri)}`);
      h.assert(r.ids2 && r.hidden && r.listing, 'unique ids, fences hidden, the listing drawn');
      await page.emulateMedia({ media: 'print' });
      const shown = await page.evaluate(() => [getComputedStyle(document.querySelector('#bars .t-vega-screen')).display, getComputedStyle(document.querySelector('#bars .t-vega-print')).display]);
      h.assert(shown[0] === 'none' && shown[1] === 'flex', `print shows the print copy: ${shown}`);
    },
  },
  {
    name: 'the reader’s dark preference draws the charts again in its colours',
    url: '/test/vega-lite/pages/addon.html',
    init: PAGE,
    allowConsole: /404|Not Found/,
    check: async (page) => {
      await h.expect(page, drawn(4), 'four charts', 20000);
      const light = await page.evaluate(() => window.__vl.fill('#bars .t-vega-screen .mark-rect path'));
      await page.emulateMedia({ colorScheme: 'dark' });
      await h.expect(page, (l) => window.__vl.fill('#bars .t-vega-screen .mark-rect path') !== l, 'the bars drawn again', 10000, light);
      const r = await page.evaluate(() => [window.__vl.fill('#bars .t-vega-screen .mark-rect path'), window.__vl.prop('--t-link'), document.querySelectorAll('#bars > .t-vega-screen').length]);
      h.assert(r[0] === r[1] && r[2] === 1, `dark: ${r}`);
    },
  },
  {
    name: "a dark theme (Nord) under a strict policy: no violation; CSV, filters and expressions without eval; the theme's colours",
    url: '/csp-nonce/test/vega-lite/pages/addon-theme.html',
    init: PAGE,
    check: async (page) => {
      await h.expect(page, drawn(2), 'two charts', 20000);
      const r = await page.evaluate(() => ({
        csp: window.__csp,
        bar: window.__vl.fill('#bars .t-vega-screen .mark-rect path'),
        points: [...document.querySelectorAll('#cars .t-vega-screen .mark-symbol.role-mark path')].map((p) => p.getAttribute('transform')),
        label: window.__vl.fill('#bars .t-vega-screen .role-axis-label text'),
        muted: window.__vl.prop('--t-muted'),
      }));
      h.assert(!r.csp.length, `CSP violations: ${r.csp}`);
      h.assert(r.bar === 'rgb(136, 192, 208)', `Nord's link: ${r.bar}`);
      h.assert(r.points.length === 6, `6 cars over 20 mpg: ${JSON.stringify(r.points)}`);
      h.assert(r.label === r.muted, `axis labels muted: ${r.label} / ${r.muted}`);
    },
  },
  {
    name: '?base=: Vega and Vega-Lite from a local copy, without SRI, nothing from jsDelivr',
    url: '/test/vega-lite/pages/addon-base.html',
    setup: async (context, page, ctx) => {
      ctx.requests = [];
      page.on('request', (r) => ctx.requests.push(r.url()));
    },
    check: async (page, ctx) => {
      await h.expect(page, drawn(2), 'two charts', 20000);
      const scripts = await page.evaluate(() => [...document.querySelectorAll('script[src]')].filter((s) => new URL(s.src).pathname.startsWith('/vendor/')).map((s) => [new URL(s.src).pathname, s.integrity]));
      h.assert(JSON.stringify(scripts) === '[["/vendor/vega/vega.min.js",""],["/vendor/vega/vega-lite.min.js",""]]', `scripts ${JSON.stringify(scripts)}`);
      h.assert(!ctx.requests.some((u) => u.includes('jsdelivr')), 'nothing from jsDelivr');
    },
  },
  {
    name: 'no Vega for a note without a chart',
    url: '/test/vega-lite/pages/addon-none.html',
    setup: async (context, page, ctx) => {
      ctx.requests = [];
      page.on('request', (r) => ctx.requests.push(r.url()));
    },
    check: async (page, ctx) => {
      await page.waitForTimeout(300);
      h.assert(!ctx.requests.some((u) => /jsdelivr|vega(?:-lite)?\.min\.js/.test(u)), `requests ${ctx.requests}`);
    },
  },
  {
    name: "both of the kit's add-ons on one page",
    url: '/test/vega-lite/pages/both.html',
    check: async (page) => {
      await h.expect(page, `${drawn(1)} && document.querySelector('#p > svg')`, 'a plot and a chart', 20000);
    },
  },
];

h.runBrowser(TESTS, {
  route: (url) => (url.startsWith('/vendor/vega/') ? path.join(require('../../tools/npm').CACHE, `${url.includes('vega-lite') ? 'vega-lite' : 'vega'}-${V[url.includes('vega-lite') ? 'vega-lite' : 'vega']}`, 'build', path.basename(url)) : null),
  cdn: [cdn('vega-lite'), cdn('vega')],
});
