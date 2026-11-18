# Sets tool

Load `./sets.js` as an ES module. The default export has `id: "sets"` and implements `mount(el, params, api)` from section 6 of CONTRACTS.md. The host loads `site/css/tokens.css` (it also holds the `--school-icon-*` colours for the pictures; without them the tool falls back to other tokens) and supplies the mount element.

The tool draws sets as ovals with a name tab on the outline. Elements are numbers, letters, or flat pictures drawn inside the tool: no emoji, no outside images. The picture is an SVG with a fixed `viewBox`; it scales to the container (320 to 1200 px, drawn at most 760 px wide). Below 520 px the ovals are redrawn in a tall layout so that the pictures stay readable. The same `params` always give the same picture at the same width.

## Parameters

| Field | Accepted values | Meaning |
| --- | --- | --- |
| `layout` | `single`, `subset`, `overlap`, `empty` | One oval · a small oval inside a big one · two crossing ovals · one empty (dashed) oval |
| `sets` | Array of `{ id?, label }`; 1 for `single`/`empty`, 2 for `subset` (outer first, inner second) and `overlap` (left, right) | Ovals and their name tabs. `id` defaults to `A`, `B` |
| `items` | Array of items (below) | Elements. `empty` takes none |
| `select` | Array of item `id`s or values | `subset` only: the elements that belong to the small oval |
| `steps` | Array of step names (below) | Show steps. Default depends on the layout |
| `shade` | `inner`, `intersection`, `A`, `B`, `union`, `all` | What the last `shade` step highlights. Defaults: `inner` for `subset`, `intersection` for `overlap`, `all` otherwise |
| `answerRegions` | Array of region names | Which regions `getState()` collects in `explore` and `answer`. Defaults: `["inner"]` for `subset`, `["both"]` for `overlap`, `["A"]` for `single` |
| `symbol` | `true`/`false` | `empty` layout: draw ∅ in the oval at the shade step (default `true`) |
| `title` | string | Accessible name of the picture |

**Item fields.** `kind`: `text` (default; shows `text`), furniture `table` `chair` `bed` `wardrobe` `lamp`, mushrooms `porcini` (white mushroom) `amanita` (fly agaric) `chanterelle`, fruit `apple` `pear` `plum`, a house `house` (see below), figures `triangle` `square` `circle` `quad` (an irregular quadrilateral). Also: `roof` (`house` only: `metal`, `tile` or `slate`; default `metal`), `id` (default `i0`, `i1`, …), `text` (required for `text`; on a figure it is written on the picture), `label` (caption under the picture; defaults to the English name, for figures to e.g. `dark triangle`; long names wrap onto two lines), `color` (`dark` or `light`, figures only), `value` (what `getState` returns for this element; defaults to `text`, else `label`, else the name), `in` (names of the sets the element belongs to; for `subset` the `select` list is the shortcut; for `overlap` give `["A"]`, `["B"]` or both ids), `start` (region where the element starts in `explore`/`answer`).

**House.** `{ "kind": "house", "roof": "tile" }` draws a small house with a door and two windows. The roof tells the houses apart at a glance: `metal` is smooth and steel-blue with straight seams, `tile` is warm red-brown with rows of tiles, `slate` is grey and wavy. The caption defaults to `metal roof`, `tile roof` or `slate roof`; `value` defaults to the caption. Colours come from `--school-icon-steel`, `--school-icon-tile`, `--school-icon-slate` in `css/tokens.css` (fallbacks: `--school-active`, `--school-icon-red`, `--school-muted`). Three classes of houses are shown one class at a time: a `subset` picture per class (`select` the houses of that class, `steps: ["items", "move"]`), because the tool draws at most two ovals.

**Regions.** `single` and `empty`: `A`. `subset`: `outer` (inside the big oval, outside the small one), `inner`. `overlap`: `A` (left only), `both`, `B` (right only).

Example, the chairs of a room:

```json
{ "layout": "subset", "sets": [{ "label": "Furniture" }, { "label": "Chairs" }],
  "items": [{ "kind": "table" }, { "kind": "chair", "id": "c1" }, { "kind": "bed" }, { "kind": "chair", "id": "c2" }],
  "select": ["c1", "c2"] }
```

Multiples of 5, checked one by one (numbers are text tiles; `value` is what the answer holds):

