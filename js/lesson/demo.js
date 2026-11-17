// Demo mode: preview a lesson without sign-in or a server. Loaded only when the page has ?demo=<lesson id>.
// Answers are checked in the browser from the task files, so nothing here is used for real students.

import { setMatches } from "./answer.js";

const GENERIC_HINTS = [
  "Read the task again. What exactly does it ask you to find?",
  "Go through your work step by step and check each calculation.",
  "Open the tool and work through a similar example first.",
];

const clean = value => String(value ?? "").replace(/\s+/g, "").replace(",", ".");

function isCorrect(task, input) {
  const expected = task.answer;
  if (!expected || input == null) return false;
  if (expected.type === "set") return setMatches(input, expected.value);
  const a = clean(input);
  const b = clean(typeof expected.value === "object" ? JSON.stringify(expected.value) : expected.value);
  if (expected.type === "int" || expected.type === "decimal") {
    return a !== "" && Number.isFinite(Number(a)) && Number(a) === Number(b);
  }
  if (expected.type === "fraction" || expected.type === "mixed") {
    const parse = text => {
      const parts = String(text).trim().split(/\s+/);
      let whole = 0;
      if (parts.length > 1) whole = Number(parts.shift());
      const [n, d = "1"] = (parts[0] ?? "").split("/");
      return whole + Number(n) / Number(d);
    };
    return Math.abs(parse(input) - parse(expected.value)) < 1e-9;
  }
  return a.toLowerCase() === b.toLowerCase();
}

// Same shape the server sends: no answer, solution or hints.
const publicTask = ({ answer, solution, hints, ...rest }) => rest;

async function load(path) {
  const response = await fetch(new URL(path, location.href));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

export async function createDemo(lessonId) {
  if (!/^[A-Za-z0-9_-]+$/.test(lessonId)) throw new Error("Bad demo lesson id");
  const lesson = await load(`../content/lessons/${lessonId}.json`);
  const files = await Promise.all(lesson.skills.map(skill => load(`../content/tasks/${skill}.json`)));
  const bank = new Map(files.flat().filter(task => task.checked).map(task => [task.id, task]));

  const wanted = new Set();
  for (const step of lesson.steps) {
    for (const id of [...(step.task_ids ?? []), ...(step.task_id ? [step.task_id] : [])]) wanted.add(id);
  }
  const tasks = [...wanted].filter(id => bank.has(id)).map(id => publicTask(bank.get(id)));

  let stars = 0;
  const attempts = new Map();

  const api = {
    async session(action, fields = {}) {
      if (action === "today") return { lesson_id: lesson.id, number: lesson.number, open_session_id: null };
      if (action === "start") {
        return {
          session_id: "demo",
          lesson,
          tasks,
          state: { student_id: "demo", started_at: new Date().toISOString(), stars_total: 0,
            issued_task_ids: [], paused: false },
        };
      }
      if (action === "finish") return { stars_total: stars, debts: [] };
      return { ok: true };
    },
    async submit({ task_id, input }) {
      const task = bank.get(task_id);
      const attempt = (attempts.get(task_id) ?? 0) + 1;
      attempts.set(task_id, attempt);
      const is_correct = Boolean(task) && isCorrect(task, input);
      const earned = is_correct ? Math.max(1, 4 - attempt) : 0;
      stars += earned;
      return { is_correct, help_code: "S", stars: earned, attempt, skill_status: "working" };
    },
    async teacher({ kind, task_id, level = 1 }) {
      if (kind === "stuck") return { text: "" };
      if (kind === "notebook_check") return { text: "Demo mode: your teacher would look at the photo here." };
      const hints = bank.get(task_id)?.hints;
      const index = Math.min(2, Math.max(0, level - 1));
      return { text: hints?.[index] ?? GENERIC_HINTS[index], level };
    },
    async alternatives(task, difficulty) {
      return [...bank.values()].filter(item => item.skill === task.skill && item.difficulty === difficulty
        && item.id !== task.id).map(publicTask);
    },
    async photoRegistered() { return false; },
    async upload() {},
  };

  return { api, lessonId: lesson.id };
}
