const SVG = 'http://www.w3.org/2000/svg';
const operations = { add: '+', sub: '−', mul: '×' };
const digits = '0123456789';

function parseNumber(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError('Use digit strings such as "248" or "12.5".');
  }
  const [whole, fraction = ''] = value.split('.');
  return { whole: whole.replace(/^0+(?=\d)/, ''), fraction };
}

// The model stores each row from right to left: index 0 is its rightmost digit.
function makeModel({ op, numbers }) {
  if (!Object.hasOwn(operations, op) || !Array.isArray(numbers) || numbers.length !== 2) {
    throw new TypeError('Choose add, sub, or mul and supply two numbers.');
  }
  const [a, b] = numbers.map(parseNumber);
  const scale = op === 'mul'
    ? a.fraction.length + b.fraction.length
    : Math.max(a.fraction.length, b.fraction.length);
  const toRow = ({ whole, fraction }) => [...(whole + (
    op === 'mul' ? fraction : fraction.padEnd(scale, '0')
  ))].reverse().map(Number);
  const first = toRow(a);
  const second = toRow(b);
  const length = Math.max(first.length, second.length);
  const width = op === 'mul'
    ? Math.max(first.length + second.length, scale + 1)
    : length + Number(op === 'add');
  const rows = [
    { digits: [], scale: 0 },
    { digits: first, scale: op === 'mul' ? a.fraction.length : scale },
    { digits: second, scale: op === 'mul' ? b.fraction.length : scale }
  ];
  const frames = [];
  const partialProducts = [];
  const resultRow = rows.length;
  const negative = op === 'sub' &&
    BigInt(first.slice().reverse().join('')) < BigInt(second.slice().reverse().join(''));

  function record(text, action = null) {
    frames.push({ rows: structuredClone(rows), text, action });
  }

  function write(row, column, value, text) {
    rows[row].digits[column] = value;
    record(text, { kind: 'digit', value, to: [row, column] });
  }

  function transfer(from, to, value, text, kind = 'carry') {
    if (kind === 'carry') rows[to[0]].digits[to[1]] = value;
    record(text, { kind, value, from, to });
  }

  function compact(row, sign = '') {
    const line = rows[row];
    const oldLength = line.digits.length;
    while (line.digits.length > line.scale + 1 && line.digits.at(-1) === 0) {
      line.digits.pop();
    }
    line.sign = sign;
    if (oldLength !== line.digits.length || sign) {
      record(sign
        ? 'The original first number was smaller, so put a minus sign in front.'
        : 'Read the result starting at its first useful place.');
    }
  }

  record(op === 'mul'
    ? (scale
      ? 'Multiply (умножение) the digits first. Place the decimal point (десятичная запятая) at the end.'
      : 'Multiply (умножение) the digits, one row at a time.')
    : scale
      ? 'Line up the decimal points (десятичные запятые) and start at the right.'
      : 'Line up the place values (разряды) and start at the right.');

  if (op === 'add') {
    rows.push({ digits: [], scale, line: true });
    let carry = 0;
    for (let column = 0; column < length; column++) {
      const left = first[column] ?? 0;
      const right = second[column] ?? 0;
      const total = left + right + carry;
      const digit = total % 10;
      const expression = carry ? left + ' + ' + right + ' + ' + carry : left + ' + ' + right;
      write(resultRow, column, digit, expression + ' = ' + total + '. Write ' + digit + '.');
      carry = Math.floor(total / 10);
      if (carry) {
        transfer([0, column], [0, column + 1], carry,
          'Carry (перенос) ' + carry + ' one column to the left.');
      }
    }
    if (carry) write(resultRow, length, carry, 'Write the final carry in the next place.');
  }

  if (op === 'sub') {
    if (negative) {
      [rows[1], rows[2]] = [rows[2], rows[1]];
      record('Find the difference between the larger and smaller numbers first.');
    }
    const top = Array.from({ length }, (_, column) => rows[1].digits[column] ?? 0);
    const bottom = rows[2].digits;
    rows[1].digits = top;
    rows.push({ digits: [], scale, line: true });
    for (let column = 0; column < length; column++) {
      const lower = bottom[column] ?? 0;
      if (top[column] < lower) {
        let donor = column + 1;
        while (top[donor] === 0) donor++;
        for (let place = donor; place > column; place--) {
          top[place]--;
          top[place - 1] += 10;
          transfer([1, place], [1, place - 1], 1,
            'Borrow (заём) 1 from the left. It becomes 10 in the next place.', 'borrow');
        }
      }
      const value = top[column] - lower;
      write(resultRow, column, value, top[column] + ' − ' + lower + ' = ' + value + '. Write ' + value + '.');
    }
    compact(resultRow, negative ? '−' : '');
  }

  if (op === 'mul') {
    // Each multiplier digit produces one shifted partial product.
    for (let shift = 0; shift < second.length; shift++) {
      const row = rows.length;
      rows.push({ digits: [], scale: 0, line: shift === 0 });
      rows[0].digits = [];
      if (shift) {
        for (let column = 0; column < shift; column++) {
          write(row, column, 0, 'Write a zero to shift this partial product (неполное произведение) left.');
        }
      }
      let carry = 0;
      for (let index = 0; index < first.length; index++) {
        const column = index + shift;
        const total = first[index] * second[shift] + carry;
        const digit = total % 10;
        const expression = first[index] + ' × ' + second[shift] + (carry ? ' + ' + carry : '');
        write(row, column, digit, expression + ' = ' + total + '. Write ' + digit + '.');
        carry = Math.floor(total / 10);
        if (carry) {
          transfer([0, column], [0, column + 1], carry,
            'Carry (перенос) ' + carry + ' one column to the left.');
        }
      }
      if (carry) write(row, first.length + shift, carry, 'Write the final carry for this row.');
      partialProducts.push(rows[row].digits);
    }

    let finalRow = resultRow;
    if (partialProducts.length > 1) {
      finalRow = rows.length;
      rows.push({ digits: [], scale: 0, line: true, operator: '+' });
      rows[0].digits = [];
      const partialWidth = Math.max(...partialProducts.map(row => row.length));
      let carry = 0;
      for (let column = 0; column < partialWidth || carry; column++) {
        const parts = partialProducts.map(row => row[column] ?? 0);
        if (carry) parts.push(carry);
        const total = parts.reduce((sum, part) => sum + part, 0);
        write(finalRow, column, total % 10, 'Add the partial products: ' + parts.join(' + ') + ' = ' + total + '.');
        carry = Math.floor(total / 10);
        if (carry) {
          transfer([0, column], [0, column + 1], carry,
            'Carry (перенос) ' + carry + ' one column to the left.');
        }
      }
    }
    if (scale) {
      const line = rows[finalRow];
      while (line.digits.length <= scale) line.digits.push(0);
      line.scale = scale;
      record('Count ' + scale + ' places from the right and put the decimal point (десятичная запятая) there.',
        { kind: 'point', value: '.', to: [finalRow, scale] });
    }
    compact(finalRow);
  }
  return { frames, width, scale, op };
}

