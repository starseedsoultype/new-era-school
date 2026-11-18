const SVG = 'http://www.w3.org/2000/svg';
const LAYOUTS = ['single', 'subset', 'overlap', 'empty'];
const INSET = 18;   // items keep this far inside an oval (room for the outline and the label)
const GAP = 14;     // items keep this far outside a neighbouring oval
let uid = 0;

// ---------- icons ----------
// One system: a 24 x 24 grid (drawn around 12, 12 and scaled), one line weight, round caps and joins,
// soft fills from css/tokens.css. Every picture is as plain as it can be and still reads at a glance.
const tone = (name, fallback) => 'var(--school-icon-' + name + ', var(' + fallback + '))';
const C = {
  line: tone('line', '--school-ink'), red: tone('red', '--school-transfer-bg'),
  green: tone('green', '--school-ok-bg'), yellow: tone('yellow', '--school-note-bg'),
  purple: tone('purple', '--school-active'), brown: tone('brown', '--school-note-bg'),
  wood: tone('wood', '--school-note-bg'), orange: tone('orange', '--school-transfer-bg'),
  steel: tone('steel', '--school-active'), tile: tone('tile', '--school-icon-red'),
  slate: tone('slate', '--school-muted'),
  ink: 'var(--school-ink)', white: 'var(--school-surface)'
};
const O = 'stroke="' + C.line + '" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"';
const f = (fill, extra = '') => 'fill="' + fill + '" ' + O + ' ' + extra;
const rect = (x, y, w, h, r, fill) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" ' + f(fill) + '/>';
const path = (d, fill) => '<path d="' + d + '" ' + f(fill) + '/>';
const line = d => '<path d="' + d + '" fill="none" ' + O + '/>';
const dot = (x, y, r, fill) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"/>';
const leaf = (d, fill) => path(d, fill);

const ICONS = {
  table: { caption: 'table', draw: () => rect(2.5, 7.5, 19, 3.4, 1.7, C.wood) + line('M6 10.9V20M18 10.9V20') },
  chair: { caption: 'chair', draw: () => rect(6.5, 2.5, 11, 8, 3.2, C.wood) + rect(4.5, 11, 15, 3.6, 1.8, C.wood)
    + line('M7 14.7V21M17 14.7V21') },
  bed: { caption: 'bed', draw: () => rect(2.5, 4.5, 3, 14.5, 1.5, C.brown) + rect(2.5, 11.5, 19, 5.5, 2.2, C.red)
    + rect(5.8, 8.2, 6.2, 3.4, 1.7, C.white) + line('M3.8 17v3.5M20.2 17v3.5') },
  wardrobe: { caption: 'wardrobe', draw: () => rect(4.5, 2.5, 15, 17, 2.8, C.wood) + line('M12 3v16')
    + dot(9.6, 11.5, 1, C.line) + dot(14.4, 11.5, 1, C.line) + line('M7.5 20v1.5M16.5 20v1.5') },
  lamp: { caption: 'lamp', draw: () => path('M7 11.5 L9 3.8 Q9.2 3.2 9.8 3.2 H14.2 Q14.8 3.2 15 3.8 L17 11.5 Z', C.yellow)
    + line('M12 11.5V18') + rect(8, 18, 8, 3, 1.5, C.wood) },
  porcini: { caption: 'white mushroom', draw: () =>
    path('M9.2 12 C9 15.5 8.6 18 8.6 20 Q8.6 21 9.6 21 H14.4 Q15.4 21 15.4 20 C15.4 18 15 15.5 14.8 12 Z', C.white)
    + path('M3 12 C3 6.8 7.2 3.2 12 3.2 C16.8 3.2 21 6.8 21 12 Z', C.brown) },
  amanita: { caption: 'fly agaric', draw: () =>
    path('M9.4 12 L9 20 Q9 21 10 21 H14 Q15 21 15 20 L14.6 12 Z', C.white)
    + path('M3 12 C3 6.8 7.2 3.2 12 3.2 C16.8 3.2 21 6.8 21 12 Z', C.red)
    + dot(8, 8.6, 1.5, C.white) + dot(13.4, 6.6, 1.7, C.white) + dot(17, 9.6, 1.3, C.white) },
  chanterelle: { caption: 'chanterelle', draw: () =>
    path('M3 9.2 C3 7.4 6.5 6.4 12 6.4 C17.5 6.4 21 7.4 21 9.2 C21 10.6 16.4 11.8 14.8 14 C14 15.4 14.8 18 14.6 20 Q14.5 21 13.6 21 H10.4 Q9.5 21 9.4 20 C9.2 18 10 15.4 9.2 14 C7.6 11.8 3 10.6 3 9.2 Z', C.orange)
    + line('M8.6 9.4 L10.6 13M12 9.6V14M15.4 9.4 L13.4 13') },
  apple: { caption: 'apple', draw: () =>
    path('M12 7.6 C10.6 6.4 8.4 6.2 6.8 7.4 C4.8 8.9 4.4 12.2 5.6 15.4 C6.6 18.2 8.4 20.8 10.2 20.8 C11 20.8 11.4 20.4 12 20.4 C12.6 20.4 13 20.8 13.8 20.8 C15.6 20.8 17.4 18.2 18.4 15.4 C19.6 12.2 19.2 8.9 17.2 7.4 C15.6 6.2 13.4 6.4 12 7.6 Z', C.red)
    + line('M12 7.6 C12 5.8 12.7 4.4 13.8 3.4') + leaf('M13 5.6 C13.4 3.8 15.6 3 17.4 3.6 C17.2 5.4 15.2 6.4 13 5.6 Z', C.green) },
  pear: { caption: 'pear', draw: () =>
    path('M12 4 C13.6 4 14.4 5.8 14.7 7.6 C15 9.6 18.8 11 18.8 15.6 C18.8 19.2 15.8 21 12 21 C8.2 21 5.2 19.2 5.2 15.6 C5.2 11 9 9.6 9.3 7.6 C9.6 5.8 10.4 4 12 4 Z', C.green)
    + line('M12 4 C12 3.4 12.2 3 12.6 2.6') + leaf('M13.4 5 C14 3.6 16 3.2 17.4 3.8 C17 5.4 15.2 6 13.4 5 Z', C.yellow) },
  plum: { caption: 'plum', draw: () =>
    '<circle cx="12" cy="13" r="7.6" ' + f(C.purple) + '/>' + line('M12 5.6 C10.2 9 10.2 16.4 12 20.4')
    + line('M12 5.6 C12.2 4.4 12.8 3.6 13.6 3') + leaf('M13.4 5 C14 3.6 16 3.2 17.4 3.8 C17 5.4 15.2 6 13.4 5 Z', C.green) },
  triangle: { shape: true, draw: dark => '<path d="M12 4.2 L20.4 19 H3.6 Z" ' + f(dark ? C.ink : C.white, dark ? 'stroke-width="2.6"' : '') + '/>' },
  square: { shape: true, draw: dark => '<rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3.2" ' + f(dark ? C.ink : C.white, dark ? 'stroke-width="2.6"' : '') + '/>' },
  circle: { shape: true, draw: dark => '<circle cx="12" cy="12" r="8.2" ' + f(dark ? C.ink : C.white) + '/>' },
  quad: { shape: true, draw: dark => '<path d="M3.8 16.6 L7.6 5.6 L19.8 5 L21 17 Z" ' + f(dark ? C.ink : C.white, dark ? 'stroke-width="2.6"' : '') + '/>' }
};

