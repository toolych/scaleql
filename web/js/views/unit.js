/* Экран урока. Юнит разбит на короткие шаги: чуть теории и одно действие.
   Слева шаг, справа верстак. Главное действие всегда внизу, в одном месте:
   на десктопе под курсором, на телефоне под большим пальцем. */

import { store, unitAt, buildSteps, stepDone, firstUndoneStep, taskDone,
         quizDone, doneIn, totalIn, unitDone, markSeen, lastStep, rememberStep,
         setState } from "../store.js";
import * as api from "../api.js";
import { $, esc, el, delegate, paint, toast, resultTable, note, confetti,
         plural, pad2, fillIcons } from "../ui.js";
import { icon } from "../icons.js";

let C = null;   // контекст открытого юнита

const lsGet = k => { try{ return localStorage.getItem("scaleql." + k); }catch{ return null; } };
const lsSet = (k, v) => { try{ localStorage.setItem("scaleql." + k, v); }catch{ /* приватный режим */ } };
const strip = h => String(h).replace(/<[^>]+>/g, "");

/* ── теория и примеры ────────────────────────────────────── */
const exampleCard = (block, idx) => `
  <div class="ex" data-ex="${idx}">
    <pre class="code"><code>${paint(block.sql)}</code></pre>
    <div class="ex__foot">
      ${block.note ? `<p class="ex__note">${block.note}</p>` : `<span class="ex__note"></span>`}
      <button class="btn btn--quiet btn--sm" data-act="run-ex" data-ex="${idx}">Выполнить</button>
      <button class="btn btn--quiet btn--sm" data-act="to-editor" data-ex="${idx}">В редактор</button>
    </div>
    <div id="exOut${idx}"></div>
  </div>`;

function contextHtml(step){
  return step.ctx.map(b => b.type === "text"
    ? `<div class="prose step__sec">${b.html}</div>`
    : `<div class="step__sec">${exampleCard(b, C.unit.blocks.indexOf(b))}</div>`).join("");
}

/* Задача без своей теории: рядом должно быть чем освежить память,
   но развёрнутый текст перетянул бы внимание с самой задачи. */
function recallHtml(step){
  if(step.ctx.some(b => b.type === "text")) return "";
  for(let i = step.i - 1; i >= 0; i--){
    const text = C.steps[i].ctx.filter(b => b.type === "text");
    if(text.length) return `<div class="disc step__sec" data-open="false">
      <button class="disc__btn" data-act="recall" aria-expanded="false">
        <span class="disc__c">${icon("caret", 11)}</span>Напомнить теорию</button>
      <div class="disc__body"><div class="prose">${text.map(b => b.html).join("")}</div></div>
    </div>`;
  }
  return "";
}

/* Одна строка положения вместо россыпи плашек: где я, что за шаг, сделан ли. */
function posLine(step){
  const kind = step.kind === "task" ? `<em>задача · ${step.main.xp} XP</em>`
             : step.kind === "quiz" ? `<em>вопрос · ${step.main.xp} XP</em>`
             : "теория";
  return `<div class="step__pos">
    ${pad2(step.i + 1)} / ${pad2(C.steps.length)} &nbsp;${kind}
    ${stepDone(step) ? `${icon("check", 13)}` : ""}
  </div>`;
}

const skipBtn = `<div class="step__skip">
  <button class="btn btn--quiet" data-act="skip">Пропустить и вернуться позже</button></div>`;

