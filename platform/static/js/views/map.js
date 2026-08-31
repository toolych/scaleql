/* Программа курса. Экран отвечает на один вопрос: что делать сейчас.
   Ответ стоит первым, курс под ним читается как оглавление учебника. */

import { store, units, unitAt, doneIn, totalIn, unitDone, unlockAt, unlockThreshold,
         currentUnitIdx, courseTotals, buildSteps, firstUndoneStep,
         isFirstRun, reviewDue, levelOf } from "../store.js";
import { esc, el, delegate, toast, meter, plural, pad2, note } from "../ui.js";
import { icon } from "../icons.js";

const strip = (html, n) => {
  const t = String(html).replace(/<[^>]+>/g, "");
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
};

const stepLabel = s =>
  s.kind === "task" ? strip(s.main.prompt, 62)
: s.kind === "quiz" ? strip(s.main.q, 62)
: "теория";

function heroContinue(){
  const i = currentUnitIdx(), u = unitAt(i);
  const steps = buildSteps(u);
  const si = firstUndoneStep(steps);
  const st = store.state;
  const todayXp = st.history[store.course.today] || 0;
  const lv = levelOf(st.xp);

  return `<section class="hero">
    <div class="hero__k">
      <span class="tag tag--acc">${pad2(i + 1)} / ${pad2(units().length)}</span>
      <span class="tag">уровень ${lv.level}</span>
    </div>
    <h1 class="hero__t">${esc(u.title)}</h1>
    <p class="hero__s">${esc(u.sub)}</p>

    <div class="hero__prog">
      ${meter(doneIn(u), totalIn(u), {label:`В юните сделано ${doneIn(u)} из ${totalIn(u)} заданий`})}
      <p class="hero__next">Шаг ${si + 1} из ${steps.length}: ${esc(stepLabel(steps[si]))}<br>
        Сегодня ${todayXp} из ${st.goal} XP дневной цели</p>
    </div>

    <div class="hero__acts">
      <button class="btn btn--primary btn--lg" data-act="continue">Продолжить</button>
      <button class="btn btn--quiet" data-act="stats">Прогресс</button>
    </div>
  </section>`;
}

function heroWelcome(){
  const t = courseTotals();
  return `<section class="hero">
    <h1 class="hero__t">SQL для аналитика,<br>на живой базе</h1>
    <p class="hero__s">${t.units} ${plural(t.units,"юнит","юнита","юнитов")},
      ${t.tasks} ${plural(t.tasks,"задача","задачи","задач")} и
      ${t.quizzes} ${plural(t.quizzes,"вопрос","вопроса","вопросов")}
      на данных сервиса по подписке за год.</p>
    <ol class="steps-list">
      <li><span class="num">01</span><span><b>Короткие шаги.</b>
        Немного теории и сразу одно действие. Урок не читается стеной.</span></li>
      <li><span class="num">02</span><span><b>Настоящая база.</b>
        Запрос выполняется по-честному, результат сверяется с эталоном.</span></li>
      <li><span class="num">03</span><span><b>Видимый прогресс.</b>
        Опыт, серия дней и дневная цель на вкладке «Прогресс».</span></li>
    </ol>
    <div class="hero__acts">
      <button class="btn btn--primary btn--lg" data-act="continue">Начать первый урок</button>
    </div>
  </section>`;
}

function heroDone(){
  const t = courseTotals();
  return `<section class="hero">
    <div class="hero__k"><span class="tag tag--ok">курс пройден</span></div>
    <h1 class="hero__t">Все ${t.units} ${plural(t.units,"юнит","юнита","юнитов")} закрыты</h1>
    <p class="hero__s">${t.tasksDone} задач и ${t.quizzesDone} вопросов, ${store.state.xp} XP.
      Дальше только повторение: без него оконные функции забываются за месяц.</p>
    <div class="hero__acts">
      <button class="btn btn--primary btn--lg" data-act="continue">Открыть юнит на повторение</button>
      <button class="btn btn--quiet" data-act="stats">Прогресс</button>
    </div>
  </section>`;
}

function reviewNote(){
  const due = reviewDue();
  if(!due.length) return "";
  const first = due[0];
  return `<div class="u-mb-7">${note({
    kind:"acc", ic:"repeat", title:"Пора повторить",
    text:`«${esc(first.u.title)}» не открывался больше недели` +
         (due.length > 1 ? `, и ещё ${due.length - 1}` : "") +
         `. Десять минут сейчас дешевле, чем заново через месяц.`,
    actions:`<button class="btn btn--sm" data-act="unit" data-idx="${first.i}">Повторить</button>`,
  })}</div>`;
}

function pathItem(u, i){
  const done = unitDone(u), open = unlockAt(i), cur = !done && open && i === currentUnitIdx();
  const d = doneIn(u), t = totalIn(u);
  const cls = done ? "is-done" : cur ? "is-current" : open ? "" : "is-locked";
  const state = done ? "закрыт" : open ? "доступен"
    : `нужно ${unlockThreshold(i)} заданий в предыдущем юните`;

  return `<li class="path__i ${cls}">
    <button class="path__b" data-act="unit" data-idx="${i}" ${open ? "" : `aria-disabled="true"`}
      aria-label="Юнит ${i + 1}. ${esc(u.title)}. ${esc(u.sub)}. Сделано ${d} из ${t}. ${state}">
      <span class="path__n">${done ? icon("check", 14) : open ? pad2(i + 1) : icon("lock", 13)}</span>
      <span class="path__body">
        <span class="path__t">${esc(u.title)}</span>
        <span class="path__s">${esc(u.sub)}</span>
      </span>
      <span class="path__m">
        <span class="bar ${done ? "bar--ok" : open ? "" : "bar--mute"}">
          <i style="width:${t ? Math.round(100 * d / t) : 0}%"></i></span>
        <span class="num">${d}/${t}</span>
      </span>
    </button></li>`;
}

export function renderMap(root, nav){
  const t = courseTotals();
  const hero = isFirstRun() ? heroWelcome() : t.unitsDone === t.units ? heroDone() : heroContinue();

  const node = el(`<div class="scroll"><div class="page">
    ${hero}
    ${reviewNote()}
    <div class="sec">
      <h2 class="sec__h">Программа</h2>
      <p class="sec__note">Юнитов закрыто ${t.unitsDone} из ${t.units},
        задач решено ${t.tasksDone} из ${t.tasks}</p>
      <ol class="path">${units().map(pathItem).join("")}</ol>
    </div>
  </div></div>`);

  delegate(node, "click", "[data-act]", (e, btn) => {
    const act = btn.dataset.act;
    if(act === "stats") return nav.go("stats");
    if(act === "continue") return nav.openUnit(currentUnitIdx());
    if(act === "unit"){
      const i = +btn.dataset.idx;
      if(!unlockAt(i)){
        const prev = unitAt(i - 1);
        return toast(`Сначала закрой «${prev.title}» на ${unlockThreshold(i)} из ${totalIn(prev)}`);
      }
      return nav.openUnit(i);
    }
  });

  root.replaceChildren(node);
}
