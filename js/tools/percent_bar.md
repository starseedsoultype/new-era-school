# Percent bar tool

Load `./percent_bar.js` as an ES module. The default export has `id: "percent_bar"` and implements `mount(el, params, api)` from section 6 of CONTRACTS.md. The host loads `site/css/tokens.css` and supplies the mount element. No outside images, no emoji.

The picture: one bar is **the old price, 100%**. The bar is cut into equal parts (10%, 25%, …). A discount shades some parts and cuts them off, a markup adds a new piece after the bar, so the bar becomes longer than 100%. Percents are written above the bar, money (coins) below it. Brackets show what a piece is worth: the inner row for the pieces (kept part, cut part, added piece), the outer row for the whole old price. Next to the bar (or under it on a narrow screen) stands a **price tag** with three rows: Was, Discount (скидка) or Markup (наценка), Now. The picture is an SVG with a fixed `viewBox`; below about 560 px it is redrawn in a narrower layout with fewer tick labels. The same `params` always give the same picture.

Two questions, set by `ask`:
- `after` (default): the old price is known, find the new one. The bar is the old price from the start.
- `before` (the reverse task): the price **now** is known, find the old one. The old price is drawn as a dashed empty frame, 100%, with a "?" under it. The known price is a solid piece of the bar: for a discount it is 80%, not 100%.

## Parameters

| Field | Accepted values | Meaning |
| --- | --- | --- |
| `base` | number or string `"80"` (more than 0) | `ask: "after"`: the old price, the whole bar |
| `given` | number or string (more than 0, not equal to `base`) | `ask: "after"` without `change`: the task gives two prices and asks **by how many percent** one differs from the other. `given` is the other price (for example `base: 240, given: 204`). The change is worked out inside the tool and shown only at the last step (`?` until then); the dashed line in `explore` marks where `given` lies |
| `known` | number or string (more than 0) | `ask: "before"`: the price now (after the change). The old price is computed inside the tool and shown only at the `result` step. Task params do not carry the answer |
| `ask` | `"after"` (default), `"before"` | See above |
| `change` | `{ "kind": "discount" \| "markup", "percent": number }` | The change. Required for `ask: "before"`. With `ask: "after"` it is optional: without it (and without `given`) `show` draws only the whole bar and the price tag shows Was (the picture of a plain task), `explore` lets the student find the change. A discount is less than 100, a markup at most 300 |
| `parts` | whole number 2 to 20 | Number of equal parts of 100%. Default: 10 when `percent` is a multiple of 10 (or there is no change), else 4 for multiples of 25, else 20 for multiples of 5, else 10. For a task whose percent is odd, pass `parts: 20` or `snap: 1` so the handle can reach it |
| `unit` | string, default `"coins"` | Written after every money value; `""` for none |
| `item` | string, default `"Price"` | Title of the price tag, for example `"Block set"` |
| `showTag` | `true` (default) / `false` | Show the price tag |
| `steps` | array of step names, see below | Show steps. Default depends on `ask` |
| `max` | number | `explore`/`answer`: the right end of the scale in percent. Default 150 (or more if the result is larger) |
| `snap` | number from 0 to 100 | `explore`/`answer`: the handle moves in steps of this many percent. Default is the size of one part |
| `start` | number | `explore`/`answer`: where the handle starts, in percent. Default 100, for `ask: "before"` the known price (for example 80) |
| `title` | string | Accessible name of the picture (`show`) |

Numbers: money values are shown with a decimal point and a space between thousands (`1 182`). Percents are shown without a trailing `.0`.

Examples:

```json
{ "base": 80, "unit": "coins", "item": "Block set", "change": { "kind": "discount", "percent": 20 } }
```
```json
{ "base": 120, "item": "Upgrade", "change": { "kind": "markup", "percent": 25 } }
```
The reverse task (the price now is 80 after a 20% discount; find the old price):
```json
{ "ask": "before", "known": 80, "change": { "kind": "discount", "percent": 20 } }
```
Two prices given, find the percent (nothing about the percent is drawn until the last step):
```json
{ "base": 240, "given": 204, "unit": "coins", "parts": 20 }
```
Explore with no change set (the student drags the edge and meets both discounts and markups):
```json
{ "base": 60, "unit": "coins", "item": "Cap" }
```

