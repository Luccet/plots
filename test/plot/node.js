#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// plot.js under node: it runs under the command line with no diagnostic and
// leaves drawing to the browser; luccet.plot (the add-on run with a stub
// engine) reads every kind of line, calculator and TeX notation alike, and
// says what is wrong with one it cannot; curves break at asymptotes and
// where they are undefined, implicit ones close; ticks in π; its
// palette is the kit's, vega-lite.js's too; and the examples that load it
// pass luccet check. The browser's part is test/plot/browser.js's.
//
//   LUCCET_ROOT=…/luccet node test/plot/node.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('../harness');
const examples = require('../examples');

const SRC = fs.readFileSync(path.join(h.ROOT, 'plot.js'), 'utf8');

// The add-on with a stub engine: luccet.plot, and what it registered.
function addon() {
  const styles = [];
  const T = { api: 2, style: (css) => styles.push(css), define() {}, on() {}, config: {} };
  vm.runInNewContext(SRC, { window: { luccet: T }, console });
  return { plot: T.plot, styles };
}
const { plot, styles } = addon();
const ok = (src) => {
  const r = plot(src);
  if (r.error) throw new Error(`${JSON.stringify(src)}: ${r.error.message}`);
  return r;
};
// A path's subpaths, from the svg's curves.
const curves = (svg) => [...svg.matchAll(/<path class="t-plot-curve[^"]*"[^>]* d="([^"]*)"/g)].map((m) => m[1]);
const subpaths = (d) => d.split('M').filter(Boolean);

h.test("under luccet check and luccet build: no diagnostic, and the page holds no drawing, which is the browser's", async () => {
  const page = await h.checkAndBuild('plot.js', '# Hello\n\n```plot\ny = sin(x)\n```\n\n```plot [A listing]{#p}\nx^2 + y^2 = 1\n```\n');
  h.assert(/<code class="language-plot">y = sin\(x\)/.test(page) && !/t-plot|<svg/.test(page), 'the built fences are fences');
});

h.test('every kind of line draws: functions of x and of y, ranges, curves (x, y) and r =, implicit curves, regions, points, definitions', () => {
  const kinds = {
    'y = sin(x)': 1, 'sin x': 1, 'x = y^2': 1, 'y = x^2, x in [0, 2]': 1, '(cos t, sin t)': 1, '(t, t^2), t in [-1, 1]': 1, 'r = 1 + cos θ': 1, 'r = θ, θ in [0, 4π]': 1,
    'x^2 + y^2 = 4': 1, 'xy = 1': 1, 'y < x^2': 1, 'y >= sin x': 1, 'x <= y^2': 1, '0 <= y <= cos x': 2, 'x^2 + y^2 < 4': 1, 'x = 1': 1, 'y = 2': 1,
  };
  for (const [src, n] of Object.entries(kinds)) {
    const r = ok(src);
    h.assert(curves(r.svg).filter(Boolean).length >= n, `${src}: ${curves(r.svg).length} curves`);
  }
  h.assert(/<circle class="t-plot-point t-plot-c1"[^>]*\/><circle/.test(ok('(1, 2), (3, 4)').svg), 'two points');
  ok('a = 2\nf(x) = a x e^{-x}\ny = f(x)');
  ok('y = f(x)\nf(x) = k x\nk = 3'); // defined below its use
  ok('g(u, v) = u v\ny = g(x, 2)');
  ok('v_{max} = 2\ny = v_{max} x');
});

h.test('calculator and TeX notation, mixed: the same values', () => {
  const at = (src) => {
    // A constant line y = c: two notations draw the same path.
    const r = plot(`c = ${src}\ny = c`);
    if (r.error) throw new Error(`${src}: ${r.error.message}`);
    return r;
  };
  const same = [
    ['2pi', '2\\pi'], ['sqrt(2)', '\\sqrt{2}'], ['8^(1/3)', '\\sqrt[3]{8}'], ['1/2', '\\frac12'], ['(1+2)/(3+4)', '\\frac{1+2}{3+4}'],
    ['2*3', '2\\cdot 3'], ['2*3', '2 × 3'], ['|-2|', '\\left|-2\\right|'], ['sin(pi/6)^2', '\\sin^2(\\pi/6)'], ['arcsin(1/2)', 'sin^{-1}(1/2)'], ['log(100)', 'log_10(100)'], ['3!', 'gamma(4)'],
  ];
  for (const [a, b] of same) {
    const da = curves(at(a).svg)[0];
    const db = curves(at(b).svg)[0];
    h.assert(da && da === db, `${a} and ${b} differ: ${da} / ${db}`);
  }
  // Implied products and precedence, as a plot of a constant: the y pixel says the value.
  const y = (src) => Number(/M[\d.-]+ ([\d.-]+)/.exec(curves(ok(`c = ${src}\ny = c\ny in [-10, 10]`).svg)[0])[1]);
  const v = (n) => y(String(n));
  for (const [src, n] of [['-2^2', -4], ['2^-1', 0.5], ['2^3^2/100', 5.12], ['2(3)', 6], ['(1+1)(2+1)', 6], ['2pi/pi', 2], ['-8^(1/3)', -2], ['(-8)^(1/3)', -2], ['sin^2 0 + cos^2 0', 1], ['mod(-1, 3)', 2], ['max(1, 4, 2)', 4]]) h.assert(Math.abs(y(src) - v(n)) < 0.06, `${src} is not ${n}`);
});

h.test('what stops a plot is said, with its line', () => {
  const cases = [
    ['y = sin(', /^line 1 \(y = sin\(\): the expression ends too soon/],
    ['y = x\ny = foo', /^line 2 .*foo is not a name a plot knows/],
    ['y = a x', /a is not defined: define it with a = …/],
    ['y = t', /cannot use t/],
    ['e = 2', /neither x nor y/],
    ['a = 2\na = 3', /a is defined twice/],
    ['a = b\nb = a', /defined in terms of itself/],
    ['f(x) = x y\ny = f(x)', /f uses y, which is not one of its arguments/],
    ['y = log(1, 2, 3)', /log takes 1 to 2 arguments, not 3/],
    ['x in [5, 1]', /runs from its smaller end/],
    ['y = x {color=nope;}', /./],
    ['y = x {width=99}', /width=99 is not a width/],
    ['1 < y > 2', /both relations point one way/],
    ['(1, 2, 3)', /\(x, y\)/],
    ['y = x @', /"@" is not something a plot reads/],
  ];
  for (const [src, re] of cases) {
    const r = plot(src);
    h.assert(r.error && re.test(r.error.message), `${JSON.stringify(src)}: ${r.error ? r.error.message : 'drew'}`);
  }
  h.assert(plot('y = x\n\ny = foo').error.line === 3, 'the line counts blank lines');
});

h.test('attributes and comments: label, color, width, dashes; # after a space; braces in a label; settings', () => {
  const r = ok('y = x {label="$e^{-x}$" .dashed color=3 width=4}   # a comment\ny = 2x {color=#d97706}\n# a whole comment\nxlabel "time"\nylabel "f"\ngrid off\naxes on\nequal\nheight 300');
  h.assert(r.legend.length === 1 && r.legend[0].label === '$e^{-x}$' && r.legend[0].color === 3 && r.legend[0].dash === 'dashed', `legend ${JSON.stringify(r.legend)}`);
  h.assert(/class="t-plot-curve t-plot-c3 t-plot-dashed" stroke-width="4"/.test(r.svg), 'colour 3, dashed, width 4');
  h.assert(/class="t-plot-curve" color="#d97706"/.test(r.svg), "the author's colour, as an attribute (no style, so no policy needs 'unsafe-inline')");
  h.assert(/>time<\/text>/.test(r.svg) && />f<\/text>/.test(r.svg) && !/t-plot-grid/.test(r.svg) && /height="300"/.test(r.svg), 'labels, no grid, height');
  h.assert(!/style=/.test(r.svg), 'no style attributes');
  h.assert(/role="img" aria-label="Plot: \$e\^\{-x\}\$; y = 2x"/.test(r.svg), 'the plot is an image, labelled with its lines');
});

h.test('curves break at asymptotes and where undefined; implicit curves close; regions fill', () => {
  const tan = subpaths(curves(ok('y = tan x\nx in [-5, 5]\ny in [-4, 4]').svg)[0]);
  h.assert(tan.length === 5, `tan x over [-5, 5]: 5 branches, not ${tan.length}`);
  const sqrt = subpaths(curves(ok('y = sqrt(x)').svg)[0]);
  h.assert(sqrt.length === 1 && Math.abs(Number(sqrt[0].split(' ')[0]) - 320) < 1, `sqrt x starts at 0: ${sqrt[0].slice(0, 30)}`);
  const recip = subpaths(curves(ok('y = 1/x').svg)[0]);
  h.assert(recip.length === 2, `1/x: two branches, not ${recip.length}`);
  const circle = subpaths(curves(ok('x^2 + y^2 = 4').svg)[0]);
  h.assert(circle.length === 1, `a circle is one loop, not ${circle.length}`);
  const pts = circle[0].split('L');
  h.assert(pts[0] === pts[pts.length - 1] && pts.length > 100, 'closed, and smooth');
  h.assert(subpaths(curves(ok('tan(x) - y = 0\nx in [-5, 5]\ny in [-4, 4]').svg)[0]).every((s) => !s.split('L').some((p, k, a) => k && Math.abs(Number(p.split(' ')[1]) - Number(a[k - 1].split(' ')[1])) > 200)), 'implicit tan: no line down an asymptote');
  h.assert(/<path class="t-plot-region t-plot-c1" d="M[^"]+z"/.test(ok('0 <= y <= cos x').svg), 'a region between curves is filled');
  h.assert(/t-plot-dashed/.test(ok('y < x').svg) && !/t-plot-dashed/.test(ok('y <= x').svg), 'a strict bound is dashed');
  const noisy = ok('y = sin(1/x)');
  h.assert(noisy.svg.length < 2e6, `a curve that never settles has a budget: ${noisy.svg.length} characters`);
});

h.test('ticks: 1, 2 or 5 × 10^k; in π for a range written with π; minus signs', () => {
  const labels = (svg) => [...svg.matchAll(/<text x="[\d.]+" y="[\d.]+" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);
  const pi = labels(ok('y = sin x\nx in [-2π, 2π]').svg);
  h.assert(pi.join() === '−3π/2,−π,−π/2,π/2,π,3π/2', `π ticks: ${pi}`);
  const plain = labels(ok('y = x\nx in [-1, 1]').svg);
  h.assert(plain.join() === '−0.8,−0.6,−0.4,−0.2,0.2,0.4,0.6,0.8', `decimal ticks: ${plain}`);
  const big = labels(ok('y = x\nx in [0, 5000]').svg);
  h.assert(big.join() === '500,1000,1500,2000,2500,3000,3500,4000,4500', `large ticks: ${big}`);
});

h.test('the palette: six colours, a theme’s --t-plot-N first, then its link and code colours; print its own; the same in vega-lite.js', () => {
  const css = styles.join('\n');
  for (let i = 1; i <= 6; i++) h.assert(new RegExp(`\\.t-plot \\.t-plot-c${i} \\{ color: var\\(--t-plot-${i}, var\\(--t-[a-z-]+, var\\(--t-plot-f${i}\\)\\)\\); \\}`).test(css), `colour ${i}`);
  h.assert(/@media print \{ \.t-plot \{ --t-plot-1: #[0-9a-f]{6} !important;/.test(css), 'print sets its own');
  const VL = fs.readFileSync(path.join(h.ROOT, 'vega-lite.js'), 'utf8');
  const block = (src) => /const FALLBACK = \{[\s\S]*?\};\n  const THEMED = \[[^\]]*\];/.exec(src)[0];
  h.assert(block(SRC) === block(VL), 'plot.js and vega-lite.js have one palette');
});

h.test('examples/: the notes that load plot.js pass luccet check with nothing to report', () => examples.check('plot.js'));

h.runTests();
