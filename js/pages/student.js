import { $, h, cmd, num, worth, rateText, fmtWhen, errorInfo, setMessage, connect } from "./common.js";

const REASONS = {
  independent_answer: "Correct answer on your own",
  self_corrected: "Fixed your own mistake",
  answer_with_help: "Correct answer after a hint",
  notebook_photo: "Notebook photo",
  lesson_completed: "Lesson finished",
  returned_after_pause: "Came back after a break",
  mastered: "Skill mastered",
  repeat_stars: "Practice again",
};
const FAILS = {
  not_enough: "You do not have that many stars to spend right now.",
  no_rate: "Your parent has not set the exchange rate yet.",
  invalid: "Choose a whole number of stars, at least 1.",
};

let session;
let data = null;
let allLessons = false;
let busy = false;
const notice = $("notice");
const input = h("input", { id: "ex-amount", class: "cmd-input", type: "number", inputmode: "numeric", min: "1", step: "1",
  autocomplete: "off", "aria-describedby": "ex-preview" });
const preview = h("p", { id: "ex-preview", class: "preview", "aria-live": "polite" });
const submit = cmd("exchange", null, { type: "submit", disabled: true });
const maxButton = cmd("max", () => { input.value = String(data?.totals.available ?? ""); refreshPreview(); input.focus(); },
  { secondary: true });
const rateLine = h("p", { class: "rate-now" });

function lessonLabel(entry) {
  const detail = entry.skill ?? (entry.lesson ? `lesson ${entry.lesson}` : "");
  return h("span", { class: "what" }, REASONS[entry.reason] ?? "Stars",
    detail ? h("span", { class: "sub" }, ` · ${detail}`) : null);
}

function renderTop() {
  const t = data.totals;
  $("stars").textContent = `★ ${num(t.available)}`;
  $("stars").setAttribute("aria-label", `${t.available} stars to spend`);
  $("waiting").textContent = t.reserved ? `waiting: ★ ${num(t.reserved)}` : "";
  $("balance").replaceChildren(h("span", { class: "big-stars" }, `★ ${num(t.available)}`), "to spend");
  $("balance-sub").textContent =
    `earned ${num(t.earned)} · given out ${num(t.given)} · waiting for your parent ${num(t.reserved)}`;
}

function renderLedger() {
  $("ledger").replaceChildren(...(data.ledger.length
    ? data.ledger.map(e => h("li", {}, h("span", { class: "lead" }, `+${e.amount}`), lessonLabel(e),
        h("span", { class: "when" }, fmtWhen(e.at, "en"))))
    : [h("li", { class: "empty" }, "No stars yet. Finish a lesson to get the first ones.")]));
}

function renderLessons() {
  const list = data.lessons;
  const todayAt = list.findIndex(l => l.state === "today");
  const done = list.filter(l => l.state === "done");
  const shown = allLessons ? list : list.filter((l, i) =>
    l.state === "today" || (l.state === "done" && done.slice(-2).includes(l))
    || (l.state === "next" && i > todayAt && i <= todayAt + 3) || (todayAt < 0 && i < 3));
  const mark = { done: "✔", today: "▶", next: "·" };
  $("lessons").replaceChildren(...(shown.length ? shown.map(l => h("li", { class: `lesson-row ${l.state}` },
    h("span", { class: "lead" }, `${mark[l.state]} ${l.subject === "biology" ? "bio " : ""}${l.number}`),
    h("span", { class: "what" }, l.title ?? `Lesson ${l.number}`,
      l.unfinished && l.state !== "done" ? h("span", { class: "sub" }, " · not finished") : null),
    l.state === "today"
      ? h("a", { class: "cmd-link", href: "lesson.html" }, h("span", { class: "pre", "aria-hidden": "true" }, "> "), "open",
          h("span", { class: "suf", "aria-hidden": "true" }, " ⏎"))
      : l.state === "done"
        // Repeat: a new session for this lesson; stars for answers follow the usual rules, no second lesson reward.
        ? h("a", { class: "cmd-link", href: `lesson.html?lesson=${encodeURIComponent(l.id)}` },
            h("span", { class: "pre", "aria-hidden": "true" }, "> "), "again",
            h("span", { class: "suf", "aria-hidden": "true" }, " ⏎"))
        : h("span", { class: "when" }, "next"))) : [h("li", { class: "empty" }, "No lessons yet.")]));
  const hidden = list.length - shown.length;
  $("lessons-more").replaceChildren(...(hidden > 0 || allLessons
    ? [cmd(allLessons ? "fewer" : `all lessons (${list.length})`, () => { allLessons = !allLessons; renderLessons(); }, { secondary: true })]
    : []));
}

