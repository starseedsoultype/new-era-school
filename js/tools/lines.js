const SVG = 'http://www.w3.org/2000/svg';
const CELL = 40;             // one notebook square in drawing units
const GW = 15;               // plane width in squares
const GH = 10;               // plane height in squares
const VW = GW * CELL;
const VH = GH * CELL;
const SNAP = 0.24;           // how close (in squares) the edge of the square must come to a point to stick to it
const STEP_NAMES = ['frame', 'lines', 'line_each', 'marks', 'highlight', 'extend', 'all',
  'triangle', 'ruler', 'slide', 'draw', 'mark'];
let uid = 0;

// ---------- colours (css/tokens.css only) ----------
const tone = (name, fallback) => 'var(--school-icon-' + name + ', var(' + fallback + '))';
const COLORS = {
  ink: 'var(--school-ink)', blue: 'var(--school-accent)', orange: 'var(--school-transfer)',
  green: 'var(--school-ok-ink)'
};
const T = {
  line: tone('line', '--school-ink'), green: tone('green', '--school-ok-bg'),
  yellow: tone('yellow', '--school-note-bg'), orange: tone('orange', '--school-transfer-bg')
};

// ---------- small vector helpers (drawing coordinates: x right, y UP, unit = one square) ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dotp = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = a => { const l = Math.hypot(a[0], a[1]); if (!l) throw new TypeError('A line needs two different points or a direction.'); return [a[0] / l, a[1] / l]; };
const rot90 = a => [-a[1], a[0]];
const px = p => [p[0] * CELL, (GH - p[1]) * CELL];
const fmt = n => String(Math.round(n * 100) / 100);
const isPoint = v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);

function clipLine(p, u) {
  let s0 = -1e9;
  let s1 = 1e9;
  for (const [pc, uc, hi] of [[p[0], u[0], GW], [p[1], u[1], GH]]) {
    if (Math.abs(uc) < 1e-9) { if (pc < 0 || pc > hi) return null; continue; }
    let a = -pc / uc;
    let b = (hi - pc) / uc;
    if (a > b) [a, b] = [b, a];
    s0 = Math.max(s0, a);
    s1 = Math.min(s1, b);
  }
  return s0 > s1 ? null : [add(p, mul(u, s0)), add(p, mul(u, s1))];
}

function cross(l1, l2) {
  const d = l1.u[0] * l2.u[1] - l1.u[1] * l2.u[0];
  if (Math.abs(d) < 1e-9) return null;
  const q = sub(l2.p, l1.p);
  const s = (q[0] * l2.u[1] - q[1] * l2.u[0]) / d;
  return add(l1.p, mul(l1.u, s));
}

