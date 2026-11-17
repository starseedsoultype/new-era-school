const SVG = 'http://www.w3.org/2000/svg';
const MINUS = '−';
const NBSP = ' ';
const STEP_NAMES = ['bar', 'divide', 'change', 'known', 'one_part', 'result'];
const ZERO = { ticks: 0, change: 0, known: 0, onepart: 0, result: 0 };
let uid = 0;

// ---------- numbers ----------
function num(value, what) {
  const n = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError(what + ' must be a number.');
  return n;
}

// Contract section 2: decimal point, a space between thousands, the minus sign is a real minus.
function fmt(value) {
  const r = Math.round(value * 100) / 100;
  const abs = Math.abs(r);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const [whole, decimals] = text.split('.');
  return (r < 0 ? MINUS : '') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + (decimals ? '.' + decimals : '');
}

const same = (a, b) => Math.abs(a - b) < 1e-9;

// ---------- parameters ----------
function normalize(params, mode) {
  if (!params || typeof params !== 'object') throw new TypeError('Pass an object with base (or known) and change.');
  const ask = params.ask ?? 'after';
  if (ask !== 'after' && ask !== 'before') throw new TypeError('ask must be "after" or "before".');
  const rawChange = params.change ?? null;
  let kind = 'discount';
  let pct = 0;
  let givenMoney = null;
  if (params.given !== undefined && params.given !== null) {
    if (ask === 'before') throw new TypeError('"given" goes with ask "after" (use "known" for the reverse task).');
    givenMoney = num(params.given, 'given');
    if (!(givenMoney > 0)) throw new TypeError('given must be more than 0.');
  }
  if (rawChange) {
    kind = rawChange.kind ?? 'discount';
    if (kind !== 'discount' && kind !== 'markup') throw new TypeError('change.kind must be "discount" or "markup".');
    pct = num(rawChange.percent, 'change.percent');
    if (!(pct > 0)) throw new TypeError('change.percent must be more than 0.');
    if (kind === 'discount' && pct >= 100) throw new TypeError('A discount must be less than 100%.');
    if (kind === 'markup' && pct > 300) throw new TypeError('A markup of more than 300% does not fit.');
  } else if (ask === 'before') {
    throw new TypeError('"change" with kind and percent is needed.');
  }
  let finalPct = kind === 'discount' ? 100 - pct : 100 + pct;
  let perPct;
  if (ask === 'before') {
    const known = num(params.known, 'known');
    if (!(known > 0)) throw new TypeError('known must be more than 0.');
    perPct = known / finalPct;
  } else {
    const base = num(params.base, 'base');
    if (!(base > 0)) throw new TypeError('base must be more than 0.');
    perPct = base / 100;
  }
  let derived = false;
  if (givenMoney !== null && !rawChange) {
    // The task gives two prices and asks for the percent: the change is worked out here and shown only at the last step.
    const at = givenMoney / perPct;
    if (same(at, 100)) throw new TypeError('given must differ from base.');
    kind = at < 100 ? 'discount' : 'markup';
    pct = Math.round(Math.abs(100 - at) * 1e6) / 1e6;
    if (pct > 300) throw new TypeError('The change does not fit.');
    finalPct = at;
    derived = true;
  }
  let parts = params.parts;
  if (parts === undefined || parts === null) {
    parts = pct % 10 === 0 ? 10 : pct % 25 === 0 ? 4 : pct % 5 === 0 ? 20 : 10;
  } else {
    parts = num(parts, 'parts');
    if (!Number.isInteger(parts) || parts < 2 || parts > 20) throw new TypeError('parts must be a whole number from 2 to 20.');
  }
  const partPct = 100 / parts;
  const interactive = mode !== 'show';
  const axisMax = interactive
    ? Math.min(400, params.max !== undefined ? Math.max(num(params.max, 'max'), finalPct, 100) : Math.max(150, Math.ceil(finalPct / partPct - 1e-9) * partPct))
    : Math.max(100, finalPct);
  const snap = params.snap !== undefined ? num(params.snap, 'snap') : partPct;
  if (!(snap > 0 && snap <= 100)) throw new TypeError('snap must be from 0 to 100.');
  const start = params.start !== undefined ? num(params.start, 'start') : ask === 'before' ? finalPct : 100;
  const steps = params.steps ?? (ask === 'before'
    ? ['bar', 'divide', 'change', 'known', 'one_part', 'result']
    : pct === 0 ? ['bar', 'divide'] : ['bar', 'divide', 'change', 'result']);
  if (!Array.isArray(steps) || !steps.length || steps.some(name => !STEP_NAMES.includes(name))) {
    throw new TypeError('steps must list names from: ' + STEP_NAMES.join(', ') + '.');
  }
  return {
    ask, kind, pct, finalPct, perPct, derived, parts, partPct, axisMax, snap,
    start: Math.max(snap, Math.min(axisMax, start)), steps,
    unit: params.unit === undefined || params.unit === null ? 'coins' : String(params.unit),
    item: params.item === undefined || params.item === null ? 'Price' : String(params.item),
    showTag: params.showTag !== false,
    title: params.title ? String(params.title) : ''
  };
}

