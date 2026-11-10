#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// plot.js in Chromium and Firefox (test/harness.js): fences drawn as SVG,
// listings and ids kept, legends with their formulas, a broken one left
// with its error; colours from luccet.css's palette, a theme's (Nord, under
// a strict policy with no violation), the reader's dark preference and print,
// all without drawing again; nothing fetched; and examples/areas.html, with
// the engine from the checkout in place of the CDN's.
//
//   LUCCET_ROOT=…/luccet node test/plot/browser.js [--browsers=…] [--filter=TEXT]
'use strict';

const h = require('../harness');
const examples = require('../examples');

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

// examples/areas.html's figures: for each, the colour of each line drawn,
// curves (a dashed one marked), regions and points, and its legend's size.
const AREAS = {
  'fig-sincos': { curves: ['c1', 'c4'], regions: ['c3'], points: 2, legend: 3 },
  'fig-slices': { curves: ['c1', 'c4', 'c5 dashed'], regions: ['c3'], points: 2, legend: 3 },
  'fig-polar': { curves: ['c1', 'c4'], regions: ['c3'], points: 2, legend: 3 },
  'fig-astroid': { curves: ['c1 dashed', 'c4'], regions: ['c3'], points: 0, legend: 3 },
};

const TESTS = [
  {
    name: 'examples/areas.html: four plots in numbered figures, each line drawn (functions of x and y, polar, parametric and implicit curves, regions, points) in its colour, legends with formulas, ticks in π; nothing fetched',
    url: '/examples/areas.html',
    init: PAGE,
    setup: async (context, page, ctx) => {
      await examples.fromCdn(context, ctx.origin);
      ctx.requests = [];
      page.on('request', (r) => ctx.requests.push(r.url()));
    },
    check: async (page, ctx) => {
      await h.expect(page, () => document.querySelectorAll('figure .t-plot > svg').length === 4, 'four plots in figures');
      const r = await page.evaluate((ids) => {
        const lines = (fig, kind) =>
          [...fig.querySelectorAll(`.t-plot-${kind}`)]
            .filter((p) => (p.getAttribute('d') || '').length > 100)
            .map((p) => [...p.classList].filter((c) => /^t-plot-(c\d|dashed)$/.test(c)).map((c) => c.slice(7)).join(' '));
        const figs = {};
        for (const id of ids) {
          const fig = document.getElementById(id);
          figs[id] = {
            figure: fig && fig.matches('figure[data-t="figure"]'),
            caption: fig && (/^Figure\s*\d+/.exec(fig.querySelector(':scope > figcaption').textContent.trim()) || [''])[0].replace(/\s+/, ' '),
            ref: (document.querySelector(`main.luccet a.t-ref[href="#${id}"]`) || {}).textContent,
            curves: lines(fig, 'curve'),
            regions: lines(fig, 'region'),
            points: fig.querySelectorAll('circle.t-plot-point').length,
            legend: fig.querySelectorAll('.t-plot-legend > li').length,
            maths: fig.querySelectorAll('.t-plot-legend > li math').length,
            hidden: fig.querySelector('.t-plot > pre').hidden,
          };
        }
        const colour = (c) => window.__pl.colour(document.querySelector(`.t-plot-curve.t-plot-${c}, .t-plot-point.t-plot-${c}`));
        return {
          figs,
          colours: ['c1', 'c4', 'c5'].map(colour),
          link: window.__pl.prop('--t-link'),
          pi: [...document.querySelectorAll('#fig-sincos .t-plot-labels text')].map((t) => t.textContent).filter((t) => t.includes('π')),
        };
      }, Object.keys(AREAS));
      Object.keys(AREAS).forEach((id, i) => {
        const want = AREAS[id];
        const got = r.figs[id];
        h.assert(got.figure && got.caption === `Figure ${i + 1}` && got.ref === `Figure ${i + 1}`, `${id}: figure ${got.figure}, caption "${got.caption}", reference "${got.ref}"`);
        for (const want_ of want.curves) h.assert(got.curves.includes(want_), `${id}: no ${want_} curve among ${JSON.stringify(got.curves)}`);
        h.assert(JSON.stringify(got.regions) === JSON.stringify(want.regions), `${id}: regions ${JSON.stringify(got.regions)}`);
        h.assert(got.points === want.points && got.legend === want.legend && got.maths === want.legend && got.hidden, `${id}: ${got.points} points, ${got.legend} legend entries with ${got.maths} formulas, fence hidden ${got.hidden}`);
      });
      h.assert(r.colours[0] === r.link && new Set(r.colours).size === 3, `colours 1, 4 and 5: ${r.colours}, --t-link ${r.link}`);
      h.assert(r.pi.join() === 'π/4,π/2,3π/4,π,5π/4,3π/2,7π/4,2π', `ticks in π: ${r.pi}`);
      const others = ctx.requests.filter((u) => !u.startsWith(ctx.origin) && !/^https:\/\/cdn\.luccet\.dev\//.test(u));
      h.assert(!others.length, `nothing fetched beyond the site and cdn.luccet.dev: ${others}`);
    },
  },
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