// ---------- parameters ----------
function normalize(params) {
  if (!params || typeof params !== 'object') throw new TypeError('Pass an object with lines, points, segments or polygons.');
  const pts = new Map();
  const points = (params.points ?? []).map((raw, k) => {
    if (!isPoint(raw.at)) throw new TypeError('Point ' + (raw.id ?? k) + ' needs "at": [x, y].');
    const id = String(raw.id ?? raw.label ?? 'P' + k);
    pts.set(id, raw.at.map(Number));
    return { id, label: String(raw.label ?? id), at: raw.at.map(Number), pos: raw.pos ?? 'ne', color: raw.color ?? 'ink' };
  });
  const coord = v => {
    if (isPoint(v)) return v.map(Number);
    const hit = pts.get(String(v));
    if (!hit) throw new TypeError('Unknown point "' + v + '".');
    return hit;
  };
  const segMap = new Map();
  const segments = (params.segments ?? []).map(raw => {
    const seg = { id: raw.id == null ? null : String(raw.id), a: coord(raw.from), b: coord(raw.to),
      label: raw.label == null ? '' : String(raw.label), color: raw.color ?? 'ink' };
    if (seg.id) segMap.set(seg.id, seg);
    return seg;
  });
  const polygons = (params.polygons ?? []).map(raw => {
    const ring = (raw.points ?? []).map(coord);
    if (ring.length < 3) throw new TypeError('A polygon needs at least three points.');
    const labels = (raw.labels ?? []).map(String);
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const name = (labels[i] ?? '') + (labels[(i + 1) % ring.length] ?? '');
      if (name.length > 1) segMap.set(name, { a, b });
    });
    return { ring, labels, color: raw.color ?? 'ink' };
  });
  const lineMap = new Map();
  const lines = (params.lines ?? []).map((raw, k) => {
    const id = String(raw.id ?? raw.label ?? 'l' + k);
    let p;
    let u;
    let a = null;
    let b = null;
    const dirOf = ref => {
      const key = String(ref);
      if (lineMap.has(key)) return lineMap.get(key).u;
      if (segMap.has(key)) { const s = segMap.get(key); return unit(sub(s.b, s.a)); }
      throw new TypeError('Unknown line or segment "' + key + '".');
    };
    if (raw.from != null && raw.to != null) {
      a = coord(raw.from);
      b = coord(raw.to);
      p = a;
      u = unit(sub(b, a));
    } else if (raw.through != null) {
      p = coord(raw.through);
      u = raw.parallelTo != null ? dirOf(raw.parallelTo)
        : raw.perpendicularTo != null ? rot90(dirOf(raw.perpendicularTo))
          : isPoint(raw.dir) ? unit(raw.dir)
            : Number.isFinite(raw.angle) ? [Math.cos(raw.angle * Math.PI / 180), Math.sin(raw.angle * Math.PI / 180)]
              : null;
      if (!u) throw new TypeError('Line ' + id + ' needs dir, angle, parallelTo or perpendicularTo.');
    } else throw new TypeError('Line ' + id + ' needs "from" and "to", or "through".');
    const finite = raw.segment === true;
    if (finite && !a) throw new TypeError('A segment line needs "from" and "to".');
    const line = { id, label: raw.label == null ? id : String(raw.label), p, u, finite, a, b,
      color: raw.color ?? 'ink', ref: raw.ref === true, extend: raw.extend === true,
      labelAt: Number.isFinite(raw.labelAt) ? raw.labelAt : 0.9, labelSide: raw.labelSide === -1 ? -1 : 1 };
    lineMap.set(id, line);
    return line;
  });
  const need = id => { if (!lineMap.has(String(id))) throw new TypeError('Unknown line "' + id + '".'); return String(id); };
  const marks = (params.marks ?? []).map(raw => {
    if (!['right', 'parallel'].includes(raw.kind)) throw new TypeError('A mark is "right" or "parallel".');
    return { kind: raw.kind, lines: (raw.lines ?? []).map(need), flip: raw.flip ?? [false, false],
      count: raw.count === 2 ? 2 : 1, degrees: raw.degrees === true };
  });
  const highlight = (params.highlight ?? []).map(need);
  const choose = params.choose ? params.choose.map(need) : lines.filter(l => !l.ref).map(l => l.id);

  // The "set square and ruler" construction.
  let cons = null;
  if (params.construct) {
    const c = params.construct;
    const base = lineMap.get(String(c.base));
    if (!base) throw new TypeError('construct.base must name a line.');
    const raw = c.through == null ? [] : Array.isArray(c.through) && !isPoint(c.through) ? c.through : [c.through];
    const targets = raw.map(t => ({ at: coord(t), name: isPoint(t) ? '' : String(t) }));
    const free = c.free === true || targets.length === 0;
    const first = targets[0]?.at ?? add(base.p, mul(rot90(base.u), 2.5));
    let n = rot90(base.u);
    if (dotp(sub(first, base.p), n) < 0) n = mul(n, -1);
    const a = Number(c.triangle?.a ?? 3.6);
    const bb = Number(c.triangle?.b ?? 2.7);
    const h = Math.hypot(a, bb);
    const d0 = dotp(sub(first, base.p), n);
    const sig = targets.map(t => dotp(sub(t.at, base.p), n) * h / bb);
    // The square can lie to either side; unless "flip" is given, take the side that keeps it on the plane.
    const place = s => {
      const w = [(-s * a * base.u[0] + bb * n[0]) / h, (-s * a * base.u[1] + bb * n[1]) / h];
      const xv = dotp(sub(first, base.p), base.u) + s * (d0 * a / bb - a / 2);
      const v0 = add(base.p, mul(base.u, xv));
      const v1 = add(v0, mul(base.u, s * a));
      const v2 = add(v0, mul(n, bb));
      let out = 0;
      for (const sg of [0, ...sig]) for (const p of [v0, v1, v2]) {
        const q = add(p, mul(w, sg));
        out += Math.max(0, 0.3 - q[0]) + Math.max(0, q[0] - GW + 0.3) + Math.max(0, 0.3 - q[1]) + Math.max(0, q[1] - GH + 0.3);
      }
      return { s, w, v0, v1, v2, out };
    };
    const pick = typeof c.flip === 'boolean' ? place(c.flip ? -1 : 1)
      : [place(1), place(-1)].sort((p, q) => p.out - q.out)[0];
    const { s, w, v0, v1, v2 } = pick;
    const lo = Math.min(0, ...sig) - 1;
    const hi = Math.max(0, ...sig) + 1;
    const labels = (c.new ?? []).map(String);
    const fallback = ['n', 'k', 'p', 'q', 'r', 's'];
    cons = { base, targets, free, n, s, a, b: bb, h, w, sig, v0, v1, v2, lo, hi,
      max: Math.max(1, Math.min(8, Number(c.maxLines ?? (targets.length || 5)))),
      labelFor: i => labels[i] ?? fallback[i % fallback.length], first };
  }
  const names = Array.isArray(params.steps) ? params.steps
    : cons ? ['frame', 'triangle', 'ruler', 'slide', 'draw', 'mark']
      : marks.length ? ['frame', 'marks'] : ['frame'];
  const steps = [];
  for (const name of names) {
    if (name === 'line_each') lines.forEach((_, i) => steps.push({ name, i }));
    else if (STEP_NAMES.includes(name)) steps.push({ name });
    else throw new TypeError('Unknown step "' + name + '".');
  }
  if (!steps.length) steps.push({ name: 'frame' });
  if (steps.some(s => ['triangle', 'ruler', 'slide', 'draw', 'mark'].includes(s.name)) && !cons) {
    throw new TypeError('Construction steps need "construct".');
  }
  return { points, segments, polygons, lines, lineMap, marks, highlight, choose, cons, steps,
    grid: params.grid !== false, title: params.title ? String(params.title) : '' };
}

// ---------- DOM helpers ----------
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

const pathOf = pts => pts.map((p, i) => (i ? 'L' : 'M') + fmt(px(p)[0]) + ' ' + fmt(px(p)[1])).join(' ');

