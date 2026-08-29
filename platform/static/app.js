/* ScaleQL — интерфейс тренажёра */
const KW = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|AS|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|LEFT|RIGHT|INNER|FULL|OUTER|JOIN|ON|HAVING|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|ASC|DESC|OVER|PARTITION BY|FILTER|INTERVAL";
const FN = "COUNT|SUM|AVG|MIN|MAX|MEDIAN|ROUND|ABS|COALESCE|CAST|DATE_TRUNC|DATE_DIFF|EXTRACT|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|NOW|CURRENT_DATE";
const RE = new RegExp("(--[^\\n]*)|('(?:[^']|'')*')|\\b(" + FN + ")\\b(?=\\s*\\()|\\b(" + KW + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", "gi");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paint = src => esc(src).replace(RE, (m, c, st, fn, kw) =>
  c ? `<span class="c">${m}</span>` : st ? `<span class="s">${m}</span>` :
  fn ? `<span class="f">${m}</span>` : kw ? `<span class="k">${m}</span>` : `<span class="n">${m}</span>`);

let C = null, S = null, view = "map", unitIdx = 0, curTask = null, busy = false, lastCtx = {};
const $ = id => document.getElementById(id);
const post = async (u, b) => (await fetch(u, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(b)})).json();

const tasksOf = u => u.blocks.filter(b => b.type === "task");
const quizOf  = u => u.blocks.filter(b => b.type === "quiz");
const doneIn  = u => tasksOf(u).filter(t => S.tasks[t.id] === "done").length
                   + quizOf(u).filter(q => S.quizzes[q.id] === "done").length;
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
  const done = C.units.filter(unitDone).length;
  const totT = C.units.reduce((a,u) => a + tasksOf(u).length, 0);
  const dT = C.units.reduce((a,u) => a + tasksOf(u).filter(t => S.tasks[t.id]==="done").length, 0);
  let h = `<div class="map"><h1>Путь аналитика: SQL</h1>
    <p class="lead">${C.units.length} юнитов · ${totT} задач · ${C.units.reduce((a,u)=>a+quizOf(u).length,0)} тестов.
    Решено задач ${dT} из ${totT}, юнитов закрыто ${done}.</p>`;
  C.units.forEach((u, i) => {
    const d = doneIn(u), t = totalIn(u), ok = unitDone(u), open = unlocked(i);
    const cls = ok ? "done" : open ? (d > 0 ? "cur" : "cur") : "lock";
    h += `<div class="node ${cls} ${i%2 ? "r" : ""}">
      <div class="dot" onclick="${open ? `openUnit(${i})` : `toast('Юнит откроется, когда закроешь предыдущий на 70%')`}">${ok ? "✓" : open ? u.icon : "🔒"}</div>
      <div class="meta"><b>${u.title}</b><span>${u.sub}</span>
        <div class="prog"><div class="bar"><i style="width:${t ? Math.round(100*d/t) : 0}%"></i></div>
        <span>${d} / ${t}</span></div>
      </div></div>`;
    if (i < C.units.length - 1) h += `<div class="link"></div>`;
  });
  $("view").innerHTML = h + "</div>";
}

/* ── экран юнита ───────────────────────────────────────── */
function openUnit(i){
  unitIdx = i; view = "unit";
  const u = C.units[i];
  const undone = tasksOf(u).filter(t => S.tasks[t.id] !== "done");
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
  bindEditor();
  renderLecture(); renderSel(); renderSchema(); hud();
  setTask(curTask, "");
}

