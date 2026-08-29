/* Карта курса. Главный вопрос экрана — «что мне делать сейчас».
   Ответ стоит первым и выглядит как единственное крупное действие. */

import { store, units, unitAt, doneIn, totalIn, unitDone, unlockAt, unlockThreshold,
         currentUnitIdx, courseTotals, buildSteps, stepDone, firstUndoneStep,
         isFirstRun, reviewDue, levelOf } from "../store.js";
import { esc, el, delegate, toast, ring, nDays, plural } from "../ui.js";

const stepLabel = s =>
  s.kind === "task" ? "Задача: " + strip(s.main.prompt, 52)
: s.kind === "quiz" ? "Вопрос: " + strip(s.main.q, 52)
: "Короткая теория";

const strip = (html, n) => {
  const t = String(html).replace(/<[^>]+>/g, "");
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
};

function heroContinue(){
  const i = currentUnitIdx(), u = unitAt(i);
  const steps = buildSteps(u);
  const si = firstUndoneStep(steps);
  const s = steps[si];
  const st = store.state;
  const todayXp = st.history[store.course.today] || 0;
  const lv = levelOf(st.xp);

  return `<section class="hero">
    <div class="hero__eyebrow">
      <span class="badge badge--brand">Юнит ${i + 1} из ${units().length}</span>
      ${st.streak.days ? `<span class="badge badge--warn">🔥 ${nDays(st.streak.days)} подряд</span>` : ""}
      <span class="badge">Уровень ${lv.level}</span>
    </div>
    <h1 class="hero__title">${esc(u.title)}</h1>
    <p class="hero__sub">${esc(u.sub)}</p>

    <div class="hero__meta">
      <div class="hero__prog">
        <div class="progress-row">
          <span class="progress" role="progressbar" aria-valuenow="${doneIn(u)}" aria-valuemin="0"
                aria-valuemax="${totalIn(u)}" aria-label="В юните сделано ${doneIn(u)} из ${totalIn(u)} заданий">
            <i class="progress__fill" style="width:${Math.round(100 * doneIn(u) / (totalIn(u) || 1))}%"></i>
          </span>
          <span class="progress-row__num">${doneIn(u)} из ${totalIn(u)}</span>
        </div>
        <p class="hero__sub u-mt-3">
          Дальше — шаг ${si + 1} из ${steps.length}. ${esc(stepLabel(s))}</p>
      </div>
      ${ring(todayXp, st.goal)}
    </div>

    <div class="hero__foot">
      <button class="btn btn--primary btn--lg" data-act="continue">Продолжить обучение</button>
      <button class="btn btn--quiet" data-act="stats">Мой прогресс</button>
    </div>
  </section>`;
}

function heroWelcome(){
  const t = courseTotals();
  return `<section class="hero">
    <div class="hero__eyebrow"><span class="badge badge--brand">Первый запуск</span></div>
    <h1 class="hero__title">SQL для аналитика — на живой базе</h1>
    <p class="hero__sub">${t.units} ${plural(t.units,"юнит","юнита","юнитов")}, ${t.tasks} ${plural(t.tasks,"задача","задачи","задач")}
      и ${t.quizzes} ${plural(t.quizzes,"вопрос","вопроса","вопросов")} на данных сервиса по подписке.</p>
    <ol class="hero__points">
      <li><span class="hero__num">1</span><span><b>Короткие шаги.</b> В каждом — немного теории и сразу одно действие. Урок не читается стеной.</span></li>
      <li><span class="hero__num">2</span><span><b>Настоящая база.</b> Запрос выполняется по-честному, результат сравнивается с эталоном.</span></li>
      <li><span class="hero__num">3</span><span><b>Прогресс виден.</b> XP, серия дней и дневная цель — на вкладке «Прогресс».</span></li>
    </ol>
    <div class="hero__foot">
      <button class="btn btn--primary btn--lg" data-act="continue">Начать первый урок</button>
    </div>
  </section>`;
}

