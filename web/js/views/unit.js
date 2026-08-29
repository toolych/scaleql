/* Экран урока. Юнит разбит на короткие шаги: чуть теории — одно действие.
   Слева шаг, справа верстак с редактором. Главное действие всегда внизу,
   в одном и том же месте: на десктопе и под большой палец на телефоне. */

import { store, unitAt, units, buildSteps, stepDone, firstUndoneStep, taskDone,
         quizDone, doneIn, totalIn, unitDone, markSeen, lastStep, rememberStep,
         setState, unlockAt } from "../store.js";
import * as api from "../api.js";
import { $, esc, el, delegate, paint, toast, resultTable, alert_, confetti, plural } from "../ui.js";

let C = null;   // контекст открытого юнита

const lsGet = k => { try{ return localStorage.getItem("scaleql." + k); }catch{ return null; } };
const lsSet = (k, v) => { try{ localStorage.setItem("scaleql." + k, v); }catch{ /* приватный режим */ } };
const strip = h => String(h).replace(/<[^>]+>/g, "");

/* ── теория и примеры внутри шага ────────────────────────── */
const exampleCard = (block, idx) => `
  <div class="example" data-ex="${idx}">
    <div class="example__head">
      <span class="label">Пример</span><span class="spacer"></span>
      <button class="btn btn--quiet btn--sm" data-act="run-ex" data-ex="${idx}">Выполнить</button>
      <button class="btn btn--quiet btn--sm" data-act="to-editor" data-ex="${idx}">В редактор</button>
    </div>
    <div class="example__body">
      <pre class="code"><code>${paint(block.sql)}</code></pre>
      ${block.note ? `<p class="example__note">${block.note}</p>` : ""}
      <div class="example__out" id="exOut${idx}"></div>
    </div>
  </div>`;

/* Задача без своей теории: рядом должно быть чем освежить память,
   но развёрнутый текст перетянул бы внимание с самой задачи. */
function recallHtml(step){
  if(step.ctx.some(b => b.type === "text")) return "";
  for(let i = step.i - 1; i >= 0; i--){
    const text = C.steps[i].ctx.filter(b => b.type === "text");
    if(text.length) return `<div class="disclosure step__section" data-open="false">
      <button class="disclosure__btn" data-act="recall" aria-expanded="false">
        <span class="disclosure__caret" aria-hidden="true">▶</span>Напомнить теорию</button>
      <div class="disclosure__body"><div class="prose">${text.map(b => b.html).join("")}</div></div>
    </div>`;
  }
  return "";
}

function contextHtml(step){
  return step.ctx.map(b => b.type === "text"
    ? `<div class="prose step__section">${b.html}</div>`
    : `<div class="step__section">${exampleCard(b, C.unit.blocks.indexOf(b))}</div>`).join("");
}

