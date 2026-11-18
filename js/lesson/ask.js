// `? ask` window (CONTRACTS.md section 9, kind "ask"): the student asks the teacher in their own words.
// A terminal-style panel that lives beside the lesson: it never touches the engine, the timer or the stars.
// All text goes in with textContent. Questions and answers are kept per context (a task, or one line of the explanation).

const MAX_PER_CONTEXT = 3;          // follow-up questions on one task or one explanation line
export const ASK_DEMO = "Demo: the teacher answers only in a real lesson.";
export const ASK_FALLBACK = "Try the hint button, or ask your parent.";
const ASK_LIMIT = "You have asked all your questions for this lesson. Ask your parent.";

const $ = id => document.getElementById(id);

export function createAsk({ getContext, send, demo = false }) {
  const panel = $("ask-panel");
  const log = $("ask-log");
  const form = $("ask-form");
  const input = $("ask-input");
  const sendButton = $("ask-send");
  const status = $("ask-status");
  const pairs = new Map();          // context key -> [{ q, a }]
  let opener = null;
  let sending = false;
  let left = null;

  const isOpen = () => !panel.hidden;
  const context = () => getContext();
  const history = key => pairs.get(key) ?? [];

  function line(who, text, cls = "") {
    const row = document.createElement("p");
    row.className = `ask-line ${who} ${cls}`.trim();
    const mark = Object.assign(document.createElement("span"), {
      className: "ps", textContent: who === "you" ? "you ❯ " : "teacher ❯ ", ariaHidden: "true",
    });
    const body = Object.assign(document.createElement("span"), { className: "ask-text", textContent: text });
    const hidden = Object.assign(document.createElement("span"), { className: "sr-only", textContent: who === "you" ? "You: " : "Teacher: " });
    row.append(mark, hidden, body);
    log.append(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function note(text, kind = "") {
    status.textContent = text;
    status.className = kind;
  }

  function sync() {
    sendButton.disabled = sending || input.value.trim() === "";
    sendButton.classList.toggle("sending", sending);
  }

  function paint() {
    const ctx = context();
    log.replaceChildren();
    if (!ctx) return;
    const list = history(ctx.key);
    if (!list.length) {
      line("teacher", "Ask me what a word or a sign means, or what the task wants. I will not give the answer, but I will help you start.", "hello");
    }
    for (const pair of list) {
      line("you", pair.q);
      line("teacher", pair.a);
    }
    const used = list.length;
    if (!demo) {
      const extra = left == null ? "" : ` ${left} question${left === 1 ? "" : "s"} left in this lesson.`;
      note(used >= MAX_PER_CONTEXT ? `You asked ${MAX_PER_CONTEXT} questions here.${extra}` : extra.trim());
    } else {
      note("");
    }
  }

  function open(from) {
    if (!context()) return;
    opener = from ?? opener;
    panel.hidden = false;
    paint();
    sync();
    panel.scrollIntoView({ block: "nearest" });
    input.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    panel.hidden = true;
    (document.getElementById("ask-open") ?? opener)?.focus?.({ preventScroll: true });
  }

  async function submit(event) {
    event.preventDefault();
    const question = input.value.trim();
    const ctx = context();
    if (sending || !question || !ctx) return;
    if (demo) {
      line("you", question);
      line("teacher", ASK_DEMO, "demo");
      input.value = "";
      sync();
      return;
    }
    const list = history(ctx.key);
    if (list.length >= MAX_PER_CONTEXT) {
      line("you", question);
      line("teacher", ASK_FALLBACK, "limit");
      input.value = "";
      sync();
      return;
    }
    sending = true;
    sync();
    note("Thinking…");
    line("you", question);
    try {
      const result = await send({ question, history: list.slice(-3), ctx });
      const text = String(result?.text ?? "").trim() || ASK_FALLBACK;
      if (typeof result?.left === "number") left = result.left;
      pairs.set(ctx.key, [...list, { q: question, a: text }]);
      input.value = "";
    } catch (error) {
      const code = error?.code ?? error?.message;
      line("teacher", code === "ask_limit" ? ASK_LIMIT : "The teacher is unavailable. " + ASK_FALLBACK, "error");
      sending = false;
      sync();
      note("");
      return;
    }
    sending = false;
    // The lesson may have moved on while the answer was on its way; paint what belongs to the current step.
    paint();
    sync();
    input.focus({ preventScroll: true });
  }

  form.addEventListener("submit", submit);
  input.addEventListener("input", sync);
  $("ask-close").addEventListener("click", close);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen() && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  });

  return {
    open, close, isOpen,
    // The lesson moved to another step: show that step's own conversation (or close if asking is no longer possible).
    refresh() {
      if (!isOpen()) return;
      if (!context()) { panel.hidden = true; return; }
      if (!sending) paint();
    },
  };
}