function stepHtml(step){
  if(step.kind === "learn"){
    return `<article class="step" tabindex="-1">${posLine(step)}
      <h2 class="step__h">${esc(C.unit.title)}</h2>
      ${contextHtml(step)}</article>`;
  }

  if(step.kind === "quiz"){
    const q = step.main, done = quizDone(q.id), fb = C.quizFb[q.id];
    const picked = fb ? fb.picked : -1;
    const right = fb ? fb.answer : (done ? q.answer : -1);
    return `<article class="step" tabindex="-1">${posLine(step)}
      <div class="step__sec">
        <div class="brief ${done ? "is-done" : ""}">
          <div class="brief__t">${q.q}</div>
        </div>
      </div>
      <div class="options" role="group" aria-label="Варианты ответа">
        ${q.options.map((o, k) => {
          const isRight = right === k, isWrong = picked === k && picked !== right;
          return `<button class="option ${isRight ? "is-right" : ""} ${isWrong ? "is-wrong" : ""}"
              data-act="answer" data-k="${k}" ${fb || done ? "disabled" : ""}
              aria-label="Вариант ${k + 1}. ${esc(strip(o))}">
            <span class="option__k">${k + 1}</span>
            <span class="option__t">${o}</span>
            <span class="option__m">${isRight ? icon("check", 15) : isWrong ? icon("cross", 15) : ""}</span>
          </button>`;
        }).join("")}
      </div>
      ${contextHtml(step)}
      ${recallHtml(step)}
      <div id="quizFb" aria-live="polite">${
        fb ? feedbackHtml(fb.ok, q.explain)
        : done ? feedbackHtml(true, q.explain, "Вопрос пройден") : ""}</div>
      ${done || fb ? "" : skipBtn}
    </article>`;
  }

  const t = step.main, done = taskDone(t.id);
  const hints = C.hints[t.id] || 0;
  return `<article class="step" tabindex="-1">${posLine(step)}
    <div class="step__sec">
      <div class="brief ${done ? "is-done" : ""}">
        <div class="brief__t">${t.prompt}</div>
      </div>
    </div>
    <div class="stack stack--sm" id="hintBox">
      ${t.hints.slice(0, hints).map((h, k) =>
        `<div class="hint">${icon("hint", 16)}<span><b>Подсказка ${k + 1}.</b> ${h}</span></div>`).join("")}
    </div>
    ${contextHtml(step)}
    ${recallHtml(step)}
    ${done && store.state.answers[t.id] ? `<div class="step__sec" style="margin-top:var(--sp-5)">
      <p class="caps" style="margin-bottom:var(--sp-2)">твоё решение</p>
      <pre class="solved">${esc(store.state.answers[t.id])}</pre></div>` : ""}
    ${done ? "" : skipBtn}
  </article>`;
}

const feedbackHtml = (ok, explain, title = "") => note({
  kind: ok ? "ok" : "acc",
  ic: ok ? "check" : "info",
  title: title || (ok ? "Верно" : "Разберём"),
  text: explain,
});

/* ── панель действий ─────────────────────────────────────── */
function actionsHtml(){
  const step = C.steps[C.cur], last = C.cur === C.steps.length - 1;
  const nextBtn = `<button class="btn btn--primary" data-act="next">${
    last ? "Завершить юнит" : "Дальше"}</button>`;
  const runBtn = C.forceSplit && step.kind !== "task"
    ? `<button class="btn btn--sm" data-act="run">Выполнить</button>` : "";

  if(step.kind === "learn"){
    return {info:["Теория", "Прочитал — идём дальше"], acts:runBtn + nextBtn};
  }
  if(step.kind === "quiz"){
    const answered = C.quizFb[step.main.id] || quizDone(step.main.id);
    return answered
      ? {info:["Ответ засчитан", "Можно двигаться дальше"], acts:runBtn + nextBtn}
      : {info:["Вопрос на понимание", "Выбери вариант: цифры 1–4 тоже работают"], acts:runBtn};
  }

  const t = step.main, done = taskDone(t.id);
  const left = t.hints.length - (C.hints[t.id] || 0);
  const hintBtn = t.hints.length
    ? `<button class="btn btn--sm" data-act="hint" ${left ? "" : "disabled"}>${
        left ? "Подсказка" : "Подсказок нет"}</button>` : "";

  if(done){
    return {info:["Решено", `${t.xp} XP начислено`],
      acts:`${hintBtn}<button class="btn btn--sm" data-act="run">Выполнить</button>${nextBtn}`};
  }
  return {info:["Задача", `${t.xp} XP, проверка по эталону`],
    acts:`${hintBtn}<button class="btn btn--sm" data-act="run">Выполнить</button>
      <button class="btn btn--primary" data-act="check">Проверить</button>`};
}

function paintActions(){
  const {info, acts} = actionsHtml();
  const bar = $("#acts", C.root);
  bar.innerHTML = `<div class="acts__i"><b>${info[0]}</b><span>${info[1]}</span></div>
    <div class="acts__b">${acts}</div>`;
  bar.classList.toggle("is-bare", !acts.trim());
  fillIcons(bar);
}