/* ── содержимое шага ─────────────────────────────────────── */
function stepHtml(step){
  const n = `<div class="step__kicker">
      <span class="badge">Шаг ${step.i + 1} из ${C.steps.length}</span>
      ${step.kind === "task" ? `<span class="badge badge--brand">Задача · ${step.main.xp} XP</span>` : ""}
      ${step.kind === "quiz" ? `<span class="badge badge--brand">Вопрос · ${step.main.xp} XP</span>` : ""}
      ${stepDone(step) ? `<span class="badge badge--ok">✓ сделано</span>` : ""}
    </div>`;

  if(step.kind === "learn"){
    return `<article class="step" tabindex="-1">${n}
      <h2 class="step__h">${esc(C.unit.title)}</h2>
      ${contextHtml(step)}</article>`;
  }

  if(step.kind === "quiz"){
    const q = step.main, done = quizDone(q.id), fb = C.quizFb[q.id];
    const picked = fb ? fb.picked : -1;
    const right = fb ? fb.answer : (done ? q.answer : -1);
    return `<article class="step" tabindex="-1">${n}
      ${contextHtml(step)}
      <div class="step__section">
        <div class="brief ${done ? "is-done" : ""}">
          <div class="brief__head"><span class="label">Проверь понимание</span></div>
          <div class="brief__text">${q.q}</div>
        </div>
      </div>
      <div class="options" role="group" aria-label="Варианты ответа">
        ${q.options.map((o, k) => {
          const isRight = right === k, isWrong = picked === k && picked !== right;
          const mark = isRight ? "✓" : isWrong ? "✕" : "";
          return `<button class="option ${isRight ? "is-right" : ""} ${isWrong ? "is-wrong" : ""}
              ${picked === k ? "is-picked" : ""}" data-act="answer" data-k="${k}"
              ${fb || done ? "disabled" : ""} aria-label="Вариант ${k + 1}. ${esc(strip(o))}">
            <span class="option__key" aria-hidden="true">${k + 1}</span>
            <span class="option__text">${o}</span>
            <span class="option__mark" aria-hidden="true">${mark}</span></button>`;
        }).join("")}
      </div>
      ${recallHtml(step)}
      ${done || fb ? "" : `    <div class="step__skip">
      <button class="btn btn--quiet" data-act="skip">Пропустить и вернуться позже</button>
    </div>`}
      <div id="quizFeedback" aria-live="polite">${
        fb ? feedbackHtml(fb.ok, q.explain)
        : done ? feedbackHtml(true, q.explain, "Вопрос уже пройден.") : ""}</div>
    </article>`;
  }

  const t = step.main, done = taskDone(t.id);
  const hints = C.hints[t.id] || 0;
  return `<article class="step" tabindex="-1">${n}
    ${contextHtml(step)}
    <div class="step__section">
      <div class="brief ${done ? "is-done" : ""}">
        <div class="brief__head">
          <span class="label">${done ? "Задача решена" : "Задача"}</span>
        </div>
        <div class="brief__text">${t.prompt}</div>
      </div>
    </div>
    ${recallHtml(step)}
    <div class="stack stack--sm" id="hintBox">
      ${t.hints.slice(0, hints).map((h, k) =>
        `<div class="hint"><span aria-hidden="true">💡</span><span><b>Подсказка ${k + 1}.</b> ${h}</span></div>`).join("")}
    </div>
    ${done ? "" : `    <div class="step__skip">
      <button class="btn btn--quiet" data-act="skip">Пропустить и вернуться позже</button>
    </div>`}
    ${done && store.state.answers[t.id] ? `<div class="step__section u-mt-3">
      <span class="label">Твоё решение</span>
      <pre class="solved u-mt-2">${esc(store.state.answers[t.id])}</pre></div>` : ""}
  </article>`;
}

const feedbackHtml = (ok, explain, prefix = "") => alert_({
  kind: ok ? "ok" : "info",
  icon: ok ? "✓" : "→",
  title: prefix || (ok ? "Верно" : "Разберём"),
  text: explain,
});

/* ── панель действий ─────────────────────────────────────── */
function actionsHtml(){
  const step = C.steps[C.cur], last = C.cur === C.steps.length - 1;
  const nextLabel = last ? "Завершить юнит" : "Дальше";
  const nextBtn = `<button class="btn btn--primary" data-act="next">${nextLabel}
      <span class="btn__icon" aria-hidden="true">→</span></button>`;

  const runBtn = C.forceSplit && step.kind !== "task"
    ? `<button class="btn btn--ghost btn--sm" data-act="run">Выполнить</button>` : "";

  if(step.kind === "learn"){
    return {info:["Теория", "Прочитал — идём дальше"], acts:runBtn + nextBtn};
  }
  if(step.kind === "quiz"){
    const answered = C.quizFb[step.main.id] || quizDone(step.main.id);
    return answered
      ? {info:["Ответ засчитан", "Можно двигаться дальше"], acts:runBtn + nextBtn}
      : {info:["Вопрос на понимание", "Выбери вариант — цифры 1–4 тоже работают"], acts:runBtn};
  }

  const t = step.main, done = taskDone(t.id);
  const hintsLeft = t.hints.length - (C.hints[t.id] || 0);
  const hintBtn = t.hints.length
    ? `<button class="btn btn--ghost btn--sm" data-act="hint" ${hintsLeft ? "" : "disabled"}>
         ${hintsLeft ? `Подсказка (${hintsLeft})` : "Подсказки кончились"}</button>` : "";

  if(done){
    return {info:["Решено ✓", `+${t.xp} XP уже начислено`],
      acts:`${hintBtn}<button class="btn btn--ghost btn--sm" data-act="run">Выполнить</button>${nextBtn}`};
  }
  return {
    info:["Задача", `${t.xp} XP · проверка по эталону`],
    acts:`${hintBtn}
      <button class="btn btn--ghost btn--sm" data-act="run">Выполнить</button>
      <button class="btn btn--primary" data-act="check">Проверить</button>`,
  };
}

