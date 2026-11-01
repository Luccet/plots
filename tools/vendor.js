#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Writes a local copy of Vega and Vega-Lite, at the versions vega-lite.js
// pins, in the layout its ?base= option takes: DIR/vega/vega.min.js and
// DIR/vega/vega-lite.min.js, each fetched once into
// node_modules/.cache/luccet-smoke/ and checked against the registry's hash.
// For a note read offline, or under a policy that allows only its own
// origin. (plot.js needs no copy: it fetches nothing.)
//
//   node tools/vendor.js DIR
'use strict';

const fs = require('fs');
const path = require('path');
const { packageDir, PACKAGES } = require('./vega');

async function main() {
  const [dir, ...rest] = process.argv.slice(2);
  if (!dir || rest.length) {
    console.error('usage: node tools/vendor.js DIR');
    process.exit(2);
  }
  const st = fs.statSync(dir, { throwIfNoEntry: false });
  if (st && !st.isDirectory()) {
    console.error(`${dir} is not a folder`);
    process.exit(2);
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'vega-lite.js'), 'utf8');
  const versions = { vega: /vega: '([\d.]+)'/.exec(src)[1], 'vega-lite': /vegaLite: '([\d.]+)'/.exec(src)[1] };
  const to = path.join(dir, 'vega');
  fs.mkdirSync(to, { recursive: true });
  for (const [name, version] of Object.entries(versions)) {
    let pkg;
    try {
      pkg = await packageDir(name, version);
    } catch (e) {
      console.error(`${name} ${version} could not be fetched (${(e && e.message) || e}); is the network there?`);
      process.exit(1);
    }
    fs.copyFileSync(path.join(pkg, PACKAGES[name].file), path.join(to, path.basename(PACKAGES[name].file)));
  }
  const shown = path.relative(process.cwd(), to).split(path.sep).join('/') || '.';
  console.error(`Vega ${versions.vega} and Vega-Lite ${versions['vega-lite']} → ${shown} (2 files); load them with vega-lite.js?base=${shown}`);
}

main();
