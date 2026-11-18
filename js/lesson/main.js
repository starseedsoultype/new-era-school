import { schoolApi, schoolClient } from "../core/supabase.js";
import { requireLogin } from "../core/auth.js";
import { LessonEngine } from "./engine.js";
import { SET_HINT } from "./answer.js";
import { nextLessonPage } from "./nav.js";

const $ = id => document.getElementById(id);
const workspace = $("workspace");
const answer = $("answer");
const photo = $("photo");
const toolIds = new Set(["column", "sets", "lines", "fraction_bars", "number_line", "area_grid",
  "percent_bar", "balance", "cubes", "protractor"]);
const titles = {
  recall: "Warm up", explain: "See how it works", together: "Work together",
  solo: "Try it on your own", notebook: "Show your work", use: "Use what you learned",
  finish: "Finish the lesson",
};
const topics = { S1: "subsets" };
const kindLabels = { example: "Example", rule: "The rule", remark: "Watch out", try: "Your turn" };
const params = new URL(location.href).searchParams;
const demoId = params.get("demo") || null;
let engine;
let storageKey;
let busy = false;
let scene;
let tool;
let helpTool;
let renderEpoch = 0;
let toolSig = null;
let toolReady = Promise.resolve(null);
let helpOpen = false;
let workedOk = false;
let lastTitle = "";
let refocus = -1;
let completion;
let nextAutomaticRetry = 0;
let notice = "";
let noticeStars = 0;
let lastInput;
let lessonId = null;
let sending = false;
let feedbackApi = null;

function loadProgress(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
}

function persist() {
  if (!engine || !storageKey) return;
  try {
    if (engine.result) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(engine.snapshot()));
  } catch { /* The open session can continue without device storage. */ }
}

