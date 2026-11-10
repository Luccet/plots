// SPDX-License-Identifier: MIT
// The examples (examples/), for test/plot/ and test/vega-lite/: this
// repository's own, not the shared harness. Each add-on's tests check the
// notes that load it.
//
//   const ex = require('../examples');
//   ex.notes('plot.js')            the examples that load ../plot.js
//   ex.check('plot.js')            a Node test: they pass luccet check with
//                                  nothing to report
//   ex.fromCdn(context, origin)    a browser test's setup: cdn.luccet.dev
//                                  answered from the checkout (below)
'use strict';

const fs = require('fs');
const path = require('path');
const h = require('./harness');

const DIR = path.join(h.ROOT, 'examples');

function notes(addon) {
  const loads = new RegExp(`data-use="[^"]*\\.\\./${addon.replace(/\./g, '\\.')}[\\s"]`);
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.html') && loads.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
}

function check(addon) {
  const files = notes(addon);
  h.assert(files.length > 0, `no example loads ../${addon}`);
  const r = h.cli(['check', ...files.map((f) => `examples/${f}`)], { cwd: h.ROOT });
  const want = `luccet check: ${files.length} note${files.length === 1 ? '' : 's'}: 0 errors, 0 warnings, 0 infos`;
  h.assert(r.code === 0 && (r.out + r.err).trim() === want, `expected "${want}": ${r.out}${r.err}`);
  return files.join(', ');
}

// The examples load the engine and the themes from cdn.luccet.dev, as a
// reader's copy does. Here the engine is the checkout's, which the site
// serves as /luccet.js and /luccet.css, and a theme an empty stylesheet:
// the look is not under test, so the colours are luccet.css's. Any other
// request to cdn.luccet.dev fails.
async function fromCdn(context, origin) {
  await context.route(/^https:\/\/cdn\.luccet\.dev\//, async (route) => {
    const url = route.request().url();
    const engine = /^https:\/\/cdn\.luccet\.dev\/v2\/(luccet\.(?:js|css))$/.exec(url);
    if (engine) return route.fulfill({ response: await route.fetch({ url: `${origin}/${engine[1]}` }) });
    if (/^https:\/\/cdn\.luccet\.dev\/themes\/v1\/[\w-]+\.css$/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
}

module.exports = { notes, check, fromCdn };