function renderRequests() {
  $("requests").replaceChildren(...(data.redemptions.length ? data.redemptions.map(r => h("li", {},
    h("span", { class: `tag ${r.status}` }, r.status),
    h("span", { class: "what" }, `${num(r.stars)} ★`,
      r.rate ? h("span", { class: "sub" }, ` = ${num(worth(r.stars, r.rate))} ${r.rate.unit}`) : null),
    h("span", { class: "when" }, r.status === "given" ? `given ${fmtWhen(r.given_at, "en")}` : fmtWhen(r.created_at, "en"))))
    : [h("li", { class: "empty" }, "No requests yet.")]));
}

function refreshPreview() {
  const rate = data?.rate;
  const available = data?.totals.available ?? 0;
  const n = input.value.trim() === "" ? NaN : Number(input.value);
  const whole = Number.isInteger(n) && n >= 1;
  input.max = String(available);
  let ok = false;
  let text;
  if (!rate) text = "Your parent has not set the exchange rate yet.";
  else if (available < 1) text = "You have no stars to spend yet.";
  else if (!whole) text = "Type how many stars to exchange.";
  else if (n > available) text = `You can exchange at most ★ ${num(available)} now.`;
  else { ok = true; text = `${num(n)} ★ = ${num(worth(n, rate))} ${rate.unit}`; }
  preview.textContent = text;
  preview.className = `preview${ok || !whole ? "" : " bad"}`;
  submit.disabled = !ok || busy;
  input.disabled = !rate || available < 1;
  maxButton.disabled = !rate || available < 1 || busy;
  rateLine.replaceChildren(...(rate ? ["rate: ", h("b", {}, rateText(rate))] : ["rate: not set yet"]));
}

function buildExchange() {
  const form = h("form", { onsubmit: onExchange },
    rateLine,
    h("div", { class: "field-row" },
      h("label", { for: "ex-amount", class: "cmdline" }, h("span", { class: "ps", "aria-hidden": "true" }, "stars ❯ "),
        h("span", { class: "sr-only" }, "How many stars to exchange")),
      input, maxButton),
    preview,
    h("div", { class: "actions" }, submit),
    h("p", { class: "hint" }, "Your parent sees the request and gives you the reward. Stars in a request are set aside until then."));
  $("exchange").replaceChildren(form);
  input.addEventListener("input", refreshPreview);
}

async function onExchange(event) {
  event.preventDefault();
  const n = Number(input.value);
  if (busy || !data?.rate || !Number.isInteger(n) || n < 1 || n > data.totals.available) return;
  busy = true;
  refreshPreview();
  setMessage(notice, "Sending…");
  try {
    const result = await session.call("redeem", { stars: n });
    input.value = "";
    await load();
    setMessage(notice, `Request sent: ${num(n)} ★ = ${num(worth(n, result.rate))} ${result.rate.unit}. Your parent will see it.`, "ok");
  } catch (error) {
    const info = await errorInfo(error);
    let text = "Could not send. Check the connection and try again.";
    if (info.error === "rejected") text = FAILS[info.reason] ?? FAILS.invalid;
    else if (info.status === 403) text = "This page is for the student. The parent page is parent.html.";
    try { await load(); } catch { /* keep the old numbers */ }
    setMessage(notice, text, "err");
  } finally {
    busy = false;
    refreshPreview();
  }
}

async function load() {
  data = await session.call("student");
  renderTop();
  renderLedger();
  renderLessons();
  renderRequests();
  refreshPreview();
}

function showFatal(error, info) {
  $("workspace").hidden = false;
  $("login").hidden = true;
  const text = info?.status === 403
    ? "This page is for the student. If you are the parent, open parent.html."
    : (/School setup/.test(error?.message ?? "") ? error.message : "Could not load your stars. Check the connection and try again.");
  setMessage(notice, text, "err");
}

async function start() {
  try {
    session = await connect({ role: "student", panel: $("login") });
  } catch (error) {
    showFatal(error);
    return;
  }
  $("demo-badge").hidden = !session.demo;
  $("workspace").hidden = false;
  buildExchange();
  $("tools").replaceChildren(cmd("refresh", async () => {
    try { await load(); setMessage(notice, ""); } catch { setMessage(notice, "Could not refresh.", "err"); }
  }, { secondary: true }), ...(session.logout ? [cmd("logout", session.logout, { secondary: true })] : []));
  try {
    await load();
    $("heading").focus({ preventScroll: true });
  } catch (error) {
    showFatal(error, await errorInfo(error));
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && data && !busy) load().catch(() => {});
});
start();