function heroDone(){
  const t = courseTotals();
  return `<section class="hero">
    <div class="hero__eyebrow"><span class="badge badge--ok">Курс пройден</span></div>
    <h1 class="hero__title">Все ${t.units} ${plural(t.units,"юнит","юнита","юнитов")} закрыты</h1>
    <p class="hero__sub">${t.tasksDone} задач и ${t.quizzesDone} вопросов, ${store.state.xp} XP.
      Дальше — повторение: без него оконные функции забываются за месяц.</p>
    <div class="hero__foot">
      <button class="btn btn--primary btn--lg" data-act="continue">Открыть юнит на повторение</button>
      <button class="btn btn--quiet" data-act="stats">Мой прогресс</button>
    </div>
  </section>`;
}

function reviewBanner(){
  const due = reviewDue();
  if(!due.length) return "";
  const first = due[0];
  return `<div class="alert alert--warn u-mb-5">
    <span class="alert__icon" aria-hidden="true">↻</span>
    <div class="alert__body">
      <b class="alert__title">Пора повторить</b>
      «${esc(first.u.title)}» не открывался больше недели${due.length > 1 ? `, и ещё ${due.length - 1}` : ""}.
      Десять минут сейчас дешевле, чем заново через месяц.
      <div class="row">
        <button class="btn btn--sm" data-act="unit" data-idx="${first.i}">Повторить «${esc(first.u.title)}»</button>
      </div>
    </div></div>`;
}

function pathItem(u, i){
  const done = unitDone(u), open = unlockAt(i), cur = !done && open && i === currentUnitIdx();
  const d = doneIn(u), t = totalIn(u);
  const cls = [done ? "is-done" : open ? (cur ? "is-current" : "") : "is-locked", i % 2 ? "is-alt" : ""]
    .filter(Boolean).join(" ");
  const face = done ? "✓" : open ? u.icon : "🔒";
  const state = done ? "закрыт" : open ? "доступен" : `закрыт на замок, нужно ${unlockThreshold(i)} заданий в предыдущем юните`;

  return `<li class="path__item ${cls}">
    <button class="path__link" data-act="unit" data-idx="${i}" ${open ? "" : `aria-disabled="true"`}
      aria-label="Юнит ${i + 1}. ${esc(u.title)}. ${esc(u.sub)}. Сделано ${d} из ${t}. ${state}">
      <span class="path__dot" aria-hidden="true">${face}</span>
      <span class="path__info">
        <span class="path__name">${esc(u.title)}
          ${cur ? `<span class="badge badge--brand">вы здесь</span>` : ""}</span>
        <span class="path__topics">${esc(u.sub)}</span>
        <span class="path__prog">
          <span class="progress ${done ? "progress--ok" : open ? "" : "progress--muted"}">
            <i class="progress__fill" style="width:${t ? Math.round(100 * d / t) : 0}%"></i></span>
          <span class="path__count">${d} из ${t}</span>
        </span>
      </span>
    </button></li>`;
}

export function renderMap(root, nav){
  const t = courseTotals();
  const hero = isFirstRun() ? heroWelcome() : t.unitsDone === t.units ? heroDone() : heroContinue();

  const node = el(`<div class="view-scroll"><div class="map">
    ${hero}
    ${reviewBanner()}
    <h2 class="section-title">Путь курса</h2>
    <p class="map__lead">Юнитов закрыто ${t.unitsDone} из ${t.units} ·
      задач решено ${t.tasksDone} из ${t.tasks} ·
      вопросов ${t.quizzesDone} из ${t.quizzes}</p>
    <ol class="path">${units().map(pathItem).join("")}</ol>
  </div></div>`);

  delegate(node, "click", "[data-act]", (e, btn) => {
    const act = btn.dataset.act;
    if(act === "stats") return nav.go("stats");
    if(act === "continue") return nav.openUnit(currentUnitIdx());
    if(act === "unit"){
      const i = +btn.dataset.idx;
      if(!unlockAt(i)){
        const prev = unitAt(i - 1);
        return toast(`Сначала закрой «${prev.title}» хотя бы на ${unlockThreshold(i)} из ${totalIn(prev)}`, "");
      }
      return nav.openUnit(i);
    }
  });

  root.replaceChildren(node);
}