// A house: walls, a door, a window and a gable roof. Three roofs, told apart at a glance by colour AND texture:
// metal is smooth steel-blue with straight seams, tile is warm red-brown with rows of scales, slate is grey and wavy.
const ROOFS = { metal: 'metal roof', tile: 'tile roof', slate: 'slate roof' };
const ROOF_SHAPE = 'M1.8 12.8 L12 2.4 L22.2 12.8 Z';
// Texture lines are thinner than the outline so that they stay readable when the picture is small.
const fine = d => '<path d="' + d + '" fill="none" stroke="' + C.line + '" stroke-width="0.9" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round"/>';
const roofDraw = roof => {
  if (roof === 'tile') {
    return path(ROOF_SHAPE, C.tile) + fine('M8.2 6.2H15.8M6 8.4H18M3.8 10.6H20.2M10 6.2V8.4M14 6.2V8.4M8 8.4V10.6M12 8.4V10.6M16 8.4V10.6'
      + 'M6 10.6V12.5M10 10.6V12.5M14 10.6V12.5M18 10.6V12.5');
  }
  if (roof === 'slate') {
    const waves = (y, x0, n) => 'M' + x0 + ' ' + y + ' q1.2 -1.8 2.4 0' + ' t2.4 0'.repeat(n - 1);
    return path(ROOF_SHAPE, C.slate) + fine(waves(6.6, 8.4, 3) + waves(9, 6, 5) + waves(11.4, 3.6, 7));
  }
  return path(ROOF_SHAPE, C.steel) + fine('M12 3.4V12.4M8 6.6V12.4M16 6.6V12.4');
};
ICONS.house = { caption: 'house', roofs: ROOFS,
  draw: (dark, item) => rect(4.5, 12.4, 15, 8.8, 1.6, C.white) + rect(10.2, 15.4, 3.6, 5.8, 1.3, C.wood)
    + rect(6.2, 14.4, 2.8, 2.6, 0.8, C.yellow) + rect(15, 14.4, 2.8, 2.6, 0.8, C.yellow)
    + roofDraw(item && item.roof) };