function svgElement(name, attributes = {}, value = '') {
  const element = document.createElementNS(SVG, name);
  for (const [key, attribute] of Object.entries(attributes)) element.setAttribute(key, attribute);
  element.textContent = value;
  return element;
}

function htmlElement(name, value = '') {
  const element = document.createElement(name);
  element.textContent = value;
  return element;
}

export default {
  id: 'column',

  mount(el, params, api) {
    const { mode, onEvent = () => {} } = api;
    if (!['show', 'explore', 'answer'].includes(mode)) throw new TypeError('Choose a tool mode.');
    let model = makeModel(params);
    let step = 0;
    let answer = null;
    let finished = false;
    let selected = null;
    let drag = null;
    let destroyed = false;
    const root = htmlElement('section');
    const scroll = htmlElement('div');
    const svg = svgElement('svg', { role: 'group', 'aria-label': 'Column arithmetic (вычисления в столбик)' });
    const status = htmlElement('p');
    const tray = htmlElement('div');
    const form = htmlElement('form');
    const field = htmlElement('input');
    const submit = htmlElement('button', 'Use this answer');
    const label = htmlElement('label', 'Enter your answer (ответ) ');
    const controller = new AbortController();
    const eventOptions = { signal: controller.signal };

    root.style.cssText = 'color:var(--school-ink);font:1rem var(--school-font);min-width:0';
    scroll.style.cssText = 'overflow:auto;max-width:100%;padding:4px';
    scroll.tabIndex = 0;
    scroll.setAttribute('aria-label', 'Arithmetic grid. Scroll if needed.');
    status.setAttribute('role', 'status');
    status.style.minHeight = '2.5em';
    tray.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    form.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    svg.style.cssText = 'display:block;max-width:none;overflow:visible;font-family:var(--school-number-font)';
    field.style.maxWidth = '100%';
    field.type = 'text';
    field.inputMode = 'decimal';
    field.autocomplete = 'off';
    field.size = 12;
    submit.type = 'submit';
    label.append(field);
    form.append(label, submit);
    scroll.append(svg);
    root.append(scroll, status);
    if (mode === 'explore') root.append(tray);
    if (mode === 'answer') {
      for (const value of [...digits, '.', '−']) {
        const button = htmlElement('button', value);
        button.type = 'button';
        button.dataset.answerToken = value;
        button.setAttribute('aria-label', value === '.' ? 'Decimal point (десятичная запятая)'
          : value === '−' ? 'Minus sign (знак минус)' : 'Digit ' + value);
        tray.append(button);
      }
      const erase = htmlElement('button', 'Erase last character');
      erase.type = 'button';
      erase.dataset.answerToken = '';
      tray.append(erase);
      root.append(form, tray);
    }

    function getState() {
      if (mode === 'answer') return answer && { ...answer };
      return { step, rows: structuredClone(model.frames[step].rows) };
    }

    function animate(node, keyframes) {
      if (!api.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        node.animate(keyframes, { duration: 380, easing: 'ease-out' });
      }
    }

    function render(play = false) {
      const { frames, width, op, scale } = model;
      const frame = frames[step];
      const next = mode === 'explore' ? frames[step + 1] : null;
      const action = next?.action;
      const rows = frame.rows;
      const canvasWidth = Math.max(220, 56 + width * 36 + 6 * Math.ceil(width / 3));
      const canvasHeight = 42 + Math.max(rows.length, (action?.to[0] ?? 0) + 1) * 42;
      svg.replaceChildren();
      svg.setAttribute('width', canvasWidth);
      svg.setAttribute('height', canvasHeight);
      svg.setAttribute('viewBox', '0 0 ' + canvasWidth + ' ' + canvasHeight);
      const groupScale = op === 'mul' ? 0 : scale;
      const x = column => canvasWidth - 25 - column * 36
        - 6 * Math.max(0, Math.floor((column - groupScale) / 3))
        - (groupScale && column >= groupScale ? 6 : 0);
      const y = row => 40 + row * 42;

      function drawText(px, py, value, extra = {}) {
        const item = svgElement('text', {
          x: px, y: py, fill: 'var(--school-ink)', 'text-anchor': 'middle',
          'dominant-baseline': 'central', 'font-size': 23, ...extra
        }, String(value));
        svg.append(item);
        return item;
      }

      // One quiet background for the whole grid keeps the digits easy to read.
      svg.append(svgElement('rect', {
        x: 4, y: 8, width: canvasWidth - 8, height: canvasHeight - 16, rx: 12,
        fill: 'var(--school-grid-bg, var(--school-page))'
      }));

      if (op === 'mul' && rows.length > 3 && step > 0) {
        // Keep operand punctuation visible while partial products use digit columns.
        svg.setAttribute('aria-label', 'Column multiplication (умножение в столбик)');
      } else {
        svg.setAttribute('aria-label', 'Column arithmetic (вычисления в столбик)');
      }

      rows.forEach((row, rowIndex) => {
        const py = y(rowIndex);
        if (row.line) svg.append(svgElement('line', {
          x1: 14, x2: canvasWidth - 8, y1: py - 21, y2: py - 21,
          stroke: 'var(--school-line)', 'stroke-width': 2
        }));
        if (rowIndex === 2 || row.operator) drawText(16, py, row.operator ?? operations[op]);
        row.digits.forEach((value, column) => {
          if (rowIndex === 0) {
            // Carries sit in a clear chip above the column they belong to.
            svg.append(svgElement('rect', {
              x: x(column) - 14, y: py - 14, width: 28, height: 28, rx: 9,
              fill: 'var(--school-transfer-bg)', stroke: 'var(--school-transfer)', 'stroke-width': 1.5
            }));
          }
          drawText(x(column), py, value, rowIndex === 0
            ? { fill: 'var(--school-transfer)', 'font-size': 20, 'font-weight': 700 }
            : {});
        });
        if (row.scale && (rowIndex <= 2 || row.digits.length > row.scale)) {
          drawText((x(row.scale) + x(row.scale - 1)) / 2, py + 4, '.', {
            'aria-label': 'Decimal point (десятичная запятая)'
          });
        }
        if (row.sign) drawText(x(row.digits.length - 1) - 20, py, row.sign);
      });

      function target(position, name, value = '', source = false) {
        const [row, column] = position;
        const px = action.kind === 'point' ? (x(column) + x(column - 1)) / 2 : x(column);
        const py = y(row) - (source && action.kind === 'borrow' ? 16 : 0);
        const group = svgElement('g', {
          tabindex: 0, role: 'button', 'aria-label': name,
          'data-control': source ? 'source' : 'destination',
          'data-value': value
        });
        group.style.cursor = 'pointer';
        group.style.touchAction = 'none';
        group.append(svgElement('rect', {
          x: px - 16, y: py - 16, width: 32, height: 32, rx: 6,
          fill: source ? 'var(--school-transfer-bg)' : 'var(--school-active)',
          'fill-opacity': source ? 1 : 0.5,
          stroke: source ? 'var(--school-transfer)' : 'var(--school-accent)',
          'stroke-width': 2, 'stroke-dasharray': source ? 'none' : '4 3'
        }));
        if (source) group.append(svgElement('text', {
          x: px, y: py, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': 16, fill: 'var(--school-transfer)'
        }, value));
        svg.append(group);
      }

      if (action) {
        const [row, column] = action.to;
        // A new partial-product row can accept its first digit immediately.
        if (!rows[row]) {
          svg.append(svgElement('line', {
            x1: 14, x2: canvasWidth - 8, y1: y(row) - 21, y2: y(row) - 21,
            stroke: 'var(--school-line)', 'stroke-width': 1
          }));
        }
        target([row, column], 'Place the selected token in column ' + (column + 1) + ' from the right.');
        if (action.from) target(action.from, 'Move the ' + action.kind + ' token ' + action.value, String(action.value), true);
      }

      if (play && frame.action) {
        const { from, to, value, kind } = frame.action;
        const endX = kind === 'point' ? (x(to[1]) + x(to[1] - 1)) / 2 : x(to[1]);
        const endY = y(to[0]);
        const token = drawText(endX, endY, kind === 'borrow' ? '+10' : value, {
          fill: 'var(--school-transfer)', 'font-size': 18, 'aria-hidden': 'true'
        });
        token.style.pointerEvents = 'none';
        animate(token, [
          { transform: 'translate(' + (from ? x(from[1]) - endX : 0) + 'px,' +
            (from ? y(from[0]) - endY : -18) + 'px)', opacity: 1 },
          { transform: 'translate(0,0)', opacity: 0 }
        ]);
        // The committed digit underneath stays visible after the transient token.
        token.style.opacity = '0';
      }

      if (mode === 'show') status.textContent = frame.text;
      if (mode === 'explore') {
        status.textContent = !next ? 'You completed the calculation.'
          : !action ? next.text
            : action.from ? 'Move the highlighted ' + action.kind + ' token to the outlined place.'
              : action.kind === 'point' ? 'Place the decimal point (десятичная запятая).'
                : 'Choose a digit and move it into the outlined place.';
        tray.replaceChildren();
        if (next && !action) {
          const button = htmlElement('button', 'Continue to the next step');
          button.type = 'button';
          button.dataset.control = 'continue';
          tray.append(button);
        }
        if (action && !action.from) {
          const options = action.kind === 'point' ? '.' : digits;
          for (const value of options) {
            const button = htmlElement('button', value);
            button.type = 'button';
            button.style.cssText = 'min-width:36px;min-height:36px;touch-action:none';
            button.dataset.control = 'source';
            button.dataset.value = value;
            button.setAttribute('aria-label', value === '.' ? 'Decimal point (десятичная запятая)' : 'Digit ' + value);
            tray.append(button);
          }
        }
      }
      if (mode === 'answer' && !status.textContent) {
        status.textContent = 'Work out the calculation and enter the number you get.';
      }
    }

    function focusControl() {
      root.querySelector('[data-control="source"], [data-control="continue"]')?.focus();
    }

    function advance() {
      const next = model.frames[step + 1];
      if (!next) return;
      step++;
      selected = null;
      render(true);
      focusControl();
      onEvent('changed', getState());
      if (step === model.frames.length - 1) onEvent('done', getState());
    }

    function place() {
      const action = model.frames[step + 1]?.action;
      if (!action) return;
      if (selected !== String(action.value)) {
        selected = null;
        status.textContent = 'Check this column and choose the token again.';
        focusControl();
        return;
      }
      advance();
    }

    function activate(control) {
      if (control.dataset.control === 'continue') advance();
      if (control.dataset.control === 'source') {
        selected = control.dataset.value;
        const destination = root.querySelector('[data-control="destination"]');
        destination?.focus();
        status.textContent = 'Place ' + selected + ' in the outlined place.';
      }
      if (control.dataset.control === 'destination') place();
    }

    root.addEventListener('click', event => {
      const control = event.target.closest('[data-control]');
      if (control) activate(control);
      const answerToken = event.target.closest('[data-answer-token]')?.dataset.answerToken;
      if (answerToken !== undefined) {
        field.value = answerToken ? field.value + answerToken : field.value.slice(0, -1);
        updateAnswer();
      }
    }, eventOptions);

    root.addEventListener('keydown', event => {
      const control = event.target.closest('svg [data-control]');
      if (!control || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      activate(control);
    }, eventOptions);

    root.addEventListener('pointerdown', event => {
      const control = event.target.closest('[data-control="source"]');
      if (!control || event.button !== 0 || drag) return;
      control.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, value: control.dataset.value };
    }, eventOptions);

    root.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      if (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      if (!drag.ghost) {
        drag.ghost = htmlElement('span', drag.value);
        drag.ghost.setAttribute('aria-hidden', 'true');
        drag.ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:10;transform:translate(-50%,-50%);'
          + 'padding:4px 10px;border:2px solid var(--school-transfer);border-radius:6px;'
          + 'color:var(--school-transfer);background:var(--school-transfer-bg)';
        root.append(drag.ghost);
      }
      drag.ghost.style.left = event.clientX + 'px';
      drag.ghost.style.top = event.clientY + 'px';
    }, eventOptions);

    root.addEventListener('pointerup', event => {
      if (drag?.id !== event.pointerId) return;
      const { ghost, value } = drag;
      drag = null;
      if (!ghost) return;
      ghost.remove();
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (hit?.closest('[data-control="destination"]')?.closest('section') === root) {
        selected = value;
        place();
      }
    }, eventOptions);

    root.addEventListener('pointercancel', event => {
      if (drag?.id !== event.pointerId) return;
      drag.ghost?.remove();
      drag = null;
    }, eventOptions);

    function readAnswer() {
      const normalized = field.value.trim().replace(/\s+/g, '').replace(',', '.').replace(/^−/, '-');
      if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
      return { type: model.scale || normalized.includes('.') ? 'decimal' : 'int', value: normalized };
    }

    function updateAnswer() {
      answer = readAnswer();
      finished = false;
      status.textContent = model.scale
        ? 'Use a point or a comma for the decimal separator (десятичная запятая).' : '';
      onEvent('changed', getState());
    }

    field.addEventListener('input', updateAnswer, eventOptions);

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!answer) {
        status.textContent = 'Enter a complete number first.';
        field.focus();
        return;
      }
      if (finished) return;
      finished = true;
      status.textContent = 'Your answer is ready to submit.';
      onEvent('done', getState());
    }, eventOptions);

    el.append(root);
    render();
    onEvent('ready', { steps: model.frames.length, step: 0 });

    return {
      setParams(nextParams) {
        if (destroyed) return;
        model = makeModel(nextParams);
        step = 0;
        answer = null;
        finished = false;
        selected = null;
        drag?.ghost?.remove();
        drag = null;
        field.value = '';
        status.textContent = '';
        scroll.scrollLeft = 0;
        render();
        onEvent('ready', { steps: model.frames.length, step: 0 });
      },
      setStep(n) {
        if (destroyed || mode !== 'show' || !Number.isFinite(n)) return;
        const previous = step;
        step = Math.max(0, Math.min(Math.trunc(n), model.frames.length - 1));
        render(step === previous + 1);
        onEvent('step', { step, steps: model.frames.length });
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
