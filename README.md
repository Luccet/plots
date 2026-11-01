# Plots for Luccet

Two add-ons that draw a [Luccet](https://luccet.dev) note's fences as plots and charts, each loaded on its own:

- **`plot.js`** draws each fence in the language `plot`: graphs of functions, curves, regions and points, written one to a line as on a calculator or in TeX (`y = sin x`, `x^2 + y^2 = 4`, `0 <= y <= \cos x`). It is drawn here in full, with no library, and fetches nothing.
- **`vega-lite.js`** draws each fence in the language `vega-lite` (or `vega`) with [Vega-Lite](https://vega.github.io/vega-lite/): charts of data (bar, line, point, area, histograms, heat maps, facets and the rest of [Vega-Lite's grammar](https://vega.github.io/vega-lite/examples/)), from a specification in JSON.

Both take the page theme's colours and its sans-serif font, in light, dark and print, and share one palette for their series.

## Loading them

They need Luccet 2, the [add-on API](https://luccet.dev/docs/addon-api.html) 2 (`luccet.api`). List the one a note uses, or both, in `data-use` on the luccet.js tag:

````html
<!doctype html><meta charset="utf-8"><script src="luccet.js" data-use="https://cdn.luccet.dev/plots/v1/plot.js https://cdn.luccet.dev/plots/v1/vega-lite.js"></script>

# Damped waves

```plot
y = sin(x) e^{-x/4}    {label="$\sin x \, e^{-x/4}$"}
y = e^{-x/4}           {.dashed}
x in [0, 4π]
y in [-1, 1]
```

```vega-lite
{
  "data": {"url": "rainfall.csv"},
  "mark": "bar",
  "encoding": {
    "x": {"field": "month", "type": "ordinal"},
    "y": {"field": "mm", "type": "quantitative"}
  }
}
```
````

or in a `:::use` block, one entry per line, which must come first in the note (after `:::meta` at most):

```html
<!doctype html><meta charset="utf-8"><script src="luccet.js"></script>

:::use
https://cdn.luccet.dev/themes/v1/nord.css
https://cdn.luccet.dev/plots/v1/plot.js
:::
```

- **From cdn.luccet.dev,** `v1/` is the newest 1.x release of the kit, checked for a newer one every hour; a release's own folder, such as `v1.0.0/`, never changes, and browsers keep it a year.
- **A copy of your own:** put `plot.js` or `vega-lite.js` beside your notes and list it by its path, `data-use="plot.js"`.
- **Options** for vega-lite.js go in its query string, `vega-lite.js?base=vend/vega`, or in `window.LUCCET = {use: {'vega-lite': {…}}}` in a head script ([options](https://luccet.dev/docs/schema.html#use-options)). plot.js has none: a plot's settings are in its fence.

How add-ons load, and how to write one: [Add-ons](https://luccet.dev/docs/schema.html#addons).

## Figures and ids

- **In a figure,** a plot or chart gets the figure's caption, its number where the vocabulary counts figures, and references ([figures](https://luccet.dev/docs/elements.html#figures)).
- **An id on the fence,** as in ```` ```plot {#id} ````, goes to the drawing, so links land on it; one that cannot be drawn gives it back to the fence, which stays with the error after it.
- **A titled fence** (```` ```plot[Title] ````) is a [listing](https://luccet.dev/docs/guide.html#listings), as for code. A figure usually reads better.

## Plots

### Lines

Each line of a `plot` fence is one thing to draw, a setting, or a definition. Blank lines are ignored, and a `#` at a line's start or after a space starts a comment.

| Line | Draws |
|---|---|
| `y = sin(x)`, or `sin(x)` alone | a function of x |
| `x = y^2` | a function of y |
| `y = x^2, x in [0, 2]` | a function over its own range (any line can end in one) |
| `x^2 + y^2 = 4`, `xy = 1` | an implicit curve, traced on a grid |
| `(cos t, sin t)` | a parametric curve, t in [0, 2π] unless given (`, t in [0, 1]`) |
| `r = 1 + cos θ` | a polar curve, θ in [0, 2π] unless given (`θ` or `theta`) |
| `y < x^2`, `y >= sin x`, `x <= y^2` | the region below, above or beside a curve; a strict bound (`<`, `>`) is dashed |
| `0 <= y <= cos x` | the region between two curves |
| `x^2 + y^2 < 4` | the region where an expression in x and y has a sign |
| `(1, 2)`, `(1, 2), (3, 4)` | points |
| `a = 2` | a constant, for any line above or below it |
| `f(x) = a x e^{-x}`, `g(u, v) = u v` | a function, used as `y = f(x)` |

A definition's name is one letter, with a subscript if need be (`a`, `k`, `a_1`, `v_{max}`), so `xy = 1` is a curve in x times y, not a definition. `x`, `y`, `t`, `r` and `θ` are the plot's own, as are `pi` (`π`), `tau` (`τ`) and `e`.

### Expressions

Write them as on a calculator, or in the TeX of the note's formulas, or both:

- **Arithmetic:** `+ - * /`, `^` (or `**`), `!`, `|x|`, and products implied by juxtaposition: `2x`, `2 pi x`, `x sin x`, `(x + 1)(x - 1)`. A word of known names is split into them: `sinx` is `sin x`, `2pix` is `2 π x`. `-x^2` is `-(x^2)`, and `2^3^2` is `2^(3^2)`.
- **Functions:** `sin cos tan sec csc cot`, `arcsin arccos arctan` (also `asin acos atan`, and `arctan(y, x)`), `sinh cosh tanh arsinh arcosh artanh`, `exp ln log` (`log x` is base 10, `log_2 x` and `log(b, x)` base b), `sqrt cbrt abs floor ceil round sign mod min max gamma`. A function takes parentheses or the product after it: `sin 2x` is `sin(2x)`, `sin x cos x` is `sin(x) cos(x)`. `sin^2 x` is `(sin x)^2`, and `sin^{-1} x` is `arcsin x`.
- **TeX:** `\frac{a}{b}` (and `\frac12`), `\sqrt{x}`, `\sqrt[3]{x}`, `x^{2}`, `{ }` as parentheses, `\left( \right)`, `\cdot \times \div`, `\le \ge \lt \gt`, `\pi \theta \tau`, `\sin \ln …`, `\operatorname{sinh}`, and `\, \; \quad` (ignored). Also `· × ÷ − ≤ ≥ π θ τ`.
- **Real roots:** an odd root of a negative number is real, so `x^(1/3)` and `\sqrt[3]{x}` are drawn for negative x too.

Expressions are evaluated by functions made from the tree, never compiled from text, so a page under a Content-Security-Policy needs nothing for them.

### Settings

Each on a line of its own:

- **`x in [a, b]`, `y in [a, b]`** the view. With only one, the other is set at the same scale, centred on 0; with neither, x is [-5, 5]. A range written with π (`x in [-2π, 2π]`) has its ticks in π.
- **`t in [a, b]`, `θ in [a, b]`** the parameters' range for every curve without its own.
- **`equal`** one unit as long on both axes, the plot's height following its ranges.
- **`height N`** the height, in the plot's units, out of a width of 640 (400 unless set).
- **`grid off`, `axes off`**, and **`xlabel "time"`, `ylabel "distance"`**.

### Attributes

After a line, in braces, as elsewhere in Luccet:

- **`label="…"`** puts the line in the legend under the plot, with `$…$` set as a formula (`label="$\sin x$"`); a point's label goes beside it.
- **`color=`** `1` to `6`, a colour of the [palette](#colours), or a CSS colour (`color=#d97706`, `color=teal`). Lines take the palette's colours in turn otherwise.
- **`width=3`**, **`.dashed`**, **`.dotted`**.

### How plots are drawn

- **SVG,** written whole by the add-on, its colours custom properties, so light, dark, a theme switched in, and print need no second drawing.
- **Curves** are sampled more finely where they bend, broken where they are undefined (`sqrt x` for x < 0) or jump (`tan x`, `1/x`), and given a budget, so `sin(1/x)` ends.
- **Implicit curves** are traced by marching squares on a 200-column grid, joined into lines; a sign change at a pole (`tan x = y`) is not drawn as a curve.
- **Accessibility:** the plot is an image whose label lists its lines (`role="img"`).
- **`luccet.plot(source)`** returns `{svg, legend, label}`, or `{error: {message, line}}`, for a page script that draws a plot elsewhere.

## Charts

### Vega-Lite and Vega

A `vega-lite` fence holds a Vega-Lite specification, as in the [Vega-Lite editor](https://vega.github.io/editor/), without `$schema` if you like. A `vega` fence holds a full [Vega](https://vega.github.io/vega/) specification, for what Vega-Lite does not do. Data comes inline (`"values"`), from a file beside the note (`"url": "data.csv"`), or from a sequence or generator; CSV, TSV, JSON and TopoJSON are read.

On screen the chart is Vega's own, so tooltips (`"tooltip"`), hover and selections (`"params"`) work. Width `"container"` fills the column.

### Chart colours

The theme's colours go in as the chart's configuration, beneath the specification's own `config`, which wins:

- **Text, axes, grid lines, legends:** titles in `--t-fg`, labels in `--t-muted`, grid lines and the view's frame in `--t-line`, the font `--t-sans`.
- **Marks:** a chart of one series in the palette's first colour, a category scale in its six (`range.category`). A specification's own `"color"` or `"scheme"` wins.
- **Light, dark and print.** Vega writes the colours into the chart, so it is drawn again when the reader switches between light and dark, or when a page script switches the theme and says so (`window.dispatchEvent(new Event('luccet:theme'))`). A copy in print colours, dark on white, is the one printed.
- A `vega` fence takes the axis, legend, title and category colours; its marks are its own.

### Links and the policy

- **Links** in a chart (`"href"`) and images (`"url"`) are followed for `http`, `https`, `mailto` and paths only.
- **No eval.** Vega compiles its expressions with `new Function`, which a Content-Security-Policy refuses without `'unsafe-eval'`. vega-lite.js carries Vega's own interpreter instead ([`vega-interpreter`](https://github.com/vega/vega/tree/main/packages/vega-interpreter)), and reads CSV and TSV with a reader of its own rather than d3's, which compiles one too. So a strict policy needs only `script-src` for jsDelivr (or your copy's origin), and `connect-src` for the data's.

### How Vega loads

Vega (`vega.min.js`, about 180 KB compressed) and Vega-Lite (`vega-lite.min.js`, about 80 KB) come from jsDelivr, pinned to one version each with [SRI](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity), and only to a page with a chart; Vega-Lite only to one with a `vega-lite` fence. `?base=URL` names a copy instead: the folder of both files, loaded without SRI, which [`tools/vendor.js`](#local-copies) writes. A `window.vega` and `window.vegaLite` already on the page are used as they are. One that fails to load leaves the charts as their source, with a warning in the console, and is asked for again when the note is rendered again.

## Colours

The six colours both add-ons draw series in are, for each `N` from 1 to 6, a theme's `--t-plot-N` where it sets one, else its link and code colours (`--t-link`, `--t-code-number`, `--t-code-string`, `--t-code-keyword`, `--t-code-type`, `--t-code-deleted`, which every [Luccet theme](https://github.com/Luccet/themes) sets), else the kit's own, a set for light and one for dark. Print has a set of its own, readable on white. A theme can set `--t-plot-1` … `--t-plot-6` for plots and charts of its own colours.

## Local copies

```sh
node tools/vendor.js vend
```

writes `vend/vega/vega.min.js` and `vend/vega/vega-lite.min.js` at the versions vega-lite.js pins, checked against the npm registry's hashes; load them with `vega-lite.js?base=vend/vega`. plot.js needs no copy.

## Newer versions

`node tools/vega.js VEGA VEGA_LITE INTERPRETER` (`node tools/vega.js 6.4.0 6.5.0 2.3.2`) rewrites the table in vega-lite.js: the versions, the SRI hashes, and the interpreter it carries. `--check` says whether the table is what its versions give.

## Tests

```sh
npm install && npx playwright install chromium firefox
LUCCET_ROOT=../luccet npm test
```

`test/plot/` and `test/vega-lite/` each have Node tests (`node.js`) and browser tests in Chromium and Firefox (`browser.js`), against an engine checkout (`LUCCET_ROOT`, else `../luccet`). Vega comes from a local copy of the npm package, so runs are the same each time and work offline after the first.

## License

MIT, for the add-ons and the tools. Vega and Vega-Lite are © the University of Washington Interactive Data Lab, under the [BSD 3-Clause licence](https://github.com/vega/vega/blob/main/LICENSE); vega-lite.js carries vega-interpreter's code, under the same licence, its notice beside it.