function renderLecture(){
  const u = C.units[unitIdx], pane = $("lecture"), keep = pane.scrollTop;
  let h = `<h2>${u.title}</h2><div class="sub">${u.sub}</div>`;
  u.blocks.forEach((b, idx) => {
    if (b.type === "text") h += b.html;
    if (b.type === "ex"){
      h += `<div class="block"><div class="cap">пример</div>
        <pre class="sql">${paint(b.sql)}</pre><div class="in">
        <div class="row"><button class="btn sm" onclick="runEx(${idx})">Выполнить</button>
        <button class="btn sm" onclick="toEditor(${idx})">В редактор</button></div>
        ${b.note ? `<div class="note">${b.note}</div>` : ""}
        <div id="exres${idx}"></div></div></div>`;
    }
    if (b.type === "task"){
      const done = S.tasks[b.id] === "done", act = curTask === b.id, ans = S.answers[b.id];
      h += `<div class="block task ${done?"done":""} ${act?"act":""}">
        <div class="cap">задача · ${b.xp} XP ${done?"· решена ✓":act?"· решаешь сейчас":""}</div>
        <div class="in"><p>${b.prompt}</p>
        <div class="row"><button class="btn sm ${act?"":"pri"}" onclick="setTask('${b.id}','')">${act?"Активна":"Решать"}</button>
        ${b.hints.length ? `<button class="btn sm" onclick="hint('${b.id}',${b.hints.length})">Подсказка</button>` : ""}</div>
        <div id="h${b.id}"></div>
        ${done && ans ? `<div class="answer">${esc(ans)}</div>` : ""}</div></div>`;
    }
    if (b.type === "quiz"){
      const done = S.quizzes[b.id] === "done";
      h += `<div class="block ${done?"task done":""}"><div class="cap">тест · ${b.xp} XP ${done?"· пройден ✓":""}</div>
        <div class="in"><p>${b.q}</p>
        ${b.options.map((o,k)=>`<button class="opt" id="o${b.id}_${k}" onclick="answer('${b.id}',${k})">${o}</button>`).join("")}
        <div id="e${b.id}"></div></div></div>`;
    }
  });
  pane.innerHTML = h;
  pane.scrollTop = keep;
  if (S.quizzes) Object.keys(S.quizzes).forEach(qid => {
    const b = u.blocks.find(x => x.id === qid && x.type === "quiz");
    if (b) { const el = $("o"+qid+"_"+b.answer); if (el) el.classList.add("right"); }
  });
}

const hintState = {};
function hint(id, total){
  hintState[id] = Math.min((hintState[id]||0)+1, total);
  const b = C.units[unitIdx].blocks.find(x => x.id === id);
  $("h"+id).innerHTML = b.hints.slice(0, hintState[id])
    .map((t,i)=>`<div class="hint"><b>Подсказка ${i+1}.</b> ${t}</div>`).join("");
}
async function answer(qid, k){
  const r = await post("/api/quiz", {quiz_id: qid, choice: k});
  const b = C.units[unitIdx].blocks.find(x => x.id === qid);
  $("o"+qid+"_"+k).classList.add(r.ok ? "right" : "wrong");
  if (!r.ok) $("o"+qid+"_"+r.answer).classList.add("right");
  $("e"+qid).innerHTML = `<div class="explain">${r.ok?"<b>Верно.</b> ":"<b>Мимо.</b> "}${b.explain}</div>`;
  if (r.state){ S = r.state; hud(); }
  if (r.xp) toast("+" + r.xp + " XP");
}
async function runEx(idx){
  const b = C.units[unitIdx].blocks[idx], box = $("exres"+idx);
  box.innerHTML = `<div class="note">Выполняю…</div>`;
  const r = await post("/api/run", {sql: b.sql});
  box.innerHTML = r.error ? `<div class="msg bad">${esc(r.error)}</div>` : table(r);
}
function toEditor(idx){ setTask(null, C.units[unitIdx].blocks[idx].sql); }

