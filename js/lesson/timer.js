export class LessonTimer {
  constructor(startedAt, now = Date.now, saved = {}) {
    this.now = now;
    this.lessonEnd = saved.lessonEnd ?? startedAt + 1800000;
    this.stepEnd = saved.stepEnd ?? startedAt;
    this.stepFrozenAt = saved.stepFrozenAt ?? null;
    this.pauseAt = saved.pauseAt ?? null;
  }

  snapshot() {
    const { lessonEnd, stepEnd, stepFrozenAt, pauseAt } = this;
    return { lessonEnd, stepEnd, stepFrozenAt, pauseAt };
  }

  startStep(seconds) {
    this.stepEnd = this.now() + seconds * 1000;
    this.stepFrozenAt = null;
  }

  freezeStep() {
    this.stepFrozenAt ??= this.now();
  }

  resumeStep() {
    if (this.stepFrozenAt === null) return;
    this.stepEnd += this.now() - this.stepFrozenAt;
    this.stepFrozenAt = null;
  }

  pause() {
    this.freezeStep();
    this.pauseAt ??= this.now();
  }

  resume() {
    if (this.pauseAt === null) return;
    this.lessonEnd += this.now() - this.pauseAt;
    this.pauseAt = null;
    this.resumeStep();
  }

  left() {
    return {
      lesson: Math.max(0, this.lessonEnd - (this.pauseAt ?? this.now())),
      step: Math.max(0, this.stepEnd - (this.stepFrozenAt ?? this.now())),
    };
  }
}
