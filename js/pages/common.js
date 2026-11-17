// Shared helpers for the student and parent pages. Plain DOM, no libraries; all text goes in with textContent.
export const $ = id => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  el.append(...kids.flat().filter(kid => kid != null && kid !== false));
  return el;
}

// A command instead of a button: "> exchange ⏎".
export function cmd(label, onclick, { secondary = false, disabled = false, type = "button", title } = {}) {
  return h("button", { class: `cmd ${secondary ? "secondary" : "go"}`, type, disabled, title, onclick },
    h("span", { class: "pre", "aria-hidden": "true" }, "> "), label,
    h("span", { class: "suf", "aria-hidden": "true" }, " ⏎"));
}

// Whole numbers with a non-breaking space between thousands; at most 2 decimals, trailing zeros removed.
export function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const [whole, fraction] = (Math.round(n * 100) / 100).toString().split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (fraction ? `.${fraction}` : "");
}

// What stars turn into by the rate, rounded down to 2 decimals (the child never sees more than the parent gives).
export function worth(stars, rate) {
  return Math.floor((stars * rate.amount) / rate.stars * 100 + 1e-9) / 100;
}

export function rateText(rate) {
  return `${num(rate.stars)} ★ = ${num(rate.amount)} ${rate.unit}`;
}

export function fmtWhen(iso, lang) {
  if (!iso) return "";
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const words = lang === "ru" ? ["сегодня", "вчера"] : ["today", "yesterday"];
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff === 0) return `${words[0]} ${time}`;
  if (diff === 1) return `${words[1]} ${time}`;
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${time}`;
}

// The Edge Function answers 4xx with {error, reason}; supabase-js hands the Response over as error.context.
export async function errorInfo(error) {
  const response = error?.context;
  const status = typeof response?.status === "number" ? response.status : 0;
  let body = null;
  try { body = await response.json(); } catch { /* network error or empty body */ }
  return { status, error: body?.error ?? null, reason: body?.reason ?? null };
}

export function setMessage(el, text, kind = "") {
  el.textContent = text;
  el.className = kind;
}

// Sign in (or preview mode) and hand back one function: call(action, fields) -> the `stars` Edge Function.
import { schoolApi, schoolClient } from "../core/supabase.js";
import { requireLogin } from "../core/auth.js";

export async function connect({ role, panel, wrong }) {
  const demo = new URL(location.href).searchParams.get("demo");
  if (demo) {
    const { demoServer } = await import("./demo.js");
    return { demo: true, call: demoServer(role, { noRate: demo === "norate" }), logout: null };
  }
  const client = schoolClient();
  await requireLogin(client, panel, wrong);
  const api = schoolApi(client);
  return {
    demo: false,
    call: (action, fields) => api.stars(action, fields),
    logout: async () => { await client.auth.signOut(); location.reload(); },
  };
}
