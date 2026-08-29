/* Мелкие переиспользуемые кирпичи интерфейса. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/** HTML-строка → элемент. */
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
/** Полоса с числом рядом: «18 из 25», а не голые проценты. */
export function progressRow(done, total, {mod = "", unit = "", id = ""} = {}){
  const pct = total ? Math.round(100 * done / total) : 0;
  return `<div class="progress-row">
    <div class="progress ${mod}" role="progressbar" ${id ? `id="${id}"` : ""}
         aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"
         aria-label="Готово ${done} из ${total}${unit ? " " + unit : ""}">
      <i class="progress__fill" style="width:${pct}%"></i></div>
    <span class="progress-row__num">${done} из ${total}${unit ? " " + unit : ""}</span>
  </div>`;
}

export function ring(value, goal){
  const pct = goal ? Math.min(1, value / goal) : 0;
  const r = 32, c = 2 * Math.PI * r;
  return `<div class="ring ${pct >= 1 ? "is-done" : ""}" role="img"
      aria-label="Дневная цель: ${value} из ${goal} XP">
    <svg viewBox="0 0 76 76" aria-hidden="true">
      <circle class="ring__track" cx="38" cy="38" r="${r}"></circle>
      <circle class="ring__bar" cx="38" cy="38" r="${r}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"></circle>
    </svg>
    <span class="ring__val" aria-hidden="true">${value}<small>из ${goal}</small></span>
  </div>`;
}

/* ── таблица результата запроса ──────────────────────────── */
export function resultTable(res){
  if(!res || !res.columns) return "";
  if(!res.rows.length){
    return alert_({kind:"info", icon:"◌", title:"Строк не вернулось",
      text:"Запрос отработал, но под условия не подошла ни одна строка. Обычно виноват слишком узкий фильтр."});
  }
  const shown = res.rows.slice(0, 150);
  const total = res.total ?? res.rows.length;
  return `<div>
    <div class="table-wrap"><table class="table">
      <thead><tr>${res.columns.map(c => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${shown.map(row => "<tr>" + row.map(v =>
        `<td>${v === null ? `<span class="null">NULL</span>` : esc(v)}</td>`).join("") + "</tr>").join("")}
      </tbody></table></div>
    <p class="table-note">${shown.length < total
      ? `Показаны первые ${shown.length} строк из ${total}.`
      : `Строк: ${total}.`}</p></div>`;
}

/* ── сообщения ───────────────────────────────────────────── */
export function alert_({kind = "info", icon = "", title = "", text = "", raw = "", actions = ""}){
  return `<div class="alert alert--${kind}">
    ${icon ? `<span class="alert__icon" aria-hidden="true">${icon}</span>` : ""}
    <div class="alert__body">
      ${title ? `<b class="alert__title">${title}</b>` : ""}
      ${text}
      ${raw ? `<details><summary>Что сказала база</summary><pre>${esc(raw)}</pre></details>` : ""}
      ${actions ? `<div class="row u-mt-3">${actions}</div>` : ""}
    </div></div>`;
}

export const emptyState = ({art = "◌", title, text, action = ""}) => `
  <div class="state">
    <div class="state__art" aria-hidden="true">${art}</div>
    <p class="state__title">${title}</p>
    <p class="state__text">${text}</p>
    ${action}
  </div>`;

export const skeletonMap = () => `<div class="map" aria-busy="true" aria-label="Курс загружается">
  <div class="skeleton skeleton--title"></div>
  <div class="skeleton" style="height:150px;border-radius:var(--r-xl);margin-bottom:var(--sp-7)"></div>
  ${"<div class='skeleton skeleton--node'></div>".repeat(4)}</div>`;

/* ── тосты ───────────────────────────────────────────────── */
export function toast(text, kind = ""){
  const box = $("#toasts");
  if(!box) return;
  const t = el(`<div class="toast ${kind ? "toast--" + kind : ""}">${text}</div>`);
  box.appendChild(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 260); }, 2100);
}

/* ── микровзаимодействия ─────────────────────────────────── */
export function bump(node){
  if(!node) return;
  node.classList.remove("is-bumped");
  void node.offsetWidth;
  node.classList.add("is-bumped");
}

/** Короткий салют на закрытие юнита. Отключается через prefers-reduced-motion. */
export function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#2f80ff","#22b567","#ffbe5c","#5b9cff","#4bd68b"];
  const box = el(`<div class="confetti" aria-hidden="true"></div>`);
  for(let i = 0; i < 26; i++){
    const p = document.createElement("i");
    p.style.left = (50 + (Math.random() - .5) * 26) + "%";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", ((Math.random() - .5) * 560).toFixed(0) + "px");
    p.style.setProperty("--dy", (140 + Math.random() * 420).toFixed(0) + "px");
    p.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
    p.style.setProperty("--dur-fly", (900 + Math.random() * 700).toFixed(0) + "ms");
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
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