export default {
  id: 'lines',

  mount(el, params, api) {
    const { mode, onEvent = () => {} } = api;
    if (!['show', 'explore', 'answer'].includes(mode)) throw new TypeError('Choose a tool mode.');
    const id = ++uid;
    let model = normalize(params);
    let step = 0;
    let destroyed = false;
    let sel = new Set();            // selected line ids (explore/answer without construct)
    let sigma = 0;                  // explore: position of the square along the ruler
    let drawn = [];                 // explore: lines drawn by the student { key, target, p, label }
    let drag = null;
    let finished = false;
    let prev = { keys: new Set(), sigma: null };
    const controller = new AbortController();
    const opt = { signal: controller.signal };
    const interactive = mode !== 'show';

    const root = htmlElement('section');
    const style = htmlElement('style', `
      .ln-${id} button { font: inherit; color: inherit; background: var(--school-surface);
        border: 1px solid var(--school-line); border-radius: 6px; padding: .4rem .7rem; min-height: 40px; cursor: pointer; }
      .ln-${id} button:disabled { opacity: .55; cursor: default; }
      .ln-${id} .ln-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .ln-${id} .ln-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .ln-${id} .ln-pick, .ln-${id} .ln-tri { touch-action: none; outline: none; }
      .ln-${id} .ln-pick .ln-focus, .ln-${id} .ln-tri .ln-focus { opacity: 0; }
      .ln-${id} .ln-pick:focus-visible .ln-focus, .ln-${id} .ln-tri:focus-visible .ln-focus { opacity: 1; }
      .ln-${id} .ln-pick:hover .ln-vis { stroke-width: 4.6; }`);
    const svg = svgElement('svg', { role: 'group', viewBox: '0 0 ' + VW + ' ' + VH });
    const status = htmlElement('p');
    const bar = htmlElement('div');
    root.className = 'ln-' + id;
    root.style.cssText = 'color:var(--school-ink);font:1rem var(--school-font);min-width:0;position:relative';
    svg.style.cssText = 'display:block;width:100%;height:auto;max-width:760px;margin:0 auto;font-family:var(--school-font)';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.className = interactive ? '' : 'ln-vh';
    status.style.cssText = interactive ? 'min-height:2.4em;margin:8px 0 0' : '';
    bar.className = 'ln-bar';
    root.append(style, svg, status);
    if (interactive) root.append(bar);

    const reduced = () => api.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colorOf = c => COLORS[c] ?? COLORS.ink;
    const cons = () => model.cons;
    const constructing = () => interactive && !!cons();

    // ---------- what is visible ----------
    function stateAt(n) {
      const st = { lines: new Set(), marks: false, hi: false, ext: false, tri: null, ruler: false, drawn: false, tools: true };
      for (let k = 0; k <= n; k++) {
        const { name, i } = model.steps[k];
        if (name === 'frame' || name === 'lines' || name === 'all') model.lines.forEach(l => st.lines.add(l.id));
        if (name === 'line_each') st.lines.add(model.lines[i].id);
        if (name === 'all' || name === 'marks') st.marks = true;
        if (name === 'highlight') { model.lines.forEach(l => st.lines.add(l.id)); st.hi = true; }
        if (name === 'extend') { model.lines.forEach(l => st.lines.add(l.id)); st.ext = true; }
        if (name === 'triangle') { st.tri = 0; }
        if (name === 'ruler') { st.tri = 0; st.ruler = true; }
        if (name === 'slide') { st.tri = cons().sig[0] ?? 0; st.ruler = true; }
        if (name === 'draw') { st.tri = cons().sig[0] ?? 0; st.ruler = true; st.drawn = true; }
        if (name === 'mark') { st.tools = false; st.drawn = true; st.marks = true; st.tri = null; st.ruler = false; }
      }
      if (step >= 0 && model.cons && !model.steps.some(s => ['frame', 'lines', 'all', 'line_each'].includes(s.name))) {
        st.lines.add(model.cons.base.id);
      }
      return st;
    }

    // ---------- drawing pieces ----------
    function drawLinePiece(line, o = {}) {
      const g = svgElement('g', { 'data-line': line.id });
      let ends = line.finite ? [line.a, line.b] : clipLine(line.p, line.u);
      if (!ends) return g;
      const color = o.color ?? colorOf(line.color);
      const width = o.width ?? 2.8;
      const vis = svgElement('path', { class: 'ln-vis', d: pathOf(ends), fill: 'none', stroke: color,
        'stroke-width': width, 'stroke-linecap': 'round', 'data-key': o.key ?? line.id, opacity: o.opacity ?? 1 });
      if (o.halo) g.append(svgElement('path', { d: pathOf(ends), fill: 'none', stroke: T.orange, 'stroke-opacity': 0.6,
        'stroke-width': 12, 'stroke-linecap': 'round', filter: 'url(#ln-glow-' + id + ')' }));
      g.append(vis);
      if (line.finite && o.ext) {
        const far = clipLine(line.p, line.u);
        if (far) for (const [from, to] of [[far[0], line.a], [line.b, far[1]]]) {
          g.append(svgElement('path', { d: pathOf([from, to]), fill: 'none', stroke: COLORS.orange, 'stroke-width': 2.2,
            'stroke-dasharray': '2 7', 'stroke-linecap': 'round', 'data-dash': '1' }));
        }
      }
      return g;
    }

    function labelAt(line, text, o = {}) {
      const ends = line.finite && !o.far ? [line.a, line.b] : clipLine(line.p, line.u);
      if (!ends || !text) return null;
      const at = add(ends[0], mul(sub(ends[1], ends[0]), o.at ?? line.labelAt));
      const nrm = mul(rot90(line.u), (o.side ?? line.labelSide) * 0.55);
      let [x, y] = px(add(at, nrm));
      x = Math.max(14, Math.min(VW - 14, x));
      y = Math.max(18, Math.min(VH - 10, y));
      return svgElement('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 25,
        'font-style': 'italic', 'font-weight': 600, fill: o.color ?? colorOf(line.color), 'paint-order': 'stroke',
        stroke: 'var(--school-grid-bg, var(--school-page))', 'stroke-width': 4, 'stroke-linejoin': 'round' }, text);
    }

    function drawPoint(p, hot) {
      const g = svgElement('g');
      const [x, y] = px(p.at);
      if (hot) g.append(svgElement('circle', { cx: x, cy: y, r: 15, fill: T.orange, 'fill-opacity': 0.4,
        stroke: COLORS.orange, 'stroke-width': 1.6, 'data-key': 'ring-' + p.id }));
      g.append(svgElement('circle', { cx: x, cy: y, r: 6, fill: colorOf(p.color), stroke: 'var(--school-surface)', 'stroke-width': 2 }));
      const off = { ne: [14, -14], nw: [-14, -14], se: [14, 16], sw: [-14, 16], n: [0, -20], s: [0, 22], e: [18, 0], w: [-18, 0] }[p.pos] ?? [14, -14];
      g.append(svgElement('text', { x: x + off[0], y: y + off[1], 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 25, 'font-style': 'italic', 'font-weight': 700, fill: colorOf(p.color), 'paint-order': 'stroke',
        stroke: 'var(--school-grid-bg, var(--school-page))', 'stroke-width': 4, 'stroke-linejoin': 'round' }, p.label));
      return g;
    }

    function drawMark(mark) {
      const g = svgElement('g');
      const [l1, l2] = mark.lines.map(k => model.lineMap.get(k));
      if (mark.kind === 'right') {
        const x = cross(l1, l2);
        if (!x) return g;
        const s1 = mark.flip[0] ? -1 : 1;
        const s2 = mark.flip[1] ? -1 : 1;
        const a = mul(l1.u, s1 * 0.42);
        const b = mul(l2.u, s2 * 0.42);
        g.append(svgElement('path', { d: pathOf([add(x, a), add(add(x, a), b), add(x, b)]), fill: 'none',
          stroke: 'var(--school-ink)', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
        if (mark.degrees) {
          const [tx, ty] = px(add(x, mul(add(mul(l1.u, s1), mul(l2.u, s2)), 0.95)));
          g.append(svgElement('text', { x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-size': 15, 'font-weight': 600, fill: 'var(--school-muted)' }, '90°'));
        }
      } else {
        for (const line of [l1, l2]) {
          const ends = line.finite ? [line.a, line.b] : clipLine(line.p, line.u);
          if (!ends) continue;
          const mid = add(ends[0], mul(sub(ends[1], ends[0]), 0.62));
          const nrm = rot90(line.u);
          for (let k = 0; k < mark.count; k++) {
            const tip = add(mid, mul(line.u, 0.12 + k * 0.3));
            const back = sub(tip, mul(line.u, 0.26));
            g.append(svgElement('path', { d: pathOf([add(back, mul(nrm, 0.2)), tip, sub(back, mul(nrm, 0.2))]), fill: 'none',
              stroke: colorOf(line.color), 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
          }
        }
      }
      return g;
    }

    function rulerShape() {
      const c = cons();
      const wd = 0.95;
      let ow = rot90(c.w);
      if (dotp(sub(c.v0, c.v1), ow) > 0) ow = mul(ow, -1);
      const len = Math.min(13, c.hi - c.lo + c.h + 4);
      const mid = add(mul(add(c.v1, c.v2), 0.5), mul(c.w, (c.lo + c.hi) / 2));
      const p0 = sub(mid, mul(c.w, len / 2));
      const corners = [p0, add(p0, mul(c.w, len)), add(add(p0, mul(c.w, len)), mul(ow, wd)), add(p0, mul(ow, wd))];
      const g = svgElement('g', { 'data-key': 'ruler' });
      const [x0, y0] = px(corners[0]);
      g.append(svgElement('path', { d: pathOf(corners) + 'Z', fill: T.yellow, 'fill-opacity': 0.85, stroke: T.line,
        'stroke-width': 1.4, 'stroke-linejoin': 'round', filter: 'url(#ln-soft-' + id + ')' }));
      for (let k = 1; k < len * 4; k++) {
        const along = k / 4;
        const long = k % 4 === 0;
        const base = add(add(p0, mul(c.w, along)), mul(ow, wd));
        g.append(svgElement('path', { d: pathOf([base, sub(base, mul(ow, long ? 0.34 : 0.17))]), stroke: T.line,
          'stroke-width': 1.2, 'stroke-linecap': 'round' }));
      }
      g.append(svgElement('circle', { cx: x0, cy: y0, r: 0, fill: 'none' }));
      return g;
    }

    function triShape(sg, hot) {
      const c = cons();
      const shift = mul(c.w, sg);
      const ring = [c.v0, c.v1, c.v2];
      const centre = mul(add(add(c.v0, c.v1), c.v2), 1 / 3);
      const hole = ring.map(p => add(centre, mul(sub(p, centre), 0.52)));
      const g = svgElement('g', { transform: 'translate(' + fmt(shift[0] * CELL) + ',' + fmt(-shift[1] * CELL) + ')' });
      const inner = svgElement('g', { class: 'ln-tri-body' });
      inner.append(svgElement('path', { d: pathOf(ring) + 'Z ' + pathOf(hole) + 'Z', 'fill-rule': 'evenodd', fill: T.green,
        'fill-opacity': 0.62, stroke: T.line, 'stroke-width': 1.8, 'stroke-linejoin': 'round', filter: 'url(#ln-soft-' + id + ')' }));
      inner.append(svgElement('path', { d: pathOf([c.v0, c.v1]), stroke: hot ? COLORS.orange : COLORS.blue,
        'stroke-width': hot ? 4 : 2.6, 'stroke-linecap': 'round' }));
      const focus = svgElement('path', { class: 'ln-focus', d: pathOf(ring) + 'Z', fill: 'none', stroke: 'var(--school-accent)',
        'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-opacity': 0.7 });
      g.append(focus, inner);
      return { g, inner };
    }

    // ---------- render ----------
    function snappedTarget() {
      const c = cons();
      if (!c) return -1;
      return c.targets.findIndex((_, i) => Math.abs(sigma - c.sig[i]) < 1e-6);
    }

    function newLineFor(i, sg) {
      const c = cons();
      const at = c.targets[i]?.at ?? add(c.v0, mul(c.w, sg));
      return { id: 'new' + i, p: at, u: c.base.u, finite: false, label: c.labelFor(i), color: 'blue',
        labelAt: c.base.labelAt, labelSide: c.base.labelSide, a: null, b: null, ref: false, extend: false };
    }

    function render(play = false) {
      const st = interactive ? null : stateAt(step);
      svg.replaceChildren();
      svg.setAttribute('aria-label', model.title || 'A plane with lines');
      const defs = svgElement('defs');
      defs.innerHTML = '<filter id="ln-soft-' + id + '" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#182840" flood-opacity="0.18"/></filter>'
        + '<filter id="ln-glow-' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>'
        + '<clipPath id="ln-clip-' + id + '"><rect x="0" y="0" width="' + VW + '" height="' + VH + '" rx="22"/></clipPath>';
      svg.append(defs);
      const plane = svgElement('g', { 'clip-path': 'url(#ln-clip-' + id + ')' });
      svg.append(plane);
      plane.append(svgElement('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'var(--school-grid-bg, var(--school-page))' }));
      if (model.grid) {
        let d = '';
        for (let x = 1; x < GW; x++) d += 'M' + x * CELL + ' 0V' + VH;
        for (let y = 1; y < GH; y++) d += 'M0 ' + y * CELL + 'H' + VW;
        plane.append(svgElement('path', { d, stroke: 'var(--school-line)', 'stroke-opacity': 0.2, 'stroke-width': 1, fill: 'none' }));
      }
      svg.append(svgElement('rect', { x: 0.75, y: 0.75, width: VW - 1.5, height: VH - 1.5, rx: 22, fill: 'none',
        stroke: 'var(--school-line)', 'stroke-opacity': 0.35, 'stroke-width': 1.5 }));

      const c = cons();
      const keys = new Set();
      const visible = interactive ? new Set(model.lines.map(l => l.id)) : st.lines;
      const hiSet = interactive ? sel : (st.hi ? new Set(model.highlight) : null);
      const drawnNow = [];
      if (interactive && c) drawn.forEach(d => drawnNow.push(newLineFor(d.target, d.offset ?? 0)));
      if (!interactive && st.drawn && c) c.targets.length ? c.targets.forEach((_, i) => drawnNow.push(newLineFor(i, 0)))
        : drawnNow.push(newLineFor(0, c.sig[0] ?? 0));
      if (!interactive && st.drawn && c && !c.targets.length) drawnNow[0].p = add(c.v0, mul(c.w, c.sig[0] ?? 0));
      const tools = interactive ? !!c : (st.tri !== null);
      const showRuler = interactive ? !!c : st.ruler;

      // ruler under the lines
      if (showRuler && c) { plane.append(rulerShape()); keys.add('ruler'); }
      // polygons and segments
      for (const poly of model.polygons) {
        plane.append(svgElement('path', { d: pathOf(poly.ring) + 'Z', fill: 'var(--school-accent)', 'fill-opacity': 0.07,
          stroke: colorOf(poly.color), 'stroke-width': 2.8, 'stroke-linejoin': 'round' }));
        const centre = mul(poly.ring.reduce((s, p) => add(s, p), [0, 0]), 1 / poly.ring.length);
        poly.labels.forEach((text, i) => {
          const dir = unit(sub(poly.ring[i], centre));
          const [x, y] = px(add(poly.ring[i], mul(dir, 0.6)));
          plane.append(svgElement('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 25,
            'font-style': 'italic', 'font-weight': 700, fill: 'var(--school-ink)', 'paint-order': 'stroke',
            stroke: 'var(--school-grid-bg, var(--school-page))', 'stroke-width': 4 }, text));
        });
      }
      for (const seg of model.segments) {
        plane.append(svgElement('path', { d: pathOf([seg.a, seg.b]), fill: 'none', stroke: colorOf(seg.color),
          'stroke-width': 2.8, 'stroke-linecap': 'round' }));
        if (seg.label) {
          const mid = mul(add(seg.a, seg.b), 0.5);
          const nrm = rot90(unit(sub(seg.b, seg.a)));
          const [x, y] = px(add(mid, mul(nrm, 0.5)));
          plane.append(svgElement('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 22,
            'font-style': 'italic', 'font-weight': 600, fill: colorOf(seg.color) }, seg.label));
        }
      }
      // lines
      const lineNodes = [];
      for (const line of model.lines) {
        if (!visible.has(line.id)) continue;
        const chosen = hiSet?.has(line.id);
        const dim = hiSet && hiSet.size && !chosen && !interactive;
        const showExt = !interactive && st.ext && line.extend;
        const piece = drawLinePiece(line, {
          color: chosen ? COLORS.orange : line.ref && interactive ? COLORS.blue : undefined,
          width: chosen ? 4.4 : 2.8, halo: chosen, opacity: dim ? 0.35 : 1, ext: showExt, key: 'ln-' + line.id });
        keys.add('ln-' + line.id);
        if (interactive && mode === 'answer' || interactive && !c) {
          if (!line.ref && model.choose.includes(line.id)) {
            piece.setAttribute('class', 'ln-pick');
            piece.setAttribute('tabindex', '0');
            piece.setAttribute('role', 'button');
            piece.setAttribute('aria-pressed', String(!!chosen));
            piece.setAttribute('aria-label', 'Line ' + line.label + ', ' + (chosen ? 'selected' : 'not selected')
              + '. Enter or Space selects it.');
            piece.style.cursor = 'pointer';
            const ends = line.finite ? [line.a, line.b] : clipLine(line.p, line.u);
            if (ends) {
              piece.prepend(svgElement('path', { d: pathOf(ends), fill: 'none', stroke: 'transparent', 'stroke-width': 28,
                'stroke-linecap': 'round', 'pointer-events': 'stroke' }));
              piece.append(svgElement('path', { class: 'ln-focus', d: pathOf(ends), fill: 'none', stroke: 'var(--school-accent)',
                'stroke-width': 9, 'stroke-opacity': 0.35, 'stroke-linecap': 'round' }));
            }
          }
        }
        plane.append(piece);
        lineNodes.push(piece);
      }
      for (const line of drawnNow) {
        const piece = drawLinePiece(line, { color: COLORS.blue, width: 3.2, key: 'new-' + line.id + '-' + fmt(line.p[0]) + '-' + fmt(line.p[1]) });
        keys.add('new-' + line.id + '-' + fmt(line.p[0]) + '-' + fmt(line.p[1]));
        plane.append(piece);
        lineNodes.push(piece);
      }
      // marks
      const marksOn = interactive ? true : st.marks;
      if (marksOn) for (const mark of model.marks) plane.append(drawMark(mark));
      if (!interactive && st.drawn && c && !st.tools) {
        const base = c.base;
        const mock = { id: 'new0', p: drawnNow[0]?.p ?? c.first, u: base.u, color: 'blue', finite: false };
        const a = svgElement('g');
        for (const line of [base, mock]) {
          const ends = clipLine(line.p, line.u);
          const mid = add(ends[0], mul(sub(ends[1], ends[0]), 0.62));
          const nrm = rot90(line.u);
          const tip = add(mid, mul(line.u, 0.14));
          const back = sub(tip, mul(line.u, 0.26));
          a.append(svgElement('path', { d: pathOf([add(back, mul(nrm, 0.2)), tip, sub(back, mul(nrm, 0.2))]), fill: 'none',
            stroke: line === base ? colorOf(base.color) : COLORS.blue, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        }
        plane.append(a);
      }
      // crossing point of extended lines
      if (!interactive && st.ext) {
        const ext = model.lines.filter(l => l.extend);
        for (let i = 0; i < ext.length; i++) for (let j = i + 1; j < ext.length; j++) {
          const x = cross(ext[i], ext[j]);
          if (x && x[0] >= 0 && x[0] <= GW && x[1] >= 0 && x[1] <= GH) {
            const [cx, cy] = px(x);
            plane.append(svgElement('circle', { cx, cy, r: 11, fill: T.orange, 'fill-opacity': 0.55, stroke: COLORS.orange,
              'stroke-width': 2, 'data-key': 'cross-' + i + '-' + j }));
            keys.add('cross-' + i + '-' + j);
          }
        }
      }
      // points
      const snapped = interactive ? snappedTarget() : -1;
      for (const p of model.points) {
        const idx = c ? c.targets.findIndex(t => t.name === p.id) : -1;
        const hot = interactive && c && idx >= 0 && idx === snapped;
        plane.append(drawPoint(p, hot));
        if (hot) keys.add('ring-' + p.id);
      }
      // labels
      for (const line of model.lines) {
        if (!visible.has(line.id)) continue;
        const chosen = hiSet?.has(line.id);
        const t = labelAt(line, line.label, { color: chosen ? COLORS.orange : undefined });
        if (t) plane.append(t);
      }
      for (const line of drawnNow) { const t = labelAt(line, line.label, { color: COLORS.blue, far: true }); if (t) plane.append(t); }
      // set square on top
      let triParts = null;
      if (tools && c) {
        const sg = interactive ? sigma : st.tri ?? 0;
        triParts = triShape(sg, interactive ? snapped >= 0 : false);
        if (interactive) {
          triParts.g.setAttribute('class', 'ln-tri');
          triParts.g.setAttribute('tabindex', '0');
          triParts.g.setAttribute('role', 'slider');
          triParts.g.setAttribute('aria-label', 'Set square. Arrow keys slide it along the ruler.');
          triParts.g.setAttribute('aria-valuemin', fmt(c.lo));
          triParts.g.setAttribute('aria-valuemax', fmt(c.hi));
          triParts.g.setAttribute('aria-valuenow', fmt(sg));
          triParts.g.setAttribute('aria-valuetext', 'Its edge is ' + fmt(Math.abs(sg) * c.b / c.h) + ' squares from line '
            + c.base.label + (snapped >= 0 ? ', touching the point' : ''));
          triParts.g.style.cursor = 'grab';
        }
        plane.append(triParts.g);
        keys.add('tri');
      }
      // badge "m ∥ n"
      if (!interactive && st.drawn && c && !st.tools) {
        const first = c.base.label;
        const second = c.labelFor(0);
        const w1 = 14 * first.length;
        const w2 = 14 * second.length;
        const w = 40 + w1 + 26 + w2;
        plane.append(svgElement('rect', { x: 14, y: 14, width: w, height: 38, rx: 19, fill: 'var(--school-surface)',
          'fill-opacity': 0.94, stroke: 'var(--school-accent)', 'stroke-opacity': 0.45 }));
        const txt = (x, t) => svgElement('text', { x, y: 34, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': 23, 'font-style': 'italic', 'font-weight': 700, fill: 'var(--school-ink)' }, t);
        const mid = 14 + 20 + w1 + 13;
        plane.append(txt(14 + 20 + w1 / 2, first), txt(mid + 13 + w2 / 2, second));
        plane.append(svgElement('path', { d: 'M' + (mid - 4) + ' 25V43M' + (mid + 4) + ' 25V43', stroke: 'var(--school-ink)',
          'stroke-width': 2.6, 'stroke-linecap': 'round' }));
      }

      // animation of what is new
      if (play && !reduced()) {
        for (const path of svg.querySelectorAll('path[data-key]')) {
          if (prev.keys.has(path.getAttribute('data-key'))) continue;
          path.setAttribute('pathLength', '1');
          path.animate([{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }],
            { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' });
        }
        for (const node of svg.querySelectorAll('[data-key]:not(path)')) {
          if (prev.keys.has(node.getAttribute('data-key'))) continue;
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
        }
        if (triParts) {
          const c2 = cons();
          if (!prev.keys.has('tri')) {
            triParts.inner.animate([{ opacity: 0, transform: 'translate(0,12px)' }, { opacity: 1, transform: 'none' }],
              { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
          } else if (prev.sigma !== null && prev.sigma !== (interactive ? sigma : st.tri)) {
            const d = (prev.sigma - (interactive ? sigma : st.tri));
            triParts.inner.animate([{ transform: 'translate(' + fmt(d * c2.w[0] * CELL) + 'px,' + fmt(-d * c2.w[1] * CELL) + 'px)' },
              { transform: 'translate(0,0)' }], { duration: 1100, easing: 'cubic-bezier(.45,.05,.3,1)' });
          }
        }
      }
      prev = { keys, sigma: triParts ? (interactive ? sigma : st.tri) : null };
      describe(st);
      if (interactive) drawBar();
    }

    function lineNames(set) { return [...set].map(k => model.lineMap.get(k)?.label ?? k).join(', '); }

    function describe(st) {
      const c = cons();
      if (interactive) {
        if (c) {
          const sn = snappedTarget();
          const dist = fmt(Math.abs(sigma) * c.b / c.h);
          if (status.dataset.keep) return;
          status.textContent = sn >= 0
            ? 'The edge of the square touches ' + (c.targets[sn].name || 'the point') + '. Press “Draw the line”.'
            : (c.targets.length ? 'Slide the square along the ruler until its edge reaches ' + c.targets.map(t => t.name || 'the point').join(' or ') + '.'
              : 'Slide the square along the ruler, then press “Draw the line”.') + ' The edge is ' + dist + ' squares from line ' + c.base.label + '.';
        } else if (!status.dataset.keep) {
          status.textContent = sel.size ? 'Selected: ' + lineNames(sel) + '.' : (mode === 'answer'
            ? 'Click the lines that fit the question, then press “Use this answer”.' : 'Click a line to mark it.');
        }
        return;
      }
      const cur = model.steps[step];
      const name = cur.name;
      const c2 = cons();
      status.textContent = name === 'triangle' ? 'The square is placed with its edge on line ' + c2.base.label + '.'
        : name === 'ruler' ? 'The ruler is placed along the other side of the square.'
          : name === 'slide' ? 'The square slides along the ruler until its edge reaches the point.'
            : name === 'draw' ? 'A line is drawn along the edge of the square, through the point.'
              : name === 'mark' ? 'The two lines are parallel.'
                : name === 'extend' ? 'The lines are continued: they meet.'
                  : name === 'highlight' ? 'Lines ' + lineNames(model.highlight) + ' are marked.'
                    : name === 'marks' ? 'The marks are shown.'
                      : 'Lines ' + lineNames(new Set(st.lines)) + '.';
    }

    function drawBar() {
      bar.replaceChildren();
      const make = (label, action, disabled = false) => {
        const b = htmlElement('button', label);
        b.type = 'button';
        b.dataset.action = action;
        b.disabled = disabled;
        bar.append(b);
      };
      const c = cons();
      if (c) {
        make('Slide back', 'back');
        make('Slide on', 'on');
        make('Draw the line', 'draw', !(snappedTarget() >= 0 || (c.free && drawn.length < c.max)));
        make('Erase lines', 'erase', !drawn.length);
        return;
      }
      make('Clear', 'clear', !sel.size);
      if (mode === 'answer') make('Use this answer', 'done');
    }

    // ---------- state ----------
    function getState() {
      const c = cons();
      if (mode === 'answer') {
        return { type: 'set', value: model.lines.filter(l => sel.has(l.id)).map(l => l.label) };
      }
      if (mode === 'explore') {
        if (c) return { offset: Math.round(sigma * 100) / 100, snapped: c.targets[snappedTarget()]?.name || null,
          lines: drawn.map(d => ({ label: d.label, through: c.targets[d.target]?.name || null, parallelTo: c.base.id })) };
        return { value: model.lines.filter(l => sel.has(l.id)).map(l => l.label) };
      }
      return { step, lines: [...stateAt(step).lines] };
    }

    // ---------- interaction ----------
    function toSvg(event) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
    }

    function setSigma(value, focus = false) {
      const c = cons();
      let v = Math.max(c.lo, Math.min(c.hi, value));
      for (const s of c.sig) if (Math.abs(v - s) * c.b / c.h < SNAP) { v = s; break; }
      if (Math.abs(v) * c.b / c.h < SNAP * 0.6) v = 0;
      sigma = v;
      return focus;
    }

    function toggle(lineId) {
      if (sel.has(lineId)) sel.delete(lineId); else sel.add(lineId);
      finished = false;
      delete status.dataset.keep;
      render();
      svg.querySelector('[data-line="' + lineId + '"]')?.focus({ preventScroll: true });
      onEvent('changed', getState());
    }

    function drawLine() {
      const c = cons();
      const at = snappedTarget();
      if (at >= 0) {
        if (!drawn.some(d => d.target === at)) drawn.push({ target: at, label: c.labelFor(at) });
      } else if (c.free && drawn.length < c.max) {
        drawn.push({ target: drawn.length, label: c.labelFor(drawn.length), free: true, offset: sigma });
      } else return;
      delete status.dataset.keep;
      render(true);
      status.dataset.keep = '1';
      status.textContent = 'Line ' + drawn[drawn.length - 1].label + ' is drawn. It is parallel to line ' + c.base.label + '.';
      onEvent('changed', getState());
      const complete = c.targets.length ? c.targets.every((_, i) => drawn.some(d => d.target === i)) : drawn.length >= c.max;
      if (complete && !finished) {
        finished = true;
        onEvent('done', getState());
      }
    }

    svg.addEventListener('pointerdown', event => {
      if (!interactive || event.button !== 0) return;
      const c = cons();
      const tri = event.target.closest('.ln-tri');
      if (c && tri && !drag) {
        tri.setPointerCapture(event.pointerId);
        const p = toSvg(event);
        drag = { id: event.pointerId, node: tri, x: p.x, y: p.y, s0: sigma, moved: false };
        delete status.dataset.keep;
        return;
      }
      const pick = event.target.closest('.ln-pick');
      if (pick) { event.preventDefault(); toggle(pick.dataset.line); }
    }, opt);

    svg.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const c = cons();
      const p = toSvg(event);
      const delta = [(p.x - drag.x) / CELL, -(p.y - drag.y) / CELL];
      drag.moved = true;
      setSigma(drag.s0 + dotp(delta, c.w));
      drag.node.setAttribute('transform', 'translate(' + fmt(sigma * c.w[0] * CELL) + ',' + fmt(-sigma * c.w[1] * CELL) + ')');
      drag.node.style.cursor = 'grabbing';
      describe(null);
    }, opt);

    const endDrag = event => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      render();
      svg.querySelector('.ln-tri')?.focus({ preventScroll: true });
      onEvent('changed', getState());
    };
    svg.addEventListener('pointerup', endDrag, opt);
    svg.addEventListener('pointercancel', endDrag, opt);

    svg.addEventListener('keydown', event => {
      if (!interactive) return;
      const tri = event.target.closest?.('.ln-tri');
      if (tri && cons()) {
        const c = cons();
        const big = event.shiftKey ? 5 : 1;
        const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
        if (dir) {
          event.preventDefault();
          setSigma(sigma + dir * 0.15 * big);
        } else if (event.key === 'Home') { event.preventDefault(); setSigma(c.lo); }
        else if (event.key === 'End') { event.preventDefault(); setSigma(c.hi); }
        else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drawLine(); return; }
        else return;
        delete status.dataset.keep;
        render();
        svg.querySelector('.ln-tri')?.focus({ preventScroll: true });
        onEvent('changed', getState());
        return;
      }
      const pick = event.target.closest?.('.ln-pick');
      if (pick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggle(pick.dataset.line); }
    }, opt);

    bar.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const c = cons();
      const action = button.dataset.action;
      if (action === 'back' || action === 'on') {
        setSigma(sigma + (action === 'on' ? 0.5 : -0.5));
        delete status.dataset.keep;
        render(true);
        onEvent('changed', getState());
      } else if (action === 'draw') drawLine();
      else if (action === 'erase') {
        drawn = [];
        finished = false;
        delete status.dataset.keep;
        render();
        onEvent('changed', getState());
      } else if (action === 'clear') {
        sel = new Set();
        finished = false;
        delete status.dataset.keep;
        render();
        onEvent('changed', getState());
      } else if (action === 'done') {
        finished = true;
        status.dataset.keep = '1';
        status.textContent = 'Your answer is ready to submit.';
        onEvent('done', getState());
      }
      void c;
    }, opt);

    function reset() {
      sel = new Set();
      drawn = [];
      sigma = 0;
      finished = false;
      drag = null;
      prev = { keys: new Set(), sigma: null };
      delete status.dataset.keep;
    }

    el.append(root);
    render();
    onEvent('ready', { steps: model.steps.length, step: 0 });

    return {
      setParams(nextParams) {
        if (destroyed) return;
        model = normalize(nextParams);
        step = 0;
        reset();
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
        root.remove();
      }
    };
  }
};