function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// ---------- parameters ----------
function normalize(params, mode) {
  if (!params || typeof params !== 'object') throw new TypeError('Pass an object with layout, sets and items.');
  const layout = params.layout ?? 'single';
  if (!LAYOUTS.includes(layout)) throw new TypeError('layout must be single, subset, overlap or empty.');
  const need = layout === 'subset' || layout === 'overlap' ? 2 : 1;
  const given = Array.isArray(params.sets) ? params.sets : [];
  if (given.length < need) throw new TypeError('The ' + layout + ' layout needs ' + need + ' set(s) in "sets".');
  const sets = given.slice(0, need).map((set, k) => ({
    id: String(set.id ?? 'ABCD'[k]), label: String(set.label ?? '')
  }));
  const rawItems = Array.isArray(params.items) ? params.items : [];
  if (layout === 'empty' && rawItems.length) throw new TypeError('The empty layout has no items.');
  const selectKeys = (params.select ?? []).map(String);
  const items = rawItems.map((raw, k) => {
    const kind = raw.kind ?? 'text';
    if (kind !== 'text' && !ICONS[kind]) throw new TypeError('Unknown kind "' + kind + '".');
    const color = raw.color === 'dark' ? 'dark' : 'light';
    const def = ICONS[kind];
    const text = raw.text == null ? null : String(raw.text);
    if (kind === 'text' && text === null) throw new TypeError('A text item needs "text".');
    const roof = kind === 'house' ? String(raw.roof ?? 'metal') : null;
    if (roof !== null && !ROOFS[roof]) throw new TypeError('roof must be metal, tile or slate.');
    const label = raw.label != null ? String(raw.label)
      : roof ? ROOFS[roof]
      : def?.shape ? (color === 'dark' ? 'dark ' : 'light ') + (kind === 'quad' ? 'quadrilateral' : kind)
        : def ? def.caption : null;
    return {
      id: String(raw.id ?? 'i' + k), kind, color, text, label, roof,
      value: String(raw.value ?? (kind === 'text' ? text : raw.label ?? (roof ? ROOFS[roof] : def.caption) ?? kind)),
      in: raw.in, start: raw.start
    };
  });
  const regionFor = membership => {
    if (layout === 'subset') return membership.includes(sets[1].id) ? 'inner' : 'outer';
    if (layout === 'overlap') {
      const a = membership.includes(sets[0].id); const b = membership.includes(sets[1].id);
      return a && b ? 'both' : b ? 'B' : 'A';
    }
    return 'A';
  };
  for (const item of items) {
    const selected = selectKeys.includes(item.id) || selectKeys.includes(item.value);
    const membership = Array.isArray(item.in) ? item.in.map(String)
      : layout === 'subset' ? (selected ? [sets[0].id, sets[1].id] : [sets[0].id]) : [sets[0].id];
    item.final = regionFor(membership);
    item.start = item.start ?? (layout === 'subset' ? 'outer'
      : layout === 'overlap' && mode !== 'show' ? 'A' : item.final);
  }
  const regions = layout === 'subset' ? ['outer', 'inner'] : layout === 'overlap' ? ['A', 'both', 'B'] : ['A'];
  const answerRegions = Array.isArray(params.answerRegions) ? params.answerRegions
    : layout === 'subset' ? ['inner'] : layout === 'overlap' ? ['both'] : layout === 'single' ? ['A'] : [];
  // Show steps: a list of step names; some names expand to one step per item.
  const names = Array.isArray(params.steps) ? params.steps
    : layout === 'single' ? ['frame', 'items']
      : layout === 'empty' ? ['frame', 'shade'] : ['frame', 'items', 'move', 'shade'];
  const steps = [];
  for (const name of names) {
    if (name === 'check_each') items.forEach((_, i) => steps.push({ name: 'check', i }));
    else if (name === 'move_each') {
      items.forEach((item, i) => { if (item.final !== item.start) steps.push({ name: 'moveone', i }); });
    } else if (['frame', 'items', 'items_placed', 'move', 'shade'].includes(name)) steps.push({ name });
    else throw new TypeError('Unknown step "' + name + '".');
  }
  if (!steps.length) steps.push({ name: 'frame' });
  const shade = params.shade ?? (layout === 'overlap' ? 'intersection' : layout === 'subset' ? 'inner' : 'all');
  return { layout, sets, items, regions, answerRegions, steps, shade,
    symbol: params.symbol ?? (layout === 'empty'), title: params.title ? String(params.title) : '' };
}

// ---------- geometry ----------
function geometry(layout, narrow) {
  if (layout === 'overlap') {
    return narrow
      ? { w: 340, h: 560, e: [{ cx: 170, cy: 190, rx: 150, ry: 160 }, { cx: 170, cy: 370, rx: 150, ry: 160 }] }
      : { w: 600, h: 390, e: [{ cx: 218, cy: 200, rx: 195, ry: 160 }, { cx: 382, cy: 200, rx: 195, ry: 160 }] };
  }
  if (layout === 'subset') {
    return narrow
      ? { w: 340, h: 490, e: [{ cx: 170, cy: 250, rx: 160, ry: 228 }, { cx: 170, cy: 350, rx: 135, ry: 105 }] }
      : { w: 600, h: 440, e: [{ cx: 300, cy: 220, rx: 292, ry: 205 }, { cx: 422, cy: 228, rx: 146, ry: 136 }] };
  }
  return narrow
    ? { w: 340, h: 340, e: [{ cx: 170, cy: 170, rx: 160, ry: 150 }] }
    : { w: 600, h: 360, e: [{ cx: 300, cy: 180, rx: 290, ry: 165 }] };
}

const inside = (e, x, y, m = 0) => ((x - e.cx) / (e.rx - m)) ** 2 + ((y - e.cy) / (e.ry - m)) ** 2 <= 1;
const outside = (e, x, y, m = 0) => ((x - e.cx) / (e.rx + m)) ** 2 + ((y - e.cy) / (e.ry + m)) ** 2 >= 1;

function regionTests(layout, e) {
  if (layout === 'subset') {
    return {
      outer: (x, y) => inside(e[0], x, y, INSET) && outside(e[1], x, y, GAP),
      inner: (x, y) => inside(e[1], x, y, INSET)
    };
  }
  if (layout === 'overlap') {
    return {
      A: (x, y) => inside(e[0], x, y, INSET) && outside(e[1], x, y, GAP),
      both: (x, y) => inside(e[0], x, y, INSET) && inside(e[1], x, y, INSET),
      B: (x, y) => inside(e[1], x, y, INSET) && outside(e[0], x, y, GAP)
    };
  }
  return { A: (x, y) => inside(e[0], x, y, INSET) };
}

// Which region is the point in? Used for dropping.
function regionAt(layout, e, x, y) {
  if (layout === 'subset') return inside(e[1], x, y) ? 'inner' : inside(e[0], x, y) ? 'outer' : null;
  if (layout === 'overlap') {
    const a = inside(e[0], x, y); const b = inside(e[1], x, y);
    return a && b ? 'both' : a ? 'A' : b ? 'B' : null;
  }
  return inside(e[0], x, y) ? 'A' : null;
}