function paintActions(){
  const {info, acts} = actionsHtml();
  const bar = $("#actionbar", C.root);
  bar.innerHTML = `<div class="actionbar__info"><b>${info[0]}</b><span>${info[1]}</span></div>
    <div class="actionbar__acts">${acts}</div>`;
  bar.classList.toggle("is-ok", C.steps[C.cur].kind !== "learn" && stepDone(C.steps[C.cur]));
  // Кнопок нет — значит подсказка в панели остаётся единственным содержимым
  // и её нельзя прятать даже на узком экране.
  bar.classList.toggle("is-info-only", !acts.trim());
}

/* ── шкала шагов ─────────────────────────────────────────── */
function paintRail(){
  $("#rail", C.root).innerHTML = C.steps.map(s => {
    const done = stepDone(s), cur = s.i === C.cur;
    const kind = s.kind === "task" ? "задача" : s.kind === "quiz" ? "вопрос" : "теория";
    return `<button class="steps__dot ${done ? "is-done" : ""} ${cur ? "is-current" : ""}"
      data-act="goto" data-i="${s.i}" ${cur ? 'aria-current="step"' : ""}
      aria-label="Шаг ${s.i + 1}: ${kind}${done ? ", сделан" : ""}"></button>`;
  }).join("");

  const d = doneIn(C.unit), t = totalIn(C.unit);
  $("#unitMeta", C.root).textContent =
    `Шаг ${C.cur + 1} из ${C.steps.length} · заданий ${d} из ${t}`;
}

/* ── верстак ─────────────────────────────────────────────── */
function benchTaskId(){
  const s = C.steps[C.cur];
  return s.kind === "task" ? s.main.id : null;
}
function editorSync(){
  const ta = $("#editorTa", C.root), hl = $("#editorHl code", C.root);
  if(!ta || !hl) return;
  hl.innerHTML = paint(ta.value) + "\n";
  hl.parentElement.scrollTop = ta.scrollTop;
  const id = benchTaskId();
  if(id) lsSet("draft." + id, ta.value);
}
function setEditor(text){
  const ta = $("#editorTa", C.root);
  if(!ta) return;
  ta.value = text;
  editorSync();
}
function loadEditorForStep(){
  const id = benchTaskId();
  if(!id){ setEditor(C.sandboxSql || ""); return; }
  const draft = lsGet("draft." + id);
  setEditor(draft !== null ? draft : (store.state.answers[id] || ""));
}

function benchHint(){
  const id = benchTaskId();
  return id
    ? alert_({kind:"info", icon:"→", title:"Как проверить",
        text:"«Выполнить» покажет результат, «Проверить» сверит его с эталоном. " +
             "Cmd/Ctrl + Enter — то же самое, но с клавиатуры."})
    : alert_({kind:"info", icon:"⌨", title:"Свободный запрос",
        text:"Здесь можно выполнить любой запрос к базе. Результат не проверяется и XP не даёт."});
}

function paintSchema(){
  $("#schemaBody", C.root).innerHTML = store.course.schema.map(t => `
    <div class="schema__table">
      <button class="schema__name" data-act="ins" data-text="${esc(t.table)}">${esc(t.table)}</button>
      <span class="schema__rows">${t.rows} ${plural(t.rows, "строка", "строки", "строк")}</span>
      <div class="schema__cols">${t.columns.map(c =>
        `<button class="chip" data-act="ins" data-text="${esc(c.name)}"
           title="${esc(c.name)} · ${esc(c.type)}">${esc(c.name)}</button>`).join("")}</div>
    </div>`).join("");
}

/* ── действия ────────────────────────────────────────────── */
function setBusy(on){
  C.busy = on;
  ["run","check"].forEach(a => {
    const b = $(`[data-act="${a}"]`, C.root);
    if(b) b.disabled = on;
  });
}
const out = html => { $("#benchOut", C.root).innerHTML = html; };

async function doRun(){
  if(C.busy) return;
  const sql = $("#editorTa", C.root).value.trim();
  if(!sql) return out(alert_({kind:"info", icon:"◌", title:"Пустой запрос",
    text:"Напиши запрос в редакторе — и нажми «Выполнить»."}));
  setBusy(true);
  out(`<div class="alert alert--info"><span class="spinner" aria-hidden="true"></span>
       <div class="alert__body">Выполняю запрос…</div></div>`);
  const r = await api.runSql(sql);
  setBusy(false);
  if(r.netError) return out(netAlert(r));
  C.last = {error:r.error || "", message:""};
  out(r.error || r.error_ru ? errorAlert(r) : resultTable(r));
}