function updateHeader() {
  const total = engine?.lesson.steps.length ?? 7;
  const now = completion ? total : engine ? engine.index + 1 : 0;
  $("step").textContent = completion ? `step ${total}/${total} done`
    : engine ? `step ${now}/${total} ${engine.step.type}` : `step 0/${total} ready`;
  const number = engine?.lesson.number;
  const topic = engine?.lesson.title ?? topics[engine?.lesson.skills?.[0]];
  $("win-title").textContent = `new-era-school \u2014 lesson${number ? ` ${number}` : ""}${number && topic ? `: ${topic}` : ""}`;
  const bar = $("progress");
  if (bar.children.length !== total) {
    bar.replaceChildren(...Array.from({ length: total }, () => document.createElement("span")));
  }
  [...bar.children].forEach((part, i) => {
    part.className = i < now - 1 || completion ? "done" : i === now - 1 ? "now" : "";
  });
  bar.setAttribute("aria-valuemax", String(total));
  bar.setAttribute("aria-valuenow", String(now));
  const stars = completion?.stars_total ?? engine?.stars ?? 0;
  $("stars").textContent = `\u2605 ${stars}`;
  $("stars").setAttribute("aria-label", `Stars this lesson: ${stars}`);
  const seconds = completion ? 0 : engine ? Math.ceil(engine.timer.left().lesson / 1000) : 1800;
  $("time").textContent = `\u23F1\uFE0E ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function setBusy(value) {
  busy = value;
  workspace.setAttribute("aria-busy", String(value));
  for (const control of workspace.querySelectorAll("button, input")) control.disabled = value;
}

async function run(action) {
  if (busy) return;
  setBusy(true);
  try {
    await action();
  } catch {
    nextAutomaticRetry = Date.now() + 5000;
    notice = "The connection was interrupted. Please try again.";
  } finally {
    persist();
    render();
    setBusy(false);
    focusEntry();
  }
}

// Terminal feel: after a task appears or an answer is checked, the cursor is back in the answer line (mouse and keyboard devices only).
function focusEntry() {
  if (answer.hidden || document.activeElement !== document.body) return;
  if (matchMedia("(pointer: fine)").matches) $("entry").focus({ preventScroll: true });
}

function button(label, action, kind = "primary", parent = $("actions"), lead = null) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `cmd ${kind === "primary" ? "big" : "secondary"}`;
  const mark = (cls, text) => Object.assign(document.createElement("span"), { className: cls, textContent: text, ariaHidden: "true" });
  // Command look: "> next \u23CE", "< back", "$ give me a hint". The label stays real text for readers.
  const mark0 = lead ?? (kind === "primary" ? "> " : label === "Back" ? "< " : "$ ");
  node.append(mark("pre", mark0), label);
  if (kind === "primary") node.append(mark("suf", " \u23CE"));
  node.addEventListener("click", () => {
    refocus = kind === "primary" && parent === $("actions") ? "primary" : -1;
    void run(action);
  });
  parent.append(node);
}

async function mountTool(host, id, params, mode, step, epoch) {
  if (!toolIds.has(id) || !params) return null;
  try {
    const { default: definition } = await import(`../tools/${id}.js`);
    if (epoch !== renderEpoch) return null;
    const instance = definition.mount(host, params, {
      mode, lang: "en", reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      onEvent() {},
    });
    if (mode === "show") instance.setStep(step ?? 0);
    if (busy) for (const control of host.querySelectorAll("button, input")) control.disabled = true;
    return instance;
  } catch {
    if (epoch === renderEpoch) host.textContent = "You can work this out on paper.";
    return null;
  }
}

function setScene(key, title, keepTool = false) {
  const type = Object.keys(titles).find(id => titles[id] === title);
  $("cmd").textContent = type ? `lesson ${type}` : title.toLowerCase();
  $("comment").textContent = `# ${title}`;
  if (scene === key) return false;
  scene = key;
  helpOpen = false;
  workedOk = false;
  if (!keepTool) {
    renderEpoch++;
    tool?.destroy();
    tool = null;
    toolSig = null;
    toolReady = Promise.resolve(null);
    $("tool").replaceChildren();
  }
  helpTool?.destroy();
  helpTool = null;
  $("help-tool").replaceChildren();
  $("entry").value = "";
  $("image").value = "";
  lastInput = undefined;
  if (title !== lastTitle) $("heading").focus({ preventScroll: true });
  lastTitle = title;
  return true;
}

// Typing effect for explanation lines. The whole text is in the page from the start (readers and layout
// see it at once); only the part not typed yet is transparent. ~25 ms per character, 1.5 s at most.
const lineEl = $("line");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let lineKey = null;
let typer = null;

function paintLine(text, count) {
  const typed = Object.assign(document.createElement("span"), { className: "typed", textContent: text.slice(0, count) });
  const rest = Object.assign(document.createElement("span"), { className: "rest", textContent: text.slice(count) });
  lineEl.replaceChildren(typed, rest);
}

function stopTyping() {
  clearInterval(typer);
  typer = null;
}

function finishTyping() {
  if (!typer) return false;
  stopTyping();
  paintLine(lineEl.textContent, lineEl.textContent.length);
  return true;
}

function showLine(key, text) {
  if (!text) {
    stopTyping();
    lineKey = null;
    lineEl.textContent = "";
    return;
  }
  const id = `${key}|${text}`;
  if (id === lineKey) return;
  lineKey = id;
  stopTyping();
  if (reduceMotion.matches || !key) {
    paintLine(text, text.length);
    return;
  }
  const per = Math.min(25, 1500 / text.length);
  const start = performance.now();
  paintLine(text, 0);
  typer = setInterval(() => {
    const count = Math.min(text.length, Math.floor((performance.now() - start) / per) + 1);
    paintLine(text, count);
    if (count >= text.length) stopTyping();
  }, 16);
}

function setText({ kind = "", prompt = "", line = "", lineKey: key = null } = {}) {
  $("kind").textContent = kindLabels[kind] ?? "";
  $("prompt").textContent = prompt;
  lineEl.dataset.kind = kind;
  showLine(key, line);
}