Two changes in a row are not drawn in one picture: show them as two pictures, the second `base` being the price after the first change.

## Show steps

`steps` lists names, played in order; `setStep(n)` shows the state after the n-th step (0 is the first). Defaults: `after` is `bar`, `divide`, `change`, `result` (`bar`, `divide` when there is no change at all); `before` is `bar`, `divide`, `change`, `known`, `one_part`, `result`. Steps are cumulative: a step keeps what the earlier ones showed.

| Name | What it shows |
| --- | --- |
| `bar` | The whole bar is the old price, 100% (`before`: the dashed frame with "?"). The tag shows Was |
| `divide` | Ticks with percents above and money below; the dividers appear and (`after`) every part shows its coins |
| `change` | Discount: the discount parts turn orange and hatched, a bracket "−20%" appears. Markup: a green piece grows after the bar, a bracket "+25%" appears. The tag shows the change row |
| `known` | `before` only: the solid piece is outlined and bracketed with the known price: "80% = 80 coins" |
| `one_part` | `before` only: every part of the known piece shows its coins (known price ÷ number of parts) |
| `result` | `after`: the new price is outlined and bracketed (80% / 64 coins); the tag shows Now. `before`: the "?" becomes the old price, the hatched parts show their coins, the tag shows Was |

Forward steps by one animate (the colour change, the growing piece, the fading brackets); jumps and backward steps are shown at once. With `api.reducedMotion` or the system setting, nothing animates. The status line (`role="status"`) is in the page for screen readers only in `show`; it describes each step in words.

## Explore and answer

The bar has a handle on its right edge. The student moves it:
- drag with a mouse or a finger (pressing anywhere on the bar moves the handle there);
- or with the keyboard: Tab to the handle (it is a slider), Left/Down and Right/Up move it by one step, PageUp/PageDown by one part, Home and End to the ends;
- or with the buttons **− Less**, **More +** and **Start again** under the picture.

`ask: "after"`: the bar is the old price (100%); with `given` the student drags the edge to the dashed line and reads the percent from the price tag; dragging the edge left shows a discount (the cut piece is hatched), dragging it right shows a markup (a green piece). The bracket and the tag show the percent and the price at the handle. `ask: "before"`: the known price is the solid piece (for example 80 coins = 80%); the handle sets how long the whole dashed bar is, and the tag shows what the old price would be; the row turns green when the whole bar is exactly 100%.

Under the picture a visible line says in words what the bar shows.

## State and events

- `show`: `getState()` returns `{ "step", "name", "percent", "value" }`: the current step, its name, the result in percent (80 or 125) and the result price as a string; `value` is `null` for `ask: "before"` until the `result` step.
- `explore`: `{ "percent", "change", "value" }`: where the handle is (for example 80), how far from 100 (−20), and the price there as a string.
- `answer`: `{ "type": "int" | "decimal", "value": "64" }`: the price at the handle, in the answer format of section 3. The student presses **Use this answer**.
- Events: `ready` and `step` carry `{ step, steps }` (`steps` is the number of show states, `setStep` runs from 0 to `steps - 1`). `changed` carries the state after every move or **Start again**. `done` carries the answer after **Use this answer**.
- `setParams(params)` resets progress and emits `ready`. `destroy()` removes the instance, its observer and its listeners.
- Wrong `params` throw a `TypeError` with a plain message (missing `change`, `base` or `known` not a positive number, a discount of 100% or more, an unknown step name).

## Run the demo

From the archive root, run `python3 -m http.server 8000` and open `http://localhost:8000/site/js/tools/demo.html?tool=percent_bar`. The example list has a discount, a markup, a 15% discount in 20 parts, a 50% discount in 2 parts, the two reverse tasks and two explore examples. Pick **Show**, **Explore** or **Answer**.
