import { LessonTimer } from "./timer.js";

const taskIds = step => step.task_ids ?? (step.task_id ? [step.task_id] : []);
const interventionSteps = new Set(["together", "solo", "use"]);

export class LessonEngine {
  constructor({ lesson, tasks, state, session_id }, api, saved = {}, now = Date.now) {
    this.api = api;
    this.now = now;
    this.id = session_id;
    this.lesson = lesson;
    this.studentId = state.student_id;
    this.tasks = new Map(tasks.filter(task => task.checked).map(task => [task.id, task]));
    if (saved.recoveryTask?.checked) this.tasks.set(saved.recoveryTask.id, saved.recoveryTask);
    this.issued = new Set(state.issued_task_ids ?? []);
    this.index = saved.index ?? Math.max(0, lesson.steps.findIndex(step => step.type === state.active_step_type));
    this.current = this.tasks.get(Object.hasOwn(saved, "current") ? saved.current : state.active_task_id) ?? null;
    this.taskStart = saved.taskStart ?? now();
    this.completed = saved.completed ?? [];
    this.stars = state.stars_total ?? 0;
    this.errors = saved.errors ?? 0;
    this.hintLevel = saved.hintLevel ?? 0;
    this.script = saved.script ?? 0;
    this.mode = state.paused ? "paused" : state.recovery_task_id || saved.mode === "paused"
      ? "recovery" : (saved.mode ?? "normal");
    this.timer = new LessonTimer(Date.parse(state.started_at) || now(), now, saved.timer);
    if (!saved.timer) this.timer.startStep(this.step.budget_sec);
    if (this.mode === "paused") this.timer.pause();
    if (this.mode === "recovery") this.timer.resume();
    this.extra = state.recall_extra ?? [];
    this.pendingPhoto = saved.pendingPhoto ?? null;
    this.result = null;
  }

  get step() { return this.lesson.steps[this.index]; }
  get canIntervene() { return interventionSteps.has(this.step.type); }

  snapshot() {
    const { index, taskStart, completed, errors, hintLevel, script, mode, pendingPhoto } = this;
    return { index, current: this.current?.id ?? null, taskStart, completed, errors, hintLevel, script, mode,
      timer: this.timer.snapshot(), recoveryTask: this.current, pendingPhoto };
  }

  changeStep(index) {
    this.index = index;
    this.script = 0;
    this.current = null;
    this.timer.startStep(this.step.budget_sec);
  }

  async advance() {
    if (this.mode !== "normal" || this.current || this.step.type === "finish") return;
    while (this.step.type !== "finish") {
      const time = this.timer.left();
      if (!time.lesson) {
        this.changeStep(this.lesson.steps.length - 1);
        return;
      }
      if (this.step.type === "explain" && time.step) return;
      const ids = this.step.type === "recall"
        ? [...new Set([...this.extra, ...taskIds(this.step)])]
        : taskIds(this.step);
      const next = time.step && ids.find(id => this.tasks.has(id) &&
        !this.completed.includes(`${this.step.type}:${id}`) && !this.issued.has(id));
      if (next) {
        await this.activate(this.tasks.get(next));
        return;
      }
      this.changeStep(this.index + 1);
    }
  }

  async activate(task) {
    await this.api.session("activate", { session_id: this.id, task_id: task.id, step_type: this.step.type });
    this.issued.add(task.id);
    this.current = task;
    this.taskStart = this.now();
    this.errors = 0;
    this.hintLevel = 0;
    this.pendingPhoto = null;
  }

  async nextScript() {
    if (this.step.type !== "explain") return;
    if (this.script + 1 < this.step.script.length && this.timer.left().lesson && this.timer.left().step) {
      this.script++;
    } else {
      this.changeStep(this.index + 1);
      await this.advance();
    }
  }

  async nextTask() {
    this.completed.push(`${this.step.type}:${this.current.id}`);
    this.current = null;
    this.pendingPhoto = null;
    await this.advance();
  }

  async submit(input) {
    const result = await this.api.submit({ session_id: this.id, task_id: this.current.id, input,
      ms_spent: Math.min(2147483647, Math.max(0, this.now() - this.taskStart)) });
    this.stars += result.stars ?? 0;
    if (result.is_correct || input === null) {
      this.mode = "answered";
    } else if (++this.errors === 2 && this.canIntervene) {
      await this.stuck();
    }
    return result;
  }

  teacher(kind, fields = {}) {
    let timeout;
    return Promise.race([
      this.api.teacher({ kind, session_id: this.id, task_id: this.current.id, lang: "en", ...fields }),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Teacher timed out")), 12000); }),
    ]).finally(() => clearTimeout(timeout));
  }

  async help(kind, input) {
    const level = kind === "hint" ? Math.min(3, this.hintLevel + 1) : kind === "error_review" ? 2 : 3;
    try {
      const result = await this.teacher(kind, { level, student_input: input });
      if (kind === "hint") this.hintLevel = level;
      return result;
    } catch {
      return { text: "The teacher is unavailable. You can keep working or skip this task." };
    }
  }

  async stuck() {
    this.mode = "explore";
    this.timer.freezeStep();
    try { await this.teacher("stuck"); } catch { /* Explore is still available. */ }
  }

  async continuePractice() {
    this.mode = "normal";
    this.errors = 0;
    this.timer.resumeStep();
  }

  async pause() {
    await this.api.session("pause", { session_id: this.id, reason: "meltdown" });
    this.timer.pause();
    this.mode = "paused";
  }

  async resume() {
    await this.api.session("resume", { session_id: this.id });
    this.timer.resume();
    this.mode = "recovery";
    return this.recover();
  }

  async recover() {
    const target = Math.max(1, this.current.difficulty - 2);
    const candidates = await this.api.alternatives(this.current, target);
    const task = candidates.find(candidate => !this.issued.has(candidate.id));
    if (task && this.timer.left().lesson) {
      await this.activate(task);
      this.tasks.set(task.id, task);
      this.mode = "normal";
    } else {
      this.mode = "normal";
      await this.nextTask();
    }
    return Boolean(task);
  }

  async notebook(blob, persist) {
    if (!this.pendingPhoto) {
      const path = `${this.studentId}/${this.id}/${this.current.id}-${this.now()}.jpg`;
      await this.api.upload(path, blob);
      this.pendingPhoto = path;
      persist();
    }
    try {
      const result = await this.teacher("notebook_check", { photo_path: this.pendingPhoto });
      this.mode = "answered";
      this.stars += 3;
      return result.text;
    } catch {
      if (await this.api.photoRegistered(this.id, this.pendingPhoto).catch(() => false)) {
        this.mode = "answered";
        this.stars += 3;
        return "Your photo is ready for your parent to review.";
      }
      return "Your photo was uploaded. Retry the check or continue with the lesson.";
    }
  }

  async continue() {
    this.mode = "normal";
    await this.nextTask();
  }

  async finish() {
    const unissued = this.lesson.steps.filter(step => step.type === "solo")
      .flatMap(taskIds).filter(id => !this.issued.has(id));
    this.result = await this.api.session("finish", {
      session_id: this.id, completed: true, unissued_task_ids: unissued,
    });
    this.stars = this.result.stars_total;
    return this.result;
  }
}