function placeTool(id, params, mode, step) {
  if (!id || !params) return;
  const epoch = renderEpoch;
  $("tool").classList.toggle("is-show", mode === "show");
  toolReady = mountTool($("tool"), id, params, mode, step, epoch).then(instance => {
    if (epoch === renderEpoch) tool = instance;
    else instance?.destroy();
    return instance;
  });
}

// Show a tool for a scene. Consecutive lines that use the same picture keep one tool and just move its step.
function sceneWithTool(key, title, id, params, mode, step) {
  const sig = JSON.stringify([id, params, mode]);
  const keep = mode === "show" && scene !== key && sig === toolSig;
  if (!setScene(key, title, keep)) return;
  if (keep) {
    void toolReady.then(instance => instance?.setStep(step ?? 0));
  } else {
    toolSig = sig;
    placeTool(id, params, mode, step);
  }
}

async function submit(input) {
  if (engine.mode !== "normal") return;
  lastInput = input;
  const result = await engine.submit(input);
  if (input === null) notice = "You can return to this skill in a future lesson.";
  else if (result.is_correct) { notice = "That answer is correct."; noticeStars = result.stars ?? 0; }
  else notice = engine.mode === "explore" ? "Take a moment to work through it step by step."
    : "Read the task again and check each step.";
}

async function ask(kind) {
  helpOpen = false;
  const response = await engine.help(kind, $("entry").value || lastInput);
  notice = response.text ? (kind === "hint" ? `hint: ${response.text}` : response.text) : "";
  helpTool?.destroy();
  $("help-tool").replaceChildren();
  helpTool = await mountTool($("help-tool"), response.tool?.id, response.tool?.params,
    "show", response.tool?.step, renderEpoch);
}

async function jpeg(file) {
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Photo encoding failed")), "image/jpeg", .86));
  } finally {
    image.close();
  }
}

const isOk = text => /^(That answer is correct|Yes, that is right)/.test(text);

// Result line, terminal style: green "\u2713 correct  +2 \u2605", red "\u2717 not quite", amber "hint: ...".
function showNotice() {
  const el = $("feedback");
  const add = (cls, text) => el.append(Object.assign(document.createElement("span"), { className: cls, textContent: text }));
  el.replaceChildren();
  el.className = "";
  if (!notice) return;
  if (isOk(notice)) {
    el.className = "ok";
    add("", `\u2713 correct${noticeStars ? `  +${noticeStars} \u2605` : ""}`);
  } else if (/^(Not quite|Read the task|Take a moment)/.test(notice)) {
    el.className = "bad";
    add("", "\u2717 not quite");
    const rest = notice.replace(/^Not quite\.\s*/, "");
    if (rest) add("sub", rest);
  } else if (notice.startsWith("hint: ")) {
    el.className = "hint";
    add("", notice);
  } else if (/^(The connection|School setup|The demo lesson|Choose a|Could not)/.test(notice)) {
    el.className = "err";
    add("", `\u2717 ${notice}`);
  } else {
    el.className = "info";
    add("", notice);
  }
}

function plainScene(key, title, text = "") {
  setText({ prompt: text });
  setScene(key, title);
}

function helpPanel(step) {
  const panel = $("help-panel");
  panel.replaceChildren();
  button("I need help", async () => { helpOpen = !helpOpen; }, "secondary");
  if (!helpOpen) return;
  const add = (label, action) => button(label, action, "secondary", panel);
  add("Give me a hint", () => ask("hint"));
  if (engine.errors) add("Look at my mistake", () => ask("error_review"));
  add("Explain another way", () => ask("reexplain"));
  if (engine.canIntervene) {
    add("I don't get it", async () => {
      helpOpen = false;
      notice = "Take your time. There is no rush.";
      await engine.stuck();
    });
  }
  if (engine.hintLevel >= 2) add("Skip this task", () => submit(null));
}

