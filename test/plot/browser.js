#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// plot.js in Chromium and Firefox (test/harness.js): fences drawn as SVG,
// listings and ids kept, legends with their formulas, a broken one left
// with its error; colours from luccet.css's palette, a theme's (Nord, under
// a strict policy with no violation), the reader's dark preference and print,
// all without drawing again; and nothing fetched.
//
//   LUCCET_ROOT=…/luccet node test/plot/browser.js [--browsers=…] [--filter=TEXT]
'use strict';

const h = require('../harness');

// In the page: a colour as the browser computes it, in rgb().
const PAGE = () => {
  window.__pl = {
    colour: (el) => getComputedStyle(el).color,
    resolved: (value) => {
      const s = document.createElement('span');
      s.style.color = value;
      document.querySelector('main.luccet').append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    },
    prop: (k) => window.__pl.resolved(getComputedStyle(document.querySelector('main.luccet')).getPropertyValue(k).trim()),
  };
};

const TESTS = [
  {
    name: "fences drawn: listings and ids kept, legends with formulas, the fence hidden; a broken one left with its error and its id; luccet.css's colours; nothing fetched",
    url: '/test/plot/pages/addon.html',
    init: PAGE,
    setup: async (context, page, ctx) => {
      ctx.requests = [];
      page.on('request', (r) => ctx.requests.push(r.url()));
    },
    check: async (page, ctx) => {
      await h.expect(page, () => document.querySelectorAll('.t-plot > svg').length === 4 && document.querySelector('.t-plot-error'), 'four plots and an error');
      const r = await page.evaluate(() => ({
        ids: [...document.querySelectorAll('.t-plot')].map((w) => w.id),
        hidden: [...document.querySelectorAll('.t-plot > pre')].every((p) => p.hidden),
        listing: !!document.querySelector('figure#asym > .t-plot > svg'),
        legend: [...document.querySelectorAll('#waves .t-plot-legend > li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
        maths: document.querySelectorAll('#waves .t-plot-legend math').length,
        broken: (() => {
          const pre = document.querySelector('pre#broken');
          const err = pre && pre.nextElementSibling;
          return pre && !pre.hidden && err && err.className === 't-error t-plot-error' ? err.textContent : null;
        })(),
        first: window.__pl.colour(document.querySelector('#waves .t-plot-curve')),
        link: window.__pl.prop('--t-link'),
        line: getComputedStyle(document.querySelector('#waves .t-plot-grid')).stroke,
        lineProp: window.__pl.prop('--t-line'),
        own: getComputedStyle(document.querySelector('#defs .t-plot-region[color]')).fill,
        clip: [...document.querySelectorAll('.t-plot clipPath')].map((c) => c.id),
      }));
      h.assert(JSON.stringify(r.ids) === '["waves","shapes","","defs"]', `ids ${r.ids}`);
      h.assert(r.hidden && r.listing, 'fences hidden, the listing drawn inside its figure');
      h.assert(r.legend.length === 3 && r.maths >= 3, `legend ${JSON.stringify(r.legend)}, ${r.maths} formulas`);
      h.assert(/^This plot cannot be drawn: line 1 \(y = sin\(\): the expression ends too soon$/.test(r.broken || ''), `the broken one: ${r.broken}`);
      h.assert(r.first === r.link, `the first curve takes --t-link: ${r.first} / ${r.link}`);
      h.assert(r.line === r.lineProp, `the grid takes --t-line: ${r.line} / ${r.lineProp}`);
      h.assert(r.own === 'rgb(217, 119, 6)', `the author's colour: ${r.own}`);
      h.assert(new Set(r.clip).size === r.clip.length, `unique clip paths ${r.clip}`);
      const others = ctx.requests.filter((u) => !u.startsWith(ctx.origin));
      h.assert(!others.length, `nothing fetched beyond the site: ${others}`);
    },
    allowConsole: /./, // the broken plot's warning
  },
  {
    name: 'the reader’s dark preference and print change the colours without drawing again',
    url: '/test/plot/pages/addon.html',
    init: PAGE,
    check: async (page) => {
      await h.expect(page, () => document.querySelectorAll('.t-plot > svg').length === 4, 'four plots');
      const state = () => page.evaluate(() => ({ c: window.__pl.colour(document.querySelector('#waves .t-plot-curve.t-plot-c2')), link: window.__pl.prop('--t-link') }));
      await page.evaluate(() => (document.querySelector('#waves > svg').dataset.mark = 'same'));
      const light = await state();
      await page.emulateMedia({ colorScheme: 'dark' });
      const dark = await state();
      await page.emulateMedia({ media: 'print', colorScheme: 'light' });
      const print = await state();
      const same = await page.evaluate(() => document.querySelector('#waves > svg').dataset.mark);
      h.assert(light.c !== dark.c, `dark changes the colours: ${light.c} / ${dark.c}`);
      h.assert(print.c === 'rgb(180, 83, 9)', `print's second colour: ${print.c}`);
      h.assert(same === 'same', 'the same SVG throughout');
    },
    allowConsole: /./,
  },
  {
    name: "a theme's colours (Nord), under a strict policy: no violation, a region, the author's colour",
    url: '/csp-nonce/test/plot/pages/addon-theme.html',
    init: PAGE,
    check: async (page) => {
      await h.expect(page, () => document.querySelector('#p > svg'), 'the plot');
      const r = await page.evaluate(() => ({
        csp: window.__csp,
        c1: window.__pl.colour(document.querySelector('#p .t-plot-curve.t-plot-c1')),
        link: window.__pl.prop('--t-link'),
        c3: window.__pl.colour(document.querySelector('#p .t-plot-region.t-plot-c3')),
        string: window.__pl.prop('--t-code-string'),
        bg: getComputedStyle(document.querySelector('#p svg text')).stroke,
        bgProp: window.__pl.prop('--t-bg'),
      }));
      h.assert(!r.csp.length, `CSP violations: ${r.csp}`);
      h.assert(r.c1 === r.link && r.c1 === 'rgb(136, 192, 208)', `colour 1 is Nord's link: ${r.c1}`);
      h.assert(r.c3 === r.string, `colour 3 is Nord's code string: ${r.c3} / ${r.string}`);
      h.assert(r.bg === r.bgProp, `labels haloed in the background: ${r.bg}`);
    },
  },
];

h.runBrowser(TESTS, {});
