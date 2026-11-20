# Lines tool

`site/js/tools/lines.js`, id `lines`. Plane of 15 × 10 notebook squares (x right, y UP, unit = one square). Stand: `demo.html?tool=lines`. Colours only from `css/tokens.css`. `reducedMotion` respected.

## Params
| Field | Meaning |
|---|---|
| `points` | `[{id, label?, at:[x,y], pos?: ne/nw/se/sw/n/s/e/w}]` |
| `segments` | `[{id?, from, to, label?}]` (from/to: `[x,y]` or point id) |
| `polygons` | `[{points:[...], labels:["A","B","C"]}]`; sides get ids `AB`, `BC`, `CA` |
| `lines` | `{id, label?, from, to}` or `{id, through, parallelTo \| perpendicularTo \| dir \| angle}`; `segment:true` finite; `extend:true` continued dashed at step `extend`; `ref:true` not selectable; `color` ink/blue/orange/green; `labelAt` 0..1; `labelSide` ±1 |
| `marks` | `{kind:"right", lines:[a,b], flip?, degrees?}` or `{kind:"parallel", lines:[a,b], count?}` |
| `highlight` | line ids shown orange at step `highlight` |
| `choose` | line ids selectable in `answer` (default: all except `ref`) |
| `construct` | `{base, through: id or [ids], new:[labels], free?, maxLines?, flip?, triangle?:{a,b}}` set square + ruler |
| `steps` | `frame`, `lines`, `line_each`, `marks`, `highlight`, `extend`, `all`, and for `construct`: `triangle`, `ruler`, `slide`, `draw`, `mark` (default for construct: frame, triangle, ruler, slide, draw, mark) |
| `grid`, `title` | grid on/off; accessible name |

Task pictures use `"steps": ["all"]` (everything at step 0). Example: `{"lines":[{"id":"m","from":[1,2],"to":[14,3.3]}],"points":[{"id":"M","at":[9,7]}],"construct":{"base":"m","through":"M","new":["n"]}}`.

## Modes
- `show`: `setStep(n)` by the step list; last construct step shows `m ∥ n`.
- `explore` + `construct`: drag the square along the ruler (mouse, finger, arrows, Home/End); its edge sticks to a point within 0.24 squares; "Draw the line" draws a line exactly parallel to `base`. Without `construct`: click lines to mark them.
- `answer`: click (or Tab + Enter/Space) lines; "Use this answer".

## State
`answer`: `{type:"set", value:[labels of chosen lines]}`. `explore`: `{offset, snapped, lines:[{label, through, parallelTo}]}` or `{value}`. `show`: `{step, lines}`. Events: `ready`, `step`, `changed`, `done` (all points got a line).

## Answering in a lesson task (20.11.2026)
`"tool_mode": "answer"`: the lesson screen mounts `answer`, the student clicks the lines and presses `> check` (the tool's own "Use this answer" is hidden); the answer is `getState().value`. The line the question is about (the one the others are compared with) gets `"ref": true`: it is drawn but cannot be chosen. `choose` does the same from the other side.
