/* ScaleQL — статическая версия: база DuckDB работает прямо в браузере. */
import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

const TABLES = ["users", "subscriptions", "payments", "events", "marketing_spend"];
const KW = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|AS|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|LEFT|RIGHT|INNER|FULL|OUTER|JOIN|ON|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|ASC|DESC|OVER|PARTITION BY|FILTER|INTERVAL";
const FN = "COUNT|SUM|AVG|MIN|MAX|MEDIAN|ROUND|ABS|COALESCE|CAST|DATE_TRUNC|DATE_DIFF|EXTRACT|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|NOW|CURRENT_DATE";
const RE = new RegExp("(--[^\\n]*)|('(?:[^']|'')*')|\\b(" + FN + ")\\b(?=\\s*\\()|\\b(" + KW + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", "gi");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paint = src => esc(src).replace(RE, (m, c, st, fn, kw) =>
  c ? `<span class="c">${m}</span>` : st ? `<span class="s">${m}</span>` :
  fn ? `<span class="f">${m}</span>` : kw ? `<span class="k">${m}</span>` : `<span class="n">${m}</span>`);
const $ = id => document.getElementById(id);

/* ── прогресс в браузере ───────────────────────────────── */
const KEY = "scaleql.v1";
const BLANK = {xp: 0, tasks: {}, quizzes: {}, answers: {}, streak: {days: 0, last: ""}, goal: 30, history: {}};
function loadState(){
  try { return Object.assign(structuredClone(BLANK), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { return structuredClone(BLANK); }
}
function saveState(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
const today = () => new Date().toISOString().slice(0, 10);
function award(xp){
  const d = today();
  if (S.streak.last !== d){
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    S.streak.days = S.streak.last === y ? S.streak.days + 1 : 1;
    S.streak.last = d;
  }
  S.xp += xp;
  S.history[d] = (S.history[d] || 0) + xp;
  saveState();
}

/* ── база в браузере ───────────────────────────────────── */
let conn = null;
async function initDb(){
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], {type: "text/javascript"}));
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  $("bootMsg").textContent = "Готовлю данные: год работы сервиса по подписке.";
  for (const t of TABLES){
    const buf = new Uint8Array(await (await fetch(`data/${t}.parquet`)).arrayBuffer());
    await db.registerFileBuffer(`${t}.parquet`, buf);
  }
  conn = await db.connect();
  for (const t of TABLES) await conn.query(`CREATE TABLE ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
}
function norm(v){
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
  return v;
}
async function sql(query){
  const res = await conn.query(query);
  const fields = res.schema.fields;
  const cols = fields.map(f => f.name);
  const isDate = fields.map(f => /date|timestamp/i.test(String(f.type)));
  const rows = res.toArray().map(r => {
    const o = r.toJSON();
    return cols.map((c, i) => {
      let v = o[c];
      if (isDate[i] && typeof v === "number") v = new Date(v).toISOString().slice(0, 10);
      if (isDate[i] && typeof v === "bigint") v = new Date(Number(v)).toISOString().slice(0, 10);
      return norm(v);
    });
  });
  return {columns: cols, rows, total: rows.length};
}
const ERR_RU = [
  [/column "(\w+)" must appear in the GROUP BY/, n => `Колонка «${n}» стоит в SELECT без агрегатной функции и её нет в GROUP BY. В кучке много разных значений — база не знает, какое показать. Оберни в функцию или добавь в GROUP BY.`],
  [/Table with name (\w+) does not exist/, n => `Таблицы «${n}» в базе нет. Проверь имя по списку таблиц.`],
  [/Referenced column "(\w+)" not found/, n => `Колонки «${n}» нет в таблицах из FROM. Проверь написание или добавь нужную таблицу.`],
  [/syntax error at or near "([^"]+)"/, n => `Синтаксическая ошибка рядом с «${n}». Обычно лишнее слово, пропущенная запятая или сбитый порядок: SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT.`],
  [/syntax error at end of input/, () => "Запрос оборван — не хватает последней части."],
  [/Conversion Error/, () => "Не сошлись типы: текст сравнивается с числом. Обычно условие повешено не на ту колонку."],
  [/aggregate function calls cannot be nested/, () => "Агрегат внутри агрегата запрещён. Нужен второй шаг: посчитай первый уровень в WITH, потом усредняй."],
  [/WHERE clause cannot contain window functions/, () => "По оконной функции нельзя фильтровать в WHERE — она считается позже. Оберни запрос в WITH и фильтруй на следующем шаге."],
  [/No function matches/, () => "Такой функции нет или ей переданы не те аргументы."],
];
const ruError = m => { for (const [re, f] of ERR_RU){ const x = m.match(re); if (x) return f(x[1]); } return null; };

/* ── состояние приложения ──────────────────────────────── */
let C = null, SCHEMA = null, S = loadState(), view = "map", unitIdx = 0, curTask = null, busy = false, lastCtx = {};
const tasksOf = u => u.blocks.filter(b => b.type === "task");
const quizOf = u => u.blocks.filter(b => b.type === "quiz");
const doneIn = u => tasksOf(u).filter(t => S.tasks[t.id] === "done").length + quizOf(u).filter(q => S.quizzes[q.id] === "done").length;
const totalIn = u => tasksOf(u).length + quizOf(u).length;
const unitDone = u => doneIn(u) === totalIn(u);
const unlocked = i => i === 0 || doneIn(C.units[i-1]) >= Math.ceil(totalIn(C.units[i-1]) * 0.7);

function hud(){
  $("streak").textContent = "🔥 " + (S.streak.days || 0);
  $("xp").innerHTML = (S.xp || 0) + " <small>XP</small>";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.v === view));
}
function toast(text){
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = text; document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ── карта ─────────────────────────────────────────────── */
function renderMap(){
  const totT = C.units.reduce((a, u) => a + tasksOf(u).length, 0);
  const dT = C.units.reduce((a, u) => a + tasksOf(u).filter(t => S.tasks[t.id] === "done").length, 0);
  let h = `<div class="map"><h1>Путь аналитика: SQL</h1>
    <p class="lead">${C.units.length} юнитов · ${totT} задач · ${C.units.reduce((a,u)=>a+quizOf(u).length,0)} тестов.
    Решено задач ${dT} из ${totT}, юнитов закрыто ${C.units.filter(unitDone).length}.</p>`;
  C.units.forEach((u, i) => {
    const d = doneIn(u), t = totalIn(u), ok = unitDone(u), open = unlocked(i);
    h += `<div class="node ${ok ? "done" : open ? "cur" : "lock"} ${i % 2 ? "r" : ""}">
      <div class="dot" onclick="${open ? `openUnit(${i})` : `toast('Юнит откроется, когда закроешь предыдущий на 70%')`}">${ok ? "✓" : open ? u.icon : "🔒"}</div>
      <div class="meta"><b>${u.title}</b><span>${u.sub}</span>
        <div class="prog"><div class="bar"><i style="width:${t ? Math.round(100*d/t) : 0}%"></i></div><span>${d} / ${t}</span></div>
      </div></div>`;
    if (i < C.units.length - 1) h += `<div class="link"></div>`;
  });
  $("view").innerHTML = h + "</div>";
}

/* ── юнит ──────────────────────────────────────────────── */
function openUnit(i){
  unitIdx = i; view = "unit";
  const undone = tasksOf(C.units[i]).filter(t => S.tasks[t.id] !== "done");
  curTask = undone.length ? undone[0].id : null;
  $("view").innerHTML = `<div class="unit">
    <div class="lecture" id="lecture"></div>
    <div class="bench">
      <div class="top">
        <span class="lbl">задача</span>
        <select id="taskSel"></select>
        <span style="flex:1"></span>
        <button class="btn sm" onclick="show('map')">К карте</button>
        <button class="btn sm" id="runB">Выполнить</button>
        <button class="btn sm pri" id="checkB">Проверить</button>
      </div>
      <div id="edWrap"><pre id="hl"><code></code></pre><textarea id="ta" spellcheck="false"
        placeholder="Пиши запрос здесь. Проверить — Cmd+Enter."></textarea></div>
      <div id="out"></div>
      <div id="schema"><h3>Таблицы базы</h3><div id="schemaBody"></div></div>
    </div></div>`;
  bindEditor(); renderLecture(); renderSel(); renderSchema(); hud(); setTask(curTask, "");
}
function renderLecture(){
  const u = C.units[unitIdx], pane = $("lecture"), keep = pane.scrollTop;
  let h = `<h2>${u.title}</h2><div class="sub">${u.sub}</div>`;
  u.blocks.forEach((b, idx) => {
    if (b.type === "text") h += b.html;
    if (b.type === "ex") h += `<div class="block"><div class="cap">пример</div>
      <pre class="sql">${paint(b.sql)}</pre><div class="in">
      <div class="row"><button class="btn sm" onclick="runEx(${idx})">Выполнить</button>
      <button class="btn sm" onclick="toEditor(${idx})">В редактор</button></div>
      ${b.note ? `<div class="note">${b.note}</div>` : ""}<div id="exres${idx}"></div></div></div>`;
    if (b.type === "task"){
      const done = S.tasks[b.id] === "done", act = curTask === b.id, ans = S.answers[b.id];
      h += `<div class="block task ${done?"done":""} ${act?"act":""}">
        <div class="cap">задача · ${b.xp} XP ${done?"· решена ✓":act?"· решаешь сейчас":""}</div>
        <div class="in"><p>${b.prompt}</p>
        <div class="row"><button class="btn sm ${act?"":"pri"}" onclick="setTask('${b.id}','')">${act?"Активна":"Решать"}</button>
        ${b.hints.length ? `<button class="btn sm" onclick="hint('${b.id}',${b.hints.length})">Подсказка</button>` : ""}</div>
        <div id="h${b.id}"></div>${done && ans ? `<div class="answer">${esc(ans)}</div>` : ""}</div></div>`;
    }
    if (b.type === "quiz"){
      const done = S.quizzes[b.id] === "done";
      h += `<div class="block ${done?"task done":""}"><div class="cap">тест · ${b.xp} XP ${done?"· пройден ✓":""}</div>
        <div class="in"><p>${b.q}</p>
        ${b.options.map((o,k)=>`<button class="opt" id="o${b.id}_${k}" onclick="answer('${b.id}',${k})">${o}</button>`).join("")}
        <div id="e${b.id}"></div></div></div>`;
    }
  });
  pane.innerHTML = h; pane.scrollTop = keep;
  Object.keys(S.quizzes).forEach(qid => {
    const b = u.blocks.find(x => x.id === qid && x.type === "quiz");
    if (b){ const el = $("o" + qid + "_" + b.answer); if (el) el.classList.add("right"); }
  });
}
const hintState = {};
function hint(id, total){
  hintState[id] = Math.min((hintState[id] || 0) + 1, total);
  const b = C.units[unitIdx].blocks.find(x => x.id === id);
  $("h" + id).innerHTML = b.hints.slice(0, hintState[id]).map((t, i) => `<div class="hint"><b>Подсказка ${i+1}.</b> ${t}</div>`).join("");
}
function answer(qid, k){
  const b = C.units[unitIdx].blocks.find(x => x.id === qid);
  const right = k === b.answer;
  $("o" + qid + "_" + k).classList.add(right ? "right" : "wrong");
  if (!right) $("o" + qid + "_" + b.answer).classList.add("right");
  $("e" + qid).innerHTML = `<div class="explain">${right ? "<b>Верно.</b> " : "<b>Мимо.</b> "}${b.explain}</div>`;
  if (right && S.quizzes[qid] !== "done"){
    S.quizzes[qid] = "done"; award(b.xp); hud(); toast("+" + b.xp + " XP");
  }
}
async function runEx(idx){
  const b = C.units[unitIdx].blocks[idx], box = $("exres" + idx);
  box.innerHTML = `<div class="note">Выполняю…</div>`;
  try { box.innerHTML = table(await sql(b.sql)); }
  catch (e){ box.innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; }
}
function toEditor(idx){ setTask(null, C.units[unitIdx].blocks[idx].sql); }

/* ── редактор и проверка ───────────────────────────────── */
function bindEditor(){
  const ta = $("ta"), hl = document.querySelector("#hl code");
  const sync = () => { hl.innerHTML = paint(ta.value) + "\n"; hl.parentElement.scrollTop = ta.scrollTop; };
  window.sync = sync;
  ta.addEventListener("input", sync);
  ta.addEventListener("scroll", () => { hl.parentElement.scrollTop = ta.scrollTop; });
  ta.addEventListener("keydown", e => {
    if (e.key === "Tab"){ e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2; sync();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter"){ e.preventDefault(); curTask ? doCheck() : doRun(); }
  });
  $("runB").onclick = doRun; $("checkB").onclick = doCheck;
}
function renderSel(){
  const u = C.units[unitIdx], sel = $("taskSel");
  sel.innerHTML = `<option value="">— песочница —</option>` + tasksOf(u).map(t =>
    `<option value="${t.id}" ${t.id === curTask ? "selected" : ""}>${S.tasks[t.id] === "done" ? "✓ " : ""}${t.prompt.replace(/<[^>]+>/g, "").slice(0, 64)}…</option>`).join("");
  sel.onchange = () => setTask(sel.value || null, "");
}
function setTask(id, q){
  curTask = id || null;
  const ta = $("ta");
  ta.value = q || (id ? (S.answers[id] || "") : ""); sync();
  $("checkB").disabled = !curTask;
  renderSel(); renderLecture();
  const b = id ? C.units[unitIdx].blocks.find(x => x.id === id) : null;
  $("out").innerHTML = b
    ? `<div class="msg info"><b>Задача:</b> ${b.prompt}<br><br>Пиши запрос и жми «Проверить». «Выполнить» просто показывает результат.</div>`
    : `<div class="msg info">Песочница: выполняй любые запросы к базе.</div>`;
  ta.focus();
}
function table(r){
  if (!r || !r.columns) return "";
  if (!r.rows.length) return `<div class="msg info">Запрос выполнился, но строк не вернул — скорее всего фильтр отсекает всё.</div>`;
  const shown = r.rows.slice(0, 150);
  let h = `<div style="overflow:auto;max-height:44vh"><table class="res"><thead><tr>`
    + r.columns.map(c => `<th>${esc(c)}</th>`).join("") + `</tr></thead><tbody>`;
  h += shown.map(row => "<tr>" + row.map(v => `<td>${v === null ? "<span style='color:#5f6a79'>NULL</span>" : esc(v)}</td>`).join("") + "</tr>").join("");
  h += `</tbody></table></div><div class="note">${shown.length < r.total ? `Показаны первые ${shown.length} строк из ${r.total}.` : `Строк: ${r.total}`}</div>`;
  return h;
}
function setBusy(v){ busy = v; $("runB").disabled = v; $("checkB").disabled = v || !curTask; }
async function doRun(){
  if (busy) return;
  const q = $("ta").value.trim().replace(/;+\s*$/, ""); if (!q) return;
  setBusy(true); $("out").innerHTML = `<div class="msg info">Выполняю…</div>`;
  try {
    const r = await sql(q); lastCtx = {error: "", message: ""};
    $("out").innerHTML = table(r);
  } catch (e){
    lastCtx = {error: e.message, message: ""};
    $("out").innerHTML = `<div class="msg bad"><b>${ruError(e.message) || "Ошибка"}</b><br><br><span class="mono" style="font-size:12px">${esc(e.message)}</span></div>`;
  }
  setBusy(false);
}
async function doCheck(){
  if (busy || !curTask) return;
  const q = $("ta").value.trim().replace(/;+\s*$/, ""); if (!q) return;
  const task = C.units[unitIdx].blocks.find(x => x.id === curTask);
  setBusy(true); $("out").innerHTML = `<div class="msg info">Проверяю…</div>`;
  let got;
  try { got = await sql(q); }
  catch (e){
    setBusy(false); lastCtx = {error: e.message, message: "Запрос не выполнился."};
    $("out").innerHTML = `<div class="msg bad"><b>Запрос не выполнился.</b><br><br>${ruError(e.message) || ""}<br><br><span class="mono" style="font-size:12px">${esc(e.message)}</span></div>`;
    return;
  }
  const exp = await sql(task.ref);
  setBusy(false);
  const g = got.rows, e = exp.rows;
  let msg = null;
  if (got.columns.length !== exp.columns.length)
    msg = `Колонок должно быть ${exp.columns.length}, а в ответе ${got.columns.length}.`;
  else if (g.length !== e.length)
    msg = `Строк должно получиться ${e.length}, а вышло ${g.length}. Обычно это лишний или потерянный фильтр, либо не та группировка.`;
  else {
    const same = task.ordered ? JSON.stringify(g) === JSON.stringify(e)
                              : JSON.stringify(g.map(String).sort()) === JSON.stringify(e.map(String).sort());
    if (!same) msg = task.ordered && JSON.stringify(g.map(String).sort()) === JSON.stringify(e.map(String).sort())
      ? "Значения верные, а порядок строк другой — проверь ORDER BY."
      : "Размер ответа сошёлся, а значения — нет. Сравни числа: скорее всего не та функция или не тот фильтр.";
  }
  lastCtx = {error: "", message: msg || "Верно."};
  if (msg){
    $("out").innerHTML = `<div class="msg bad"><b>${msg}</b></div>` + table(got);
    return;
  }
  const first = S.tasks[curTask] !== "done";
  S.tasks[curTask] = "done"; S.answers[curTask] = q;
  if (first){ award(task.xp); toast("+" + task.xp + " XP"); }
  saveState(); hud();
  const head = `<div class="msg ok"><b>Верно.</b>${first ? ` +${task.xp} XP` : ""}</div>` + table(got);
  const rest = tasksOf(C.units[unitIdx]).filter(t => S.tasks[t.id] !== "done");
  if (rest.length){
    setTask(rest[0].id, "");
    $("out").innerHTML = head + `<div class="msg info">Следующая задача: ${rest[0].prompt}</div>`;
  } else {
    renderLecture(); renderSel();
    $("out").innerHTML = head + `<div class="msg ok">Задачи юнита закрыты. <button class="btn sm" onclick="show('map')">К карте</button></div>`;
  }
}
function renderSchema(){
  $("schemaBody").innerHTML = SCHEMA.map(t => `<div class="tb">
    <b onclick="ins('${t.table}')">${t.table}</b> <span>· ${t.rows} строк</span>
    <div class="cols">${t.columns.map(c => `<i onclick="ins('${c.name}')" title="${c.type}">${c.name}</i>`).join("")}</div></div>`).join("");
}
function ins(text){
  const ta = $("ta"), s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + text.length; sync(); ta.focus();
}

/* ── прогресс ──────────────────────────────────────────── */
function renderStats(){
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const k = d.toISOString().slice(0, 10);
    return {k, xp: S.history[k] || 0, lbl: d.toLocaleDateString("ru", {weekday: "short"})[0]};
  });
  const mx = Math.max(30, ...days.map(d => d.xp));
  const totT = C.units.reduce((a, u) => a + tasksOf(u).length, 0);
  const totQ = C.units.reduce((a, u) => a + quizOf(u).length, 0);
  const todayXp = S.history[today()] || 0;
  $("view").innerHTML = `<div class="stats"><h1>Прогресс</h1>
    <div class="grid">
      <div class="kpi"><b>${S.streak.days || 0}</b><span>дней подряд</span></div>
      <div class="kpi"><b>${S.xp}</b><span>опыта всего</span></div>
      <div class="kpi"><b>${Object.keys(S.tasks).length} / ${totT}</b><span>задач решено</span></div>
      <div class="kpi"><b>${Object.keys(S.quizzes).length} / ${totQ}</b><span>тестов пройдено</span></div>
    </div>
    <div class="sect"><h3>Сегодня: ${todayXp} из ${S.goal} XP</h3>
      <div class="bar" style="width:100%;height:14px"><i style="width:${Math.min(100, Math.round(100*todayXp/S.goal))}%"></i></div>
      <p style="margin-top:14px">Дневная цель, XP:
        <input type="number" id="goal" value="${S.goal}" min="10" max="200" step="10">
        <button class="btn sm pri" onclick="saveGoal()">Сохранить</button></p></div>
    <div class="sect"><h3>Последние 14 дней</h3>
      <div class="days">${days.map(d => `<div class="col ${d.xp ? "" : "z"}" title="${d.k}: ${d.xp} XP">
        <b>${d.xp || ""}</b><i style="height:${Math.max(4, Math.round(88*d.xp/mx))}%"></i></div>`).join("")}</div>
      <div style="display:flex;gap:6px;color:var(--dim);font-size:12px">${days.map(d => `<span style="flex:1;text-align:center">${d.lbl}</span>`).join("")}</div></div>
    <div class="sect"><h3>Прогресс и напоминания</h3>
      <p>Прогресс хранится в этом браузере. На другом устройстве он начнётся с нуля — можно перенести файлом.</p>
      <p>Напоминания шлёт бот <b>@Scaleql_bot</b> по расписанию: раз в день, независимо от того, открыт сайт или нет.</p>
      <div class="row">
        <button class="btn sm" onclick="exportState()">Скачать прогресс</button>
        <button class="btn sm" onclick="$('imp').click()">Загрузить прогресс</button>
        <input type="file" id="imp" accept="application/json" style="display:none" onchange="importState(this)">
        <button class="btn sm" onclick="resetState()">Сбросить</button>
      </div></div></div>`;
}
function saveGoal(){ S.goal = Math.max(10, Math.min(200, +$("goal").value || 30)); saveState(); renderStats(); toast("Цель сохранена"); }
function exportState(){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], {type: "application/json"}));
  a.download = "scaleql-progress.json"; a.click();
}
function importState(input){
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { S = Object.assign(structuredClone(BLANK), JSON.parse(r.result)); saveState(); hud(); renderStats(); toast("Прогресс загружен"); }
                     catch { toast("Файл не читается"); } };
  r.readAsText(f);
}
function resetState(){
  if (!confirm("Сбросить весь прогресс: XP, серию и решённые задачи?")) return;
  S = structuredClone(BLANK); saveState(); hud(); renderStats();
}

/* ── запуск ────────────────────────────────────────────── */
function show(v){ view = v; hud(); if (v === "map") renderMap(); else if (v === "stats") renderStats(); }
Object.assign(window, {show, openUnit, setTask, hint, answer, runEx, toEditor, ins, toast,
                       saveGoal, exportState, importState, resetState, $, doRun, doCheck});
(async () => {
  [C, SCHEMA] = await Promise.all([
    fetch("course.json").then(r => r.json()),
    fetch("schema.json").then(r => r.json()),
  ]);
  await initDb();
  $("boot").remove();
  hud(); show("map");
})().catch(err => {
  $("bootMsg").innerHTML = "Не удалось запустить базу: " + esc(err.message) +
    "<br><br>Обнови страницу. Если не помогает — проверь, что браузер не блокирует WebAssembly.";
});