/* ── шкала шагов ─────────────────────────────────────────── */
function paintRail(){
  $("#rail", C.root).innerHTML = C.steps.map(s => {
    const done = stepDone(s), cur = s.i === C.cur;
    const kind = s.kind === "task" ? "задача" : s.kind === "quiz" ? "вопрос" : "теория";
    return `<button class="rail__s ${done ? "is-done" : ""} ${cur ? "is-current" : ""}"
      data-act="goto" data-i="${s.i}" ${cur ? 'aria-current="step"' : ""}
      aria-label="Шаг ${s.i + 1}: ${kind}${done ? ", сделан" : ""}"></button>`;
  }).join("");

  $("#unitMeta", C.root).textContent =
    `${pad2(C.cur + 1)}/${pad2(C.steps.length)} · заданий ${doneIn(C.unit)}/${totalIn(C.unit)}`;
}

/* ── верстак ─────────────────────────────────────────────── */
const benchTaskId = () => C.steps[C.cur].kind === "task" ? C.steps[C.cur].main.id : null;

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
  if(!id) return setEditor(C.sandboxSql || "");
  const draft = lsGet("draft." + id);
  setEditor(draft !== null ? draft : (store.state.answers[id] || ""));
}

const benchHint = () => benchTaskId()
  ? note({ic:"info", title:"Как проверить",
      text:"«Выполнить» покажет результат, «Проверить» сверит его с эталоном. " +
           "Cmd/Ctrl + Enter делает то же с клавиатуры."})
  : note({ic:"code", title:"Свободный запрос",
      text:"Здесь выполняется любой запрос к базе. Результат не проверяется и опыт не даёт."});