function renderScripted(step) {
  const back = () => { notice = ""; engine.prevScript(); };
  if (step.type === "explain") {
    const line = step.script[engine.script];
    const toolMode = line.kind === "try" || line.tool_mode === "explore" ? "explore" : "show";
    setText({ kind: line.kind, line: line.text, lineKey: `explain:${engine.script}` });
    sceneWithTool(`explain:${engine.script}`, titles.explain, line.tool, line.tool_params, toolMode, line.tool_step);
    const last = engine.script + 1 >= step.script.length;
    if (engine.script > 0) button("Back", async () => back(), "secondary");
    button(last ? "Start practicing" : "Next", async () => { notice = ""; await engine.nextScript(); });
    return;
  }
  const worked = step.worked;
  const shown = engine.script;
  const last = engine.workedLast;
  const part = shown === 0 ? null : worked.steps[Math.min(shown, worked.steps.length) - 1];
  const text = last ? worked.last_step.text
    : part ? part.text : "Let's solve this one together. Press Next when you are ready.";
  setText({ kind: "", prompt: worked.prompt, line: text, lineKey: `worked:${shown}` });
  sceneWithTool(`worked:${shown}`, titles.together, worked.tool, worked.tool_params, "show", part?.tool_step ?? 0);
  if (last && !workedOk) {
    answer.hidden = false;
    $("entry").placeholder = worked.last_step.answer?.type === "set" ? SET_HINT : "";
    if (shown > 0) button("Back", async () => back(), "secondary");
  } else if (last) {
    button("Continue", async () => { notice = ""; await engine.finishWorked(); });
  } else {
    if (shown > 0) button("Back", async () => back(), "secondary");
    button("Next", async () => { notice = ""; engine.nextWorked(); });
  }
}

function render() {
  updateHeader();
  if (!engine) {
    showNotice();
    return;
  }
  answer.hidden = true;
  photo.hidden = true;
  $("actions").replaceChildren();
  $("help-panel").replaceChildren();
  const { step, current, mode } = engine;
  if (completion) {
    if (completion.completed) {
      plainScene("complete", "Lesson complete", `You earned ${completion.stars_total} stars in this lesson.`);
      button("next lesson", goNext);
    } else {
      // Closed by the timer: the lesson is not finished and comes back as today's lesson.
      plainScene("timeup", "Time is up", `You earned ${completion.stars_total} stars. This lesson is not finished yet: you can go through it again.`);
      button("start again", async () => { location.href = "lesson.html"; });
    }
    button("my stars", () => { location.href = "student.html"; }, "secondary", $("actions"), "> ");
  } else if (step.type === "finish") {
    plainScene("finish", "Finish the lesson", step.finish_prompt || "Think of one thing you learned today.");
    button("Finish lesson", () => closeLesson(true));
  } else if (engine.scripted) {
    renderScripted(step);
  } else if (!current) {
    plainScene(`pending:${step.type}`, titles[step.type]);
    button("Continue lesson", () => engine.advance());
  } else if (mode === "paused" || mode === "recovery") {
    plainScene(mode, mode === "paused" ? "Lesson paused" : "Ready to return",
      "Take the time you need. An easier problem can help you get started again.");
    button("Return to lesson", async () => {
      notice = "";
      if (mode === "paused") await engine.resume();
      else await engine.recover();
    });
  } else {
    const key = `${step.type}:${current.id}:${mode}`;
    const text = step.type === "notebook" ? `${current.prompt} Write your work on paper.` : current.prompt;
    setText({ prompt: text });
    // Only one answer box ever: the tool is a picture of the numbers, or the explore mode after "I don't get it".
    const picture = ["recall", "together", "solo"].includes(step.type) && current.tool_params && mode !== "answered";
    // Without a tool there is nothing to explore: show the plain task and keep the buttons.
    if (mode === "explore" && current.tool && current.tool_params) {
      sceneWithTool(key, titles[step.type], current.tool, current.tool_params, "explore", 0);
    } else if (mode === "explore") plainScene(key, titles[step.type], text);
    else if (picture) sceneWithTool(key, titles[step.type], current.tool, current.tool_params, "show", 0);
    else plainScene(key, titles[step.type], text);
    if (mode === "explore") {
      button("Try the task again", async () => { notice = ""; await engine.continuePractice(); });
      button("Call mom", () => engine.pause(), "secondary");
    } else if (mode === "answered") {
      button("Continue lesson", async () => { notice = ""; await engine.continue(); });
    } else if (step.type === "notebook") {
      photo.hidden = false;
      $("image").hidden = Boolean(engine.pendingPhoto);
      $("photo").querySelector("label").hidden = Boolean(engine.pendingPhoto);
      $("photo").querySelector("button").textContent = engine.pendingPhoto ? "Retry photo check" : "Upload photo";
      button("Continue without photo check", async () => { notice = ""; await engine.continue(); }, "secondary");
    } else {
      answer.hidden = false;
      // Real students get tasks without `answer`, so the label shows only where the task carries its kind (demo).
      $("entry").placeholder = current.answer?.type === "set" ? SET_HINT : "";
      helpPanel(step);
    }
  }
  showNotice();
  if (refocus === "primary") $("actions").querySelector(".big")?.focus({ preventScroll: true });
  refocus = -1;
}

