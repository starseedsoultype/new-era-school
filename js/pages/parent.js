import { $, h, cmd, num, worth, rateText, fmtWhen, errorInfo, setMessage, connect } from "./common.js";

const FAILS = {
  not_enough: "Не хватает звёзд.",
  no_rate: "Курс не задан.",
  invalid: "Проверьте числа: звёзд — целое число от 1, количество больше нуля, единица — до 24 знаков.",
};
const STATUS_RU = { new: "new", seen: "seen", done: "done" };

let session;
let data = null;
let photos = { pending: 0, list: [], failed: false };
let busy = false;
let rateFilled = false;
const notice = $("notice");
const inStars = h("input", { id: "r-stars", class: "cmd-input", type: "number", inputmode: "numeric", min: "1", step: "1", autocomplete: "off" });
const inAmount = h("input", { id: "r-amount", class: "cmd-input", type: "text", inputmode: "decimal", autocomplete: "off" });
const inUnit = h("input", { id: "r-unit", class: "cmd-input wide", type: "text", maxlength: "24", autocomplete: "off",
  placeholder: "Robux" });
const rateNow = h("p", { class: "rate-now" });
const rateSave = cmd("save", null, { type: "submit" });

function renderTop() {
  const t = data.totals;
  $("stars").textContent = `★ ${num(t.available)}`;
  $("stars").setAttribute("aria-label", `Доступно звёзд: ${t.available}`);
  $("waiting").textContent = t.reserved ? `ждёт выдачи: ★ ${num(t.reserved)}` : "";
  $("done").textContent = `уроков: ${data.summary.lessons_done}/${data.summary.lessons_total}`;
}

function renderSummary() {
  const t = data.totals;
  const s = data.summary;
  const b = x => h("b", {}, x);
  $("summary").replaceChildren(
    h("li", {}, "Уроков пройдено: ", b(`${s.lessons_done} из ${s.lessons_total}`)),
    h("li", {}, "Звёзд за последние 7 дней: ", b(`★ ${num(s.stars_week)}`)),
    h("li", {}, "Фото ждут проверки: ", b(photos.failed ? "не удалось загрузить" : String(photos.pending))),
    h("li", {}, "Баланс ученика: ", b(`★ ${num(t.available)}`), ` свободно (заработано ${num(t.earned)}, выдано ${num(t.given)}, ждёт выдачи ${num(t.reserved)})`));
}

function renderRequests() {
  const list = data.redemptions;
  $("requests").replaceChildren(...(list.length ? list.map(r => {
    const rate = r.rate;
    return h("li", {},
      h("span", { class: `tag ${r.status}` }, r.status),
      h("span", { class: "what" }, `${num(r.stars)} ★`,
        rate ? h("span", { class: "sub" }, ` = ${num(worth(r.stars, rate))} ${rate.unit} (курс ${rateText(rate)})`) : null),
      h("span", { class: "when" }, r.status === "given" ? `выдано ${fmtWhen(r.given_at, "ru")}` : fmtWhen(r.created_at, "ru")),
      r.status === "requested"
        ? h("span", { class: "row-actions" }, cmd("given", event => onGiven(r, event.currentTarget))) : null);
  }) : [h("li", { class: "empty" }, "Запросов пока нет.")]));
}

const VERDICT_SHOWN = { true: "верно", false: "неверно" };

function verdictLine(v) {
  if (!v || typeof v !== "object") return h("span", { class: "none" }, "модель не проверила");
  const result = v.correct === true || v.correct === false ? VERDICT_SHOWN[v.correct] : "не видно";
  return h("span", { class: "verdict" }, `модель: ${result}, ${v.neat ? "аккуратно" : "неаккуратно"}`,
    v.comment ? h("span", { class: "sub" }, ` \u2014 ${v.comment}`) : null);
}

function openPhoto(url) {
  const dialog = $("photo-view");
  $("photo-big").src = url;
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
}

function renderPhotos() {
  const list = photos.list;
  if (photos.failed) {
    $("photos").replaceChildren(h("li", { class: "empty" }, "Не удалось загрузить фото. Нажмите refresh."));
    return;
  }
  $("photos").replaceChildren(...(list.length ? list.map(p => h("li", { class: p.reviewed ? "photo" : "photo fresh" },
    p.url
      ? h("button", { class: "thumb", type: "button", title: "Открыть крупно", "aria-label": "Открыть фото крупно",
          onclick: () => openPhoto(p.url) }, h("img", { src: p.url, alt: "Фото тетради", loading: "lazy" }))
      : h("span", { class: "thumb none" }, "нет картинки"),
    h("span", { class: "info" },
      h("span", { class: "meta" }, h("span", { class: `tag ${p.reviewed ? "done" : "new"}` }, p.reviewed ? "проверено" : "новое"),
        [fmtWhen(p.created_at, "ru"), p.lesson_number ? `урок ${p.lesson_number}` : null, `задание ${p.task_id}`]
          .filter(Boolean).join(" \u00b7 ")),
      p.prompt ? h("span", { class: "text" }, p.prompt) : null,
      verdictLine(p.model_verdict),
      p.reviewed ? null : h("span", { class: "row-actions" }, cmd("проверено", event => onPhoto(p, event.currentTarget)))
    ))) : [h("li", { class: "empty" }, "Фото пока нет.")]));
}