/* ── редактор ──────────────────────────────────────────── */
function bindEditor(){
  const ta = $("ta"), hl = document.querySelector("#hl code");
  const sync = () => { hl.innerHTML = paint(ta.value) + "\n"; hl.parentElement.scrollTop = ta.scrollTop; };
  window.sync = sync;
  ta.addEventListener("input", sync);
  ta.addEventListener("scroll", () => { hl.parentElement.scrollTop = ta.scrollTop; });
  ta.addEventListener("keydown", e => {
    if (e.key === "Tab"){ e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0,s) + "  " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2; sync(); }
    if ((e.metaKey||e.ctrlKey) && e.key === "Enter"){ e.preventDefault(); curTask ? doCheck() : doRun(); }
  });
  $("runB").onclick = doRun; $("checkB").onclick = doCheck;
}
function renderSel(){
  const u = C.units[unitIdx], sel = $("taskSel");
  sel.innerHTML = `<option value="">— песочница —</option>` + tasksOf(u).map(t =>
    `<option value="${t.id}" ${t.id===curTask?"selected":""}>${S.tasks[t.id]==="done"?"✓ ":""}${t.prompt.replace(/<[^>]+>/g,"").slice(0,64)}…</option>`).join("");
  sel.onchange = () => setTask(sel.value || null, "");
}
function setTask(id, sql){
  curTask = id || null;
  const ta = $("ta");
  ta.value = sql || (id ? (S.answers[id] || "") : ""); sync();
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
  const shown = r.rows.slice(0,150);
  let h = `<div style="overflow:auto;max-height:44vh"><table class="res"><thead><tr>`
    + r.columns.map(c=>`<th>${esc(c)}</th>`).join("") + `</tr></thead><tbody>`;
  h += shown.map(row => "<tr>" + row.map(v => `<td>${v===null?"<span style='color:#5f6a79'>NULL</span>":esc(v)}</td>`).join("") + "</tr>").join("");
  h += `</tbody></table></div>`;
  const total = r.total ?? r.rows.length;
  h += `<div class="note">${shown.length < total ? `Показаны первые ${shown.length} строк из ${total}.` : `Строк: ${total}`}</div>`;
  return h;
}
function setBusy(v){ busy = v; $("runB").disabled = v; $("checkB").disabled = v || !curTask; }
async function doRun(){
  if (busy) return;
  const sql = $("ta").value.trim(); if (!sql) return;
  setBusy(true); $("out").innerHTML = `<div class="msg info">Выполняю…</div>`;
  const r = await post("/api/run", {sql}); setBusy(false);
  lastCtx = {error: r.error || "", message: ""};
  $("out").innerHTML = (r.error || r.error_ru)
    ? `<div class="msg bad"><b>${r.error_ru || "Ошибка"}</b><br><br><span class="mono" style="font-size:12px">${esc(r.error||"")}</span></div>`
    : table(r);
}
async function doCheck(){
  if (busy || !curTask) return;
  const sql = $("ta").value.trim(); if (!sql) return;
  setBusy(true); $("out").innerHTML = `<div class="msg info">Проверяю…</div>`;
  const r = await post("/api/check", {task_id: curTask, sql}); setBusy(false);
  lastCtx = {error: r.error || "", message: r.message || ""};
  let h = r.ok ? `<div class="msg ok"><b>${r.message}</b>${r.xp?` +${r.xp} XP`:""}</div>`
               : `<div class="msg bad"><b>${r.message}</b>${r.error_ru?"<br><br>"+r.error_ru:""}${r.error?`<br><br><span class="mono" style="font-size:12px">${esc(r.error)}</span>`:""}</div>`;
  h += table(r.result);
  $("out").innerHTML = h;
  if (r.ok){
    if (r.state){ S = r.state; }
    if (r.xp) toast("+" + r.xp + " XP");
    hud();
    const rest = tasksOf(C.units[unitIdx]).filter(t => S.tasks[t.id] !== "done");
    if (rest.length){
      setTask(rest[0].id, "");
      $("out").innerHTML = h + `<div class="msg info">Следующая задача: ${rest[0].prompt}</div>`;
    } else {
      renderLecture(); renderSel();
      $("out").innerHTML = h + `<div class="msg ok">Задачи юнита закрыты. <button class="btn sm" onclick="show('map')">К карте</button></div>`;
    }
  }
}
function renderSchema(){
  $("schemaBody").innerHTML = C.schema.map(t => `<div class="tb">
    <b onclick="ins('${t.table}')">${t.table}</b> <span>· ${t.rows} строк</span>
    <div class="cols">${t.columns.map(c=>`<i onclick="ins('${c.name}')" title="${c.type}">${c.name}</i>`).join("")}</div></div>`).join("");
}
function ins(text){
  const ta = $("ta"), s = ta.selectionStart;
  ta.value = ta.value.slice(0,s) + text + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + text.length; sync(); ta.focus();
}

