import { schoolApi, schoolClient } from "../core/supabase.js";
import { requireLogin } from "../core/auth.js";
import { LessonEngine } from "./engine.js";

const $ = id => document.getElementById(id);
const workspace = $("workspace");
const answer = $("answer");
const photo = $("photo");
const toolIds = new Set(["column", "fraction_bars", "number_line", "area_grid",
  "percent_bar", "balance", "cubes", "protractor"]);
const titles = {
  recall: "Warm up", explain: "See how it works", together: "Work together",
  solo: "Try it on your own", notebook: "Show your work", use: "Use what you learned",
  finish: "Finish the lesson",
};
let engine;
let storageKey;
let busy = false;
let scene;
let tool;
let helpTool;
let renderEpoch = 0;
let completion;
let nextAutomaticRetry = 0;
let notice = "";
let lastInput;

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
  $("step").textContent = completion ? "Lesson complete" : engine ? titles[engine.step.type] : "Get ready";
  $("progress").value = engine ? engine.index + 1 : 0;
  $("stars").textContent = String(completion?.stars_total ?? engine?.stars ?? 0);
  const seconds = completion ? 0 : engine ? Math.ceil(engine.timer.left().lesson / 1000) : 1800;
  $("time").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
  }
}

function button(label, action, secondary = false) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  if (secondary) node.className = "secondary";
  node.addEventListener("click", () => void run(action));
  $("actions").append(node);
}

async function mountTool(host, id, params, mode, step, epoch) {
  if (!toolIds.has(id) || !params) return null;
  try {
    const { default: definition } = await import(`../tools/${id}.js`);
    if (epoch !== renderEpoch) return null;
    const instance = definition.mount(host, params, {
      mode, lang: "en", reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      onEvent(type, payload) {
        if (mode === "answer" && type === "done" && payload?.value != null) {
          void run(() => submit(payload.value));
        }
      },
    });
    if (mode === "show") instance.setStep(step ?? 0);
    if (busy) for (const control of host.querySelectorAll("button, input")) control.disabled = true;
    return instance;
  } catch {
    if (epoch === renderEpoch) host.textContent = "You can work this out on paper.";
    return null;
  }
}

function setScene(key, title, text = "") {
  $("heading").textContent = title;
  $("prompt").textContent = text;
  if (scene === key) return false;
  scene = key;
  renderEpoch++;
  tool?.destroy();
  tool = null;
  helpTool?.destroy();
  helpTool = null;
  $("tool").replaceChildren();
  $("help-tool").replaceChildren();
  $("entry").value = "";
  $("image").value = "";
  lastInput = undefined;
  $("heading").focus();
  return true;
}

async function submit(input) {
  if (engine.mode !== "normal") return;
  lastInput = input;
  const result = await engine.submit(input);
  if (input === null) notice = "You can return to this skill in a future lesson.";
  else if (result.is_correct) notice = "That answer is correct.";
  else notice = engine.mode === "explore" ? "Take a moment to work through the columns."
    : "Check the digits and try again.";
}

async function ask(kind) {
  const response = await engine.help(kind, $("entry").value || lastInput);
  notice = response.text ?? "";
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

function render() {
  updateHeader();
  if (!engine) {
    $("feedback").textContent = notice;
    return;
  }
  answer.hidden = true;
  photo.hidden = true;
  $("actions").replaceChildren();
  const { step, current, mode } = engine;
  if (completion) {
    setScene("complete", "Lesson complete", `You earned ${completion.stars_total} stars in this lesson.`);
  } else if (step.type === "finish") {
    setScene("finish", "Finish the lesson", "Think of one place where carrying helped you today.");
    button("Finish lesson", closeLesson);
  } else if (step.type === "explain") {
    const line = step.script[engine.script];
    if (setScene(`explain:${engine.script}`, titles.explain, line.text)) {
      const epoch = renderEpoch;
      void mountTool($("tool"), line.tool, line.tool_params, "show", line.tool_step, epoch)
        .then(instance => { if (epoch === renderEpoch) tool = instance; });
    }
    button(engine.script + 1 < step.script.length ? "Next part" : "Start practicing",
      async () => { notice = ""; await engine.nextScript(); });
  } else if (!current) {
    setScene(`pending:${step.type}`, titles[step.type]);
    button("Continue lesson", () => engine.advance());
  } else if (mode === "paused" || mode === "recovery") {
    setScene(mode, mode === "paused" ? "Lesson paused" : "Ready to return",
      "Take the time you need. An easier problem can help you get started again.");
    button("Return to lesson", async () => {
      notice = "";
      if (mode === "paused") await engine.resume();
      else await engine.recover();
    });
  } else {
    const key = `${step.type}:${current.id}:${mode}`;
    const text = step.type === "notebook" ? `${current.prompt} Write your work on paper.` : current.prompt;
    if (setScene(key, titles[step.type], text)) {
      const toolMode = mode === "explore" ? "explore" : step.type === "together" ? "answer" : null;
      if (toolMode && mode !== "answered") {
        const epoch = renderEpoch;
        void mountTool($("tool"), current.tool, current.tool_params, toolMode, 0, epoch)
          .then(instance => { if (epoch === renderEpoch) tool = instance; });
      }
    }
    if (mode === "explore") {
      button("Try the task again", async () => { notice = ""; await engine.continuePractice(); });
      button("Call mom", () => engine.pause(), true);
    } else if (mode === "answered") {
      button("Continue lesson", async () => { notice = ""; await engine.continue(); });
    } else if (step.type === "notebook") {
      photo.hidden = false;
      $("image").hidden = Boolean(engine.pendingPhoto);
      $("photo").querySelector("label").hidden = Boolean(engine.pendingPhoto);
      $("photo").querySelector("button").textContent = engine.pendingPhoto ? "Retry photo check" : "Upload photo";
      button("Continue without photo check", async () => { notice = ""; await engine.continue(); }, true);
    } else {
      answer.hidden = false;
      button("Get a hint", () => ask("hint"), true);
      if (engine.errors) button("Review my mistake", () => ask("error_review"), true);
      if (step.type === "together") button("Explain another way", () => ask("reexplain"), true);
      if (engine.canIntervene) button("I don't get it", async () => {
        notice = "Work through the columns at your own pace.";
        await engine.stuck();
      }, true);
      button("Skip this task", () => submit(null), true);
    }
  }
  $("feedback").textContent = notice;
}

answer.addEventListener("submit", event => {
  event.preventDefault();
  const input = $("entry").value.trim();
  if (input) void run(() => submit(input));
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

async function closeLesson() {
  notice = "";
  completion = await engine.finish();
}

function tick() {
  updateHeader();
  if (!engine || busy || completion || Date.now() < nextAutomaticRetry) return;
  const time = engine.timer.left();
  if (engine.mode === "answered" && !time.lesson) {
    void run(async () => { await engine.continue(); await closeLesson(); });
    return;
  }
  if (engine.mode !== "normal" || engine.current) return;
  if (engine.step.type === "explain" && (!time.lesson || !time.step)) {
    void run(() => engine.advance());
  } else if (engine.step.type === "finish" && (!time.lesson || !time.step)) {
    void run(closeLesson);
  }
}

async function boot() {
  try {
    const client = schoolClient();
    workspace.hidden = true;
    await requireLogin(client, $("login"));
    const api = schoolApi(client);
    const today = await api.session("today");
    const lessonId = new URL(location.href).searchParams.get("lesson") ?? today.lesson_id;
    workspace.hidden = false;
    if (!lessonId) {
      setScene("empty", "You are all caught up", "Your next lesson will appear here when it is ready.");
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

setInterval(tick, 250);
void boot();