function makeSlots(geo, layout, cell) {
  const tests = regionTests(layout, geo.e);
  const memo = new Map();
  const fits = (test, x, y) => {
    const hw = cell.w / 2 - 2; const hh = cell.h / 2 - 2;
    return [[0, 0], [-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh], [-hw, 0], [hw, 0], [0, -hh], [0, hh]]
      .every(([dx, dy]) => test(x + dx, y + dy));
  };
  function rows(key) {
    const id = 'rows:' + key;
    if (memo.has(id)) return memo.get(id);
    let best = [];
    let bestTotal = -1;
    for (const offset of [0, 1 / 3, 2 / 3]) {
      const found = [];
      for (let y = offset * cell.h + cell.h / 2; y <= geo.h - cell.h / 2 + 1; y += cell.h) {
        let widest = null;
        let start = null;
        for (let x = 0; x <= geo.w + 3; x += 3) {
          const ok = x <= geo.w && fits(tests[key], x, y);
          if (ok && start === null) start = x;
          if (!ok && start !== null) {
            const end = x - 3;
            if (!widest || end - start > widest.b - widest.a) widest = { a: start, b: end };
            start = null;
          }
        }
        if (widest) found.push({ y, a: widest.a, b: widest.b, cap: Math.floor((widest.b - widest.a) / cell.w) + 1 });
      }
      const total = found.reduce((sum, row) => sum + row.cap, 0);
      if (total > bestTotal) { bestTotal = total; best = found; }
    }
    memo.set(id, best);
    return best;
  }
  return {
    capacity: key => rows(key).reduce((sum, row) => sum + row.cap, 0),
    // N centred slots for a region, sorted top to bottom, left to right.
    slots(key, n) {
      const id = 'slots:' + key + ':' + n;
      if (memo.has(id)) return memo.get(id);
      const all = rows(key);
      const result = [];
      if (n > 0 && all.length) {
        const weight = all.reduce((sum, row) => sum + row.cap, 0);
        const centreY = all.reduce((sum, row) => sum + row.y * row.cap, 0) / weight;
        let pick = null;
        for (let size = 1; size <= all.length && !pick; size++) {
          let bestBlock = null;
          for (let from = 0; from + size <= all.length; from++) {
            const block = all.slice(from, from + size);
            if (block.reduce((sum, row) => sum + row.cap, 0) < n) continue;
            const mid = (block[0].y + block[block.length - 1].y) / 2;
            if (!bestBlock || Math.abs(mid - centreY) < bestBlock.dist) bestBlock = { block, dist: Math.abs(mid - centreY) };
          }
          if (bestBlock) pick = bestBlock.block;
        }
        const block = pick ?? all;
        const counts = block.map(() => 0);
        for (let k = 0; k < n; k++) {
          let chosen = -1;
          block.forEach((row, r) => {
            if (counts[r] >= row.cap) return;
            if (chosen < 0 || counts[r] / row.cap < counts[chosen] / block[chosen].cap
              || (counts[r] / row.cap === counts[chosen] / block[chosen].cap && row.cap > block[chosen].cap)) chosen = r;
          });
          if (chosen < 0) chosen = block.length - 1; // overflow: crowd the last row
          counts[chosen]++;
        }
        block.forEach((row, r) => {
          const mid = (row.a + row.b) / 2;
          for (let c = 0; c < counts[r]; c++) {
            result.push({ x: mid + (c - (counts[r] - 1) / 2) * cell.w, y: row.y });
          }
        });
      }
      memo.set(id, result);
      return result;
    }
  };
}

// ---------- the tool ----------
function htmlElement(name, value = '') {
  const element = document.createElement(name);
  element.textContent = value;
  return element;
}

function svgElement(name, attributes = {}, value = '') {
  const element = document.createElementNS(SVG, name);
  for (const [key, attribute] of Object.entries(attributes)) element.setAttribute(key, attribute);
  if (value !== '') element.textContent = value;
  return element;
}

