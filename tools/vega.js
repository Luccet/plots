#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Writes the Vega table in vega-lite.js, the pinned versions of the npm
// packages vega and vega-lite with the SRI hashes of their build/vega.min.js
// and build/vega-lite.min.js, and the expression interpreter it carries,
// vega-interpreter's build/vega-interpreter.js made a function of the vega
// it is given (the package is an ES module that imports vega-util, whose
// names vega has). Run it to move to other versions; it needs the network
// once per version.
//
// The packages come from the npm registry, through tools/npm.js, which keeps
// those files in node_modules/.cache/luccet-smoke/ (the browser tests serve
// the same copies). jsDelivr's /npm/ files are the packages' bytes, so the
// hashes hold.
//
//   node tools/vega.js [VEGA VEGA_LITE INTERPRETER]   rewrite (default: the versions in it)
//   node tools/vega.js --check                        exit 1 if it is not what the versions give
'use strict';

const fs = require('fs');
const path = require('path');
const npm = require('./npm');

const ROOT = path.join(__dirname, '..');
const ADDON = path.join(ROOT, 'vega-lite.js');
const START = '  // <vega> written by tools/vega.js; do not edit by hand';
const END = '  // </vega>';

const PACKAGES = {
  vega: { file: 'build/vega.min.js' },
  'vega-lite': { file: 'build/vega-lite.min.js' },
  'vega-interpreter': { file: 'build/vega-interpreter.js' },
};
// node_modules/.cache/luccet-smoke/NAME-VERSION/: the one file each needs, and its licence.
const packageDir = (name, version) => npm.packageDir(name, version, { folder: `${name}-${version}`, keep: [PACKAGES[name].file, 'LICENSE'], has: PACKAGES[name].file });

// vega-interpreter's module as a function of vega: its import of vega-util
// read from vega, its export returned.
function interpreter(src, version, licence) {
  const imp = /^import \{([^}]*)\} from 'vega-util';\n/m;
  const exp = /^export \{ expression as expressionInterpreter \};\n/m;
  if (!imp.test(src) || !exp.test(src) || /^(?:import|export)\b/m.test(src.replace(imp, '').replace(exp, ''))) throw new Error(`vega-interpreter@${version}'s module is not the shape this tool knows: one import from vega-util, one export`);
  const names = imp.exec(src)[1].trim();
  const body = src.replace(imp, '').replace(exp, '').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n').trim();
  const indent = (s) => s.split('\n').map((l) => (l ? `    ${l}` : l)).join('\n');
  return [
    `  // vega-interpreter ${version} (github.com/vega/vega), BSD-3-Clause, ${licence},`,
    '  // its module made a function of vega: Vega evaluates expressions with it rather than with new Function.',
    '  const interpreterOf = (vega) => {',
    `    const { ${names} } = vega;`,
    indent(body),
    '    return expression;',
    '  };',
  ].join('\n');
}

async function table(versions) {
  const dirs = {};
  for (const [name, v] of Object.entries(versions)) dirs[name] = await packageDir(name, v);
  const dir = dirs['vega-interpreter'];
  const src = fs.readFileSync(path.join(dir, PACKAGES['vega-interpreter'].file), 'utf8');
  const licence = (/^Copyright .*$/m.exec(fs.existsSync(path.join(dir, 'LICENSE')) ? fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8') : '') || [])[0];
  if (!licence) throw new Error(`vega-interpreter@${versions['vega-interpreter']} has no copyright line in its LICENSE`);
  return [
    START,
    '  const VEGA = {',
    `    vega: '${versions.vega}',`,
    `    vegaLite: '${versions['vega-lite']}',`,
    `    interpreter: '${versions['vega-interpreter']}',`,
    `    sri: { vega: '${npm.sri(path.join(dirs.vega, PACKAGES.vega.file))}', vegaLite: '${npm.sri(path.join(dirs['vega-lite'], PACKAGES['vega-lite'].file))}' },`,
    '  };',
    interpreter(src, versions['vega-interpreter'], licence.trim()),
    END,
  ].join('\n');
}

async function main() {
  const src = fs.readFileSync(ADDON, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a < 0 || b < a) throw new Error(`vega-lite.js has no table between "${START.trim()}" and "${END.trim()}"`);
  const block = src.slice(a, b);
  const current = (k) => (new RegExp(`${k}: '([^']+)'`).exec(block) || [])[1];
  const args = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (args.length && args.length !== 3) throw new Error('give three versions, of vega, vega-lite and vega-interpreter, or none');
  const versions = { vega: args[0] || current('vega'), 'vega-lite': args[1] || current('vegaLite'), 'vega-interpreter': args[2] || current('interpreter') };
  if (Object.values(versions).some((v) => !v)) throw new Error('no versions: give them, as node tools/vega.js 6.4.0 6.5.0 2.3.2');
  const out = src.slice(0, a) + (await table(versions)) + src.slice(b + END.length);
  const shown = `vega@${versions.vega}, vega-lite@${versions['vega-lite']} and vega-interpreter@${versions['vega-interpreter']}`;
  if (process.argv.includes('--check')) {
    if (out !== src) {
      console.log(`✗ the Vega table in vega-lite.js is not ${shown}'s: run node tools/vega.js`);
      process.exit(1);
    }
    console.log(`✓ vega-lite.js has ${shown}'s table`);
    return;
  }
  fs.writeFileSync(ADDON, out);
  console.log(`wrote ${shown}'s table into vega-lite.js`);
}

module.exports = { packageDir, PACKAGES };

if (require.main === module)
  main().catch((e) => {
    console.error(`tools/vega.js: ${e.message}`);
    process.exit(1);
  });
