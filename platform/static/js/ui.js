/* Мелкие переиспользуемые кирпичи интерфейса. */

import { icon } from "./icons.js";

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

export function el(html){
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Делегирование: один обработчик на контейнер вместо сотни inline-onclick. */
export function delegate(root, event, selector, handler){
  root.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if(target && root.contains(target)) handler(e, target);
  });
}

/** Расставляет иконки по разметке: <span data-icon="flame" data-size="15">. */
export function fillIcons(root = document){
  $$("[data-icon]", root).forEach(node => {
    if(node.dataset.filled) return;
    node.innerHTML = icon(node.dataset.icon, +(node.dataset.size || 18));
    node.dataset.filled = "1";
  });
}

/* ── подсветка SQL ───────────────────────────────────────── */
const KW = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|AS|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|LEFT|RIGHT|INNER|FULL|OUTER|JOIN|ON|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|ASC|DESC|OVER|PARTITION BY|FILTER|INTERVAL";
const FN = "COUNT|SUM|AVG|MIN|MAX|MEDIAN|ROUND|ABS|COALESCE|CAST|DATE_TRUNC|DATE_DIFF|EXTRACT|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|NOW|CURRENT_DATE";
const SYNTAX = new RegExp(
  "(--[^\\n]*)|('(?:[^']|'')*')|\\b(" + FN + ")\\b(?=\\s*\\()|\\b(" + KW + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", "gi");

export const paint = src => esc(src).replace(SYNTAX, (m, comment, str, fn, kw) =>
  comment ? `<span class="c">${m}</span>` :
  str     ? `<span class="s">${m}</span>` :
  fn      ? `<span class="f">${m}</span>` :
  kw      ? `<span class="k">${m}</span>` : `<span class="n">${m}</span>`);

/* ── прогресс ────────────────────────────────────────────── */
/** Полоса и число рядом. Всегда со знаменателем: «18 / 25», не «72%». */
export function meter(done, total, {mod = "", label = ""} = {}){
  const pct = total ? Math.round(100 * done / total) : 0;
  return `<span class="meter">
    <span class="bar ${mod}" role="progressbar" aria-valuenow="${done}" aria-valuemin="0"
      aria-valuemax="${total}" aria-label="${label || `Готово ${done} из ${total}`}">
      <i style="width:${pct}%"></i></span>
    <span class="meter__n">${done} / ${total}</span>
  </span>`;
}

export function ring(value, goal){
  const pct = goal ? Math.min(1, value / goal) : 0;
  const r = 27, c = 2 * Math.PI * r;
  return `<span class="ring ${pct >= 1 ? "is-done" : ""}" role="img"
      aria-label="Дневная цель: ${value} из ${goal} XP">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle class="ring__track" cx="32" cy="32" r="${r}"></circle>
      <circle class="ring__bar" cx="32" cy="32" r="${r}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"></circle>
    </svg>
    <span class="ring__val" aria-hidden="true">${value}<small>/${goal}</small></span>
  </span>`;
}

/* ── результат запроса ───────────────────────────────────── */
export function resultTable(res){
  if(!res || !res.columns) return "";
  if(!res.rows.length){
    return note({kind:"", ic:"info", title:"Строк не вернулось",
      text:"Запрос отработал, но под условия не подошла ни одна строка. Обычно виноват слишком узкий фильтр."});
  }
  const shown = res.rows.slice(0, 150);
  const total = res.total ?? res.rows.length;
  return `<div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>${res.columns.map(c => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${shown.map(row => "<tr>" + row.map(v =>
        `<td>${v === null ? `<span class="null">NULL</span>` : esc(v)}</td>`).join("") + "</tr>").join("")}
      </tbody></table></div>
    <p class="tbl-note">${shown.length < total
      ? `Первые ${shown.length} строк из ${total}`
      : `Строк: ${total}`}</p></div>`;
}

/* ── сообщения ───────────────────────────────────────────── */
export function note({kind = "", ic = "info", title = "", text = "", raw = "", actions = ""}){
  return `<div class="note ${kind ? "note--" + kind : ""}">
    ${icon(ic, 16)}
    <div class="note__b">
      ${title ? `<b class="note__t">${title}</b>` : ""}
      ${text}
      ${raw ? `<details><summary>Что сказала база</summary><pre>${esc(raw)}</pre></details>` : ""}
      ${actions ? `<div class="row" style="margin-top:var(--sp-3)">${actions}</div>` : ""}
    </div></div>`;
}

export const emptyState = ({ic = "info", title, text, action = ""}) => `
  <div class="state">
    ${icon(ic, 22)}
    <p class="state__t">${title}</p>
    <p class="state__x">${text}</p>
    ${action}
  </div>`;

export const skeletonPage = () => `<div class="scroll"><div class="page" aria-busy="true"
    aria-label="Курс загружается">
  <div class="skel skel--head"></div>
  <div class="skel skel--line" style="width:70%"></div>
  <div class="skel skel--line" style="width:40%;margin-bottom:var(--sp-7)"></div>
  ${'<div class="skel skel--row"></div>'.repeat(6)}</div></div>`;

/* ── тосты ───────────────────────────────────────────────── */
export function toast(text, kind = "", ic = ""){
  const box = $("#toasts");
  if(!box) return;
  const t = el(`<div class="toast ${kind ? "toast--" + kind : ""}">${ic ? icon(ic, 15) : ""}${text}</div>`);
  box.appendChild(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 220); }, 2000);
}

/* ── микровзаимодействия ─────────────────────────────────── */
export function bump(node){
  if(!node) return;
  node.classList.remove("is-bumped");
  void node.offsetWidth;
  node.classList.add("is-bumped");
}

/** Короткий салют на закрытие юнита. Гасится настройкой ОС. */
export function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue("--acc"), css.getPropertyValue("--ok"), css.getPropertyValue("--tx-2")];
  const box = el(`<div class="confetti" aria-hidden="true"></div>`);
  for(let i = 0; i < 20; i++){
    const p = document.createElement("i");
    p.style.left = (50 + (Math.random() - .5) * 22) + "%";
    p.style.background = colors[i % colors.length].trim();
    p.style.setProperty("--dx", ((Math.random() - .5) * 480).toFixed(0) + "px");
    p.style.setProperty("--dy", (120 + Math.random() * 360).toFixed(0) + "px");
    p.style.setProperty("--rot", (Math.random() * 540 - 270).toFixed(0) + "deg");
    p.style.setProperty("--fly", (800 + Math.random() * 500).toFixed(0) + "ms");
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1500);
}

/* ── склонение ───────────────────────────────────────────── */
export function plural(n, one, few, many){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}
export const nDays = n => `${n} ${plural(n, "день", "дня", "дней")}`;
export const pad2 = n => String(n).padStart(2, "0");