export default {
  id: 'sets',

  mount(el, params, api) {
    const { mode, onEvent = () => {} } = api;
    if (!['show', 'explore', 'answer'].includes(mode)) throw new TypeError('Choose a tool mode.');
    const interactive = mode !== 'show';
    const id = ++uid;
    let model = normalize(params, mode);
    let step = 0;
    let narrow = false;
    let assign = [];          // interactive: current region of every item
    let selected = -1;
    let drag = null;
    let finished = false;
    let destroyed = false;
    let prev = new Map();     // last drawn positions, for animation
    let lastRender = '';
    const controller = new AbortController();
    const opt = { signal: controller.signal };

    const root = htmlElement('section');
    const style = htmlElement('style', `
      .ss-${id} .ss-item:focus { outline: none; }
      .ss-${id} .ss-item:focus-visible .ss-focus { stroke: var(--school-accent); stroke-width: 3; }
      .ss-${id} .ss-item { touch-action: none; }
      .ss-${id} button { font: inherit; color: inherit; background: var(--school-surface);
        border: 1px solid var(--school-line); border-radius: 6px; padding: .4rem .7rem; min-height: 40px; cursor: pointer; }
      .ss-${id} button:disabled { opacity: .55; cursor: default; }
      .ss-${id} .ss-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .ss-${id} .ss-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }`);
    const svg = svgElement('svg', { role: 'group' });
    const status = htmlElement('p');
    const bar = htmlElement('div');
    root.className = 'ss-' + id;
    root.style.cssText = 'color:var(--school-ink);font:1rem var(--school-font);min-width:0;position:relative';
    svg.style.cssText = 'display:block;width:100%;height:auto;max-width:760px;margin:0 auto;'
      + 'font-family:var(--school-font)';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.className = interactive ? '' : 'ss-vh';
    status.style.cssText = interactive ? 'min-height:2.4em;margin:8px 0 0' : '';
    bar.className = 'ss-bar';
    root.append(style, svg, status);
    if (interactive) root.append(bar);

    // ---- layout of one render ----
    function metrics() {
      const geo = geometry(model.layout, narrow);
      const hasCaption = model.items.some(item => item.label && item.kind !== 'text');
      const lines = Math.max(1, ...model.items.map(item => (item.label && item.kind !== 'text'
        && item.label.length > 10 ? 2 : 1)));
      const tileW = Math.max(46, ...model.items.filter(item => item.kind === 'text')
        .map(item => 15 * item.text.length + 22));
      // Largest scale at which every region can hold every item that may ever sit in it.
      const regionMax = key => model.items.filter(item => interactive
        || item.start === key || item.final === key).length;
      for (const s of narrow ? [0.85, 0.75, 0.65, 0.55, 0.5] : [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
        const cell = {
          s,
          w: hasCaption ? Math.max(68, 70 * s, tileW + 8) : tileW + 10,
          h: hasCaption ? 56 * s + 8 + 14 * lines : 46 * s + 16
        };
        const slots = makeSlots(geo, model.layout, cell);
        if (model.regions.every(key => slots.capacity(key) >= regionMax(key)) || s === 0.5) {
          return { geo, cell, slots, hasCaption, tileW };
        }
      }
      return null;
    }

    function stateAt(n) {
      const count = model.items.length;
      const st = { visible: Array(count).fill(false), region: model.items.map(item => item.start),
        mark: Array(count).fill(null), ring: -1, shade: false, current: null };
      for (let k = 0; k <= n; k++) {
        const { name, i } = model.steps[k];
        st.current = model.steps[k];
        if (name === 'items') { st.visible.fill(true); st.ring = -1; }
        if (name === 'items_placed') { st.visible.fill(true); st.region = model.items.map(item => item.final); }
        if (name === 'check') {
          st.visible.fill(true);
          st.ring = i;
          if (model.items[i].final !== model.items[i].start) {
            st.region[i] = model.items[i].final;
            st.mark[i] = 'ok';
          } else st.mark[i] = 'no';
        }
        if (name === 'move') {
          st.visible.fill(true);
          st.ring = -1;
          model.items.forEach((item, j) => { st.region[j] = item.final; });
        }
        if (name === 'moveone') { st.visible.fill(true); st.region[i] = model.items[i].final; st.ring = i; }
        if (name === 'shade') { st.visible.fill(true); st.shade = true; st.ring = -1; }
      }
      return st;
    }

    function regionTitle(key) {
      const [a, b] = model.sets;
      if (model.layout === 'subset') return key === 'inner' ? b.label : a.label;
      if (model.layout === 'overlap') return key === 'both' ? a.label + ' and ' + b.label
        : (key === 'A' ? a.label : b.label) + ' only';
      return a.label;
    }

    function positions(st, m) {
      const out = new Map();
      for (const key of model.regions) {
        const members = model.items.map((item, i) => i).filter(i => interactive
          ? assign[i] === key : (model.items[i].start === key || model.items[i].final === key));
        const slots = m.slots.slots(key, members.length);
        members.forEach((i, k) => {
          if ((interactive ? true : st.region[i] === key)) {
            const slot = slots[k] ?? slots[slots.length - 1] ?? { x: m.geo.w / 2, y: m.geo.h / 2 };
            out.set(i, { ...slot, region: key });
          }
        });
      }
      return out;
    }

    function reduced() {
      return api.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function drawItem(item, i, pos, m, st) {
      const g = svgElement('g', { transform: 'translate(' + pos.x + ',' + pos.y + ')', 'data-i': i });
      const inner = svgElement('g');
      const s = m.cell.s;
      const hasLabel = item.label && item.kind !== 'text';
      const iconY = hasLabel ? -m.cell.h / 2 + 28 * s + 3 : 0;
      let markup = '';
      const dim = (st.shade && model.answerRegionsShade && !model.answerRegionsShade.includes(pos.region)) ? 0.4 : 1;
      inner.setAttribute('opacity', dim);
      const hw = m.cell.w / 2 - 1; const hh = m.cell.h / 2 - 1;
      const isSel = selected === i && interactive;
      markup += (isSel || st.ring === i)
        ? '<rect class="ss-focus" x="' + -hw + '" y="' + -hh + '" width="' + hw * 2 + '" height="' + hh * 2
          + '" rx="14" fill="var(--school-accent)" fill-opacity="0.12" stroke="var(--school-accent)" stroke-opacity="0.55" stroke-width="1.5"/>'
        : '<rect class="ss-focus" x="' + -hw + '" y="' + -hh + '" width="' + hw * 2 + '" height="' + hh * 2
          + '" rx="14" fill="none" stroke="none"/>';
      if (item.kind === 'text') {
        const w = m.tileW; const h = 40 * Math.max(s, 0.8);
        markup += '<g filter="url(#ss-soft-' + id + ')"><rect x="' + -w / 2 + '" y="' + -h / 2 + '" width="' + w + '" height="' + h + '" rx="12" '
          + 'fill="var(--school-surface)" stroke="var(--school-line)" stroke-opacity="0.6" stroke-width="1.2"/></g>'
          + '<text x="0" y="1" text-anchor="middle" dominant-baseline="central" font-size="' + 21 * Math.max(s, 0.8)
          + '" font-family="var(--school-number-font)" fill="var(--school-ink)">' + esc(item.text) + '</text>';
      } else {
        const def = ICONS[item.kind];
        const dark = item.color === 'dark';
        markup += '<g filter="url(#ss-soft-' + id + ')"><g transform="translate(0,' + iconY + ') scale(' + 2.4 * s + ') translate(-12,-12)">'
          + def.draw(dark, item) + '</g></g>';
        if (item.text) markup += '<text x="0" y="' + (iconY + 1) + '" text-anchor="middle" dominant-baseline="central" '
          + 'font-size="' + 18 * s + '" font-weight="700" fill="' + (dark ? C.white : C.ink) + '">'
          + esc(item.text) + '</text>';
        const words = item.label.length > 10 && item.label.includes(' ') ? item.label.split(/ (.+)/, 2) : [item.label];
        words.forEach((word, k) => {
          markup += '<text x="0" y="' + (iconY + 28 * s + 13 + k * 14) + '" text-anchor="middle" font-size="12.5" font-weight="500" '
            + 'fill="var(--school-muted)">' + esc(word) + '</text>';
        });
      }
      if (st.mark[i] && !interactive) {
        const ok = st.mark[i] === 'ok';
        const bx = hw - 6; const by = -hh + 8;
        markup += '<circle cx="' + bx + '" cy="' + by + '" r="10" fill="' + (ok ? 'var(--school-ok-bg)' : 'var(--school-transfer-bg)')
          + '" stroke="' + (ok ? 'var(--school-ok-ink)' : 'var(--school-transfer)') + '" stroke-width="1.4"/>'
          + (ok ? '<path d="M' + (bx - 5) + ' ' + by + ' L' + (bx - 1) + ' ' + (by + 4) + ' L' + (bx + 5) + ' ' + (by - 4)
            + '" fill="none" stroke="var(--school-ok-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path d="M' + (bx - 4) + ' ' + (by - 4) + ' L' + (bx + 4) + ' ' + (by + 4) + ' M' + (bx + 4) + ' ' + (by - 4)
            + ' L' + (bx - 4) + ' ' + (by + 4) + '" stroke="var(--school-transfer)" stroke-width="2" stroke-linecap="round"/>');
      }
      inner.innerHTML = markup;
      inner.style.transformBox = 'fill-box';
      inner.style.transformOrigin = 'center';
      if (interactive && selected === i) { inner.style.transform = 'scale(1.06)'; inner.style.filter = 'drop-shadow(0 5px 6px rgba(24,40,64,.25))'; }
      g.append(inner);
      if (interactive) {
        g.classList.add('ss-item');
        g.setAttribute('class', 'ss-item');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-pressed', String(isSel));
        g.setAttribute('aria-label', (item.label ?? item.text) + ', in ' + regionTitle(pos.region)
          + '. Enter selects it. Arrow keys move it to the next place.');
        g.style.cursor = 'grab';
      }
      return { g, inner };
    }

    function render(play = false) {
      const m = metrics();
      const { geo } = m;
      const st = interactive ? { visible: model.items.map(() => true), region: assign, mark: [], ring: -1, shade: false }
        : stateAt(step);
      model.answerRegionsShade = st.shade ? shadeRegions() : null;
      const pos = positions(st, m);
      svg.replaceChildren();
      svg.setAttribute('viewBox', '0 0 ' + geo.w + ' ' + geo.h);
      svg.setAttribute('aria-label', model.title || (model.layout === 'overlap' ? 'Two overlapping ovals' : 'Oval diagram'));
      svg.append(svgElement('rect', { x: 0, y: 0, width: geo.w, height: geo.h, rx: 22, fill: 'var(--school-grid-bg, var(--school-page))' }));
      const [outer] = geo.e;
      const shade = st.shade ? model.shade : null;
      const clip = 'ss-clip-' + id;
      const defs = svgElement('defs');
      defs.innerHTML = '<filter id="ss-soft-' + id + '" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#182840" flood-opacity="0.16"/></filter>'
        + '<filter id="ss-glow-' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>';
      svg.append(defs);

      const glass = (k, hot) => hot ? { fill: 'var(--school-transfer-bg)', op: 0.95 }
        : { fill: 'var(--school-accent)', op: model.layout === 'subset' && k === 1 ? 0.12 : 0.06 };
      const empty = model.layout === 'empty';
      const hotOf = k => (shade === 'inner' && k === 1) || shade === 'all' || shade === 'union'
        || (shade === 'A' && k === 0) || (shade === 'B' && k === 1);
      geo.e.forEach((e, k) => {
        const hot = hotOf(k);
        if (hot) svg.append(svgElement('ellipse', { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: 'none',
          stroke: C.orange, 'stroke-opacity': 0.55, 'stroke-width': 10, filter: 'url(#ss-glow-' + id + ')' }));
        const g = glass(k, hot);
        svg.append(svgElement('ellipse', { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: g.fill, 'fill-opacity': g.op, stroke: 'none' }));
      });
      if (shade === 'intersection' && geo.e.length === 2) {
        const [a, b] = geo.e;
        const path = svgElement('clipPath', { id: clip + 'a' });
        path.append(svgElement('ellipse', { cx: a.cx, cy: a.cy, rx: a.rx, ry: a.ry }));
        defs.append(path);
        svg.append(svgElement('ellipse', { cx: b.cx, cy: b.cy, rx: b.rx, ry: b.ry,
          fill: C.orange, 'fill-opacity': 0.5, 'clip-path': 'url(#' + clip + 'a)', filter: 'url(#ss-glow-' + id + ')' }));
        svg.append(svgElement('ellipse', { cx: b.cx, cy: b.cy, rx: b.rx, ry: b.ry,
          fill: 'var(--school-transfer-bg)', 'fill-opacity': 0.95, 'clip-path': 'url(#' + clip + 'a)' }));
      }
      geo.e.forEach((e, k) => {
        const hot = hotOf(k);
        svg.append(svgElement('ellipse', {
          cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: 'none',
          stroke: hot ? C.orange : 'var(--school-accent)', 'stroke-opacity': hot ? 0.95 : 0.55,
          'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-dasharray': empty ? '1 7' : 'none'
        }));
      });
      // Oval labels sit on the top outline like a tab.
      geo.e.forEach((e, k) => {
        const text = model.sets[k]?.label;
        if (!text) return;
        const w = Math.max(40, 8.4 * text.length + 24);
        const ly = e.cy - e.ry;
        svg.append(svgElement('rect', { x: e.cx - w / 2, y: ly - 12, width: w, height: 24, rx: 12,
          fill: 'var(--school-surface)', 'fill-opacity': 0.92, stroke: 'var(--school-accent)', 'stroke-opacity': 0.35, 'stroke-width': 1 }));
        svg.append(svgElement('text', { x: e.cx, y: ly + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': 13, 'font-weight': 600, fill: 'var(--school-muted)' }, text));
      });
      if (empty && model.symbol && (interactive || st.shade)) {
        svg.append(svgElement('text', { x: outer.cx, y: outer.cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': 88, 'font-weight': 300, fill: C.orange, 'aria-label': 'empty set' }, '∅'));
      }

      const next = new Map();
      const drawn = [];
      model.items.forEach((item, i) => {
        if (!st.visible[i]) return;
        const p = pos.get(i);
        if (!p) return;
        const parts = drawItem(item, i, p, m, st);
        svg.append(parts.g);
        next.set(i, p);
        drawn.push({ ...parts, i, p });
      });
      if (play && !reduced()) {
        for (const { inner, i, p } of drawn) {
          const before = prev.get(i);
          if (!before) {
            inner.animate([{ opacity: 0, transform: 'translate(0,10px) scale(.92)' }, { opacity: 1, transform: 'none' }],
              { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
          } else if (before.x !== p.x || before.y !== p.y) {
            inner.animate([{ transform: 'translate(' + (before.x - p.x) + 'px,' + (before.y - p.y) + 'px)' },
              { transform: 'translate(0,0)' }], { duration: 380, easing: 'cubic-bezier(.34,1.35,.55,1)' });
          }
        }
      }
      prev = next;
      lastRender = narrow ? 'narrow' : 'wide';
      describe(st);
      if (interactive) drawBar();
    }

    function shadeRegions() {
      if (model.shade === 'inner') return ['inner'];
      if (model.shade === 'intersection') return ['both'];
      if (model.shade === 'A') return model.layout === 'overlap' ? ['A', 'both'] : ['A'];
      if (model.shade === 'B') return ['B', 'both'];
      if (model.shade === 'union') return ['A', 'both', 'B'];
      return null;
    }

    function describe(st) {
      if (interactive) {
        if (selected >= 0) {
          const item = model.items[selected];
          status.textContent = (item.label ?? item.text) + ' is selected. Click a place below, or drag it.';
        } else if (!status.dataset.keep) {
          status.textContent = mode === 'answer'
            ? 'Move the right elements into “' + regionTitle(model.answerRegions[0] ?? 'A') + '”. Drag them, or select one and use the buttons.'
            : 'Drag the elements between the ovals, or select one and use the buttons.';
        }
        return;
      }
      const cur = st.current;
      const label = i => model.items[i].label ?? model.items[i].text;
      if (!cur) status.textContent = '';
      else if (cur.name === 'frame') status.textContent = model.sets.map(set => set.label).filter(Boolean).join(' and ') || 'Empty oval';
      else if (cur.name === 'items' || cur.name === 'items_placed') status.textContent = model.items.length + ' elements.';
      else if (cur.name === 'check') status.textContent = label(cur.i) + (model.items[cur.i].final !== model.items[cur.i].start
        ? ' goes into “' + regionTitle(model.items[cur.i].final) + '”.' : ' stays where it is.');
      else if (cur.name === 'moveone') status.textContent = label(cur.i) + ' moves into “' + regionTitle(model.items[cur.i].final) + '”.';
      else if (cur.name === 'move') status.textContent = 'The chosen elements move into “' + regionTitle(model.regions[model.regions.length - 1]) + '”.';
      else status.textContent = model.layout === 'empty' ? 'This oval has no elements.' : 'This part is highlighted.';
    }

    function drawBar() {
      bar.replaceChildren();
      for (const key of model.regions) {
        if (model.regions.length < 2) break;
        const b = htmlElement('button', (model.layout === 'subset' && key === 'outer' ? 'Back to “' : 'Into “') + regionTitle(key) + '”');
        b.type = 'button';
        b.dataset.region = key;
        b.disabled = selected < 0 || assign[selected] === key;
        bar.append(b);
      }
      const reset = htmlElement('button', 'Start again');
      reset.type = 'button';
      reset.dataset.action = 'reset';
      bar.append(reset);
      if (mode === 'answer') {
        const done = htmlElement('button', 'Use this answer');
        done.type = 'button';
        done.dataset.action = 'done';
        bar.append(done);
      }
    }

    // ---- state ----
    function regionsNow() {
      const out = {};
      for (const key of model.regions) out[key] = [];
      if (interactive) model.items.forEach((item, i) => out[assign[i]].push(item.value));
      else {
        const st = stateAt(step);
        model.items.forEach((item, i) => { if (st.visible[i]) out[st.region[i]].push(item.value); });
      }
      return out;
    }

    function getState() {
      const regions = regionsNow();
      if (mode === 'answer') {
        return { type: 'set', value: model.answerRegions.flatMap(key => regions[key] ?? []) };
      }
      return interactive
        ? { regions, value: model.answerRegions.flatMap(key => regions[key] ?? []) }
        : { step, regions };
    }

    function resetAssign() {
      assign = model.items.map(item => item.start);
      selected = -1;
      finished = false;
    }

    // ---- interaction ----
    function toSvg(event) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
    }

    function moveItem(i, key, focus = true) {
      if (!model.regions.includes(key) || assign[i] === key) return false;
      assign[i] = key;
      finished = false;
      delete status.dataset.keep;
      render(true);
      status.dataset.keep = '1';
      const item = model.items[i];
      status.textContent = (item.label ?? item.text) + ' is now in “' + regionTitle(key) + '”.';
      if (focus) svg.querySelector('[data-i="' + i + '"]')?.focus({ preventScroll: true });
      onEvent('changed', getState());
      return true;
    }

    function select(i) {
      selected = selected === i ? -1 : i;
      delete status.dataset.keep;
      render();
      if (selected >= 0) svg.querySelector('[data-i="' + selected + '"]')?.focus({ preventScroll: true });
    }

    svg.addEventListener('pointerdown', event => {
      if (!interactive || drag || event.button !== 0) return;
      const node = event.target.closest('.ss-item');
      if (!node || model.regions.length < 2) {
        if (node) select(Number(node.dataset.i));
        return;
      }
      node.setPointerCapture(event.pointerId);
      const start = toSvg(event);
      const origin = node.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/);
      drag = { id: event.pointerId, node, i: Number(node.dataset.i), sx: event.clientX, sy: event.clientY,
        ox: Number(origin[1]) - start.x, oy: Number(origin[2]) - start.y, moved: false };
    }, opt);

    svg.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 6) return;
      drag.moved = true;
      const p = toSvg(event);
      drag.node.setAttribute('transform', 'translate(' + (p.x + drag.ox) + ',' + (p.y + drag.oy) + ')');
      drag.node.parentNode.append(drag.node);
      drag.node.style.cursor = 'grabbing';
      const body = drag.node.firstChild;
      body.style.transformBox = 'fill-box';
      body.style.transformOrigin = 'center';
      body.style.transform = 'scale(1.1)';
      body.style.filter = 'drop-shadow(0 8px 8px rgba(24,40,64,.28))';
    }, opt);

    svg.addEventListener('pointerup', event => {
      if (!interactive) return;
      if (drag?.id === event.pointerId) {
        const { i, moved } = drag;
        drag = null;
        if (!moved) { select(i); return; }
        const p = toSvg(event);
        const key = regionAt(model.layout, geometry(model.layout, narrow).e, p.x, p.y);
        if (key && moveItem(i, key)) return;
        render(true);
        return;
      }
      // A click on an oval moves the selected element there.
      if (selected >= 0 && !event.target.closest('.ss-item')) {
        const p = toSvg(event);
        const key = regionAt(model.layout, geometry(model.layout, narrow).e, p.x, p.y);
        if (key) moveItem(selected, key);
      }
    }, opt);

    svg.addEventListener('pointercancel', event => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      render();
    }, opt);

    svg.addEventListener('keydown', event => {
      const node = event.target.closest?.('.ss-item');
      if (!node || !interactive) return;
      const i = Number(node.dataset.i);
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(i); return; }
      if (event.key === 'Escape') { selected = -1; render(); svg.querySelector('[data-i="' + i + '"]')?.focus(); return; }
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!dir || model.regions.length < 2) return;
      event.preventDefault();
      const at = model.regions.indexOf(assign[i]);
      const key = model.regions[(at + dir + model.regions.length) % model.regions.length];
      moveItem(i, key);
    }, opt);

    bar.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.region && selected >= 0) {
        const i = selected;
        moveItem(i, button.dataset.region);
      }
      if (button.dataset.action === 'reset') {
        resetAssign();
        delete status.dataset.keep;
        render(true);
        onEvent('changed', getState());
      }
      if (button.dataset.action === 'done') {
        if (finished) return;
        finished = true;
        status.dataset.keep = '1';
        status.textContent = 'Your answer is ready to submit.';
        onEvent('done', getState());
      }
    }, opt);

    function fit() {
      const width = el.clientWidth || root.clientWidth || 600;
      const wasNarrow = narrow;
      narrow = width < 520;
      if (narrow !== wasNarrow && !destroyed) render();
    }

    resetAssign();
    el.append(root);
    narrow = (el.clientWidth || 600) < 520;
    render();
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => fit());
      observer.observe(el);
    }
    onEvent('ready', { steps: model.steps.length, step: 0 });

    return {
      setParams(nextParams) {
        if (destroyed) return;
        model = normalize(nextParams, mode);
        step = 0;
        prev = new Map();
        drag = null;
        delete status.dataset.keep;
        resetAssign();
        render();
        onEvent('ready', { steps: model.steps.length, step: 0 });
      },
      setStep(n) {
        if (destroyed || mode !== 'show' || !Number.isFinite(n)) return;
        const previous = step;
        step = Math.max(0, Math.min(Math.trunc(n), model.steps.length - 1));
        render(step === previous + 1);
        onEvent('step', { step, steps: model.steps.length });
      },
      getState,
      destroy() {
        destroyed = true;
        controller.abort();
        observer?.disconnect();
        root.remove();
      }
    };
  }
};
