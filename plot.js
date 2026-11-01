// SPDX-License-Identifier: MIT
// plot.js, Luccet's function plots, in the plots kit
// (github.com/Luccet/plots). It draws each ```plot fence, titled ones
// (listings) too, as a plot of the functions, curves, regions and points it
// lists, one to a line:
//
//   <script src="luccet.js" data-use="plot.js"></script>
//
//   ```plot
//   y = sin(x)               {label="$\sin x$"}
//   y = x^2/4, x in [0, 3]   {.dashed}
//   x^2 + y^2 = 4
//   0 <= y <= cos(x)         {color=3}
//   (cos(t), sin(t)/2)
//   r = 1 + cos(θ)
//   (1, 2), (2, 1)           {label="P"}
//   a = 2
//   f(x) = a x e^{-x}
//   y = f(x)
//   x in [-2π, 2π]
//   y in [-2, 2]
//   ```
//
// Expressions are written as on a calculator (2x, sin x, sqrt(x), |x|,
// e^(-x^2)) or in the TeX of the note's formulas (\frac{1}{x}, \sqrt[3]{x},
// x^{2}, \sin\theta, \cdot, \le), and the two mix. The settings, each a line
// of its own: x in [a, b] and y in [a, b] (the view), t in […] and θ in […]
// (the parameters' default ranges), equal (one unit as long on both axes),
// height N, grid off, axes off, xlabel "…" and ylabel "…". A line's
// attributes, after it in braces: label="…" (in the legend, $…$ as TeX; a
// point's beside it), color=1…6 (the plot palette) or a CSS colour, width=N,
// .dashed, .dotted. A # at a line's start or after a space starts a comment.
//
// The plot is SVG, drawn here in full: no library, and nothing fetched. Its
// colours are the theme's, as custom properties, so it follows the
// reader's light or dark preference, a theme switched in and print without
// being drawn again: the six plot colours are --t-plot-1 … --t-plot-6 where
// a theme gives them, else its link and code colours (Luccet/themes), else
// the add-on's own, and print has a palette of its own. Curves are sampled
// more finely where they bend, broken where they jump (tan x) or are
// undefined (sqrt x, x < 0), and implicit ones (x^2 + y^2 = 4) traced on a
// grid. A plot that does not parse keeps its fence, with the error after it.
//
// luccet.plot(source) -> {svg, legend: [{label, color, dash, region}], label}
// | {error: {message, line}} draws a plot's source as markup, for a page
// script. Under node (luccet check, luccet build, the language server) it
// only adds its styles: drawing needs the page.
(function () {
  'use strict';
  const T = window.luccet;
  if (!T) return;
  if (T.api !== 2) throw new Error(`needs the add-on API 2 (Luccet 2); this luccet.js has ${T.api}`);

  // The plot colours: a theme's --t-plot-N, else its link and code colours,
  // else these, which read on luccet.css's light and dark system colours;
  // print has its own, on white.
  const FALLBACK = {
    light: ['#1f6fd0', '#c2410c', '#15803d', '#7e22ce', '#0e7490', '#b91c1c'],
    dark: ['#6ea8fe', '#fb923c', '#4ade80', '#c084fc', '#22d3ee', '#f87171'],
    print: ['#1f5fa8', '#b45309', '#15803d', '#7e22ce', '#0e7490', '#b91c1c'],
  };
  const THEMED = ['--t-link', '--t-code-number', '--t-code-string', '--t-code-keyword', '--t-code-type', '--t-code-deleted'];
  const fallbacks = (set) => set.map((c, i) => `--t-plot-f${i + 1}: ${c};`).join(' ');
  T.style(
    [
      '.luccet .t-plot { margin-block: 0 1rem; }',
      `.t-plot { ${fallbacks(FALLBACK.light)} }`,
      `@media (prefers-color-scheme: dark) { .t-plot { ${fallbacks(FALLBACK.dark)} } }`,
      ...THEMED.map((p, i) => `.t-plot .t-plot-c${i + 1} { color: var(--t-plot-${i + 1}, var(${p}, var(--t-plot-f${i + 1}))); }`),
      `@media print { .t-plot { ${FALLBACK.print.map((c, i) => `--t-plot-${i + 1}: ${c} !important;`).join(' ')} } }`,
      '.t-plot > svg { display: block; margin-inline: auto; max-inline-size: 100%; height: auto; font-family: var(--t-sans, sans-serif); }',
      // Numbers and labels over the curves, haloed in the background colour.
      '.t-plot svg text { fill: var(--t-muted); font-size: 13px; paint-order: stroke; stroke: var(--t-bg); stroke-width: 3px; stroke-linejoin: round; }',
      '.t-plot .t-plot-grid { stroke: var(--t-line); stroke-width: 1; fill: none; }',
      '.t-plot .t-plot-axis { stroke: var(--t-muted); stroke-width: 1.25; fill: none; }',
      '.t-plot svg .t-plot-title { fill: var(--t-fg); font-style: italic; }',
      '.t-plot .t-plot-curve { fill: none; stroke: currentColor; stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round; }',
      '.t-plot .t-plot-region { fill: currentColor; fill-opacity: .18; stroke: none; }',
      '.t-plot .t-plot-point { fill: currentColor; stroke: var(--t-bg); stroke-width: 1.5; }',
      '.t-plot svg .t-plot-point-label { fill: var(--t-fg); }',
      '.t-plot .t-plot-dashed { stroke-dasharray: 7 5; }',
      '.t-plot .t-plot-dotted { stroke-dasharray: 0 5; }',
      '.t-plot-legend { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: .25rem 1.25rem; margin: .25rem 0 0; padding: 0; font-size: .9em; }',
      '.t-plot-legend > li { display: flex; align-items: center; gap: .4em; margin: 0; }',
      '.t-plot-key { inline-size: 1.5em; block-size: .75em; flex: none; }',
    ].join('\n'),
  );

  // ------------------------------------------------------------ reading

  class PlotError extends Error {}
  const fail = (message) => {
    throw new PlotError(message);
  };

  // The names an expression knows, besides its own definitions: functions,
  // each with its arity ([min, max]), and constants.
  const gamma = (z) => {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    z -= 1;
    let a = g[0];
    const t = z + 7.5;
    for (let i = 1; i < 9; i++) a += g[i] / (z + i);
    return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a;
  };
  const one = (f) => [1, 1, f];
  const FUNCTIONS = {
    sin: one(Math.sin), cos: one(Math.cos), tan: one(Math.tan),
    sec: one((x) => 1 / Math.cos(x)), csc: one((x) => 1 / Math.sin(x)), cot: one((x) => 1 / Math.tan(x)),
    arcsin: one(Math.asin), arccos: one(Math.acos), asin: one(Math.asin), acos: one(Math.acos),
    arctan: [1, 2, (a, b) => (b === undefined ? Math.atan(a) : Math.atan2(a, b))],
    sinh: one(Math.sinh), cosh: one(Math.cosh), tanh: one(Math.tanh), arsinh: one(Math.asinh), arcosh: one(Math.acosh), artanh: one(Math.atanh),
    exp: one(Math.exp), ln: one(Math.log),
    log: [1, 2, (a, b) => (b === undefined ? Math.log10(a) : Math.log(b) / Math.log(a))],
    sqrt: one(Math.sqrt), cbrt: one(Math.cbrt), abs: one(Math.abs),
    floor: one(Math.floor), ceil: one(Math.ceil), round: one(Math.round), sign: one(Math.sign), sgn: one(Math.sign),
    min: [1, Infinity, Math.min], max: [1, Infinity, Math.max],
    mod: [2, 2, (a, b) => ((a % b) + b) % b],
    gamma: one(gamma),
  };
  FUNCTIONS.atan = FUNCTIONS.arctan;
  const CONSTANTS = { pi: Math.PI, π: Math.PI, tau: 2 * Math.PI, τ: 2 * Math.PI, e: Math.E };
  // The variables a line can be in: the axes, a parametric curve's t, and a
  // polar one's θ (and r, its radius, on the left of one only).
  const VARIABLES = ['x', 'y', 't', 'θ'];
  const RESERVED = new Set([...VARIABLES, 'r', 'theta']);
  const canonical = (w) => (w === 'theta' ? 'θ' : w === 'π' ? 'pi' : w === 'τ' ? 'tau' : w);

  // TeX commands, as the tokens they stand for.
  const TEX = {
    cdot: '*', times: '*', ast: '*', div: '/', le: '<=', leq: '<=', leqslant: '<=', ge: '>=', geq: '>=', geqslant: '>=', lt: '<', gt: '>',
    lvert: '|', rvert: '|', vert: '|', mid: '|', lbrace: '(', rbrace: ')', lbrack: '(', rbrack: ')', lparen: '(', rparen: ')',
  };
  const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'mathrm', 'operatorname']);
  const SYMBOLS = { '·': '*', '×': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=', '[': '(', ']': ')', '{': '(', '}': ')' };

  // A line's expression as tokens: {k: num|word|op, v, at}. Words are runs
  // of letters, a subscript (a_1, a_{12}) kept in the word; \frac and
  // \sqrt are words of their own (\frac, \sqrt).
  function lex(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      const at = i;
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
        if (!m) fail(`"${c}" is not a number`);
        out.push({ k: 'num', v: m[0], at });
        i += m[0].length;
        continue;
      }
      if (c === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
        if (!m) fail('a \\ ends the line');
        i += m[0].length;
        const name = m[1];
        if (SPACES.has(name)) {
          // \operatorname{sin}, \mathrm{e}: the braces' word is the name.
          const brace = /^\s*\{([A-Za-z]+)\}/.exec(s.slice(i));
          if ((name === 'operatorname' || name === 'mathrm') && brace) (out.push({ k: 'word', v: brace[1], at }), (i += brace[0].length));
          continue;
        }
        if (name === '{' || name === '}') out.push({ k: 'op', v: name === '{' ? '(' : ')', at });
        else if (Object.prototype.hasOwnProperty.call(TEX, name)) out.push({ k: 'op', v: TEX[name], at });
        else if (name === 'frac' || name === 'dfrac' || name === 'tfrac') out.push({ k: 'word', v: '\\frac', at });
        else if (name === 'sqrt') out.push({ k: 'word', v: '\\sqrt', at });
        else if (/^[A-Za-z]+$/.test(name)) out.push({ k: 'word', v: name, at, tex: true });
        else fail(`\\${name} is not something a plot reads`);
        continue;
      }
      if (/\p{L}/u.test(c)) {
        let w = /^\p{L}+/u.exec(s.slice(i))[0];
        i += w.length;
        const sub = /^_(?:\{([\p{L}\d]+)\}|(\d+|\p{L}))/u.exec(s.slice(i));
        if (sub) (w += `_${sub[1] || sub[2]}`), (i += sub[0].length);
        out.push({ k: 'word', v: w, at });
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '**') {
        out.push({ k: 'op', v: two === '**' ? '^' : two, at });
        i += 2;
        continue;
      }
      if ('+-*/^()|!=<>,'.includes(c)) out.push({ k: 'op', v: c, at });
      else if (SYMBOLS[c]) out.push({ k: 'op', v: SYMBOLS[c], at, bracket: c === '[' });
      else fail(`"${c}" is not something a plot reads`);
      i++;
    }
    return out;
  }

  // Expressions as trees: {num}, {name} (a variable, constant or
  // definition), {op: '+' | '-' | '*' | '/' | '^', a, b}, {neg}, {fact},
  // {call, args} (a function, its arguments).
  function parser(tokens, known) {
    let i = 0;
    let bars = 0; // inside |…|: a bar closes rather than opens
    const peek = () => tokens[i];
    const isOp = (v, t = peek()) => t && t.k === 'op' && t.v === v;
    const take = (v) => {
      if (!isOp(v)) fail(peek() ? `expected "${v}" before "${peek().v}"` : `expected "${v}" at the end`);
      i++;
    };
    const isFunction = (w) => known.fn(w);

    // A word as the names it is made of: itself if known, else split into
    // the longest known names from its start (sinx is sin x, 2pix is 2 pi x).
    function names(t) {
      const w = t.v;
      if (w.startsWith('\\') || known.any(w)) return [w];
      if (w.includes('_') || w.length === 1) fail(`${w} is not defined: define it with ${w} = …`);
      const out = [];
      let rest = w;
      while (rest) {
        let n = rest.length;
        while (n > 0 && !known.any(rest.slice(0, n))) n--;
        if (!n) fail(`${w} is not a name a plot knows${rest.length === 1 ? `: define ${rest} with ${rest} = …` : ''}`);
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      return out;
    }
    // Split words are spliced back as separate tokens.
    function word() {
      const t = peek();
      const ns = names(t);
      if (ns.length > 1) tokens.splice(i, 1, ...ns.map((v) => ({ k: 'word', v, at: t.at })));
      return tokens[i];
    }

    const startsPrimary = (t) => t && (t.k === 'num' || t.k === 'word' || (t.k === 'op' && (t.v === '(' || (t.v === '|' && !bars))));

    function expr() {
      let a = term();
      while (isOp('+') || isOp('-')) {
        const op = tokens[i++].v;
        a = { op, a, b: term() };
      }
      return a;
    }
    // Products, written (*, /) or implied (2x, x sin x, (x+1)(x-1)).
    function term(stopAtFunction) {
      let a = unary();
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = tokens[i++].v;
          a = { op, a, b: unary() };
        } else if (startsPrimary(peek()) && !(stopAtFunction && peek().k === 'word' && isFunction(word().v))) {
          a = { op: '*', a, b: power() };
        } else return a;
      }
    }
    function unary() {
      if (isOp('-')) return i++, { neg: unary() };
      if (isOp('+')) return i++, unary();
      return power();
    }
    // a^b^c is a^(b^c); -x^2 is -(x^2); 2^-x is 2^(-x).
    function power() {
      const a = postfix();
      if (!isOp('^')) return a;
      i++;
      return { op: '^', a, b: exponent() };
    }
    const exponent = () => (isOp('-') ? (i++, { neg: exponent() }) : isOp('+') ? (i++, exponent()) : power());
    function postfix() {
      let a = primary();
      while (isOp('!')) i++, (a = { fact: a });
      return a;
    }
    // One TeX argument: {…}, or a single token (\frac12 is 1/2).
    function texArg() {
      const t = peek();
      if (!t) fail('a TeX argument is missing at the end');
      if (isOp('(')) {
        i++;
        const e = expr();
        take(')');
        return e;
      }
      if (t.k === 'num' && t.v.length > 1 && /^\d+$/.test(t.v)) {
        tokens.splice(i, 1, { k: 'num', v: t.v[0], at: t.at }, { k: 'num', v: t.v.slice(1), at: t.at + 1 });
      }
      return primary();
    }
    function primary() {
      const t = peek();
      if (!t) fail('the expression ends too soon');
      if (t.k === 'num') {
        i++;
        if (t.v === '.') fail('"." is not a number');
        return { num: Number(t.v) };
      }
      if (isOp('(')) {
        i++;
        const e = expr();
        if (isOp(',')) {
          const items = [e];
          while (isOp(',')) i++, items.push(expr());
          take(')');
          return { tuple: items };
        }
        take(')');
        return e;
      }
      if (isOp('|') && !bars) {
        i++;
        bars++;
        const e = expr();
        bars--;
        take('|');
        return { call: 'abs', args: [e] };
      }
      if (t.k !== 'word') fail(`"${t.v}" cannot start an expression here`);
      const w = word();
      i++;
      if (w.v === '\\frac') return { op: '/', a: texArg(), b: texArg() };
      if (w.v === '\\sqrt') {
        // \sqrt[n]{x}: [ ] are lexed as ( ), marked.
        let n = null;
        const next = tokens[i];
        if (next && next.k === 'op' && next.v === '(' && next.bracket) {
          i++;
          n = expr();
          take(')');
        }
        const x = texArg();
        return n ? { call: 'root', args: [n, x] } : { call: 'sqrt', args: [x] };
      }
      const name = canonical(w.v);
      if (isFunction(name)) {
        // log_2 x: the subscript is the base.
        let base = null;
        let fname = name;
        const sub = /^(log)_(.+)$/.exec(name);
        if (sub) (fname = 'log'), (base = { num: Number(sub[2]) });
        // sin^2 x is (sin x)^2; sin^{-1} x is arcsin x.
        let pow = null;
        if (isOp('^')) {
          i++;
          pow = exponent();
        }
        let args;
        if (isOp('(')) {
          i++;
          args = [expr()];
          while (isOp(',')) i++, args.push(expr());
          take(')');
        } else if (startsPrimary(peek())) args = [term(true)];
        else fail(`${name} needs an argument`);
        if (base) args.unshift(base);
        let call = { call: fname, args };
        if (pow && pow.neg && pow.neg.num === 1 && FUNCTIONS[`arc${fname}`]) call = { call: `arc${fname}`, args };
        else if (pow) call = { op: '^', a: call, b: pow };
        return call;
      }
      return { name };
    }
    return {
      expr,
      done: () => i >= tokens.length,
      rest: () => peek(),
    };
  }

  // Splits tokens at the top level (not inside brackets) where test(token).
  function split(tokens, test) {
    const parts = [[]];
    let depth = 0;
    for (const t of tokens) {
      if (t.k === 'op' && t.v === '(') depth++;
      if (t.k === 'op' && t.v === ')') depth--;
      if (depth === 0 && test(t)) parts.push(t, []);
      else parts[parts.length - 1].push(t);
    }
    return parts;
  }

  // ------------------------------------------------------------ evaluating

  // A tree as a function of an environment ({x, y, t, θ}), closures all the
  // way down (no eval, so no 'unsafe-eval' under a policy); the variables
  // it uses gathered in uses.
  function compile(node, scope, uses) {
    if ('num' in node) {
      const v = node.num;
      return () => v;
    }
    if ('name' in node) {
      const n = node.name;
      if (Object.prototype.hasOwnProperty.call(scope.params || {}, n)) {
        const k = scope.params[n];
        return (env) => env.args[k];
      }
      if (VARIABLES.includes(n)) {
        uses.add(n);
        return (env) => env[n];
      }
      if (n === 'r') fail('r stands only on the left of a polar curve, as r = 1 + cos θ');
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, n)) {
        const v = CONSTANTS[n];
        return () => v;
      }
      const d = scope.defs.get(n);
      if (d && d.kind === 'const') {
        const v = scope.value(n);
        return () => v;
      }
      if (d) fail(`${n} is a function: write ${n}(…)`);
      fail(`${n} is not defined`);
    }
    if ('neg' in node) {
      const a = compile(node.neg, scope, uses);
      return (env) => -a(env);
    }
    if ('fact' in node) {
      const a = compile(node.fact, scope, uses);
      return (env) => {
        const v = a(env);
        return v < 0 && Number.isInteger(v) ? NaN : gamma(v + 1);
      };
    }
    if ('tuple' in node) fail('a point or a curve (x, y) stands alone on its line');
    if ('call' in node) {
      const args = node.args.map((a) => compile(a, scope, uses));
      if (node.call === 'root') {
        const [n, x] = args;
        return (env) => {
          const k = n(env);
          const v = x(env);
          return v < 0 && Number.isInteger(k) && k % 2 ? -((-v) ** (1 / k)) : v ** (1 / k);
        };
      }
      const user = scope.defs.get(node.call);
      if (user && user.kind === 'fn') {
        if (args.length !== user.params.length) fail(`${node.call} takes ${user.params.length} argument${user.params.length === 1 ? '' : 's'}, not ${args.length}`);
        const body = scope.fn(node.call);
        return (env) => body({ ...env, args: args.map((a) => a(env)) });
      }
      const f = FUNCTIONS[node.call];
      if (!f) fail(`${node.call} is not a function`);
      if (args.length < f[0] || args.length > f[1]) fail(`${node.call} takes ${f[0] === f[1] ? f[0] : `${f[0]} to ${f[1] === Infinity ? 'any number of' : f[1]}`} argument${f[1] === 1 ? '' : 's'}, not ${args.length}`);
      const fn = f[2];
      if (args.length === 1) {
        const [a] = args;
        return (env) => fn(a(env));
      }
      return (env) => fn(...args.map((a) => a(env)));
    }
    const a = compile(node.a, scope, uses);
    const b = compile(node.b, scope, uses);
    switch (node.op) {
      case '+':
        return (env) => a(env) + b(env);
      case '-':
        return (env) => a(env) - b(env);
      case '*':
        return (env) => a(env) * b(env);
      case '/':
        return (env) => a(env) / b(env);
      default:
        // An odd root of a negative number is real: x^(1/3) of -8 is -2.
        return (env) => {
          const x = a(env);
          const p = b(env);
          if (x >= 0 || Number.isInteger(p)) return x ** p;
          const q = 1 / p;
          return Number.isInteger(q) && Math.abs(q) % 2 === 1 ? -((-x) ** p) : NaN;
        };
    }
  }

  // ------------------------------------------------------------ the source

  const ATTRS = /^\s*(?:(?:\.[\w-]+|[\w-]+=(?:"[^"]*"|'[^']*'|[^\s"'{}]+))\s*)+$/;

  // A line split into its statement and its attributes ({…} at its end, the
  // engine's syntax), its comment dropped: # at its start or after a space,
  // outside quotes (color=#d97706 is a colour).
  function lineParts(raw) {
    let s = '';
    let q = null;
    for (const c of raw) {
      if (q) (s += c), c === q && (q = null);
      else if (c === '"' || c === "'") (s += c), (q = c);
      else if (c === '#' && (!s || /\s$/.test(s))) break;
      else s += c;
    }
    s = s.trim();
    const attrs = {};
    // The block is the first { outside quotes, after a space, from which
    // the rest of the line reads as attributes (a label may hold braces).
    let block = null;
    if (s.endsWith('}')) {
      for (let k = 0, quote = null; k < s.length && !block; k++) {
        const c = s[k];
        if (quote) c === quote && (quote = null);
        else if (c === '"' || c === "'") quote = c;
        else if (c === '{' && (k === 0 || /\s/.test(s[k - 1])) && ATTRS.test(s.slice(k + 1, -1))) block = { at: k, text: s.slice(k + 1, -1) };
      }
    }
    if (block) {
      s = s.slice(0, block.at).trim();
      for (const a of block.text.matchAll(/\.([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s"'{}]+))/g)) {
        if (a[1]) attrs[`.${a[1]}`] = true;
        else attrs[a[2]] = a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5];
      }
    }
    return { text: s, attrs };
  }

  // A [a, b] range's tokens (after "x in"): two expressions of constants.
  function range(tokens, scope, what) {
    if (!tokens.length || !(tokens[0].k === 'op' && tokens[0].v === '(') || !(tokens[tokens.length - 1].k === 'op' && tokens[tokens.length - 1].v === ')')) fail(`${what} in takes a range, as [-5, 5]`);
    const inner = tokens.slice(1, -1);
    const parts = split(inner, (t) => t.k === 'op' && t.v === ',');
    if (parts.length !== 3) fail(`${what} in takes two ends, as [-5, 5]`);
    const [a, b] = [parts[0], parts[2]].map((p) => constant(p, scope, `${what}'s range`));
    if (!(a < b)) fail(`${what}'s range runs from its smaller end to its larger, as [-5, 5]`);
    const pi = inner.some((t) => t.k === 'word' && /pi|π|tau|τ/.test(t.v));
    return { a, b, pi };
  }
  function constant(tokens, scope, what) {
    if (!tokens.length) fail(`${what} is missing`);
    const p = parser(tokens.slice(), scope.known);
    const tree = p.expr();
    if (!p.done()) fail(`"${p.rest().v}" is not expected in ${what}`);
    const uses = new Set();
    const f = compile(tree, scope, uses);
    if (uses.size) fail(`${what} uses ${[...uses].join(', ')}: it is a number`);
    const v = f({});
    if (!Number.isFinite(v)) fail(`${what} is not a finite number`);
    return v;
  }

  const SETTINGS = /^(?:equal|grid\s+(?:on|off)|axes\s+(?:on|off)|height\s+\d+(?:\.\d+)?|[xy]label\s+(?:"[^"]*"|'[^']*'))$/;
  const RELATIONS = new Set(['=', '<', '>', '<=', '>=']);

  // The plot a source describes: its view and settings, and its items,
  // each {kind: 'fx' | 'fy' | 'param' | 'implicit' | 'region' | 'raster' |
  // 'points', …} with its line, its attributes and its functions.
  function read(source) {
    const lines = String(source).split('\n').map((raw, n) => ({ n: n + 1, ...lineParts(raw) })).filter((l) => l.text);
    const settings = { grid: true, axes: true, equal: false, height: null, xlabel: '', ylabel: '' };
    const scope = { defs: new Map(), params: null, known: null, values: new Map(), fns: new Map(), busy: new Set() };
    const at = (l, e) => {
      if (e instanceof PlotError && !e.line) (e.line = l.n), (e.message = `line ${l.n} (${l.text}): ${e.message}`);
      throw e;
    };

    // Definitions first, so a line can use one defined below it.
    const rest = [];
    for (const l of lines) {
      try {
        if (SETTINGS.test(l.text)) {
          const [k, v] = [l.text.split(/\s+/)[0], l.text.replace(/^\S+\s+/, '')];
          if (k === 'equal') settings.equal = true;
          else if (k === 'height') settings.height = Math.min(1600, Math.max(80, Number(v)));
          else if (k === 'grid' || k === 'axes') settings[k] = v === 'on';
          else settings[k] = v.slice(1, -1);
          continue;
        }
        const tokens = lex(l.text);
        // A definition's name is one letter, with a subscript if need be
        // (a, k, a_1, v_{max}), so xy = 1 is a curve, x times y.
        const def = /^\s*(\p{L}(?:_(?:\{[\p{L}\d]+\}|[\p{L}\d]))?)\s*(?:\(\s*([^()]*)\))?\s*=(?![=<>])/u.exec(l.text);
        const name = def && canonical(def[1].replace(/_\{([^}]*)\}/, '_$1'));
        if (def && !RESERVED.has(name) && !Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
          if (scope.defs.has(name)) fail(`${name} is defined twice`);
          const params = def[2] === undefined ? null : def[2].split(',').map((p) => canonical(p.trim()));
          if (params && params.some((p) => !/^\p{L}+$/u.test(p))) fail(`${name}'s arguments are names, as ${name}(x)`);
          const eq = tokens.findIndex((t) => t.k === 'op' && t.v === '=');
          scope.defs.set(name, { kind: params ? 'fn' : 'const', params, body: tokens.slice(eq + 1), line: l });
          continue;
        }
        rest.push({ ...l, tokens });
      } catch (e) {
        at(l, e);
      }
    }
    const own = (w) => scope.defs.has(w);
    scope.known = {
      fn: (w) => Object.prototype.hasOwnProperty.call(FUNCTIONS, w) || /^log_\d+$/.test(w) || (own(w) && scope.defs.get(w).kind === 'fn'),
      any: (w) => {
        const c = canonical(w);
        return Object.prototype.hasOwnProperty.call(FUNCTIONS, c) || Object.prototype.hasOwnProperty.call(CONSTANTS, c) || VARIABLES.includes(c) || c === 'r' || own(c) || /^log_\d+$/.test(c) || (scope.params && Object.prototype.hasOwnProperty.call(scope.params, c));
      },
    };
    // A definition's value or function, on first use; a loop is an error.
    scope.value = (n) => {
      if (scope.values.has(n)) return scope.values.get(n);
      const d = scope.defs.get(n);
      if (scope.busy.has(n)) fail(`${n} is defined in terms of itself`);
      scope.busy.add(n);
      let v;
      try {
        v = constant(d.body, { ...scope, params: null }, n);
      } catch (e) {
        if (e instanceof PlotError && !e.line && d.line) at(d.line, e);
        throw e;
      } finally {
        scope.busy.delete(n);
      }
      scope.values.set(n, v);
      return v;
    };
    scope.fn = (n) => {
      if (scope.fns.has(n)) return scope.fns.get(n);
      const d = scope.defs.get(n);
      if (scope.busy.has(n)) fail(`${n} is defined in terms of itself`);
      scope.busy.add(n);
      try {
        const params = Object.fromEntries(d.params.map((p, k) => [p, k]));
        const inner = { ...scope, params };
        inner.known = { ...scope.known, any: (w) => Object.prototype.hasOwnProperty.call(params, canonical(w)) || scope.known.any(w) };
        const p = parser(d.body.slice(), inner.known);
        const tree = p.expr();
        if (!p.done()) fail(`"${p.rest().v}" is not expected here`);
        const uses = new Set();
        const f = compile(tree, inner, uses);
        if (uses.size) fail(`${n} uses ${[...uses].join(', ')}, which is not one of its arguments`);
        scope.fns.set(n, f);
        return f;
      } catch (e) {
        if (e instanceof PlotError && !e.line && d.line) at(d.line, e);
        throw e;
      } finally {
        scope.busy.delete(n);
      }
    };
    // Every definition is checked, used or not.
    for (const [n, d] of scope.defs) {
      try {
        if (d.kind === 'const') scope.value(n);
        else scope.fn(n);
      } catch (e) {
        at(d.line, e);
      }
    }

    const view = {};
    const params = {};
    const items = [];
    let colour = 0;
    for (const l of rest) {
      try {
        const { head, ranges } = takeRanges(l.tokens, scope);
        if (!head.length) {
          for (const [k, r] of Object.entries(ranges)) (k === 'x' || k === 'y' ? view : params)[k] = r;
          continue;
        }
        const pieces = split(head, (t) => t.k === 'op' && t.v === ',').filter((p, k) => k % 2 === 0);
        const style = { attrs: l.attrs, line: l.n, text: l.text };
        const given = l.attrs.color;
        if (given !== undefined && !/^[1-6]$/.test(given) && !/^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\([\d\s.,%/+-a-z]*\))$/i.test(given)) fail(`color=${given} is not a colour: give 1 to 6, a name or #rrggbb`);
        style.colour = given === undefined ? (colour++ % 6) + 1 : /^[1-6]$/.test(given) ? Number(given) : given;
        if (l.attrs.width !== undefined && !(Number(l.attrs.width) > 0 && Number(l.attrs.width) <= 20)) fail(`width=${l.attrs.width} is not a width: give a number up to 20`);
        // Points: (a, b), (c, d) …, all numbers.
        const first = tuple(pieces[0]);
        if (pieces.length > 1 || (first && first.every((p) => !uses(p, scope).size))) {
          const pts = pieces.map((p) => {
            const items = tuple(p);
            if (!items || items.length !== 2) fail('points are written (x, y), and separated by commas');
            return items.map((tk) => constant(tk, scope, 'a point'));
          });
          items.push({ kind: 'points', pts, ...style });
          continue;
        }
        items.push(item(pieces[0], scope, ranges, style));
      } catch (e) {
        at(l, e);
      }
    }
    return { settings, view, params, items };
  }

  // A line's ranges, at its end (y = x^2, x in [0, 2], or a line of them
  // alone): {head, ranges: {x: {a, b, pi}, …}}, head the tokens before them.
  function takeRanges(tokens, scope) {
    const isStart = (k) => tokens[k] && tokens[k].k === 'word' && /^(?:x|y|t|θ|theta)$/.test(tokens[k].v) && tokens[k + 1] && tokens[k + 1].k === 'word' && tokens[k + 1].v === 'in';
    let cut = isStart(0) ? 0 : -1;
    for (let k = 0, depth = 0; cut < 0 && k < tokens.length; k++) {
      const t = tokens[k];
      if (t.k === 'op' && t.v === '(') depth++;
      if (t.k === 'op' && t.v === ')') depth--;
      if (depth === 0 && t.k === 'op' && t.v === ',' && isStart(k + 1)) cut = k;
    }
    if (cut < 0) return { head: tokens, ranges: {} };
    const ranges = {};
    let k = cut === 0 ? 0 : cut + 1;
    while (k < tokens.length) {
      if (!isStart(k)) fail('after a range comes another range or nothing, as x in [0, 2], t in [0, 1]');
      const name = canonical(tokens[k].v);
      k += 2;
      let j = k;
      for (let depth = 0; j < tokens.length; j++) {
        if (tokens[j].k === 'op' && tokens[j].v === '(') depth++;
        if (tokens[j].k === 'op' && tokens[j].v === ')' && --depth === 0) break;
      }
      if (ranges[name]) fail(`${name} has two ranges`);
      ranges[name] = range(tokens.slice(k, j + 1), scope, name);
      k = j + 1;
      if (k < tokens.length) {
        if (!(tokens[k].k === 'op' && tokens[k].v === ',')) fail(`"${tokens[k].v}" is not expected after ${name}'s range`);
        k++;
      }
    }
    return { head: tokens.slice(0, cut), ranges };
  }

  // A tuple's items' tokens, if the tokens are one (…, …) and nothing else.
  function tuple(tokens) {
    const t0 = tokens[0];
    const tn = tokens[tokens.length - 1];
    if (!t0 || t0.k !== 'op' || t0.v !== '(' || tn.k !== 'op' || tn.v !== ')') return null;
    let depth = 0;
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.k === 'op' && t.v === '(') depth++;
      if (t.k === 'op' && t.v === ')') depth--;
      if (depth === 0 && k < tokens.length - 1) return null;
    }
    const parts = split(tokens.slice(1, -1), (t) => t.k === 'op' && t.v === ',');
    return parts.length > 1 ? parts.filter((p, k) => k % 2 === 0) : null;
  }
  // The variables an expression's tokens use.
  function uses(tokens, scope) {
    const u = new Set();
    const p = parser(tokens.slice(), scope.known);
    compile(p.expr(), scope, u);
    return u;
  }
  function tree(tokens, scope, what) {
    if (!tokens.length) fail(`${what} is missing`);
    const p = parser(tokens.slice(), scope.known);
    const t = p.expr();
    if (!p.done()) fail(`"${p.rest().v}" is not expected here`);
    return t;
  }
  const fnOf = (node, scope) => {
    const u = new Set();
    return { f: compile(node, scope, u), uses: u };
  };
  const bare = (node, v) => node && node.name === v;
  const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

  // One line's item, from its tokens and the ranges at its end.
  function item(tokens, scope, ranges, style) {
    const parts = split(tokens, (t) => t.k === 'op' && RELATIONS.has(t.v));
    const exprs = parts.filter((p, k) => k % 2 === 0);
    const rels = parts.filter((p, k) => k % 2 === 1).map((t) => t.v);
    const only = (fn, allowed, what) => {
      for (const v of fn.uses) if (!allowed.includes(v)) fail(`${what} cannot use ${v}`);
      return fn;
    };
    // A curve (x(t), y(t)), or an expression alone, as y = it.
    if (!rels.length) {
      const items = tuple(exprs[0]);
      if (items) {
        if (items.length !== 2) fail('a curve is written (x, y), as (cos t, sin t)');
        const [fx, fy] = items.map((p) => only(fnOf(tree(p, scope, 'the curve'), scope), ['t'], 'a curve (x, y)'));
        return { kind: 'param', var: 't', fx: fx.f, fy: fy.f, range: ranges.t, ...style };
      }
      const f = only(fnOf(tree(exprs[0], scope, 'the expression'), scope), ['x'], 'an expression alone, plotted as y =,');
      return { kind: 'fx', f: f.f, range: ranges.x, ...style };
    }
    if (rels.length > 2) fail('a line has one relation (=, <, ≤ …), or two around y or x (0 ≤ y ≤ sin x)');
    const nodes = exprs.map((p) => tree(p, scope, 'a side'));
    if (rels.length === 2) {
      const dir = (r) => (r[0] === '<' ? 1 : r[0] === '>' ? -1 : 0);
      if (!dir(rels[0]) || dir(rels[0]) !== dir(rels[1])) fail('between two bounds, both relations point one way, as 0 ≤ y ≤ sin x');
      for (const v of ['y', 'x']) {
        if (!bare(nodes[1], v)) continue;
        const other = v === 'y' ? 'x' : 'y';
        const [lo, hi] = (dir(rels[0]) > 0 ? [nodes[0], nodes[2]] : [nodes[2], nodes[0]]).map((n) => only(fnOf(n, scope), [other], `a bound on ${v}`).f);
        return { kind: 'region', var: other, lo, hi, strict: [rels[0], rels[1]].map((r) => r.length === 1), range: ranges[other], ...style };
      }
      fail('between two bounds stands y or x alone, as 0 ≤ y ≤ sin x');
    }
    let [l, r] = nodes;
    let rel = rels[0];
    // The bare variable on the left: sin x = y is y = sin x.
    for (const v of ['y', 'x', 'r']) {
      if (bare(r, v) && !bare(l, v)) {
        [l, r] = [r, l];
        rel = FLIP[rel] || rel;
        break;
      }
    }
    if (rel === '=') {
      if (bare(l, 'r')) {
        const f = only(fnOf(r, scope), ['θ'], 'a polar curve r =');
        return { kind: 'param', var: 'θ', polar: f.f, range: ranges['θ'], ...style };
      }
      if (bare(l, 'y') || bare(l, 'x')) {
        const v = l.name;
        const other = v === 'y' ? 'x' : 'y';
        const f = fnOf(r, scope);
        if (!f.uses.has(v)) return { kind: v === 'y' ? 'fx' : 'fy', f: only(f, [other], `${v} =`).f, range: ranges[other], ...style };
      }
      const f = only(fnOf({ op: '-', a: l, b: r }, scope), ['x', 'y'], 'an equation in x and y');
      if (!f.uses.size) fail('this equation has neither x nor y in it, so there is nothing to draw');
      return { kind: 'implicit', f: f.f, ...style };
    }
    const strict = rel.length === 1;
    for (const v of ['y', 'x']) {
      if (!bare(l, v)) continue;
      const other = v === 'y' ? 'x' : 'y';
      const f = fnOf(r, scope);
      if (f.uses.has(v)) break;
      only(f, [other], `${v} ${rel}`);
      const below = rel[0] === '<';
      return { kind: 'region', var: other, lo: below ? null : f.f, hi: below ? f.f : null, strict: [strict, strict], range: ranges[other], ...style };
    }
    const f = only(fnOf({ op: '-', a: l, b: r }, scope), ['x', 'y'], 'an inequality in x and y');
    if (!f.uses.size) fail('this inequality has neither x nor y in it, so there is nothing to draw');
    return { kind: 'raster', f: f.f, sign: rel[0] === '<' ? -1 : 1, strict, ...style };
  }

  // ------------------------------------------------------------ drawing

  const W = 640;
  const PAD = 8;

  // Ticks every step, step 1, 2 or 5 × 10^k, about `count` of them; or,
  // for a range written with π, a multiple or fraction of π.
  function ticks(a, b, count, pi) {
    const span = b - a;
    let step;
    let unit = 1;
    if (pi) {
      unit = Math.PI;
      const raw = span / Math.PI / count;
      step = [1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 10, 20, 50].find((s) => s >= raw) || Math.ceil(raw);
    } else {
      const raw = span / count;
      const p = 10 ** Math.floor(Math.log10(raw));
      step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999);
    }
    const out = [];
    const s = step * unit;
    for (let k = Math.ceil(a / s - 1e-9); k * s <= b + s * 1e-9; k++) out.push({ v: k * s, label: pi ? piLabel(k, step) : num(k * step, step) });
    return out;
  }
  const MINUS = '−';
  const num = (v, step) => {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    const s = Math.abs(v) < step / 1e6 ? '0' : v.toFixed(Math.min(d, 10));
    return s.replace('-', MINUS);
  };
  function piLabel(k, step) {
    // k × step × π, step a fraction 1/q or a whole number.
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let p = k;
    let q = 1;
    if (step < 1) q = Math.round(1 / step);
    else p = k * step;
    const g = gcd(Math.abs(p), q) || 1;
    (p /= g), (q /= g);
    if (p === 0) return '0';
    const sign = p < 0 ? MINUS : '';
    const n = Math.abs(p) === 1 ? 'π' : `${Math.abs(p)}π`;
    return q === 1 ? sign + n : `${sign}${n}/${q}`;
  }

  const fmt = (v) => {
    const r = Math.round(v * 10) / 10;
    return String(Object.is(r, -0) ? 0 : r);
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Sampling a curve P(s) = [x, y] for s in [a, b] into polylines, in the
  // plot's pixels: finer where it bends, broken where it is undefined or
  // jumps (an asymptote).
  function trace(P, a, b, px) {
    const out = [];
    let cur = [];
    const H = px.h;
    const end = () => {
      if (cur.length > 1) out.push(cur);
      cur = [];
    };
    const at = (s) => {
      const p = P(s);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
      return [px.x(p[0]), px.y(p[1])];
    };
    const far = (p) => (p[1] < -H ? -1 : p[1] > 2 * H ? 1 : 0) || (p[0] < -px.w ? -2 : p[0] > 2 * px.w ? 2 : 0);
    // A budget of points, for a curve that never settles (sin(1/x) near 0).
    let budget = 40000;
    const push = (p) => (p ? cur.push(p) : end());
    const MAX = 12;
    function refine(sa, pa, sb, pb, depth) {
      if (pa && pb && far(pa) && far(pa) === far(pb)) return push(pb);
      const sm = (sa + sb) / 2;
      const pm = at(sm);
      budget--;
      const bad = (p) => !p;
      let split = false;
      if (bad(pa) !== bad(pb) || (bad(pm) && !(bad(pa) && bad(pb)))) split = true;
      else if (pa && pb && pm) {
        const dx = pb[0] - pa[0];
        const dy = pb[1] - pa[1];
        const len = Math.hypot(dx, dy);
        const dev = len ? Math.abs((pm[0] - pa[0]) * dy - (pm[1] - pa[1]) * dx) / len : Math.hypot(pm[0] - pa[0], pm[1] - pa[1]);
        if (dev > 0.4 || len > 24) split = true;
      }
      if (split && depth < MAX && budget > 0) {
        refine(sa, pa, sm, pm, depth + 1);
        refine(sm, pm, sb, pb, depth + 1);
        return;
      }
      if (!pb) return push(null);
      // Still bending at the finest step, and jumping more than the plot's
      // height: an asymptote, not a curve.
      if (pa && pm && depth >= MAX && Math.abs(pb[1] - pa[1]) > H / 2 && !(Math.min(pa[1], pb[1]) - 1 <= pm[1] && pm[1] <= Math.max(pa[1], pb[1]) + 1)) {
        push(null);
        return push(pb);
      }
      if (pa && depth >= MAX && Math.abs(pb[1] - pa[1]) > H) {
        push(null);
        return push(pb);
      }
      push(pb);
    }
    const N = 160;
    let sa = a;
    let pa = at(a);
    push(pa);
    for (let k = 1; k <= N; k++) {
      const sb = a + ((b - a) * k) / N;
      const pb = at(sb);
      refine(sa, pa, sb, pb, 0);
      (sa = sb), (pa = pb);
    }
    end();
    return out;
  }
  const LIMIT = 4 * W;
  const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT + W, v));
  const pathOf = (lines) => lines.map((l) => 'M' + l.map((p) => `${fmt(clamp(p[0]))} ${fmt(clamp(p[1]))}`).join('L')).join('');

  // An implicit curve F(x, y) = 0, traced on a grid by marching squares,
  // each crossing found on its edge once, so cells join into polylines. A
  // sign change where |F| grows towards the crossing is a pole, not a root.
  function contour(F, view, px, n = 200) {
    const nx = n;
    const ny = Math.max(2, Math.round((n * px.h) / px.w));
    const X = (i) => view.x.a + ((view.x.b - view.x.a) * i) / nx;
    const Y = (j) => view.y.a + ((view.y.b - view.y.a) * j) / ny;
    const v = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = F({ x: X(i), y: Y(j) });
    const val = (i, j) => v[j * (nx + 1) + i];
    const cross = new Map();
    // A crossing on the edge from (i, j) along h (x) or v (y).
    const edge = (i, j, dir) => {
      const key = `${dir}${i},${j}`;
      if (cross.has(key)) return cross.get(key);
      const [i2, j2] = dir === 'h' ? [i + 1, j] : [i, j + 1];
      const a = val(i, j);
      const b = val(i2, j2);
      let p = null;
      if (Number.isFinite(a) && Number.isFinite(b) && (a < 0) !== (b < 0)) {
        const f = a / (a - b);
        const x = X(i + (i2 - i) * f);
        const y = Y(j + (j2 - j) * f);
        const mid = F({ x, y });
        if (Number.isFinite(mid) && Math.abs(mid) <= Math.max(Math.abs(a), Math.abs(b))) p = { key, at: [px.x(x), px.y(y)] };
      }
      cross.set(key, p);
      return p;
    };
    const links = new Map();
    const link = (p, q) => {
      if (!p || !q) return;
      for (const [s, t] of [[p, q], [q, p]]) {
        if (!links.has(s.key)) links.set(s.key, { p: s, to: [] });
        links.get(s.key).to.push(t.key);
      }
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)];
        if (c.some((x) => !Number.isFinite(x))) continue;
        const neg = c.map((x) => x < 0);
        if (neg.every((x) => x === neg[0])) continue;
        const bottom = edge(i, j, 'h');
        const right = edge(i + 1, j, 'v');
        const top = edge(i, j + 1, 'h');
        const left = edge(i, j, 'v');
        const es = [bottom, right, top, left];
        const on = es.filter(Boolean);
        if (on.length === 2) link(on[0], on[1]);
        else if (on.length === 4) {
          // A saddle: the centre's sign says which corners join.
          const centre = F({ x: X(i + 0.5), y: Y(j + 0.5) }) < 0;
          if (centre === neg[0]) link(bottom, right), link(top, left);
          else link(bottom, left), link(right, top);
        }
      }
    }
    const lines = [];
    const seen = new Set();
    const walk = (start) => {
      const line = [links.get(start).p.at];
      seen.add(start);
      let at = start;
      for (;;) {
        const next = links.get(at).to.find((k) => !seen.has(k));
        if (!next) break;
        seen.add(next);
        line.push(links.get(next).p.at);
        at = next;
      }
      return line;
    };
    // Open chains from their ends, then the loops.
    for (const [k, l] of links) if (!seen.has(k) && l.to.length === 1) lines.push(walk(k));
    for (const k of links.keys()) {
      if (seen.has(k)) continue;
      const line = walk(k);
      line.push(line[0]);
      lines.push(line);
    }
    return lines.filter((l) => l.length > 1);
  }

  // Where F(x, y) has a sign, as rows of pixel runs: a region no bound on x
  // or y alone describes (x^2 + y^2 < 4).
  function raster(F, sign, view, px) {
    const step = 2;
    const cols = Math.ceil(px.w / step);
    const rows = Math.ceil(px.h / step);
    let d = '';
    for (let r = 0; r < rows; r++) {
      const y = view.y.b - ((r + 0.5) * step * (view.y.b - view.y.a)) / px.h;
      let run = -1;
      for (let c = 0; c <= cols; c++) {
        const x = view.x.a + ((c + 0.5) * step * (view.x.b - view.x.a)) / px.w;
        const v = c < cols ? F({ x, y }) : NaN;
        const inside = Number.isFinite(v) && v * sign > 0;
        if (inside && run < 0) run = c;
        if (!inside && run >= 0) {
          d += `M${fmt(px.left + run * step)} ${fmt(px.top + r * step)}h${(c - run) * step}v${step}h${-(c - run) * step}z`;
          run = -1;
        }
      }
    }
    return d;
  }

  let seq = 0;

  // The plot's SVG, from what read() made of it.
  function draw(plot) {
    const { settings, params } = plot;
    // The view: what the source gives, else ten units of x, and y at x's scale.
    let vx = plot.view.x;
    let vy = plot.view.y;
    let h = settings.height || 400;
    if (!vx && !vy) vx = { a: -5, b: 5 };
    // Room for the labels beside the axes, worked out before the scale.
    const left = PAD;
    const top = PAD;
    const right = PAD;
    const bottom = PAD;
    const pw = W - left - right;
    if (!vy) {
      const half = ((vx.b - vx.a) / 2) * ((h - top - bottom) / pw);
      vy = { a: -half, b: half };
    } else if (!vx) {
      const half = ((vy.b - vy.a) / 2) * (pw / (h - top - bottom));
      vx = { a: -half, b: half };
    } else if (settings.equal && !settings.height) {
      h = Math.round(Math.min(1600, Math.max(120, (pw * (vy.b - vy.a)) / (vx.b - vx.a) + top + bottom)));
    }
    const ph = h - top - bottom;
    const view = { x: vx, y: vy };
    const px = {
      left, top, w: pw, h: ph,
      x: (x) => left + ((x - vx.a) / (vx.b - vx.a)) * pw,
      y: (y) => top + ((vy.b - y) / (vy.b - vy.a)) * ph,
    };
    const id = `t-plot-${++seq}`;
    const parts = [];
    const over = []; // drawn after the curves
    const xt = ticks(vx.a, vx.b, Math.max(3, Math.round(pw / 64)), vx.pi);
    const yt = ticks(vy.a, vy.b, Math.max(3, Math.round(ph / 60)), vy.pi);
    if (settings.grid) {
      const d = xt.map((t) => `M${fmt(px.x(t.v))} ${top}v${ph}`).join('') + yt.map((t) => `M${left} ${fmt(px.y(t.v))}h${pw}`).join('');
      parts.push(`<path class="t-plot-grid" d="${d}"/>`);
    }
    // The axes through 0 when it is in view, else along the frame's edges;
    // their numbers beside them, kept inside the plot.
    const ax = vy.a <= 0 && 0 <= vy.b ? px.y(0) : vy.a > 0 ? top + ph : top;
    const ay = vx.a <= 0 && 0 <= vx.b ? px.x(0) : vx.a > 0 ? left : left + pw;
    if (settings.axes) {
      parts.push(`<path class="t-plot-axis" d="M${left} ${fmt(ax)}h${pw}M${fmt(ay)} ${top}v${ph}"/>`);
      const below = ax + 16 > top + ph ? ax - 6 : ax + 16;
      const labels = [];
      for (const t of xt) {
        const x = px.x(t.v);
        if (Math.abs(t.v) < 1e-12 && settings.axes && ay === x) continue;
        if (x < left + 10 || x > left + pw - 10) continue;
        labels.push(`<text x="${fmt(x)}" y="${fmt(below)}" text-anchor="middle">${esc(t.label)}</text>`);
      }
      const side = ay - 6 < left + 30 ? { x: ay + 6, anchor: 'start' } : { x: ay - 6, anchor: 'end' };
      for (const t of yt) {
        const y = px.y(t.v);
        if (Math.abs(t.v) < 1e-12) continue;
        if (y < top + 8 || y > top + ph - 8) continue;
        labels.push(`<text x="${fmt(side.x)}" y="${fmt(y + 4.5)}" text-anchor="${side.anchor}">${esc(t.label)}</text>`);
      }
      if (vx.a <= 0 && 0 <= vx.b && vy.a <= 0 && 0 <= vy.b) labels.push(`<text x="${fmt(ay - 6)}" y="${fmt(below)}" text-anchor="end">0</text>`);
      if (settings.xlabel) labels.push(`<text class="t-plot-title" x="${left + pw - 4}" y="${fmt(ax - 8 < top + 12 ? ax + 30 : ax - 8)}" text-anchor="end">${esc(settings.xlabel)}</text>`);
      if (settings.ylabel) labels.push(`<text class="t-plot-title" x="${fmt(side.anchor === 'start' ? ay + 8 : ay - 8)}" y="${top + 14}" text-anchor="${side.anchor}">${esc(settings.ylabel)}</text>`);
      over.push(`<g class="t-plot-labels">${labels.join('')}</g>`);
    }

    const legend = [];
    const marks = [];
    for (const it of plot.items) {
      const cls = typeof it.colour === 'number' ? ` t-plot-c${it.colour}` : '';
      const own = typeof it.colour === 'string' ? ` color="${esc(it.colour)}"` : '';
      const dash = it.attrs['.dashed'] ? ' t-plot-dashed' : it.attrs['.dotted'] ? ' t-plot-dotted' : '';
      const width = it.attrs.width ? ` stroke-width="${Number(it.attrs.width)}"` : '';
      const line = (d, extra = '') => (d ? `<path class="t-plot-curve${cls}${dash}${extra}"${own}${width} d="${d}"/>` : '');
      const region = (d) => (d ? `<path class="t-plot-region${cls}"${own} d="${d}"/>` : '');
      let region_ = false;
      if (it.kind === 'fx' || it.kind === 'fy') {
        const r = it.range || (it.kind === 'fx' ? vx : vy);
        const a = Math.max(r.a, (it.kind === 'fx' ? vx : vy).a);
        const b = Math.min(r.b, (it.kind === 'fx' ? vx : vy).b);
        if (a < b) marks.push(line(pathOf(traceFn(it.f, it.kind === 'fx' ? 'x' : 'y', a, b, px))));
      } else if (it.kind === 'param') {
        const r = it.range || params[it.var] || { a: 0, b: 2 * Math.PI };
        const P = it.polar ? (s) => {
          const rr = it.polar({ θ: s });
          return [rr * Math.cos(s), rr * Math.sin(s)];
        } : (s) => [it.fx({ t: s }), it.fy({ t: s })];
        marks.push(line(pathOf(trace(P, r.a, r.b, px))));
      } else if (it.kind === 'implicit') {
        marks.push(line(pathOf(contour(it.f, view, px))));
      } else if (it.kind === 'raster') {
        region_ = true;
        marks.push(region(raster(it.f, it.sign, view, px)));
        marks.push(line(pathOf(contour(it.f, view, px)), it.strict ? ' t-plot-dashed' : ''));
      } else if (it.kind === 'region') {
        region_ = true;
        marks.push(regionOf(it, view, px, line, region));
      } else if (it.kind === 'points') {
        const dots = it.pts.map(([x, y]) => `<circle class="t-plot-point${cls}"${own} cx="${fmt(px.x(x))}" cy="${fmt(px.y(y))}" r="${it.attrs.width ? Number(it.attrs.width) + 2 : 4.5}"/>`);
        marks.push(dots.join(''));
        if (it.attrs.label) {
          const [x, y] = it.pts[0];
          const tx = px.x(x) + 8;
          const anchor = tx > left + pw - 60 ? 'end' : 'start';
          marks.push(`<text class="t-plot-point-label" x="${fmt(anchor === 'end' ? px.x(x) - 8 : tx)}" y="${fmt(px.y(y) - 8)}" text-anchor="${anchor}">${esc(it.attrs.label)}</text>`);
        }
        continue;
      }
      if (it.attrs.label) legend.push({ label: it.attrs.label, color: it.colour, dash: dash.trim().replace('t-plot-', '') || null, region: region_ });
    }
    parts.push(`<clipPath id="${id}-clip"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath>`);
    parts.push(`<g clip-path="url(#${id}-clip)">${marks.join('')}</g>`, ...over);
    const label = plot.items.map((it) => it.attrs.label || it.text).join('; ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="t-plot-svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${esc(`Plot: ${label}`)}">${parts.join('')}</svg>`;
    return { svg, legend, label };
  }
  // A function of x (y = f(x)) or of y (x = g(y)) traced: for one of y,
  // in pixels with the axes' roles swapped, so trace's jumps are along x.
  function traceFn(f, v, a, b, px) {
    if (v === 'x') return trace((s) => [s, f({ x: s })], a, b, px);
    const flip = { w: px.h, h: px.w, x: px.y, y: px.x };
    return trace((s) => [s, f({ y: s })], a, b, flip).map((l) => l.map(([u, w]) => [w, u]));
  }

  // A region between bounds on y (or x), each a polyline of its own
  // sampling; a missing bound is the view's edge.
  function regionOf(it, view, px, line, region) {
    const across = it.var === 'x' ? view.x : view.y;
    const r = it.range || across;
    const a = Math.max(r.a, across.a);
    const b = Math.min(r.b, across.b);
    if (!(a < b)) return '';
    const N = 400;
    const ys = it.var === 'x' ? view.y : view.x;
    const big = (ys.b - ys.a) * 4;
    const at = (f, s, edge) => (f ? f({ [it.var]: s }) : edge);
    const pt = (s, v) => (it.var === 'x' ? [px.x(s), px.y(v)] : [px.x(v), px.y(s)]);
    let d = '';
    let lo = [];
    let hi = [];
    const close = () => {
      if (lo.length > 1) d += 'M' + [...lo, ...hi.reverse()].map((p) => `${fmt(clamp(p[0]))} ${fmt(clamp(p[1]))}`).join('L') + 'z';
      (lo = []), (hi = []);
    };
    for (let k = 0; k <= N; k++) {
      const s = a + ((b - a) * k) / N;
      const l = at(it.lo, s, ys.a - big);
      const u = at(it.hi, s, ys.b + big);
      if (!Number.isFinite(l) || !Number.isFinite(u) || l > u) {
        close();
        continue;
      }
      const cl = Math.max(ys.a - big, Math.min(ys.b + big, l));
      const cu = Math.max(ys.a - big, Math.min(ys.b + big, u));
      lo.push(pt(s, cl));
      hi.push(pt(s, cu));
    }
    close();
    // The bounds drawn, dashed where the region leaves them out (<, >).
    const edges = [it.lo, it.hi].map((f, k) => (f ? line(pathOf(traceFn(f, it.var, a, b, px)), it.strict[k] ? ' t-plot-dashed' : '') : ''));
    return region(d) + edges.join('');
  }

  // The source as markup, or what stops it.
  function plotOf(source) {
    try {
      return draw(read(source));
    } catch (e) {
      if (!(e instanceof PlotError)) throw e;
      return { error: { message: e.message, line: e.line || null } };
    }
  }
  T.plot = plotOf;

  const DOM = typeof document === 'object' && document !== null && document.nodeType === 9;
  if (!DOM) return;

  // A legend's label: text, its $…$ as the engine's formulas.
  function labelNodes(text) {
    const out = [];
    const parts = String(text).split(/(\$[^$]+\$)/);
    for (const p of parts) {
      if (!p) continue;
      const m = /^\$([^$]+)\$$/.exec(p);
      const r = m && typeof T.tex === 'function' ? T.tex(m[1]) : null;
      if (r && r.mathml) {
        const t = document.createElement('template');
        t.innerHTML = r.mathml;
        const span = document.createElement('span');
        span.className = 't-math';
        span.append(t.content);
        out.push(span);
      } else out.push(document.createTextNode(p));
    }
    return out;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function key(entry) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', `t-plot-key${typeof entry.color === 'number' ? ` t-plot-c${entry.color}` : ''}`);
    if (typeof entry.color === 'string') svg.setAttribute('color', entry.color);
    svg.setAttribute('viewBox', '0 0 24 12');
    svg.setAttribute('aria-hidden', 'true');
    if (entry.region) {
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('class', 't-plot-region');
      for (const [k, v] of Object.entries({ x: 1, y: 1, width: 22, height: 10 })) r.setAttribute(k, v);
      svg.append(r);
    }
    const l = document.createElementNS(SVGNS, 'path');
    l.setAttribute('class', `t-plot-curve${entry.dash ? ` t-plot-${entry.dash}` : ''}`);
    l.setAttribute('d', 'M2 6H22');
    svg.append(l);
    return svg;
  }

  // A plot that does not parse: the fence back where it was, with the id
  // the wrapper had taken, and the error after it.
  function failed(wrap, message) {
    const pre = wrap.querySelector(':scope > pre');
    const err = document.createElement('div');
    err.className = 't-error t-plot-error';
    err.textContent = `This plot cannot be drawn: ${message}`;
    if (wrap.id) pre.id = wrap.id;
    wrap.replaceWith(pre, err);
    pre.hidden = false;
    console.warn(`Luccet plot.js: ${message}`);
  }

  // Fences are pre[data-t=code], listings figure[data-t=code] holding one.
  const LANGUAGE = /(?:^|\s)language-plot(?:\s|$)/i;
  T.define('code', (el) => {
    const pre = el.matches('pre') ? el : el.querySelector(':scope > pre');
    const code = pre && pre.querySelector(':scope > code');
    if (!code || !LANGUAGE.test(code.className)) return;
    const wrap = document.createElement('div');
    wrap.className = 't-plot';
    if (pre.id) (wrap.id = pre.id), pre.removeAttribute('id');
    if (pre.hasAttribute('data-pos')) wrap.setAttribute('data-pos', pre.getAttribute('data-pos'));
    pre.replaceWith(wrap);
    wrap.append(pre);
    let r;
    try {
      r = plotOf(code.textContent);
    } catch (e) {
      r = { error: { message: `the plot stopped (${(e && e.message) || e})` } };
    }
    if (r.error) return failed(wrap, r.error.message);
    const t = document.createElement('template');
    t.innerHTML = r.svg;
    wrap.insertBefore(t.content, pre);
    if (r.legend.length) {
      const ul = document.createElement('ul');
      ul.className = 't-plot-legend';
      for (const entry of r.legend) {
        const li = document.createElement('li');
        li.append(key(entry), ...labelNodes(entry.label));
        ul.append(li);
      }
      wrap.insertBefore(ul, pre);
    }
    pre.hidden = true;
  });
})();
