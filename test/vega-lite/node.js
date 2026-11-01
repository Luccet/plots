#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// vega-lite.js under node: it runs under the command line with no
// diagnostic and leaves drawing to the browser; its Vega table is well
// formed and is the pinned versions' (the interpreter it carries too); its
// print palette is luccet.css's; it compiles nothing at run time; and
// tools/vendor.js writes the copy ?base= takes. The browser's part is
// test/vega-lite/browser.js's.
//
//   LUCCET_ROOT=…/luccet node test/vega-lite/node.js
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const h = require('../harness');

const SRC = fs.readFileSync(path.join(h.ROOT, 'vega-lite.js'), 'utf8');
const node = (args, cwd = h.ROOT) => {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const offline = (r) => /could not be fetched|fetch failed|ENOTFOUND|EAI_AGAIN/.test(r.err + r.out);
const tool = (name) => path.join(h.ROOT, 'tools', name);

h.test("under luccet check and luccet build: no diagnostic, and the page holds no drawing, which is the browser's", async () => {
  const page = await h.checkAndBuild('vega-lite.js', '# Hello\n\n```vega-lite\n{"mark": "bar"}\n```\n\n```vega [A listing]{#v}\n{"marks": []}\n```\n');
  h.assert(/<code class="language-vega-lite">/.test(page) && /<code class="language-vega">/.test(page) && !/t-vega|<svg/.test(page), 'the built fences are fences');
});

h.test('the Vega table is well formed, and the interpreter it carries is a function of vega', () => {
  const block = /\/\/ <vega>[^\n]*\n([\s\S]*?)\n\s*\/\/ <\/vega>/.exec(SRC);
  h.assert(block, 'no <vega> table');
  const { VEGA, interpreterOf } = new Function(`${block[1]}; return { VEGA, interpreterOf };`)();
  for (const k of ['vega', 'vegaLite', 'interpreter']) h.assert(/^\d+\.\d+\.\d+$/.test(VEGA[k]), `${k} ${VEGA[k]}`);
  for (const k of ['vega', 'vegaLite']) h.assert(/^sha384-[A-Za-z0-9+/]{64}$/.test(VEGA.sri[k]), `hash ${VEGA.sri[k]}`);
  const vega = { ascending: (a, b) => a - b, isString: (s) => typeof s === 'string', DisallowedObjectProperties: new Set(['__proto__']) };
  const ex = interpreterOf(vega);
  h.assert(typeof ex === 'object' && typeof ex.parameter === 'function' && typeof ex.encode === 'function', `the interpreter: ${Object.keys(ex)}`);
  h.assert(/BSD-3-Clause, Copyright/.test(block[1]), 'its licence named');
  return `Vega ${VEGA.vega}, Vega-Lite ${VEGA.vegaLite}, interpreter ${VEGA.interpreter}`;
});

h.test("the table is the pinned versions' (tools/vega.js --check)", () => {
  const r = node([tool('vega.js'), '--check']);
  if (r.code !== 0 && offline(r)) throw new h.Skip('the Vega packages are not cached and could not be fetched');
  h.assert(r.code === 0, `${r.out}${r.err}`);
});

h.test('nothing compiled at run time: no eval, no new Function, no inline style attribute', () => {
  const own = SRC.replace(/\/\/ <vega>[\s\S]*?\/\/ <\/vega>/, '').replace(/^\s*\/\/.*$/gm, '');
  h.assert(!/\beval\(|new Function|Function\(/.test(own), 'no eval');
  h.assert(!/setAttribute\(['"]style/.test(own), 'no style attribute');
});

h.test("its print palette is luccet.css's", () => {
  const PRINT = new Function(`return ${/const PRINT = (\{[\s\S]*?\});/.exec(SRC)[1]}`)();
  const want = require(path.join(h.ENGINE, 'test', 'lib', 'palette')).printPalette();
  const long = (x) => (x.length === 4 ? '#' + [...x.slice(1)].map((c) => c + c).join('') : x);
  const off = Object.keys(PRINT).filter((k) => !(k in want) || (/^#/.test(want[k] || '') && PRINT[k] !== long(want[k])));
  h.assert(PRINT.bg === '#ffffff' && PRINT.fg === '#000000' && !off.length, `differs: ${off}`);
});

h.test('tools/vendor.js: Vega and Vega-Lite in the layout ?base= takes; usage errors', () =>
  h.inTemp((dir) => {
    const r = node([tool('vendor.js'), 'vend'], dir);
    if (r.code === 1 && offline(r)) throw new h.Skip('the Vega packages are not cached and could not be fetched');
    h.assert(r.code === 0, `vendor.js: ${r.err}`);
    h.assert(JSON.stringify(fs.readdirSync(path.join(dir, 'vend'), { recursive: true }).map(String).sort()) === '["vega","vega/vega-lite.min.js","vega/vega.min.js"]', 'vend/vega/');
    h.assert(/^Vega [\d.]+ and Vega-Lite [\d.]+ → vend\/vega \(2 files\); load them with vega-lite\.js\?base=vend\/vega$/.test(r.err.trim()), `the base line: ${r.err}`);
    h.assert(node([tool('vendor.js')], dir).code === 2 && node([tool('vendor.js'), 'a', 'b'], dir).code === 2, 'no DIR, or two');
  }),
);

h.runTests();