const errorAlert = r => alert_({
  kind:"bad", icon:"✕",
  title:"Запрос не выполнился",
  text: r.error_ru || "База не поняла запрос. Проверь порядок частей и имена колонок.",
  raw: r.error || "",
  actions:`<button class="btn btn--ghost btn--sm" data-act="copy">Скопировать для разбора</button>`,
});
const netAlert = r => alert_({kind:"bad", icon:"⚡", title:"Нет связи с тренажёром", text:r.message});

async function doCheck(){
  const id = benchTaskId();
  if(C.busy || !id) return;
  const sql = $("#editorTa", C.root).value.trim();
  if(!sql) return out(alert_({kind:"info", icon:"◌", title:"Запрос пустой",
    text:"Сначала напиши решение, потом проверяй."}));
  setBusy(true);
  out(`<div class="alert alert--info"><span class="spinner" aria-hidden="true"></span>
       <div class="alert__body">Сверяю с эталоном…</div></div>`);
  const r = await api.checkTask(id, sql);
  setBusy(false);
  if(r.netError) return out(netAlert(r));
  C.last = {error:r.error || "", message:r.message || ""};

  if(!r.ok){
    out((r.error ? errorAlert(r) : alert_({
      kind:"bad", icon:"→",
      title:"Пока не сходится",
      text:r.message + " Это нормально: ошибка показывает, где именно разошлась логика.",
      actions:`<button class="btn btn--ghost btn--sm" data-act="hint">Подсказка</button>
               <button class="btn btn--ghost btn--sm" data-act="copy">Скопировать для разбора</button>`,
    })) + (r.result ? resultTable(r.result) : ""));
    return;
  }

  if(r.state) setState(r.state);
  out(alert_({kind:"ok", icon:"✓", title:"Верно",
    text:r.xp ? `Задача засчитана, +${r.xp} XP.` : "Задача уже была решена — повтор тоже полезен."})
    + resultTable(r.result));
  if(r.xp) toast(`+${r.xp} XP`, "xp");
  C.hints[id] = 0;
  paintStep({keepOut:true});
  celebrateIfUnitDone();
}

async function onAnswer(k){
  const q = C.steps[C.cur].main;
  const r = await api.answerQuiz(q.id, k);
  if(r.netError) return toast(r.message, "bad");
  C.quizFb[q.id] = {picked:k, answer:r.answer, ok:r.ok};
  if(r.state) setState(r.state);
  if(r.xp) toast(`+${r.xp} XP`, "xp");
  paintStep();
  $("#quizFeedback", C.root)?.scrollIntoView({block:"nearest", behavior:"smooth"});
  celebrateIfUnitDone();
}

function celebrateIfUnitDone(){
  if(unitDone(C.unit)){
    confetti();
    toast("Юнит закрыт", "ok");
  }
}

async function runExample(idx){
  const block = C.unit.blocks[idx];
  const box = $("#exOut" + idx, C.root);
  if(!box) return;
  box.innerHTML = `<div class="alert alert--info"><span class="spinner" aria-hidden="true"></span>
    <div class="alert__body">Выполняю…</div></div>`;
  const r = await api.runSql(block.sql);
  box.innerHTML = r.netError ? netAlert(r) : (r.error ? errorAlert(r) : resultTable(r));
}

async function copyForChat(){
  const s = C.steps[C.cur];
  const text = [
    `Юнит: ${C.unit.title} (${C.unit.sub})`,
    s.kind === "task" ? `Задача: ${strip(s.main.prompt)}`
      : s.kind === "quiz" ? `Вопрос: ${strip(s.main.q)}` : "Теория",
    `Мой запрос:\n${$("#editorTa", C.root)?.value || "—"}`,
    C.last?.message ? `Ответ платформы: ${C.last.message}` : "",
    C.last?.error ? `Ошибка базы: ${C.last.error}` : "",
  ].filter(Boolean).join("\n\n");
  try{
    await navigator.clipboard.writeText(text);
    toast("Скопировано — вставь в чат", "ok");
  }catch{
    toast("Браузер не дал доступ к буферу обмена", "bad");
  }
}

function showHint(){
  const s = C.steps[C.cur];
  if(s.kind !== "task") return;
  const t = s.main;
  const shown = C.hints[t.id] || 0;
  if(shown >= t.hints.length) return;
  C.hints[t.id] = shown + 1;
  paintStep({keepOut:true});
  $("#hintBox .hint:last-child", C.root)?.scrollIntoView({block:"nearest", behavior:"smooth"});
}