/* ── прогресс ──────────────────────────────────────────── */
function renderStats(){
  const days = [...Array(14)].map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const k = d.toISOString().slice(0,10);
    return {k, xp: S.history[k] || 0, lbl: d.toLocaleDateString("ru",{weekday:"short"})[0]};
  });
  const mx = Math.max(30, ...days.map(d => d.xp));
  const solved = Object.keys(S.tasks).length, quizzes = Object.keys(S.quizzes).length;
  const totT = C.units.reduce((a,u)=>a+tasksOf(u).length,0);
  const totQ = C.units.reduce((a,u)=>a+quizOf(u).length,0);
  const todayXp = S.history[C.today] || 0;
  $("view").innerHTML = `<div class="stats"><h1>Прогресс</h1>
    <div class="grid">
      <div class="kpi"><b>${S.streak.days||0}</b><span>дней подряд</span></div>
      <div class="kpi"><b>${S.xp}</b><span>опыта всего</span></div>
      <div class="kpi"><b>${solved} / ${totT}</b><span>задач решено</span></div>
      <div class="kpi"><b>${quizzes} / ${totQ}</b><span>тестов пройдено</span></div>
    </div>
    <div class="sect"><h3>Сегодня: ${todayXp} из ${S.goal} XP</h3>
      <div class="bar" style="width:100%;height:14px"><i style="width:${Math.min(100, Math.round(100*todayXp/S.goal))}%"></i></div>
      <p style="margin-top:14px">Дневная цель, XP:
        <input type="number" id="goal" value="${S.goal}" min="10" max="200" step="10">
        <button class="btn sm pri" onclick="saveGoal()">Сохранить</button></p></div>
    <div class="sect"><h3>Последние 14 дней</h3>
      <div class="days">${days.map(d=>`<div class="${d.xp?"":"z"}" style="height:${Math.max(3, Math.round(100*d.xp/mx))}%" title="${d.k}: ${d.xp} XP"></div>`).join("")}</div>
      <div style="display:flex;gap:5px;color:var(--dim);font-size:12px">${days.map(d=>`<span style="flex:1;text-align:center">${d.lbl}</span>`).join("")}</div></div>
    <div class="sect"><h3>Напоминания в Telegram</h3>
      <p>${S.tg.chat_id ? "Подключено. Бот пишет, если за день не набрана дневная цель." :
        "Открой бота в Telegram, напиши ему любое сообщение и нажми кнопку — я привяжу чат."}</p>
      <div class="row"><button class="btn pri" onclick="linkTg()">${S.tg.chat_id ? "Переподключить" : "Подключить"}</button>
        <span>Время напоминания:</span>
        <input type="number" id="hour" value="${S.tg.hour}" min="0" max="23">
        <button class="btn sm" onclick="saveHour()">Сохранить</button></div>
      <div id="tgres" class="note"></div></div></div>`;
}
async function saveGoal(){ S = await post("/api/goal", {goal: +$("goal").value}); renderStats(); toast("Цель сохранена"); }
async function saveHour(){ S = await post("/api/tg/hour", {hour: +$("hour").value}); toast("Время сохранено"); }
async function linkTg(){
  $("tgres").textContent = "Проверяю…";
  const r = await post("/api/tg/link", {});
  $("tgres").textContent = r.message;
  if (r.state){ S = r.state; }
}

/* ── маршрутизация ─────────────────────────────────────── */
function show(v){ view = v; hud(); v === "map" ? renderMap() : v === "stats" ? renderStats() : null; }
(async () => {
  C = await (await fetch("/api/course")).json();
  S = C.state; hud();
  const i = C.units.findIndex((u,k) => unlocked(k) && !unitDone(u));
  unitIdx = i < 0 ? 0 : i;
  show("map");
})();