// ---------- drawing helpers ----------
function S(name, attributes = {}, text = '') {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== '') node.textContent = text;
  return node;
}

function H(name, text = '', className = '') {
  const node = document.createElement(name);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

// A rounded rectangle where each side can be round or square (pieces of the bar touch each other flat).
function rpath(x1, x2, y, h, r, roundLeft, roundRight) {
  if (!(x2 - x1 > 0.5)) return '';
  const k = Math.min(r, h / 2, (x2 - x1) / (roundLeft && roundRight ? 2 : 1));
  const a = roundLeft ? k : 0;
  const b = roundRight ? k : 0;
  let d = 'M' + (x1 + a) + ',' + y + 'H' + (x2 - b);
  if (b) d += 'A' + b + ',' + b + ' 0 0 1 ' + x2 + ',' + (y + b);
  d += 'V' + (y + h - b);
  if (b) d += 'A' + b + ',' + b + ' 0 0 1 ' + (x2 - b) + ',' + (y + h);
  d += 'H' + (x1 + a);
  if (a) d += 'A' + a + ',' + a + ' 0 0 1 ' + x1 + ',' + (y + h - a);
  d += 'V' + (y + a);
  if (a) d += 'A' + a + ',' + a + ' 0 0 1 ' + (x1 + a) + ',' + y;
  return d + 'Z';
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const COLORS = {
  line: 'var(--school-line)', accent: 'var(--school-accent)',
  transfer: 'var(--school-transfer)', ok: 'var(--school-ok-ink)'
};

export default {
  id: 'percent_bar',

  mount(el, params, api) {
    const { mode, onEvent = () => {} } = api;
    if (!['show', 'explore', 'answer'].includes(mode)) throw new TypeError('Choose a tool mode.');
    const interactive = mode !== 'show';
    const id = ++uid;
    let model = normalize(params, mode);
    let step = 0;
    let narrow = false;
    let side = false;
    let destroyed = false;
    let v = { ...ZERO };
    let p = model.start;
    let drag = null;
    let finished = false;
    let raf = 0;
    let ui = null;            // nodes of the current picture
    const controller = new AbortController();
    const opt = { signal: controller.signal };
    const still = () => api.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ---------- DOM ----------
    const root = H('section');
    root.className = 'pb-' + id;
    root.style.cssText = 'color:var(--school-ink);font:1rem var(--school-font);min-width:0;position:relative';
    const style = H('style', `
      .pb-${id} .pb-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
      .pb-${id} .pb-wrap.side { flex-direction: row; }
      .pb-${id} .pb-fig { width: 100%; min-width: 0; flex: 1 1 auto; }
      .pb-${id} svg { display: block; width: 100%; height: auto; margin: 0 auto; font-family: var(--school-font); }
      .pb-${id} svg text { paint-order: stroke; stroke: var(--school-surface); stroke-width: 3px; stroke-linejoin: round; }
      .pb-${id} .pb-handle { touch-action: none; cursor: ew-resize; }
      .pb-${id} .pb-handle:focus { outline: none; }
      .pb-${id} .pb-handle:focus-visible .pb-hbody { stroke: var(--school-accent); stroke-width: 4; }
      .pb-${id} .pb-handle .pb-hbody { filter: drop-shadow(0 3px 4px rgba(24, 40, 64, .28)); }
      .pb-${id} .pb-tag { position: relative; width: 100%; max-width: 520px; padding: 14px 16px 12px; background: var(--school-note-bg);
        color: var(--school-note-ink); border: 1.5px solid var(--school-line); border-radius: var(--school-radius);
        box-shadow: 0 6px 16px rgba(24, 40, 64, .12); }
      .pb-${id} .pb-wrap.side .pb-tag { width: 210px; flex: 0 0 210px; }
      .pb-${id} .pb-tag::before { content: ''; position: absolute; top: 10px; right: 14px; width: 11px; height: 11px;
        border-radius: 50%; background: var(--school-page); border: 1.5px solid var(--school-line); }
      .pb-${id} .pb-title { margin: 0 0 8px; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--school-muted); }
      .pb-${id} .pb-rows { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
      .pb-${id} .pb-wrap.side .pb-rows { grid-template-columns: 1fr; gap: 6px; }
      .pb-${id} .pb-row { margin: 0; padding: 6px 8px; border-radius: 12px; transition: opacity .35s ease, background .35s ease; min-width: 0; }
      .pb-${id} .pb-row dt { margin: 0; font-size: .78rem; color: var(--school-muted); }
      .pb-${id} .pb-row dd { margin: 0; font: 700 1.2rem var(--school-number-font); overflow-wrap: anywhere; color: var(--school-ink); }
      .pb-${id} .pb-row dd small { display: block; font: .85rem var(--school-number-font); color: var(--school-muted); font-weight: 400; }
      .pb-${id} .pb-row.now { background: var(--school-ok-bg); }
      .pb-${id} .pb-row.now dd { color: var(--school-ok-ink); }
      .pb-${id} .pb-row.chg dd.discount { color: var(--school-transfer); }
      .pb-${id} .pb-row.chg dd.markup { color: var(--school-ok-ink); }
      .pb-${id} .pb-row.hit { background: var(--school-ok-bg); }
      .pb-${id} .pb-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; justify-content: center; }
      .pb-${id} button { font: inherit; color: inherit; background: var(--school-surface); border: 1px solid var(--school-line);
        border-radius: 999px; padding: .4rem .9rem; min-height: 40px; cursor: pointer; }
      .pb-${id} button:disabled { opacity: .55; cursor: default; }
      .pb-${id} .pb-status { margin: 8px 0 0; text-align: center; }
      .pb-${id} .pb-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      @media (prefers-reduced-motion: reduce) { .pb-${id} .pb-row { transition: none; } }`);
    const wrap = H('div', '', 'pb-wrap');
    const fig = H('div', '', 'pb-fig');
    const status = H('p', '', 'pb-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    if (!interactive) status.className = 'pb-vh';
    const bar = H('div', '', 'pb-bar');
    const tag = H('aside', '', 'pb-tag');
    tag.setAttribute('aria-label', 'Price tag');
    const tagTitle = H('p', '', 'pb-title');
    const rows = H('dl', '', 'pb-rows');
    const rowWas = H('div', '', 'pb-row was');
    const rowChg = H('div', '', 'pb-row chg');
    const rowNow = H('div', '', 'pb-row now');
    const wasLabel = H('dt', 'Was');
    const wasValue = H('dd');
    const chgLabel = H('dt');
    const chgValue = H('dd');
    const chgSub = H('small');
    const nowLabel = H('dt', 'Now');
    const nowValue = H('dd');
    rowWas.append(wasLabel, wasValue);
    chgValue.append(chgSub);
    rowChg.append(chgLabel, chgValue);
    rowNow.append(nowLabel, nowValue);
    rows.append(rowWas, rowChg, rowNow);
    tag.append(tagTitle, rows);
    wrap.append(fig, tag);
    root.append(style, wrap, status);
    if (interactive) root.append(bar);

    // ---------- text helpers ----------
    const unitSuffix = () => (model.unit ? NBSP + model.unit : '');
    const money = pctValue => fmt(model.perPct * pctValue) + unitSuffix();
    const pctText = value => fmt(value) + '%';
    const isDiscount = () => model.kind === 'discount';
    const before = () => model.ask === 'before';

    // ---------- build the picture ----------
    function geometry() {
      const g = narrow
        ? { W: 360, barX: 22, barW: 316, bh: 50, fs: 12, fsb: 15 }
        : { W: 760, barX: 36, barW: 688, bh: 58, fs: 13, fsb: 17 };
      const topY = 120;
      return Object.assign(g, {
        topY, botY: topY + g.bh, r: Math.min(14, g.bh / 3),
        tickTop: topY - 10, t1Top: topY - 28, t2Top: topY - 70,
        tickBot: topY + g.bh + 18, t1Bot: topY + g.bh + 30, t2Bot: topY + g.bh + 76,
        H: topY + g.bh + 108
      });
    }

    function build() {
      fig.replaceChildren();
      const G = geometry();
      const sx = pct => G.barX + pct * G.barW / model.axisMax;
      const svg = S('svg', { viewBox: '0 0 ' + G.W + ' ' + G.H, role: interactive ? 'group' : 'img' });
      svg.style.maxWidth = narrow ? '560px' : '760px';
      if (interactive) svg.style.touchAction = 'pan-y';
      const defs = S('defs');
      const hatchId = 'pb-hatch-' + id;
      const pattern = S('pattern', { id: hatchId, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      pattern.append(S('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: COLORS.transfer, 'stroke-width': 2, opacity: 0.4 }));
      defs.append(pattern);
      const layerTicks = S('g');
      const layerBar = S('g');
      const layerDivs = S('g');
      const layerNums = S('g');
      const layerBrackets = S('g');
      const layerHandle = S('g');
      svg.append(defs, layerTicks, layerBar, layerDivs, layerNums, layerBrackets, layerHandle);

      const fill = { fill: 'none' };
      const frame = S('path', { ...fill, stroke: COLORS.accent, 'stroke-width': 2, 'stroke-dasharray': '7 5' });
      const base = S('path', { fill: 'var(--school-active)', stroke: COLORS.accent, 'stroke-width': 2, 'stroke-linejoin': 'round' });
      const cut = S('path', { fill: 'var(--school-transfer-bg)', stroke: COLORS.transfer, 'stroke-width': 2, 'stroke-linejoin': 'round' });
      const cutHatch = S('path', { fill: 'url(#' + hatchId + ')', stroke: 'none' });
      const ext = S('path', { fill: 'var(--school-ok-bg)', stroke: COLORS.ok, 'stroke-width': 2, 'stroke-linejoin': 'round' });
      const hold = S('path', { ...fill, stroke: COLORS.accent, 'stroke-width': 4, 'stroke-linejoin': 'round' });
      const goal = S('path', { ...fill, stroke: COLORS.transfer, 'stroke-width': 2.5, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' });
      layerBar.append(frame, base, cut, cutHatch, ext, hold, goal);

      // ticks: percents above, money below, little marks on the edges
      const tickStep = narrow ? (model.parts > 10 ? 4 : model.parts > 5 ? 2 : 1) : (model.parts > 10 ? 2 : 1);
      const ticks = [];
      for (let i = 0; i * model.partPct <= model.axisMax + 1e-9; i += 1) {
        const at = i * model.partPct;
        const x = sx(at);
        const label = i % tickStep === 0 || same(at, 100);
        const marks = S('path', { d: 'M' + x + ',' + (G.topY - 5) + 'V' + G.topY + 'M' + x + ',' + G.botY + 'V' + (G.botY + 5),
          stroke: COLORS.line, 'stroke-width': 1.5, 'stroke-linecap': 'round' });
        const tp = label ? S('text', { x, y: G.tickTop, 'text-anchor': 'middle', 'font-size': G.fs, fill: 'var(--school-muted)' }, pctText(at)) : null;
        const tm = label ? S('text', { x, y: G.tickBot, 'text-anchor': 'middle', 'font-size': G.fs, fill: 'var(--school-muted)' }, fmt(model.perPct * at)) : null;
        layerTicks.append(marks, ...(label ? [tp, tm] : []));
        ticks.push({ at, marks, tp, tm });
      }

      // dividers and per-part numbers
      const divs = [];
      const nums = [];
      const partW = G.barW * model.partPct / model.axisMax;
      const extent = isDiscount() ? 100 : Math.max(100, model.finalPct);
      for (let i = 1; i * model.partPct < extent - 1e-9; i += 1) {
        const at = i * model.partPct;
        if (same(at, 100)) continue;
        const line = S('path', { d: 'M' + sx(at) + ',' + G.topY + 'V' + G.botY, stroke: COLORS.accent, 'stroke-width': 1.2, opacity: 0 });
        layerDivs.append(line);
        divs.push({ at, line });
      }
      if (!interactive && partW >= 24) {
        for (let i = 0; (i + 1) * model.partPct <= extent + 1e-9; i += 1) {
          const from = i * model.partPct;
          const text = S('text', { x: sx(from + model.partPct / 2), y: G.topY + G.bh / 2 + 5, 'text-anchor': 'middle',
            'font-size': G.fs + 2, 'font-weight': 700, fill: 'var(--school-ink)', opacity: 0 }, fmt(model.perPct * model.partPct));
          const inCut = isDiscount() && from >= model.finalPct - 1e-9;
          const inExt = !isDiscount() && from >= 100 - 1e-9;
          layerNums.append(text);
          nums.push({ node: text, inCut, inExt });
        }
      }

      // brackets
      const brackets = [];
      function bracket(def) {
        const col = COLORS[def.color];
        const strokeAttrs = { ...fill, stroke: col, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
        const g = S('g', { opacity: 0 });
        const topPath = S('path', strokeAttrs);
        const botPath = S('path', strokeAttrs);
        const textAttrs = { 'text-anchor': 'middle', 'font-size': G.fsb, 'font-weight': 700, fill: def.color === 'line' ? 'var(--school-ink)' : col };
        const topText = S('text', textAttrs);
        const top1 = S('text', textAttrs);
        const bot0 = S('text', textAttrs);
        const bot1 = S('text', textAttrs);
        g.append(topPath, topText, top1, botPath, bot0, bot1);
        layerBrackets.append(g);
        const node = { g, topPath, botPath, topText, top1, bot0, bot1, def };
        place(node, def.a, def.b, def.tier, def.top, def.bottom);
        return node;
      }
      function place(node, a, b, tier, top, bottom) {
        const x1 = sx(a) + 2;
        const x2 = sx(b) - 2;
        const cx = (x1 + x2) / 2;
        const yT = tier === 1 ? G.t1Top : G.t2Top;
        const yB = tier === 1 ? G.t1Bot : G.t2Bot;
        node.topPath.setAttribute('d', 'M' + x1 + ',' + (yT + 6) + 'V' + yT + 'H' + x2 + 'V' + (yT + 6));
        node.botPath.setAttribute('d', 'M' + x1 + ',' + (yB - 6) + 'V' + yB + 'H' + x2 + 'V' + (yB - 6));
        for (const [text, y] of [[node.topText, yT - 8], [node.top1, yT - 8], [node.bot0, yB + 21], [node.bot1, yB + 21]]) {
          text.setAttribute('x', cx);
          text.setAttribute('y', y);
        }
        const tops = Array.isArray(top) ? top : [top];
        node.topText.textContent = tops[0] ?? '';
        node.top1.textContent = tops[1] ?? '';
        node.bot0.textContent = bottom[0] ?? '';
        node.bot1.textContent = bottom[1] ?? '';
      }

      const fp = model.finalPct;
      const pctOf = pctValue => (isDiscount() ? MINUS : '+') + fmt(pctValue) + '%';
      const moneyOfChange = () => (isDiscount() ? MINUS : '+') + money(model.pct);
      const unknown = before() || model.derived;      // the size of the change is hidden until the last step
      const keptTop = model.derived ? ['?', pctText(fp)] : pctText(fp);
      if (!interactive) {
        brackets.push({ ...bracket({ tier: 2, a: 0, b: 100, color: 'line', top: '100%',
          bottom: before() ? ['?', money(100)] : [money(100)] }),
        vis: () => 1, alt: val => (before() ? val.result : 0) });
        if (model.pct > 0 && isDiscount()) {
          brackets.push({ ...bracket({ tier: 1, a: fp, b: 100, color: 'transfer', top: model.derived ? ['?', pctOf(model.pct)] : pctOf(model.pct),
            bottom: unknown ? ['?', moneyOfChange()] : [moneyOfChange()] }),
          vis: val => val.change, alt: val => (unknown ? val.result : 0) });
          brackets.push({ ...bracket({ tier: 1, a: 0, b: fp, color: 'accent', top: keptTop, bottom: [money(fp)] }),
            vis: val => (before() ? val.known : model.derived ? val.change : val.result), alt: val => (model.derived ? val.result : 0) });
        } else if (model.pct > 0) {
          brackets.push({ ...bracket({ tier: 1, a: 100, b: fp, color: 'ok', top: model.derived ? ['?', pctOf(model.pct)] : pctOf(model.pct),
            bottom: unknown ? ['?', moneyOfChange()] : [moneyOfChange()] }),
          vis: val => val.change * (1 - (before() ? val.known : val.result)), alt: val => (unknown ? val.result : 0) });
          brackets.push({ ...bracket({ tier: 1, a: 0, b: fp, color: 'accent', top: pctText(fp), bottom: [money(fp)] }),
            vis: val => (before() ? val.known : val.result), alt: () => 0 });
        }
      }

      // handle (explore, answer)
      let handle = null;
      let live = null;
      if (interactive) {
        const hh = G.bh + 22;
        const grab = S('rect', { x: -22, y: G.topY - 11, width: 44, height: hh, fill: 'transparent' });
        const body = S('rect', { class: 'pb-hbody', x: -9, y: G.topY - 11, width: 18, height: hh, rx: 9, fill: 'var(--school-surface)',
          stroke: COLORS.accent, 'stroke-width': 2.5 });
        const grip = S('path', { d: 'M-2.5,' + (G.topY + G.bh / 2 - 7) + 'v14M2.5,' + (G.topY + G.bh / 2 - 7) + 'v14', stroke: COLORS.accent,
          'stroke-width': 2, 'stroke-linecap': 'round' });
        handle = S('g', { class: 'pb-handle', tabindex: 0, role: 'slider', 'aria-label': before() ? 'Right edge of the whole bar' : 'Right edge of the bar',
          'aria-valuemin': model.snap, 'aria-valuemax': model.axisMax });
        handle.append(grab, body, grip);
        layerHandle.append(handle);
        live = {
          whole: bracket({ tier: 2, a: 0, b: 100, color: 'line', top: '100%', bottom: [money(100)] }),
          now: bracket({ tier: before() ? 2 : 1, a: 0, b: model.start, color: 'accent', top: '', bottom: [''] }),
          fixed: before() ? bracket({ tier: 1, a: 0, b: fp, color: 'accent', top: pctText(fp), bottom: [money(fp)] }) : null
        };
        live.now.g.setAttribute('opacity', 1);
        live.fixed?.g.setAttribute('opacity', 1);
        if (before()) {
          live.whole.g.remove();
          live.whole = null;
        } else {
          live.whole.g.setAttribute('opacity', 1);
        }
      }

      fig.append(svg);
      ui = { G, sx, svg, frame, base, cut, cutHatch, ext, hold, goal, ticks, divs, nums, brackets, place, handle, live, partW };
    }

    // ---------- paint ----------
    function paintTag(values) {
      tagTitle.textContent = model.item;
      chgLabel.textContent = isDiscount() ? 'Discount (скидка)' : 'Markup (наценка)';
      chgValue.className = isDiscount() ? 'discount' : 'markup';
      if (interactive) {
        paintTagExplore();
        return;
      }
      const result = values.result > 0.5;
      const knownNow = before() || model.derived;
      const hideChange = model.derived && !result;
      wasValue.textContent = before() && !result ? '?' : money(100);
      chgValue.firstChild?.nodeType === 3 && chgValue.firstChild.remove();
      chgValue.prepend(document.createTextNode(hideChange ? '?' : (isDiscount() ? MINUS : '+') + fmt(model.pct) + '%'));
      chgSub.textContent = (before() || model.derived) && !result ? '?' : (isDiscount() ? MINUS : '+') + money(model.pct);
      nowValue.textContent = money(model.finalPct);
      rowChg.style.opacity = model.pct === 0 ? 0 : values.change;
      rowNow.style.opacity = model.pct === 0 ? 0 : knownNow ? 1 : values.result;
      rowChg.setAttribute('aria-hidden', model.pct === 0 || values.change < 0.5 ? 'true' : 'false');
      rowNow.setAttribute('aria-hidden', model.pct === 0 || (!knownNow && values.result < 0.5) ? 'true' : 'false');
    }

    function paintTagExplore() {
      rowChg.style.opacity = 1;
      rowNow.style.opacity = 1;
      rowWas.classList.remove('hit');
      let mark = '';
      if (before()) {
        wasValue.textContent = money(p);
        if (same(p, 100)) rowWas.classList.add('hit');
        nowValue.textContent = money(model.finalPct);
        mark = (isDiscount() ? MINUS : '+') + fmt(model.pct) + '%';
        chgSub.textContent = '';
      } else {
        wasValue.textContent = money(100);
        nowValue.textContent = money(p);
        const delta = p - 100;
        const down = delta < 0;
        chgLabel.textContent = same(delta, 0) ? 'No change' : down ? 'Discount (скидка)' : 'Markup (наценка)';
        chgValue.className = down ? 'discount' : 'markup';
        mark = same(delta, 0) ? '0%' : (down ? MINUS : '+') + fmt(Math.abs(delta)) + '%';
        chgSub.textContent = same(delta, 0) ? '' : (down ? MINUS : '+') + money(Math.abs(delta));
      }
      chgValue.firstChild?.nodeType === 3 && chgValue.firstChild.remove();
      chgValue.prepend(document.createTextNode(mark));
    }

    function paintShow() {
      const { G, sx } = ui;
      const fp = model.finalPct;
      if (before()) {
        ui.frame.setAttribute('d', rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
        ui.base.setAttribute('d', isDiscount() ? rpath(sx(0), sx(fp), G.topY, G.bh, G.r, true, false) : rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
        ui.base.setAttribute('opacity', v.change);
      } else {
        ui.frame.setAttribute('d', '');
        ui.base.setAttribute('d', rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
        ui.base.setAttribute('opacity', 1);
      }
      if (isDiscount() && model.pct > 0) {
        const d = rpath(sx(fp), sx(100), G.topY, G.bh, G.r, false, true);
        ui.cut.setAttribute('d', d);
        ui.cutHatch.setAttribute('d', d);
        const o = Math.min(1, v.change * 2);
        ui.cut.setAttribute('opacity', o);
        ui.cutHatch.setAttribute('opacity', o);
        ui.ext.setAttribute('d', '');
        ui.hold.setAttribute('d', rpath(sx(0), sx(fp), G.topY, G.bh, G.r, true, false));
      } else if (model.pct > 0) {
        const gap = 4;
        const x0 = sx(100) + gap;
        const x1 = x0 + (sx(fp) - x0) * v.change;
        ui.ext.setAttribute('d', rpath(x0, x1, G.topY, G.bh, G.r, true, true));
        ui.ext.setAttribute('opacity', Math.min(1, v.change * 4));
        ui.cut.setAttribute('d', '');
        ui.cutHatch.setAttribute('d', '');
        ui.hold.setAttribute('d', rpath(sx(0), sx(fp), G.topY, G.bh, G.r, true, true));
      }
      ui.hold.setAttribute('opacity', before() ? v.known : v.result);
      for (const tick of ui.ticks) {
        const out = before() ? v.result : v.ticks;
        tick.marks.setAttribute('opacity', v.ticks);
        tick.tp?.setAttribute('opacity', v.ticks);
        tick.tm?.setAttribute('opacity', out);
        if (before() && same(tick.at, 0)) tick.tm?.setAttribute('opacity', v.ticks);
        if (before() && isDiscount() && same(tick.at, fp)) tick.tm?.setAttribute('opacity', Math.max(out, v.known));
      }
      for (const div of ui.divs) {
        div.line.setAttribute('opacity', 0.45 * v.ticks * (div.at > 100 ? v.change : 1));
      }
      for (const entry of ui.nums) {
        let o;
        if (!before()) o = v.ticks * (entry.inExt ? v.change : 1);
        else o = (entry.inCut ? v.result : v.onepart) * (entry.inExt ? v.change : 1);
        entry.node.setAttribute('opacity', o);
      }
      for (const b of ui.brackets) {
        b.g.setAttribute('opacity', Math.max(0, Math.min(1, b.vis(v))));
        const flip = Math.max(0, Math.min(1, b.alt(v)));
        const pair = (first, second, two) => {
          first.setAttribute('opacity', two ? 1 - flip : 1);
          second.setAttribute('opacity', two ? flip : 0);
        };
        pair(b.bot0, b.bot1, b.def.bottom.length > 1);
        pair(b.topText, b.top1, Array.isArray(b.def.top) && b.def.top.length > 1);
      }
      paintTag(v);
    }

    function paintExplore() {
      const { G, sx, live } = ui;
      const fp = model.finalPct;
      const gap = 4;
      for (const node of [ui.cut, ui.cutHatch, ui.ext, ui.hold]) node.setAttribute('d', '');
      ui.hold.setAttribute('opacity', 0);
      ui.frame.setAttribute('opacity', 1);
      ui.goal.setAttribute('d', model.derived ? 'M' + sx(fp) + ',' + (G.topY - 16) + 'V' + (G.botY + 16) : '');
      ui.base.setAttribute('opacity', 1);
      if (before()) {
        // The known price is a solid bar; the dashed frame is the bar the student sets.
        ui.frame.setAttribute('d', rpath(sx(0), sx(p), G.topY, G.bh, G.r, true, true));
        if (isDiscount()) {
          ui.base.setAttribute('d', rpath(sx(0), sx(fp), G.topY, G.bh, G.r, true, true));
        } else {
          ui.base.setAttribute('d', rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
          ui.ext.setAttribute('d', rpath(sx(100) + gap, sx(fp), G.topY, G.bh, G.r, true, true));
        }
      } else {
        ui.frame.setAttribute('d', rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
        if (p < 100 - 1e-9) {
          ui.base.setAttribute('d', rpath(sx(0), sx(p), G.topY, G.bh, G.r, true, false));
          const d = rpath(sx(p), sx(100), G.topY, G.bh, G.r, false, true);
          ui.cut.setAttribute('d', d);
          ui.cutHatch.setAttribute('d', d);
        } else {
          ui.base.setAttribute('d', rpath(sx(0), sx(100), G.topY, G.bh, G.r, true, true));
          if (p > 100 + 1e-9) ui.ext.setAttribute('d', rpath(sx(100) + gap, sx(p), G.topY, G.bh, G.r, true, true));
        }
      }
      for (const tick of ui.ticks) {
        tick.marks.setAttribute('opacity', 1);
        tick.tp?.setAttribute('opacity', 1);
        tick.tm?.setAttribute('opacity', before() ? (tick.at <= p + 1e-9 ? 1 : 0.35) : 1);
      }
      for (const div of ui.divs) div.line.setAttribute('opacity', div.at <= Math.max(p, before() ? fp : 100) + 1e-9 ? 0.45 : 0);
      ui.handle.setAttribute('transform', 'translate(' + sx(p) + ',0)');
      ui.handle.setAttribute('aria-valuenow', p);
      ui.handle.setAttribute('aria-valuetext', fmt(p) + '%, ' + money(p));
      ui.place(live.now, 0, p, before() ? 2 : 1, pctText(p), [money(p)]);
      paintTag(v);
    }

    function paint() {
      if (!ui) return;
      if (interactive) paintExplore();
      else paintShow();
    }

    // ---------- status line ----------
    function describe() {
      if (interactive) {
        if (model.derived) {
          status.textContent = 'Move the edge of the bar to the dashed line. The bar is ' + pctText(p) + ' of the old price: ' + money(p) + '.';
          return;
        }
        status.textContent = before()
          ? 'The whole bar is ' + pctText(p) + ': ' + money(p) + '. The price we know is ' + money(model.finalPct) + ' (' + pctText(model.finalPct) + ').'
          : 'The bar is ' + pctText(p) + ' of the old price: ' + money(p) + '.';
        return;
      }
      const name = model.steps[step];
      const k = model.finalPct / model.partPct;
      const texts = {
        bar: before() ? 'The old price is the whole bar, 100%. We do not know it yet.' : 'The whole bar is the old price: 100%, ' + money(100) + '.',
        divide: 'The bar is cut into ' + model.parts + ' equal parts of ' + pctText(model.partPct) + ' each.',
        change: model.pct === 0 ? 'The price does not change.' : isDiscount()
          ? 'The discount takes off ' + pctText(model.pct) + ' of the old price.'
          : 'The markup adds ' + pctText(model.pct) + ' of the old price on top.',
        known: 'The price we know is ' + pctText(model.finalPct) + ' of the bar: ' + money(model.finalPct) + '.',
        one_part: fmt(k) + ' parts together hold ' + money(model.finalPct) + '. One part is ' + money(model.partPct) + '.',
        result: before() ? 'The old price is the whole bar, 100%: ' + money(100) + '.' : 'The new price is ' + pctText(model.finalPct) + ': ' + money(model.finalPct) + '.'
      };
      status.textContent = texts[name];
    }

    function summary() {
      if (model.title) return model.title;
      const change = model.pct === 0 ? '' : ' with a ' + fmt(model.pct) + '% ' + model.kind;
      return before()
        ? 'Percent bar: the price now is ' + money(model.finalPct) + change + '. The whole bar is the old price, 100%.'
        : 'Percent bar: the old price is ' + money(100) + change + '.';
    }

    // ---------- movement ----------
    function target() {
      const reached = name => {
        const i = model.steps.indexOf(name);
        return i >= 0 && i <= step ? 1 : 0;
      };
      return { ticks: reached('divide'), change: reached('change'), known: reached('known'), onepart: reached('one_part'), result: reached('result') };
    }

    function goTo(next, animate) {
      cancelAnimationFrame(raf);
      if (!animate || still() || typeof requestAnimationFrame !== 'function') {
        v = next;
        paint();
        return;
      }
      const from = { ...v };
      const t0 = performance.now();
      const run = now => {
        if (destroyed) return;
        const t = Math.min(1, (now - t0) / 520);
        const k = ease(t);
        v = Object.fromEntries(Object.keys(next).map(key => [key, from[key] + (next[key] - from[key]) * k]));
        paint();
        if (t < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }

    function moveTo(value, smooth) {
      const clamped = Math.max(model.snap, Math.min(model.axisMax, Math.round(value / model.snap) * model.snap));
      const next = Math.round(clamped * 1e6) / 1e6;
      if (same(next, p)) return false;
      finished = false;
      cancelAnimationFrame(raf);
      if (!smooth || still() || typeof requestAnimationFrame !== 'function') {
        p = next;
        afterMove();
        return true;
      }
      const from = p;
      const t0 = performance.now();
      const run = now => {
        if (destroyed) return;
        const t = Math.min(1, (now - t0) / 160);
        p = t < 1 ? from + (next - from) * ease(t) : next;
        paint();
        if (t < 1) raf = requestAnimationFrame(run);
        else afterMove();
      };
      raf = requestAnimationFrame(run);
      return true;
    }

    function afterMove() {
      paint();
      describe();
      onEvent('changed', getState());
    }

    function getState() {
      if (mode === 'answer') {
        const value = Math.round(model.perPct * p * 100) / 100;
        return { type: Number.isInteger(value) ? 'int' : 'decimal', value: String(value) };
      }
      if (interactive) {
        return { percent: p, change: Math.round((p - 100) * 1e6) / 1e6, value: String(Math.round(model.perPct * p * 100) / 100) };
      }
      return { step, name: model.steps[step], percent: model.finalPct,
        value: before() && !(v.result > 0.5) ? null : String(Math.round(model.perPct * model.finalPct * 100) / 100) };
    }

    // ---------- interaction ----------
    function pointerPct(event) {
      const point = ui.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = ui.svg.getScreenCTM();
      const x = matrix ? point.matrixTransform(matrix.inverse()).x : ui.G.barX;
      return (x - ui.G.barX) * model.axisMax / ui.G.barW;
    }

    function onDown(event) {
      if (!interactive || drag || event.button !== 0) return;
      const rect = ui.svg.getBoundingClientRect();
      const y = (event.clientY - rect.top) * ui.G.H / rect.height;
      const onHandle = event.target.closest?.('.pb-handle');
      if (!onHandle && (y < ui.G.topY - 30 || y > ui.G.botY + 30)) return;
      drag = { id: event.pointerId };
      ui.svg.setPointerCapture(event.pointerId);
      moveTo(pointerPct(event), !onHandle);
      ui.handle.focus({ preventScroll: true });
      event.preventDefault();
    }

    function onMove(event) {
      if (drag?.id !== event.pointerId) return;
      moveTo(pointerPct(event), false);
    }

    function onUp(event) {
      if (drag?.id === event.pointerId) drag = null;
    }

    function onKey(event) {
      if (!interactive) return;
      const big = Math.max(model.snap, model.partPct);
      const delta = { ArrowRight: model.snap, ArrowUp: model.snap, ArrowLeft: -model.snap, ArrowDown: -model.snap, PageUp: big, PageDown: -big }[event.key];
      if (delta !== undefined) {
        event.preventDefault();
        moveTo(p + delta, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        moveTo(model.snap, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        moveTo(model.axisMax, true);
      }
    }

    function drawBar() {
      bar.replaceChildren();
      const button = (label, action) => {
        const b = H('button', label);
        b.type = 'button';
        b.dataset.action = action;
        bar.append(b);
      };
      button(MINUS + ' Less', 'less');
      button('More +', 'more');
      button('Start again', 'reset');
      if (mode === 'answer') button('Use this answer', 'done');
    }

    bar.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'less') moveTo(p - model.snap, true);
      if (action === 'more') moveTo(p + model.snap, true);
      if (action === 'reset') {
        const changed = moveTo(model.start, true);
        if (!changed) afterMove();
      }
      if (action === 'done' && !finished) {
        finished = true;
        status.textContent = 'Your answer is ready to submit.';
        onEvent('done', getState());
      }
    }, opt);

    // ---------- size and start ----------
    function rebuild() {
      build();
      if (interactive) {
        ui.svg.addEventListener('pointerdown', onDown, opt);
        ui.svg.addEventListener('pointermove', onMove, opt);
        ui.svg.addEventListener('pointerup', onUp, opt);
        ui.svg.addEventListener('pointercancel', onUp, opt);
        ui.handle.addEventListener('keydown', onKey, opt);
      } else {
        ui.svg.setAttribute('aria-label', summary());
      }
      tag.hidden = !model.showTag;
      wrap.className = 'pb-wrap' + (side ? ' side' : '');
      v = interactive ? { ...ZERO } : target();
      paint();
      describe();
    }

    function fit() {
      const width = el.clientWidth || 600;
      const nextSide = width >= 960;
      const figWidth = nextSide ? width - 224 : width;
      const nextNarrow = figWidth < 560;
      if (nextSide === side && nextNarrow === narrow && ui) return;
      side = nextSide;
      narrow = nextNarrow;
      if (!destroyed) rebuild();
    }

    el.append(root);
    if (interactive) drawBar();
    side = (el.clientWidth || 600) >= 960;
    narrow = ((side ? (el.clientWidth || 600) - 224 : el.clientWidth || 600)) < 560;
    rebuild();
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
        p = model.start;
        finished = false;
        cancelAnimationFrame(raf);
        rebuild();
        onEvent('ready', { steps: model.steps.length, step: 0 });
      },
      setStep(n) {
        if (destroyed || mode !== 'show' || !Number.isFinite(n)) return;
        const previous = step;
        step = Math.max(0, Math.min(Math.trunc(n), model.steps.length - 1));
        goTo(target(), Math.abs(step - previous) === 1);
        describe();
        onEvent('step', { step, steps: model.steps.length });
      },
      getState,
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        controller.abort();
        observer?.disconnect();
        root.remove();
      }
    };
  }
};