answer.addEventListener("submit", event => {
  event.preventDefault();
  const input = $("entry").value.trim();
  if (!input) return;
  if (engine?.step.worked && !engine.current) {
    // Worked example: the last step is checked here, in the page. It is not a bank task.
    workedOk = engine.checkWorked(input);
    noticeStars = 0;
    notice = workedOk ? "Yes, that is right. Well done!" : "Not quite. Look at the steps again and try once more.";
    render();
    return;
  }
  void run(() => submit(input));
});

photo.addEventListener("submit", event => {
  event.preventDefault();
  const file = $("image").files[0];
  if (!file && !engine.pendingPhoto) {
    notice = "Choose a photo of your notebook first.";
    render();
    return;
  }
  void run(async () => {
    let blob;
    if (!engine.pendingPhoto) {
      try { blob = await jpeg(file); }
      catch { notice = "Choose a clear photo in JPEG or PNG format."; return; }
    }
    notice = await engine.notebook(blob, persist);
  });
});

// "> next lesson": the server counts the lesson just closed, so "today" is now the following one.
async function goNext() {
  notice = "";
  if (demoId) { notice = "Demo: the next lesson is not linked here."; return; }
  const page = await nextLessonPage(feedbackApi, lessonId);
  if (page) location.href = page;
  else notice = "Next lesson is not ready yet";
}

// finished = the student pressed "Finish lesson" himself. Timer closes pass false.
async function closeLesson(finished = false) {
  notice = "";
  completion = { ...(await engine.finish(finished)), completed: finished };
}

function tick() {
  updateHeader();
  document.querySelector(".feedback-bar").hidden = !$("login").hidden;
  if (!engine || busy || completion || Date.now() < nextAutomaticRetry) return;
  const time = engine.timer.left();
  if (engine.mode === "answered" && !time.lesson) {
    void run(async () => { await engine.continue(); await closeLesson(); });
    return;
  }
  if (engine.mode !== "normal" || engine.current) return;
  if (engine.scripted && !engine.holdsScripted(time)) {
    void run(() => engine.advance());
  } else if (engine.step.type === "finish" && (!time.lesson || !time.step)) {
    void run(closeLesson);
  }
}