/* ── переходы ────────────────────────────────────────────── */
function gotoStep(i, opts = {}){
  if(i < 0 || i >= C.steps.length) return;
  C.cur = i;
  rememberStep(C.unit.id, i);
  if(C.steps[i].kind === "learn") markSeen(C.steps[i].id);
  paintStep(opts);
  const pane = $("#stepPane", C.root);
  pane.scrollTop = 0;
  $(".step", pane)?.focus({preventScroll:true});
}

function nextStep(){
  const s = C.steps[C.cur];
  if(s.kind === "learn") markSeen(s.id);
  if(C.cur === C.steps.length - 1) return C.nav.finishUnit(C.unitIdx);
  gotoStep(C.cur + 1);
}

/* ── сборка экрана ───────────────────────────────────────── */
function paintStep({keepOut = false} = {}){
  const step = C.steps[C.cur];
  const split = step.kind === "task" || C.forceSplit;
  C.root.dataset.mode = split ? "split" : "focus";
  if(!split) C.root.dataset.pane = "lesson";

  $("#stepPane", C.root).innerHTML = stepHtml(step);
  paintRail();
  paintActions();

  const mark = $("#paneSwitchTask", C.root);
  if(mark) mark.hidden = !split || taskDone(step.main?.id);

  if(split){
    loadEditorForStep();
    const brief = $("#benchBrief", C.root);
    if(brief) brief.innerHTML = step.kind === "task"
      ? `<span class="label">Задача</span><div class="brief__text">${step.main.prompt}</div>`
      : `<span class="label">Свободный запрос</span>`;
    if(!keepOut) out(benchHint());
  }
}

export function renderUnit(root, nav, unitIdx, stepIdx){
  const unit = unitAt(unitIdx);
  const steps = buildSteps(unit);
  // Куда открыть юнит: явный шаг → незакрытый шаг, на котором остановились →
  // первый несделанный. Возвращаться в уже решённую задачу бессмысленно.
  const remembered = Math.min(Math.max(lastStep(unit.id), 0), steps.length - 1);
  const start = stepIdx != null ? stepIdx
    : stepDone(steps[remembered]) ? firstUndoneStep(steps) : remembered;

  C = {unitIdx, unit, steps, nav, cur:0, root:null, hints:{}, quizFb:{},
       busy:false, last:{}, sandboxSql:"", forceSplit:false};

  // На узком экране схема съедает весь результат — по умолчанию свёрнута.
  const savedSchema = lsGet("schemaOpen");
  const schemaOpen = savedSchema === null ? window.innerWidth >= 900 : savedSchema !== "false";
  const node = el(`<div class="unit" data-mode="focus" data-pane="lesson">
    <div class="unit__bar">
      <button class="icon-btn" data-act="back" aria-label="Вернуться на карту курса" title="К карте (Esc)">←</button>
      <div class="unit__title">
        <b>${esc(unit.title)}</b>
        <span id="unitMeta"></span>
      </div>
      <span class="spacer"></span>
      <button class="icon-btn" data-act="toggle-bench" aria-pressed="false"
        aria-label="Открыть редактор запроса на любом шаге" title="Свободный запрос">&lt;/&gt;</button>
      <div class="pane-switch" role="group" aria-label="Что показать">
        <button data-act="pane" data-pane="lesson" aria-pressed="true">Урок</button>
        <button data-act="pane" data-pane="bench" aria-pressed="false">Запрос<span
          class="dot-mark" id="paneSwitchTask" hidden></span></button>
      </div>
    </div>
    <div class="unit__rail"><div class="steps" id="rail" aria-label="Шаги урока"></div></div>

    <div class="unit__body">
      <section class="step-pane" id="stepPane" aria-label="Материал урока"></section>
      <section class="bench" aria-label="Редактор запроса">
        <div class="bench__head">
          <span class="label">Редактор SQL</span>
          <span class="spacer"></span>
          <button class="btn btn--quiet btn--sm" data-act="copy"
            title="Задача, запрос и ошибка — в буфер, чтобы разобрать в чате">Разбор</button>
        </div>
        <div class="bench__brief" id="benchBrief"></div>
        <div class="editor">
          <pre class="editor__hl" id="editorHl" aria-hidden="true"><code></code></pre>
          <textarea class="editor__ta" id="editorTa" spellcheck="false" autocapitalize="off"
            autocomplete="off" autocorrect="off" aria-label="Текст SQL-запроса"
            placeholder="Пиши запрос здесь. Проверка — Cmd/Ctrl + Enter."></textarea>
        </div>
        <div class="bench__out" id="benchOut" aria-live="polite"></div>
        <div class="schema disclosure" data-open="${schemaOpen}">
          <button class="disclosure__btn" data-act="schema" aria-expanded="${schemaOpen}">
            <span class="disclosure__caret" aria-hidden="true">▶</span>Таблицы базы</button>
          <div class="disclosure__body" id="schemaBody"></div>
        </div>
      </section>
    </div>

    <div class="actionbar" id="actionbar"></div>
  </div>`);

  C.root = node;
  root.replaceChildren(node);
  document.body.classList.add("is-unit");

  paintSchema();
  bindEditor();
  gotoStep(start, {});

  delegate(node, "click", "[data-act]", async (e, btn) => {
    switch(btn.dataset.act){
      case "back":     return nav.go("map");
      case "goto":     return gotoStep(+btn.dataset.i);
      case "next":     return nextStep();
      case "skip":     return nextStep();
      case "hint":     return showHint();
      case "run":      return doRun();
      case "check":    return doCheck();
      case "copy":     return copyForChat();
      case "answer":   return onAnswer(+btn.dataset.k);
      case "run-ex":   return runExample(+btn.dataset.ex);
      case "to-editor": {
        // на теоретическом шаге верстак скрыт — открываем его, иначе кнопка молчит
        const sql = C.unit.blocks[+btn.dataset.ex].sql;
        if(node.dataset.mode !== "split"){
          C.forceSplit = true;
          node.querySelector('[data-act="toggle-bench"]')?.setAttribute("aria-pressed", "true");
          paintStep({keepOut:true});
        }
        node.dataset.pane = "bench";
        switchPane("bench");
        setEditor(sql);
        return;
      }
      case "ins":      return insert(btn.dataset.text);
      case "pane":     return switchPane(btn.dataset.pane);
      case "toggle-bench": {
        C.forceSplit = !C.forceSplit;
        btn.setAttribute("aria-pressed", String(C.forceSplit));
        paintStep();
        return;
      }
      case "recall": {
        const d = btn.closest(".disclosure");
        const open = d.dataset.open !== "true";
        d.dataset.open = String(open);
        btn.setAttribute("aria-expanded", String(open));
        return;
      }
      case "schema": {
        const d = btn.closest(".disclosure");
        const open = d.dataset.open !== "true";
        d.dataset.open = String(open);
        btn.setAttribute("aria-expanded", String(open));
        lsSet("schemaOpen", String(open));
        return;
      }
    }
  });

  return {destroy(){ document.body.classList.remove("is-unit"); C = null; }};
}

