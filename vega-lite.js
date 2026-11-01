// SPDX-License-Identifier: MIT
// vega-lite.js, Luccet's charts, in the plots kit (github.com/Luccet/plots).
// It draws each ```vega-lite fence, and each ```vega one, titled ones
// (listings) too, as a chart: the fence is a Vega-Lite (or Vega)
// specification in JSON, and the chart takes the page theme's colours and
// sans-serif font.
//
//   <script src="luccet.js" data-use="vega-lite.js"></script>
//
//   ```vega-lite
//   {
//     "data": {"values": [{"a": "A", "b": 28}, {"a": "B", "b": 55}]},
//     "mark": "bar",
//     "encoding": {"x": {"field": "a"}, "y": {"field": "b", "type": "quantitative"}}
//   }
//   ```
//
// Vega and Vega-Lite come from jsDelivr, pinned with SRI (the table below),
// and only to a page that has a chart (Vega-Lite only to one with a
// vega-lite fence). `?base=URL` names a copy instead, the folder of
// vega.min.js and vega-lite.min.js (tools/vendor.js writes one), loaded
// without SRI; a window.vega and window.vegaLite already on the page are
// used as they are.
//
// The theme's colours go in as the chart's configuration, under the
// specification's own: text, axes, grid lines and legends in its text,
// muted and line colours, marks in the plot palette that plot.js uses too
// (--t-plot-1 … --t-plot-6 where a theme gives them, else its link and code
// colours, else the kit's own), its first colour for a chart of one series.
// The chart is drawn again when that palette changes (the reader's light or
// dark preference, or a theme switched in and announced with a luccet:theme
// event on window), and a copy in luccet.css's print palette is shown in
// print. The chart on screen is Vega's own, so its tooltips and selections
// work. A specification that is not JSON, or that Vega cannot draw, keeps
// its fence, with the error after it.
//
// Expressions are evaluated by Vega's interpreter, carried here (below),
// not compiled with new Function, and data in CSV or TSV is read by a
// reader here, not d3's (which compiles one too): under a
// Content-Security-Policy, script-src needs only jsDelivr (or the copy's
// origin), and connect-src the data's. A link or image in a chart (href,
// url) is followed for http, https, mailto and a path only.
//
// Under node (luccet check, luccet build, the language server) it only adds
// its styles: drawing needs the page.
(function () {
  'use strict';
  const T = window.luccet;
  if (!T) return;
  if (T.api !== 2) throw new Error(`needs the add-on API 2 (Luccet 2); this luccet.js has ${T.api}`);

  // The plot palette, as plot.js has it: a theme's --t-plot-N, else its
  // link and code colours, else these; print has its own, on white.
  const FALLBACK = {
    light: ['#1f6fd0', '#c2410c', '#15803d', '#7e22ce', '#0e7490', '#b91c1c'],
    dark: ['#6ea8fe', '#fb923c', '#4ade80', '#c084fc', '#22d3ee', '#f87171'],
    print: ['#1f5fa8', '#b45309', '#15803d', '#7e22ce', '#0e7490', '#b91c1c'],
  };
  const THEMED = ['--t-link', '--t-code-number', '--t-code-string', '--t-code-keyword', '--t-code-type', '--t-code-deleted'];
  const fallbacks = (set) => set.map((c, i) => `--t-plot-f${i + 1}: ${c};`).join(' ');
  T.style(
    [
      '.luccet .t-vega { margin-block: 0 1rem; }',
      `.t-vega { ${fallbacks(FALLBACK.light)} }`,
      `@media (prefers-color-scheme: dark) { .t-vega { ${fallbacks(FALLBACK.dark)} } }`,
      ...THEMED.map((p, i) => `.t-vega .t-vega-c${i + 1} { color: var(--t-plot-${i + 1}, var(${p}, var(--t-plot-f${i + 1}))); }`),
      '.t-vega > .t-vega-screen, .t-vega > .t-vega-print { display: flex; justify-content: center; max-inline-size: 100%; overflow-x: auto; }',
      '.t-vega svg { max-inline-size: 100%; height: auto; }',
      '.t-vega > .t-vega-print { display: none; }',
      '@media print { .t-vega > .t-vega-print { display: flex; } .t-vega:has(> .t-vega-print) > .t-vega-screen { display: none; } }',
    ].join('\n'),
  );

  const DOM = typeof document === 'object' && document !== null && document.nodeType === 9;
  if (!DOM) return;

  // <vega> written by tools/vega.js; do not edit by hand
  const VEGA = {
    vega: '6.4.0',
    vegaLite: '6.5.0',
    interpreter: '2.3.2',
    sri: { vega: 'sha384-VKdcJr3ZaBIJMbVcopTAI/JEuUkSY6qnwVu9iLuw0DnQ9gQ1JjsfZJhXFQAgNi43', vegaLite: 'sha384-pV2l7nzmyxZh02knvUH7N8zvtyCYsYiGt+SsE/emG/dFiBI6G0YJZFZ2FzEX72P3' },
  };
  // vega-interpreter 2.3.2 (github.com/vega/vega), BSD-3-Clause, Copyright (c) 2015-2023, University of Washington Interactive Data Lab,
  // its module made a function of vega: Vega evaluates expressions with it rather than with new Function.
  const interpreterOf = (vega) => {
    const { ascending, isString, DisallowedObjectProperties } = vega;
    function adjustSpatial (item, encode, swap) {
      let t;
      if (encode.x2) {
        if (encode.x) {
          if (swap && item.x > item.x2) {
            t = item.x;
            item.x = item.x2;
            item.x2 = t;
          }
          item.width = item.x2 - item.x;
        } else {
          item.x = item.x2 - (item.width || 0);
        }
      }
      if (encode.xc) {
        item.x = item.xc - (item.width || 0) / 2;
      }
      if (encode.y2) {
        if (encode.y) {
          if (swap && item.y > item.y2) {
            t = item.y;
            item.y = item.y2;
            item.y2 = t;
          }
          item.height = item.y2 - item.y;
        } else {
          item.y = item.y2 - (item.height || 0);
        }
      }
      if (encode.yc) {
        item.y = item.yc - (item.height || 0) / 2;
      }
    }

    var Constants = {
      NaN: NaN,
      E: Math.E,
      LN2: Math.LN2,
      LN10: Math.LN10,
      LOG2E: Math.LOG2E,
      LOG10E: Math.LOG10E,
      PI: Math.PI,
      SQRT1_2: Math.SQRT1_2,
      SQRT2: Math.SQRT2,
      MIN_VALUE: Number.MIN_VALUE,
      MAX_VALUE: Number.MAX_VALUE
    };

    var Ops = {
      '*': (a, b) => a * b,
      '+': (a, b) => a + b,
      '-': (a, b) => a - b,
      '/': (a, b) => a / b,
      '%': (a, b) => a % b,
      '>': (a, b) => a > b,
      '<': (a, b) => a < b,
      '<=': (a, b) => a <= b,
      '>=': (a, b) => a >= b,
      '==': (a, b) => a == b,
      '!=': (a, b) => a != b,
      '===': (a, b) => a === b,
      '!==': (a, b) => a !== b,
      '&': (a, b) => a & b,
      '|': (a, b) => a | b,
      '^': (a, b) => a ^ b,
      '<<': (a, b) => a << b,
      '>>': (a, b) => a >> b,
      '>>>': (a, b) => a >>> b
    };

    var Unary = {
      '+': a => +a,
      '-': a => -a,
      '~': a => ~a,
      '!': a => !a
    };

    const slice = Array.prototype.slice;
    const apply = (m, args, cast) => {
      const obj = cast ? cast(args[0]) : args[0];
      return obj[m].apply(obj, slice.call(args, 1));
    };
    const datetime = (yearOrTimestring, m = 0, d = 1, H = 0, M = 0, S = 0, ms = 0) => isString(yearOrTimestring) ? new Date(yearOrTimestring) : new Date(yearOrTimestring, m, d, H, M, S, ms);
    var Functions = {
      // math functions
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      abs: Math.abs,
      acos: Math.acos,
      asin: Math.asin,
      atan: Math.atan,
      atan2: Math.atan2,
      ceil: Math.ceil,
      cos: Math.cos,
      exp: Math.exp,
      floor: Math.floor,
      hypot: Math.hypot,
      log: Math.log,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      random: Math.random,
      round: Math.round,
      sin: Math.sin,
      sqrt: Math.sqrt,
      tan: Math.tan,
      clamp: (a, b, c) => Math.max(b, Math.min(c, a)),
      // date functions
      now: Date.now,
      utc: Date.UTC,
      datetime: datetime,
      date: d => new Date(d).getDate(),
      day: d => new Date(d).getDay(),
      year: d => new Date(d).getFullYear(),
      month: d => new Date(d).getMonth(),
      hours: d => new Date(d).getHours(),
      minutes: d => new Date(d).getMinutes(),
      seconds: d => new Date(d).getSeconds(),
      milliseconds: d => new Date(d).getMilliseconds(),
      time: d => new Date(d).getTime(),
      timezoneoffset: d => new Date(d).getTimezoneOffset(),
      utcdate: d => new Date(d).getUTCDate(),
      utcday: d => new Date(d).getUTCDay(),
      utcyear: d => new Date(d).getUTCFullYear(),
      utcmonth: d => new Date(d).getUTCMonth(),
      utchours: d => new Date(d).getUTCHours(),
      utcminutes: d => new Date(d).getUTCMinutes(),
      utcseconds: d => new Date(d).getUTCSeconds(),
      utcmilliseconds: d => new Date(d).getUTCMilliseconds(),
      // sequence functions
      length: x => x.length,
      join: function () {
        return apply('join', arguments);
      },
      indexof: function () {
        return apply('indexOf', arguments);
      },
      lastindexof: function () {
        return apply('lastIndexOf', arguments);
      },
      slice: function () {
        return apply('slice', arguments);
      },
      reverse: x => x.slice().reverse(),
      sort: x => x.slice().sort(ascending),
      // string functions
      parseFloat: parseFloat,
      parseInt: parseInt,
      upper: x => String(x).toUpperCase(),
      lower: x => String(x).toLowerCase(),
      substring: function () {
        return apply('substring', arguments, String);
      },
      split: function () {
        return apply('split', arguments, String);
      },
      replace: function () {
        return apply('replace', arguments, String);
      },
      trim: x => String(x).trim(),
      // Base64 encode/decode
      // Convert binary string to base64-encoded ascii
      btoa: x => btoa(x),
      // Convert base64-encoded ascii to binary string
      atob: x => atob(x),
      // URI encoding
      encodeURIComponent: x => encodeURIComponent(x),
      // regexp functions
      regexp: RegExp,
      test: (r, t) => RegExp(r).test(t)
    };

    const EventFunctions = ['view', 'item', 'group', 'xy', 'x', 'y'];
    const DisallowedMethods = new Set([Function, eval, setTimeout, setInterval]);
    if (typeof setImmediate === 'function') DisallowedMethods.add(setImmediate);
    const Visitors = {
      // global and sticky regexps carry lastIndex across calls, so hand out a
      // fresh instance per evaluation, as the generated code path does
      Literal: ($, n) => n.regex && n.value && (n.value.global || n.value.sticky) ? new RegExp(n.regex.pattern, n.regex.flags) : n.value,
      Identifier: ($, n) => {
        const id = n.name;
        return $.memberDepth > 0 ? id : id === 'datum' ? $.datum : id === 'event' ? $.event : id === 'item' ? $.item : Constants[id] || $.params['$' + id];
      },
      MemberExpression: ($, n) => {
        const d = !n.computed,
          o = $(n.object);
        if (d) $.memberDepth += 1;
        const p = $(n.property);
        if (d) $.memberDepth -= 1;
        if (DisallowedMethods.has(o[p])) {
          // eslint-disable-next-line no-console
          console.error(`Prevented interpretation of member "${p}" which could lead to insecure code execution`);
          return;
        }
        return o[p];
      },
      CallExpression: ($, n) => {
        const args = n.arguments;
        let name = n.callee.name;

        // handle special internal functions used by encoders
        // re-route to corresponding standard function
        if (name.startsWith('_')) {
          name = name.slice(1);
        }

        // special case "if" due to conditional evaluation of branches
        return name === 'if' ? $(args[0]) ? $(args[1]) : $(args[2]) : ($.fn[name] || Functions[name]).apply($.fn, args.map($));
      },
      ArrayExpression: ($, n) => n.elements.map($),
      BinaryExpression: ($, n) => Ops[n.operator]($(n.left), $(n.right)),
      UnaryExpression: ($, n) => Unary[n.operator]($(n.argument)),
      ConditionalExpression: ($, n) => $(n.test) ? $(n.consequent) : $(n.alternate),
      LogicalExpression: ($, n) => n.operator === '&&' ? $(n.left) && $(n.right) : $(n.left) || $(n.right),
      ObjectExpression: ($, n) => n.properties.reduce((o, p) => {
        $.memberDepth += 1;
        const k = $(p.key);
        $.memberDepth -= 1;
        const v = $(p.value);
        if (DisallowedObjectProperties.has(k)) {
          // eslint-disable-next-line no-console
          console.error(`Prevented interpretation of property "${k}" which could lead to insecure code execution`);
        } else if (DisallowedMethods.has(v)) {
          // eslint-disable-next-line no-console
          console.error(`Prevented interpretation of method "${k}" which could lead to insecure code execution`);
        } else {
          o[k] = v;
        }
        return o;
      }, {})
    };
    function interpret (ast, fn, params, datum, event, item) {
      const $ = n => Visitors[n.type]($, n);
      $.memberDepth = 0;
      $.fn = Object.create(fn);
      $.params = params;
      $.datum = datum;
      $.event = event;
      $.item = item;

      // route event functions to annotated vega event context
      EventFunctions.forEach(f => $.fn[f] = (...args) => event.vega[f](...args));
      return $(ast);
    }

    var expression = {
      /**
       * Parse an expression used to update an operator value.
       */
      operator(ctx, expr) {
        const ast = expr.ast,
          fn = ctx.functions;
        return _ => interpret(ast, fn, _);
      },
      /**
       * Parse an expression provided as an operator parameter value.
       */
      parameter(ctx, expr) {
        const ast = expr.ast,
          fn = ctx.functions;
        return (datum, _) => interpret(ast, fn, _, datum);
      },
      /**
       * Parse an expression applied to an event stream.
       */
      event(ctx, expr) {
        const ast = expr.ast,
          fn = ctx.functions;
        return event => interpret(ast, fn, undefined, undefined, event);
      },
      /**
       * Parse an expression used to handle an event-driven operator update.
       */
      handler(ctx, expr) {
        const ast = expr.ast,
          fn = ctx.functions;
        return (_, event) => {
          const datum = event.item && event.item.datum;
          return interpret(ast, fn, _, datum, event);
        };
      },
      /**
       * Parse an expression that performs visual encoding.
       */
      encode(ctx, encode) {
        const {
            marktype,
            channels
          } = encode,
          fn = ctx.functions,
          swap = marktype === 'group' || marktype === 'image' || marktype === 'rect';
        return (item, _) => {
          const datum = item.datum;
          let m = 0,
            v;
          for (const name in channels) {
            v = interpret(channels[name].ast, fn, _, datum, undefined, item);
            if (item[name] !== v) {
              item[name] = v;
              m = 1;
            }
          }
          if (marktype !== 'rule') {
            adjustSpatial(item, channels, swap);
          }
          return m;
        };
      }
    };
    return expression;
  };
  // </vega>

  const opts = Object.assign({}, T.config && T.config.use && T.config.use['vega-lite']);
  const own = typeof opts.base === 'string' && opts.base.trim() !== '';
  const base = own ? opts.base.trim().replace(/\/+$/, '') : null;
  const URLS = {
    vega: own ? `${base}/vega.min.js` : `https://cdn.jsdelivr.net/npm/vega@${VEGA.vega}/build/vega.min.js`,
    vegaLite: own ? `${base}/vega-lite.min.js` : `https://cdn.jsdelivr.net/npm/vega-lite@${VEGA.vegaLite}/build/vega-lite.min.js`,
  };

  // ------------------------------------------------------------ the libraries

  // window.vega can be an element with id="vega", which the browser names
  // on window: a library is one with its functions.
  const GLOBALS = { vega: () => window.vega && typeof window.vega.View === 'function' && window.vega, vegaLite: () => window.vegaLite && typeof window.vegaLite.compile === 'function' && window.vegaLite };
  const loads = {};
  let failed = false;
  function script(name) {
    if (loads[name]) return loads[name];
    loads[name] = GLOBALS[name]()
      ? Promise.resolve(GLOBALS[name]())
      : new Promise((resolve) => {
          const s = document.createElement('script');
          if (T.config && T.config.nonce) s.nonce = T.config.nonce;
          if (!own) (s.integrity = VEGA.sri[name]), (s.crossOrigin = 'anonymous');
          s.src = URLS[name];
          s.onload = () => resolve(GLOBALS[name]() || null);
          s.onerror = () => resolve(null);
          document.head.append(s);
        });
    loads[name].then((lib) => {
      if (!lib) (failed = true), console.warn(`Luccet vega-lite.js: ${name === 'vega' ? 'Vega' : 'Vega-Lite'} did not load from ${URLS[name]}, so charts stay as their source`);
    });
    return loads[name];
  }
  // One that failed is asked for again at the next render: the network may be back.
  T.on('render', () => {
    if (!failed) return;
    failed = false;
    for (const k of Object.keys(loads)) delete loads[k];
    tools = null;
  });

  // What every chart is drawn with: vega, vega-lite once a fence needs it,
  // the interpreter, and a loader that reads CSV without new Function and
  // follows only safe links.
  let tools = null;
  function vegaTools() {
    if (tools) return tools;
    tools = script('vega').then((vega) => {
      if (!vega) return null;
      for (const [type, delimiter] of [['csv', ','], ['tsv', '\t'], ['dsv', null]]) {
        const reader = (data, format) => dsv(String(data), delimiter || (format && format.delimiter) || ',');
        reader.responseType = 'text';
        vega.formats(type, reader);
      }
      const loader = vega.loader();
      const sanitize = loader.sanitize.bind(loader);
      loader.sanitize = (uri, options) =>
        sanitize(uri, options).then((r) => {
          if (!safe(r && r.href)) throw new Error(`${uri}: a chart follows http, https, mailto and paths only`);
          return r;
        });
      // Paper follows no link, and Vega's SVG text renderer stops at a link
      // its loader refuses: the print copy's loader gives none.
      const printLoader = Object.create(loader);
      printLoader.sanitize = (uri, options) => (options && options.context === 'href' ? Promise.resolve({}) : loader.sanitize(uri, options));
      return { vega, loader, printLoader, expr: interpreterOf(vega) };
    });
    return tools;
  }

  // A link Vega would follow: http, https, mailto or a path. Browsers ignore
  // spaces and control characters in a scheme, so the test does too.
  function safe(href) {
    if (typeof href !== 'string') return false;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.replace(/[\u0000- ]/g, ''));
    return !scheme || /^(?:https?|mailto)$/i.test(scheme[1]);
  }

  // Delimited text (RFC 4180: quotes, doubled quotes, newlines in quotes)
  // as objects keyed by its first row, with a columns list, as d3's
  // dsvFormat(delimiter).parse makes it.
  function dsv(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let quoted = false;
    const n = text.length;
    if (text.charCodeAt(0) === 0xfeff) i = 1;
    const endField = () => (row.push(field), (field = ''));
    const endRow = () => (endField(), rows.push(row), (row = []));
    while (i < n) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') (field += '"'), (i += 2);
          else (quoted = false), i++;
        } else (field += c), i++;
        continue;
      }
      if (c === '"' && field === '') (quoted = true), i++;
      else if (c === delimiter) endField(), i++;
      else if (c === '\n' || c === '\r') {
        endRow();
        i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      } else (field += c), i++;
    }
    if (field !== '' || row.length) endRow();
    const columns = rows.shift() || [];
    const out = rows.filter((r) => !(r.length === 1 && r[0] === '')).map((r) => Object.fromEntries(columns.map((c, k) => [c, r[k] === undefined ? '' : r[k]])));
    out.columns = columns;
    return out;
  }

  // ------------------------------------------------------------ the palette

  const PRINT = { bg: '#ffffff', fg: '#000000', muted: '#555555', line: '#d9dde3' };
  const KEYS = Object.keys(PRINT);

  // The palette in effect at el, each colour as the browser computes it
  // (luccet.css's defaults are the system's colours, which mean one thing in
  // light and another in dark), by probes inside el.
  function palette(el) {
    const cs = getComputedStyle(el);
    const p = { font: cs.getPropertyValue('--t-sans').trim() || 'sans-serif', colours: [] };
    const probe = document.createElement('span');
    probe.hidden = true;
    el.appendChild(probe);
    for (const k of KEYS) {
      probe.style.color = PRINT[k];
      probe.style.color = cs.getPropertyValue(`--t-${k}`).trim();
      p[k] = getComputedStyle(probe).color;
    }
    probe.style.color = '';
    for (let i = 1; i <= 6; i++) {
      probe.className = `t-vega-c${i}`;
      p.colours.push(getComputedStyle(probe).color);
    }
    probe.remove();
    p.key = JSON.stringify(p);
    return p;
  }
  const printPalette = (screen) => {
    const p = Object.assign({}, PRINT, { font: screen.font, colours: FALLBACK.print });
    p.key = JSON.stringify(p);
    return p;
  };

  // The theme as a Vega-Lite configuration (a Vega one takes the parts Vega
  // knows): the specification's own config wins.
  function config(p, lite) {
    const c = {
      background: 'transparent',
      font: p.font,
      title: { color: p.fg, subtitleColor: p.muted },
      axis: { domainColor: p.muted, tickColor: p.muted, gridColor: p.line, labelColor: p.muted, titleColor: p.fg },
      legend: { labelColor: p.muted, titleColor: p.fg },
      range: { category: p.colours },
    };
    if (lite) {
      Object.assign(c, {
        header: { labelColor: p.fg, titleColor: p.fg },
        view: { stroke: p.line },
        mark: { color: p.colours[0] },
        text: { color: p.fg },
        rule: { color: p.muted },
      });
    } else {
      Object.assign(c, { style: { 'guide-label': { fill: p.muted }, 'guide-title': { fill: p.fg }, 'group-title': { fill: p.fg } } });
    }
    return c;
  }

  // ------------------------------------------------------------ drawing

  // A specification and its kind, read once per fence.
  const specs = new WeakMap(); // wrap -> {lite, spec}
  const views = new WeakMap(); // wrap -> the screen's View
  const drawnFor = new WeakMap(); // wrap -> the palette key it was drawn in

  // A chart drawn into el in palette p, by a View the caller finalizes:
  // {view} or {error}. Data that fails to load is an error, which Vega
  // only logs.
  async function chart(t, lib, entry, p, el, print) {
    const renderer = 'svg';
    let vspec;
    try {
      vspec = entry.lite ? lib.compile(entry.spec, { config: config(p, true) }).spec : entry.spec;
    } catch (e) {
      return { error: firstLine(e) };
    }
    const errors = [];
    const logger = {
      level() {
        return t.vega.Warn;
      },
      error: (...a) => errors.push(a.map(firstLine).join(' ')),
      // Data that does not load or parse is only a warning to Vega.
      warn: (...a) => (/^(?:Loading|Data ingestion) failed$/.test(a[0]) ? errors.push(`${a[0]}: ${a[1]} (${firstLine(a[2])})`) : console.warn('Luccet vega-lite.js:', ...a)),
      info() {},
      debug() {},
    };
    let view;
    try {
      const runtime = t.vega.parse(vspec, entry.lite ? undefined : config(p, false), { ast: true });
      view = new t.vega.View(runtime, { renderer, container: el, loader: print ? t.printLoader : t.loader, expr: t.expr, logger, hover: !print });
      await view.runAsync();
    } catch (e) {
      if (view) view.finalize();
      return { error: firstLine(e) };
    }
    if (errors.length) {
      view.finalize();
      return { error: errors[0] };
    }
    return { view };
  }
  const firstLine = (e) => String((e && e.message) || e).split('\n')[0];

  // A wrapper's chart, drawn for the palette in effect, and its print copy.
  // A later showing supersedes one still waiting.
  async function show(wrap) {
    const entry = specs.get(wrap);
    const screenP = palette(wrap);
    drawnFor.set(wrap, screenP.key);
    const t = await vegaTools();
    const lib = entry.lite ? await script('vegaLite') : null;
    if (!t || (entry.lite && !lib) || !wrap.isConnected || drawnFor.get(wrap) !== screenP.key) return;
    const screen = document.createElement('div');
    screen.className = 't-vega-screen';
    // Laid out where it will stand, for a width of "container", unseen.
    screen.style.visibility = 'hidden';
    const old = wrap.querySelector(':scope > .t-vega-screen');
    wrap.insertBefore(screen, old || wrap.querySelector(':scope > pre'));
    const r = await chart(t, lib, entry, screenP, screen, false);
    if (r.error) {
      screen.remove();
      return void (drawnFor.get(wrap) === screenP.key && failChart(wrap, r.error));
    }
    if (!wrap.isConnected || drawnFor.get(wrap) !== screenP.key) return void (r.view.finalize(), screen.remove());
    if (old) old.remove();
    if (views.get(wrap)) views.get(wrap).finalize();
    views.set(wrap, r.view);
    screen.style.visibility = '';
    wrap.querySelector(':scope > pre').hidden = true;
    // The print copy, at the screen's width, in an unseen element.
    const printP = printPalette(screenP);
    const oldPrint = wrap.querySelector(':scope > .t-vega-print');
    if (printP.key === screenP.key) return void (oldPrint && oldPrint.remove());
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = `position:absolute;visibility:hidden;inset-inline-start:-99999px;inline-size:${screen.clientWidth || wrap.clientWidth}px`;
    document.body.append(box);
    const pr = await chart(t, lib, entry, printP, box, true);
    let svg = null;
    if (pr.view) {
      svg = await pr.view.toSVG().catch(() => null);
      pr.view.finalize();
    }
    box.remove();
    if (!svg || !wrap.isConnected || drawnFor.get(wrap) !== screenP.key) return;
    const print = document.createElement('div');
    print.className = 't-vega-print';
    const tpl = document.createElement('template');
    tpl.innerHTML = svg;
    print.append(tpl.content);
    uniqueIds(print);
    if (oldPrint) oldPrint.replaceWith(print);
    else wrap.insertBefore(print, wrap.querySelector(':scope > pre'));
  }

  // The print copy's ids made its own: Vega's (clip paths, gradients) may
  // repeat the screen chart's, and url(#…) would land on the first.
  let placed = 0;
  function uniqueIds(root) {
    const all = [...root.querySelectorAll('[id]')];
    if (!all.length) return;
    const suffix = `-print${++placed}`;
    const map = new Map(all.map((e) => [e.id, e.id + suffix]));
    for (const el of root.querySelectorAll('*')) {
      if (el.id && map.has(el.id)) el.id = map.get(el.id);
      for (const a of [...el.attributes]) {
        if (a.name === 'id' || !a.value.includes('#')) continue;
        const v = a.value.replace(/#([\w:.-]+)/g, (m, id) => (map.has(id) ? `#${map.get(id)}` : m));
        if (v !== a.value) el.setAttribute(a.name, v);
      }
    }
  }

  // A chart Vega cannot draw: the fence back where it was, with the id the
  // wrapper had taken, and the error after it.
  function failChart(wrap, message) {
    const pre = wrap.querySelector(':scope > pre');
    const err = document.createElement('div');
    err.className = 't-error t-vega-error';
    err.textContent = `This chart cannot be drawn: ${message}`;
    if (wrap.id) pre.id = wrap.id;
    if (views.get(wrap)) views.get(wrap).finalize();
    wrap.replaceWith(pre, err);
    pre.hidden = false;
    console.warn(`Luccet vega-lite.js: ${message}`);
  }

  // Drawn again when the palette changes.
  const repaint = () => {
    for (const wrap of document.querySelectorAll('.t-vega')) if (specs.has(wrap) && palette(wrap).key !== drawnFor.get(wrap)) show(wrap);
  };
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
  window.addEventListener('luccet:theme', repaint);

  // Fences are pre[data-t=code], listings figure[data-t=code] holding one.
  const LANGUAGE = /(?:^|\s)language-(vega-lite|vega)(?:\s|$)/i;
  T.define('code', (el) => {
    const pre = el.matches('pre') ? el : el.querySelector(':scope > pre');
    const code = pre && pre.querySelector(':scope > code');
    const m = code && LANGUAGE.exec(code.className);
    if (!m) return;
    const wrap = document.createElement('div');
    wrap.className = 't-vega';
    if (pre.id) (wrap.id = pre.id), pre.removeAttribute('id');
    if (pre.hasAttribute('data-pos')) wrap.setAttribute('data-pos', pre.getAttribute('data-pos'));
    pre.replaceWith(wrap);
    wrap.append(pre);
    let spec;
    try {
      spec = JSON.parse(code.textContent);
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('a specification is a JSON object, {…}');
    } catch (e) {
      return failChart(wrap, `it is not JSON: ${firstLine(e)}`);
    }
    specs.set(wrap, { lite: m[1].toLowerCase() === 'vega-lite', spec });
    show(wrap);
  });
})();
