# Column arithmetic tool

Load `./column.js` as an ES module. The default export has `id: "column"` and implements `mount(el, params, api)` from section 6 of CONTRACTS.md. The host loads `site/css/tokens.css` and supplies the mount element.

## Parameters

| Field | Accepted values | Example |
| --- | --- | --- |
| `op` | `add`, `sub`, `mul` | `"mul"` |
| `numbers` | Two non-negative decimal strings with digits on both sides of an optional point | `["12.5", "6"]` |

For example, `{ "op": "sub", "numbers": ["503", "267"] }`. Input data uses a point and contiguous digits. The answer field also accepts a comma and spaces between digits. Subtraction can produce a signed result. The English interface uses a decimal point and spaces between groups of three whole-number digits. Wide problems scroll horizontally within the SVG viewport container.

## Modes and steps

- `show`: call `setStep(0)` for the starting layout, then increment the step to show each action. Calls clamp to the available range. Sequential forward steps animate. Jumps and backward steps show the requested state directly.
- `explore`: drag a digit or a highlighted carry or borrow token into the outlined cell. Alternatively, click the token and the cell, or activate each with Enter or Space. A wrong digit leaves the step available for retry. Continue buttons advance steps that describe a layout change.
- `answer`: assemble the number with the digit buttons or type it into the answer field. Use **Use this answer** to finish the entry. The host submits the value for server-side checking.

Addition aligns place values and alternates writing digits with transfers when a column reaches ten. Subtraction shows each individual loan, including each hop through a zero. If the first operand is smaller, a step swaps the operands for the calculation and a final step places the minus sign. Multiplication forms one shifted partial product per multiplier digit, adds the rows if needed, and finally places the decimal point using the combined fractional length of the operands.

## State and events

- In `answer`, `getState()` returns `null` until the input is a complete number. It then returns the section 3 answer shape, for example `{ "type": "decimal", "value": "75.0" }`. Fractional problems and entries with a point use `decimal`. Whole-number entries on integer problems use `int`.
- In `show` and `explore`, `getState()` returns `{ step, rows }`. Each row has `digits` ordered right to left and `scale` for decimal places. Optional `sign`, `line`, and `operator` describe the layout. Row 0 contains carry marks. A temporarily regrouped subtraction cell can contain a value greater than 9.
- `ready` and `step` carry `{ step, steps }`, where `steps` counts states including step zero. `changed` carries the current state after a successful explore action or an answer edit. `done` carries the completed explore state or the submitted answer entry.
- `setParams(params)` resets progress and emits `ready`. `setStep(n)` applies to `show`. `destroy()` removes the mounted instance and its listeners. The module honors `api.reducedMotion` and the operating system preference.

## Run the demo

From the archive root, run `python3 -m http.server 8000` and open `http://localhost:8000/site/js/tools/demo.html?tool=column`. Select an example and mode. The expandable **Tool events and state** panel shows the values exchanged with the host. Each future tool can register a module loader and examples in the same demo.