function paintSchema(){
  $("#schemaBody", C.root).innerHTML = store.course.schema.map(t => `
    <div class="schema__t">
      <button class="schema__n" data-act="ins" data-text="${esc(t.table)}">${esc(t.table)}</button>
      <span class="schema__rows">${t.rows}</span>
      <div class="schema__c">${t.columns.map(c =>
        `<button class="chip" data-act="ins" data-text="${esc(c.name)}"
           title="${esc(c.name)}: ${esc(c.type)}">${esc(c.name)}</button>`).join("")}</div>
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
const out = html => { $("#benchOut", C.root).innerHTML = html; fillIcons($("#benchOut", C.root)); };
const working = text => `<div class="note"><span class="spin"></span>
  <div class="note__b">${text}</div></div>`;

const errorNote = r => note({
  kind:"bad", ic:"warn", title:"Запрос не выполнился",
  text:r.error_ru || "База не поняла запрос. Проверь порядок частей и имена колонок.",
  raw:r.error || "",
  actions:`<button class="btn btn--sm" data-act="copy">Скопировать для разбора</button>`,
});
const netNote = r => note({kind:"bad", ic:"warn", title:"Нет связи с тренажёром", text:r.message});

async function doRun(){
  if(C.busy) return;
  const sql = $("#editorTa", C.root).value.trim();
  if(!sql) return out(note({ic:"info", title:"Пустой запрос",
    text:"Напиши запрос в редакторе и нажми «Выполнить»."}));
  setBusy(true);
  out(working("Выполняю запрос…"));
  const r = await api.runSql(sql);
  setBusy(false);
  if(r.netError) return out(netNote(r));
  C.last = {error:r.error || "", message:""};
  out(r.error || r.error_ru ? errorNote(r) : resultTable(r));
}

async function doCheck(){
  const id = benchTaskId();
  if(C.busy || !id) return;
  const sql = $("#editorTa", C.root).value.trim();
  if(!sql) return out(note({ic:"info", title:"Запрос пустой",
    text:"Сначала напиши решение, потом проверяй."}));
  setBusy(true);
  out(working("Сверяю с эталоном…"));
  const r = await api.checkTask(id, sql);
  setBusy(false);
  if(r.netError) return out(netNote(r));
  C.last = {error:r.error || "", message:r.message || ""};

  if(!r.ok){
    out((r.error ? errorNote(r) : note({
      kind:"acc", ic:"info", title:"Пока не сходится",
      text:r.message + " Это нормально: расхождение показывает, где именно разошлась логика.",
      actions:`<button class="btn btn--sm" data-act="hint">Подсказка</button>
               <button class="btn btn--sm" data-act="copy">Скопировать для разбора</button>`,
    })) + (r.result ? resultTable(r.result) : ""));
    return;
  }

  if(r.state) setState(r.state);
  out(note({kind:"ok", ic:"check", title:"Верно",
    text:r.xp ? `Задача засчитана, +${r.xp} XP.` : "Задача уже была решена: повтор тоже полезен."})
    + resultTable(r.result));
  if(r.xp) toast(`+${r.xp} XP`, "ok", "xp");
  C.hints[id] = 0;
  paintStep({keepOut:true});
  celebrate();
}

async function onAnswer(k){
  const q = C.steps[C.cur].main;
  const r = await api.answerQuiz(q.id, k);
  if(r.netError) return toast(r.message, "bad", "warn");
  C.quizFb[q.id] = {picked:k, answer:r.answer, ok:r.ok};
  if(r.state) setState(r.state);
  if(r.xp) toast(`+${r.xp} XP`, "ok", "xp");
  paintStep();
  $("#quizFb", C.root)?.scrollIntoView({block:"nearest", behavior:"smooth"});
  celebrate();
}

function celebrate(){
  if(unitDone(C.unit)){
    confetti();
    toast("Юнит закрыт", "ok", "trophy");
  }
}

async function runExample(idx){
  const box = $("#exOut" + idx, C.root);
  if(!box) return;
  box.innerHTML = `<div class="ex__out">${working("Выполняю…")}</div>`;
  const r = await api.runSql(C.unit.blocks[idx].sql);
  box.innerHTML = `<div class="ex__out">${
    r.netError ? netNote(r) : r.error ? errorNote(r) : resultTable(r)}</div>`;
  fillIcons(box);
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
    toast("Скопировано, вставь в чат", "ok", "clip");
  }catch{
    toast("Браузер не дал доступ к буферу обмена", "bad", "warn");
  }
}

function showHint(){
  const s = C.steps[C.cur];
  if(s.kind !== "task") return;
  const shown = C.hints[s.main.id] || 0;
  if(shown >= s.main.hints.length) return;
  C.hints[s.main.id] = shown + 1;
  paintStep({keepOut:true});
  $("#hintBox .hint:last-child", C.root)?.scrollIntoView({block:"nearest", behavior:"smooth"});
}

/* ── переходы ────────────────────────────────────────────── */
function gotoStep(i){
  if(i < 0 || i >= C.steps.length) return;
  C.cur = i;
  rememberStep(C.unit.id, i);
  if(C.steps[i].kind === "learn") markSeen(C.steps[i].id);
  paintStep();
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

/* ── сборка ──────────────────────────────────────────────── */
function paintStep({keepOut = false} = {}){
  const step = C.steps[C.cur];
  const split = step.kind === "task" || C.forceSplit;
  C.root.dataset.mode = split ? "split" : "focus";
  if(!split) C.root.dataset.pane = "lesson";

  const pane = $("#stepPane", C.root);
  pane.innerHTML = stepHtml(step);
  fillIcons(pane);
  paintRail();
  paintActions();

  const mark = $("#paneMark", C.root);
  if(mark) mark.hidden = step.kind !== "task" || taskDone(step.main.id);

  if(split){
    loadEditorForStep();
    const brief = $("#benchBrief", C.root);
    if(brief) brief.innerHTML = step.kind === "task"
      ? `<p class="caps">задача</p><div class="brief__t">${step.main.prompt}</div>`
      : `<p class="caps">свободный запрос</p>`;
    if(!keepOut) out(benchHint());
  }
}

export function renderUnit(root, nav, unitIdx, stepIdx){
  const unit = unitAt(unitIdx);
  const steps = buildSteps(unit);
  const remembered = Math.min(Math.max(lastStep(unit.id), 0), steps.length - 1);
  const start = stepIdx != null ? stepIdx
    : stepDone(steps[remembered]) ? firstUndoneStep(steps) : remembered;

  C = {unitIdx, unit, steps, nav, cur:0, root:null, hints:{}, quizFb:{},
       busy:false, last:{}, sandboxSql:"", forceSplit:false};

  const savedSchema = lsGet("schemaOpen");
  const schemaOpen = savedSchema === null ? window.innerWidth >= 900 : savedSchema !== "false";

  const node = el(`<div class="unit" data-mode="focus" data-pane="lesson">
    <div class="unit__bar">
      <button class="icon-btn" data-act="back" data-icon="back" data-size="17"
        aria-label="К программе курса" title="К программе (Esc)"></button>
      <div class="unit__t">
        <b>${esc(unit.title)}</b>
        <span id="unitMeta"></span>
      </div>
      <span class="spacer"></span>
      <button class="icon-btn" data-act="toggle-bench" data-icon="code" data-size="17"
        aria-pressed="false" aria-label="Открыть редактор на любом шаге"
        title="Свободный запрос"></button>
      <div class="pane-switch" role="group" aria-label="Что показать">
        <button data-act="pane" data-pane="lesson" aria-pressed="true">Урок</button>
        <button data-act="pane" data-pane="bench" aria-pressed="false">Запрос<span
          class="mark" id="paneMark" hidden></span></button>
      </div>
    </div>
    <div class="rail" id="rail" aria-label="Шаги урока"></div>

    <div class="unit__body">
      <section class="step-pane" id="stepPane" aria-label="Материал урока"></section>
      <section class="bench" aria-label="Редактор запроса">
        <div class="bench__head">
          <span class="caps">редактор</span>
          <span class="spacer"></span>
          <button class="btn btn--quiet btn--sm" data-act="copy"
            title="Задача, запрос и ошибка в буфер, чтобы разобрать в чате">Разбор</button>
        </div>
        <div class="bench__brief" id="benchBrief"></div>
        <div class="editor">
          <pre class="editor__hl" id="editorHl" aria-hidden="true"><code></code></pre>
          <textarea class="editor__ta" id="editorTa" spellcheck="false" autocapitalize="off"
            autocomplete="off" autocorrect="off" aria-label="Текст SQL-запроса"
            placeholder="Пиши запрос здесь. Проверка: Cmd/Ctrl + Enter."></textarea>
        </div>
        <div class="bench__out" id="benchOut" aria-live="polite"></div>
        <div class="schema disc" data-open="${schemaOpen}">
          <button class="disc__btn" data-act="schema" aria-expanded="${schemaOpen}">
            <span class="disc__c">${icon("caret", 11)}</span>Таблицы базы</button>
          <div class="disc__body" id="schemaBody"></div>
        </div>
      </section>
    </div>

    <div class="acts" id="acts"></div>
  </div>`);

  C.root = node;
  root.replaceChildren(node);
  document.body.classList.add("is-unit");
  fillIcons(node);

  paintSchema();
  bindEditor();
  gotoStep(start);

  delegate(node, "click", "[data-act]", (e, btn) => {
    switch(btn.dataset.act){
      case "back":   return nav.go("map");
      case "goto":   return gotoStep(+btn.dataset.i);
      case "next":
      case "skip":   return nextStep();
      case "hint":   return showHint();
      case "run":    return doRun();
      case "check":  return doCheck();
      case "copy":   return copyForChat();
      case "answer": return onAnswer(+btn.dataset.k);
      case "run-ex": return runExample(+btn.dataset.ex);
      case "ins":    return insert(btn.dataset.text);
      case "pane":   return switchPane(btn.dataset.pane);
      case "to-editor": {
        const sql = C.unit.blocks[+btn.dataset.ex].sql;
        if(node.dataset.mode !== "split"){
          C.forceSplit = true;
          node.querySelector('[data-act="toggle-bench"]')?.setAttribute("aria-pressed", "true");
          paintStep({keepOut:true});
        }
        switchPane("bench");
        setEditor(sql);
        return;
      }
      case "toggle-bench": {
        C.forceSplit = !C.forceSplit;
        btn.setAttribute("aria-pressed", String(C.forceSplit));
        paintStep();
        return;
      }
      case "recall":
      case "schema": {
        const d = btn.closest(".disc");
        const open = d.dataset.open !== "true";
        d.dataset.open = String(open);
        btn.setAttribute("aria-expanded", String(open));
        if(btn.dataset.act === "schema") lsSet("schemaOpen", String(open));
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
  const ta = $("#editorTa", C.root), s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  editorSync();
  ta.focus();
}

function bindEditor(){
  const ta = $("#editorTa", C.root);
  ta.addEventListener("input", editorSync);
  ta.addEventListener("scroll", () => { $("#editorHl", C.root).scrollTop = ta.scrollTop; });
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
  if(e.key === "Enter" && C.root.querySelector('.acts [data-act="next"]')){
    e.preventDefault();
    nextStep();
  }
}