async function bootDemo() {
  try {
    const { createDemo } = await import("./demo.js");
    const demo = await createDemo(demoId);
    lessonId = demo.lessonId;
    $("demo-badge").hidden = false;
    document.title = "Demo | New Era School";
    workspace.hidden = false;
    // No saved progress in demo mode: every visit starts fresh.
    button("Start lesson", async () => {
      const result = await demo.api.session("start", { lesson_id: demo.lessonId });
      engine = new LessonEngine(result, demo.api, {});
      await engine.advance();
    });
  } catch {
    workspace.hidden = false;
    notice = "The demo lesson could not be loaded. Check that the content folder is next to the site folder.";
    render();
  }
}

async function boot() {
  if (demoId) return bootDemo();
  try {
    const client = schoolClient();
    workspace.hidden = true;
    await requireLogin(client, $("login"));
    const api = schoolApi(client);
    feedbackApi = api;
    const today = await api.session("today");
    lessonId = params.get("lesson") ?? today.lesson_id;
    workspace.hidden = false;
    if (!lessonId) {
      plainScene("empty", "You are all caught up", "Your next lesson will appear here when it is ready.");
      return;
    }
    button(today.open_session_id && lessonId === today.lesson_id ? "Resume lesson" : "Start lesson", async () => {
      const result = await api.session("start", { lesson_id: lessonId });
      storageKey = `school-lesson:${result.session_id}`;
      engine = new LessonEngine(result, api, loadProgress(storageKey));
      await engine.advance();
    });
  } catch {
    workspace.hidden = false;
    notice = "School setup or sign-in is unavailable. Ask your parent to check the connection.";
    render();
  }
}

// Feedback box (CONTRACTS.md 8V). Works beside the lesson: it never touches the engine, the timer or `busy`.
const fbText = $("fb-text");
const fbSend = $("fb-send");
const fbStatus = $("fb-status");

function fbSync() {
  fbSend.disabled = sending || fbText.value.trim() === "";
  fbSend.classList.toggle("sending", sending);
}

function fbMessage(text, kind = "") {
  fbStatus.textContent = text;
  fbStatus.className = kind;
}

fbText.addEventListener("input", () => { if (!sending) fbMessage(""); fbSync(); });
fbText.addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) $("fb-form").requestSubmit();
});

$("fb-form").addEventListener("submit", async event => {
  event.preventDefault();
  const text = fbText.value.trim();
  if (sending || !text) return;
  if (demoId) { fbMessage("Demo: not sent"); return; }
  if (!feedbackApi || !lessonId) { fbMessage("Could not send. Please try again.", "error"); return; }
  sending = true;
  fbSync();
  fbMessage("Sending\u2026");
  try {
    await feedbackApi.session("feedback", {
      session_id: engine?.id ?? null,
      lesson_id: lessonId,
      step_type: engine?.step?.type ?? null,
      task_id: engine?.current?.id ?? null,
      text,
    });
    // Clear only what was sent; anything typed while sending stays.
    if (fbText.value.trim() === text) fbText.value = "";
    fbMessage("Sent, thank you", "ok");
  } catch {
    fbMessage("Could not send. Check the connection and try again.", "error");
  } finally {
    sending = false;
    fbSync();
  }
});

// Enter: while a line is being typed it shows the whole line; otherwise it presses the main "> next \u23CE" button.
// Real buttons and fields keep their own keyboard behaviour.
document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const target = event.target instanceof Element ? event.target : document.body;
  const field = target.closest("input, textarea, select");
  if (typer && !field) { event.preventDefault(); finishTyping(); return; }
  if (field || target.closest("button, a, summary, [role=button], [tabindex]:not(#heading), #tool, #help-tool")) return;
  const go = $("actions").querySelector(".big:not(:disabled)");
  if (go && $("login").hidden) { event.preventDefault(); go.click(); }
}, true);
$("workspace").addEventListener("click", event => {
  if (typer && !event.target.closest("button, input, textarea, #tool, #help-tool")) finishTyping();
});

setInterval(tick, 250);
void boot();