function switchPane(which){
  C.root.dataset.pane = which;
  [...C.root.querySelectorAll('[data-act="pane"]')]
    .forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pane === which)));
  if(which === "bench") $("#editorTa", C.root).focus();
}

function insert(text){
  const ta = $("#editorTa", C.root);
  const s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  editorSync();
  ta.focus();
}

function bindEditor(){
  const ta = $("#editorTa", C.root);
  ta.addEventListener("input", editorSync);
  ta.addEventListener("scroll", () => {
    $("#editorHl", C.root).scrollTop = ta.scrollTop;
  });
  ta.addEventListener("keydown", e => {
    if(e.key === "Tab" && !e.shiftKey){
      e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2;
      editorSync();
    }
    if((e.metaKey || e.ctrlKey) && e.key === "Enter"){
      e.preventDefault();
      benchTaskId() ? doCheck() : doRun();
    }
  });
}

/* Горячие клавиши экрана урока. Работают, пока фокус не в поле ввода. */
export function unitKeydown(e){
  if(!C) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if(e.key === "Escape" && !typing){ e.preventDefault(); return C.nav.go("map"); }
  if(typing || e.metaKey || e.ctrlKey || e.altKey) return;

  const step = C.steps[C.cur];
  if(step.kind === "quiz" && /^[1-9]$/.test(e.key)){
    const k = +e.key - 1;
    if(k < step.main.options.length && !C.quizFb[step.main.id] && !quizDone(step.main.id)){
      e.preventDefault();
      onAnswer(k);
    }
    return;
  }
  if(e.key === "Enter"){
    const next = C.root.querySelector('.actionbar [data-act="next"]');
    if(next){ e.preventDefault(); nextStep(); }
  }
  if(e.key === "?" ) return;
}