function renderFeedback() {
  const list = data.feedback;
  $("feedback").replaceChildren(...(list.length ? list.map(f => h("li", {},
    h("span", { class: "meta" }, h("span", { class: `tag ${f.status}` }, STATUS_RU[f.status] ?? f.status),
      [fmtWhen(f.created_at, "ru"), `урок ${f.lesson_id}`, f.step_type ? `шаг ${f.step_type}` : null,
        f.task_id ? `задание ${f.task_id}` : null].filter(Boolean).join(" \u00b7 ")),
    h("span", { class: "text" }, f.text),
    f.status === "new" ? h("span", { class: "row-actions" }, cmd("seen", event => onSeen(f, event.currentTarget))) : null))
    : [h("li", { class: "empty" }, "Жалоб нет.")]));
}

function renderRate() {
  const rate = data.rate;
  rateNow.replaceChildren(...(rate ? ["Сейчас: ", h("b", {}, rateText(rate))] : ["Курс ещё не задан. Пока он не задан, ученик не может запросить обмен."]));
  if (!rateFilled) {
    if (rate) { inStars.value = rate.stars; inAmount.value = rate.amount; inUnit.value = rate.unit; }
    rateFilled = true;
  }
}

function buildRate() {
  const label = (id, text) => h("label", { for: id, class: "sr-only" }, text);
  $("rate").replaceChildren(h("form", { onsubmit: onRate },
    rateNow,
    h("div", { class: "field-row rate-line" },
      label("r-stars", "Звёзд"), inStars, h("span", { class: "times" }, "★ ="),
      label("r-amount", "Количество награды"), inAmount,
      label("r-unit", "Единица награды"), inUnit),
    h("div", { class: "actions" }, rateSave),
    h("p", { class: "hint" }, "Например: 100 ★ = 80 Robux. Единица награды — любой текст (Robux, минуты игры, рубли). Курс можно менять в любой момент; запросы, уже отправленные учеником, остаются по курсу, который был в момент запроса.")));
}

async function failure(error, fallback) {
  const info = await errorInfo(error);
  if (info.error === "rejected") return FAILS[info.reason] ?? FAILS.invalid;
  if (info.status === 403) return "Эта страница для родителя. Страница ученика — student.html.";
  return fallback;
}

async function run(button, work, okText, failText) {
  if (busy) return;
  busy = true;
  if (button) button.disabled = true;
  setMessage(notice, "Отправляю…");
  try {
    await work();
    await load();
    setMessage(notice, okText, "ok");
  } catch (error) {
    const text = await failure(error, failText);
    try { await load(); } catch { /* keep what is on screen */ }
    setMessage(notice, text, "err");
  } finally {
    busy = false;
    rateSave.disabled = false;
  }
}

const onGiven = (row, button) => run(button, () => session.call("give", { id: row.id }),
  `Отмечено: выдано ${num(row.stars)} ★.`, "Не удалось отметить. Проверьте соединение и попробуйте ещё раз.");
const onPhoto = (row, button) => run(button, () => session.call("photo_reviewed", { id: row.id }),
  "Фото отмечено как проверенное.", "Не удалось отметить. Проверьте соединение и попробуйте ещё раз.");
const onSeen = (row, button) => run(button, () => session.call("seen", { id: row.id }),
  "Жалоба отмечена как просмотренная.", "Не удалось отметить. Проверьте соединение и попробуйте ещё раз.");

function onRate(event) {
  event.preventDefault();
  const stars = Number(inStars.value);
  const amount = Number(inAmount.value.trim().replace(",", "."));
  const unit = inUnit.value.trim();
  if (!Number.isInteger(stars) || stars < 1 || !(amount > 0) || !Number.isFinite(amount) || !unit) {
    setMessage(notice, FAILS.invalid, "err");
    return;
  }
  return run(rateSave, async () => { await session.call("set_rate", { stars, amount, unit }); rateFilled = false; },
    `Курс сохранён: ${num(stars)} ★ = ${num(amount)} ${unit}.`, "Не удалось сохранить курс. Проверьте соединение и попробуйте ещё раз.");
}

async function load() {
  const next = await session.call("parent");
  if (next.student === false) {
    data = { totals: { earned: 0, given: 0, reserved: 0, available: 0 }, rate: next.rate, redemptions: [], feedback: [],
      summary: { lessons_done: 0, lessons_total: 0, stars_week: 0 } };
  } else data = next;
  try {
    const next = await session.call("photos");
    photos = { pending: next.pending, list: next.photos, failed: false };
  } catch { photos = { pending: 0, list: [], failed: true }; }
  renderTop();
  renderSummary();
  renderPhotos();
  renderRequests();
  renderRate();
  renderFeedback();
}

function showFatal(error, info) {
  $("workspace").hidden = false;
  $("login").hidden = true;
  setMessage(notice, info?.status === 403
    ? "Эта страница для родителя. Если вы ученик, откройте student.html."
    : (/School setup/.test(error?.message ?? "") ? "Школа ещё не подключена: нет связи с сервером."
      : "Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз."), "err");
}

async function start() {
  try {
    session = await connect({ role: "parent", panel: $("login"), wrong: "Почта или пароль не подошли. Попробуйте ещё раз." });
  } catch (error) {
    showFatal(error);
    return;
  }
  $("demo-badge").hidden = !session.demo;
  $("workspace").hidden = false;
  buildRate();
  $("tools").replaceChildren(cmd("refresh", async () => {
    try { await load(); setMessage(notice, ""); } catch { setMessage(notice, "Не удалось обновить.", "err"); }
  }, { secondary: true }), ...(session.logout ? [cmd("logout", session.logout, { secondary: true })] : []));
  try {
    await load();
    $("heading").focus({ preventScroll: true });
  } catch (error) {
    showFatal(error, await errorInfo(error));
  }
}

// The page stays open on the parent's side: look again when it comes back into view and once a minute.
const refresh = () => { if (!document.hidden && data && !busy) load().catch(() => {}); };
document.addEventListener("visibilitychange", refresh);
setInterval(refresh, 60000);
start();