```json
{ "layout": "subset", "sets": [{ "label": "{12, 15, 20}" }, { "label": "multiples of 5" }],
  "items": [{ "text": "12" }, { "text": "15" }, { "text": "20" }], "select": ["15", "20"],
  "steps": ["items", "check_each", "shade"] }
```

Houses of a village, the metal roofs moving into their own oval:

```json
{ "layout": "subset", "sets": [{ "label": "Village houses" }, { "label": "Metal roofs" }],
  "items": [{ "kind": "house", "roof": "metal", "id": "h1" }, { "kind": "house", "roof": "tile", "id": "h2" },
    { "kind": "house", "roof": "slate", "id": "h3" }, { "kind": "house", "roof": "metal", "id": "h4" }],
  "select": ["h1", "h4"], "steps": ["items", "move"] }
```

A task picture (no answer inside the params; the picture only shows the elements):

```json
{ "layout": "subset", "sets": [{ "label": "Figures" }, { "label": "Dark figures" }],
  "items": [{ "kind": "triangle", "label": "A" }, { "kind": "triangle", "color": "dark", "label": "B" }],
  "steps": ["items"] }
```

Two crossing ovals:

```json
{ "layout": "overlap", "sets": [{ "id": "A", "label": "multiples of 2" }, { "id": "B", "label": "multiples of 3" }],
  "items": [{ "text": "4", "in": ["A"] }, { "text": "6", "in": ["A", "B"] }, { "text": "9", "in": ["B"] }] }
```

Do not put the answer of a task into `select` or `in`: task `tool_params` are public. In explain and worked examples the answer is not a secret.

## Show steps

`steps` lists names, played in order; `setStep(n)` shows the state after the n-th step (0 is the first). Defaults: `single` is `frame`, `items`; `empty` is `frame`, `shade`; `subset` and `overlap` are `frame`, `items`, `move`, `shade`.

| Name | What it shows |
| --- | --- |
| `frame` | Only the ovals with their names |
| `items` | All elements appear. In `subset` they all sit in the big oval; in `overlap` they sit where `in` says |
| `items_placed` | Elements appear already in their final regions |
| `move` | One step: all `select`ed elements move into the small oval |
| `move_each` | One step per selected element, in item order |
| `check_each` | One step per element, in item order: a dashed frame marks the element being checked; a selected one gets a green tick and moves into the small oval, another gets an orange cross and stays |
| `shade` | The part named by `shade` is coloured, the elements outside it fade. For `empty` the ∅ sign appears |

Forward steps by one animate (elements fade in or glide). Jumps and backward steps show the state directly. With `api.reducedMotion` or the system setting, nothing animates. The status line is in the page for screen readers only in `show`, and it never uses the words "set" or "subset", so a lesson can introduce them in its own text.

## Explore and answer

All elements start in `start` (default: the big oval; for `overlap` the left oval). The student moves them:
- drag with a mouse or a finger and drop inside an oval;
- or click an element to select it, then press the button under the picture ("Into …", "Back to …") or click inside an oval;
- or with the keyboard: Tab to an element, Enter or Space selects it, an arrow key moves it to the next region (Left/Up back, Right/Down forward), Escape deselects.

Under the picture: the region buttons, **Start again**, and in `answer` also **Use this answer**. `explore` and `answer` ignore `setStep` and `steps`. The icons shrink (down to half size) when the regions must hold many elements; keep to six or seven elements in an interactive picture.

## State and events

- `answer`: `getState()` returns `{ "type": "set", "value": [...] }`: the `value`s of the elements in `answerRegions`, in item order; `[]` when nothing was moved. This is the answer format `set` of section 3.
- `explore`: `{ "regions": { "outer": [...], "inner": [...] }, "value": [...] }`.
- `show`: `{ "step": n, "regions": { ... } }` with the elements visible at that step.
- Events: `ready` and `step` carry `{ step, steps }` (`steps` is the number of show states: one per entry of `steps`, so `setStep` runs from 0 to `steps - 1`). `changed` carries the state after each move or **Start again**. `done` carries the answer after **Use this answer**.
- `setParams(params)` resets progress and emits `ready`. `destroy()` removes the instance, its observer and its listeners.

## Run the demo

From the archive root, run `python3 -m http.server 8000` and open `http://localhost:8000/site/js/tools/demo.html?tool=sets`. The example list has furniture, mushrooms, fruit, village houses with three kinds of roofs, multiples of 5, the figures of the book, a whole set, an empty oval and two crossing ovals. Pick **Show**, **Explore** or **Answer**.
