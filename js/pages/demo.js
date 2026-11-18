// Preview mode (?demo=1): invented data, nothing leaves the browser. It mimics the server rules
// (balance minus requests, rate required, role checks) so the pages can be tried without a server.
const MIN = 60000;
const DAY = 24 * 60 * MIN;
const iso = ago => new Date(Date.now() - ago).toISOString();

function fail(status, error, reason = null) {
  const e = new Error("demo");
  e.context = new Response(JSON.stringify({ error, reason }), { status, headers: { "Content-Type": "application/json" } });
  return e;
}

// Invented notebook "photos": plain SVG pictures, so nothing real is needed.
const sheet = (text, tone) => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${tone}"/>` +
  [60, 120, 180, 240, 300, 360, 420].map(y => `<line x1="0" y1="${y}" x2="640" y2="${y}" stroke="#9db4d0" stroke-width="1"/>`).join("") +
  `<text x="40" y="110" font-size="44" font-family="monospace" fill="#223">${text}</text></svg>`);

export function demoServer(role, options = {}) {
  const state = {
    rate: options.noRate ? null : { stars: 100, amount: 80, unit: "Robux" },
    ledger: [
      { amount: 2, reason: "independent_answer", at: iso(12 * MIN), skill: "Subsets" },
      { amount: 1, reason: "answer_with_help", at: iso(25 * MIN), skill: "Subsets" },
      { amount: 3, reason: "notebook_photo", at: iso(40 * MIN), lesson: 2 },
      { amount: 5, reason: "lesson_completed", at: iso(45 * MIN), lesson: 2 },
      { amount: 2, reason: "self_corrected", at: iso(DAY + 30 * MIN), skill: "Intersection of sets" },
      { amount: 10, reason: "mastered", at: iso(DAY + 50 * MIN), skill: "Subsets" },
      { amount: 5, reason: "lesson_completed", at: iso(2 * DAY), lesson: 1 },
    ],
    earnedExtra: 107, // older awards, so the balance is a realistic number
    redemptions: [
      { id: "r0000000-0000-4000-8000-000000000001", stars: 20, status: "given", created_at: iso(4 * DAY),
        given_at: iso(3 * DAY), rate: { stars: 100, amount: 80, unit: "Robux" } },
    ],
    feedback: [
      { id: "f0000000-0000-4000-8000-000000000001", lesson_id: "M-002", step_type: "solo", task_id: "S1-g-004",
        text: "The picture of the mushrooms is too small on my screen, I can't see which one is red.",
        status: "new", created_at: iso(35 * MIN) },
      { id: "f0000000-0000-4000-8000-000000000002", lesson_id: "M-001", step_type: "explain", task_id: null,
        text: "Не понял слово «подмножество» в третьей строке.", status: "seen", created_at: iso(DAY + 2 * 60 * MIN) },
      { id: "f0000000-0000-4000-8000-000000000003", lesson_id: "M-001", step_type: "together", task_id: null,
        text: "Всё хорошо.", status: "done", created_at: iso(2 * DAY) },
    ],
    lessons: [
      { id: "M-001", number: 1, title: "Subsets", state: "done" },
      { id: "M-002", number: 2, title: "Intersection of sets", state: "done" },
      { id: "M-003", number: 3, title: "Union of sets", state: "today" },
      { id: "M-004", number: 4, title: "Splitting into classes", state: "next" },
      { id: "M-005", number: 5, title: "Natural numbers: order", state: "next" },
      { id: "M-006", number: 6, title: "Adding in a column", state: "next" },
      { id: "M-007", number: 7, title: "Subtracting in a column", state: "next" },
      { id: "M-008", number: 8, title: "Multiplication tables", state: "next" },
    ],
  };
  state.asks = [
    { id: "a0000000-0000-4000-8000-000000000001", created_at: iso(14 * MIN), lesson_id: "M-003", lesson_number: 3,
      step_type: "solo", task_id: "S1-g-004", prompt: "Find the union of the sets A and B.",
      question: "что такое объединение?", answer: "Объединение (union) — это все элементы обоих наборов вместе, без повторов. Например, для {1, 2} и {2, 3} получится {1, 2, 3}.", from_model: true },
    { id: "a0000000-0000-4000-8000-000000000002", created_at: iso(DAY + 20 * MIN), lesson_id: "M-002", lesson_number: 2,
      step_type: "explain", task_id: null, prompt: null,
      question: "what is a subset?", answer: "Try the hint button, or ask your parent.", from_model: false },
  ];
  state.photos = [
    { id: "p0000000-0000-4000-8000-000000000001", url: sheet("12 x 4 = 48", "#f6f1e4"), created_at: iso(20 * MIN),
      lesson_id: "M-003", lesson_number: 3, task_id: "S1-b-011", prompt: "Find the union of the sets A and B.",
      model_verdict: null, reviewed: false },
    { id: "p0000000-0000-4000-8000-000000000002", url: sheet("A ∩ B = {2, 5}", "#eef3e6"), created_at: iso(DAY + 10 * MIN),
      lesson_id: "M-002", lesson_number: 2, task_id: "S1-g-004", prompt: "Write the intersection of two sets.",
      model_verdict: { correct: true, neat: true, comment: "Clear work, the common elements are found calmly." }, reviewed: false },
    { id: "p0000000-0000-4000-8000-000000000003", url: sheet("?", "#f3e9e9"), created_at: iso(2 * DAY),
      lesson_id: "M-001", lesson_number: 1, task_id: "S1-a-002", prompt: "Which of the sets is a subset of the other?",
      model_verdict: { correct: null, neat: false, comment: "The photo is dark, the solution is hard to see." }, reviewed: true },
  ];
  if (role === "parent") {
    state.redemptions.push({ id: "r0000000-0000-4000-8000-000000000002", stars: 37, status: "requested",
      created_at: iso(50 * MIN), given_at: null, rate: { ...state.rate } });
  }
  const earned = () => state.earnedExtra + state.ledger.reduce((s, e) => s + e.amount, 0);
  const sum = status => state.redemptions.filter(r => r.status === status).reduce((s, r) => s + r.stars, 0);
  const totals = () => ({ earned: earned(), given: sum("given"), reserved: sum("requested"),
    available: earned() - sum("given") - sum("requested") });
  const sortedRequests = () => [...state.redemptions].sort((a, b) =>
    (b.status === "requested") - (a.status === "requested") || b.created_at.localeCompare(a.created_at));
  const need = wanted => { if (role !== wanted) throw fail(403, "forbidden"); };
  let counter = 100;

  return async function call(action, fields = {}) {
    await new Promise(r => setTimeout(r, 120));
    if (action === "student") {
      need("student");
      return { totals: totals(), rate: state.rate, ledger: state.ledger.slice(0, 15), lessons: state.lessons,
        redemptions: sortedRequests().slice(0, 20) };
    }
    if (action === "redeem") {
      need("student");
      const n = fields.stars;
      if (!Number.isInteger(n) || n < 1) throw fail(400, "rejected", "invalid");
      if (!state.rate) throw fail(400, "rejected", "no_rate");
      if (n > totals().available) throw fail(400, "rejected", "not_enough");
      const row = { id: `r0000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`, stars: n,
        status: "requested", created_at: new Date().toISOString(), given_at: null, rate: { ...state.rate } };
      state.redemptions.push(row);
      return { id: row.id, stars: n, status: "requested", rate: row.rate, available: totals().available };
    }
    if (action === "parent") {
      need("parent");
      return { student: true, totals: totals(), rate: state.rate, redemptions: sortedRequests().slice(0, 30),
        feedback: state.feedback, summary: { lessons_done: 2, lessons_total: 40, stars_week: 91 } };
    }
    if (action === "asks") {
      need("parent");
      return { asks: state.asks };
    }
    if (action === "photos") {
      need("parent");
      return { pending: state.photos.filter(p => !p.reviewed).length, photos: state.photos };
    }
    if (action === "photo_reviewed") {
      need("parent");
      const row = state.photos.find(p => p.id === fields.id);
      if (!row) throw fail(403, "forbidden");
      row.reviewed = true;
      return { ok: true };
    }
    if (action === "give") {
      need("parent");
      const row = state.redemptions.find(r => r.id === fields.id);
      if (!row) throw fail(403, "forbidden");
      if (row.status === "requested") { row.status = "given"; row.given_at = new Date().toISOString(); }
      return { ok: true, status: "given" };
    }
    if (action === "set_rate") {
      need("parent");
      const unit = String(fields.unit ?? "").trim();
      if (!Number.isInteger(fields.stars) || fields.stars < 1 || !(fields.amount > 0) || !unit || unit.length > 24) {
        throw fail(400, "rejected", "invalid");
      }
      state.rate = { stars: fields.stars, amount: fields.amount, unit };
      return { ok: true, rate: state.rate };
    }
    if (action === "seen") {
      need("parent");
      const row = state.feedback.find(f => f.id === fields.id);
      if (!row) throw fail(403, "forbidden");
      if (row.status === "new") row.status = "seen";
      return { ok: true };
    }
    throw fail(400, "invalid_request");
  };
}
