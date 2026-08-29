/* Экран завершения юнита. Момент, ради которого возвращаются:
   видно, что сделано, сколько заработано и куда идти дальше. */

import { store, unitAt, units, tasksOf, quizzesOf, taskDone, quizDone,
         unitDone, doneIn, totalIn, unlockAt, buildSteps, courseTotals } from "../store.js";
import { esc, el, delegate, plural } from "../ui.js";

const strip = h => String(h).replace(/<[^>]+>/g, "");

export function renderFinish(root, nav, unitIdx){
  const u = unitAt(unitIdx);
  const done = unitDone(u);
  const xp = u.blocks.reduce((a, b) =>
    a + ((b.type === "task" && taskDone(b.id)) || (b.type === "quiz" && quizDone(b.id)) ? (b.xp || 0) : 0), 0);
  const nextIdx = unitIdx + 1 < units().length ? unitIdx + 1 : -1;
  const total = courseTotals();
  const courseDone = total.unitsDone === total.units;

  const left = u.blocks.filter(b =>
    (b.type === "task" && !taskDone(b.id)) || (b.type === "quiz" && !quizDone(b.id)));
  const steps = buildSteps(u);
  const stepOf = id => steps.findIndex(s => s.main && s.main.id === id);

  const body = done ? `
    <div class="finish__art" aria-hidden="true">✓</div>
    <h1 class="finish__title">Юнит закрыт</h1>
    <p class="finish__sub">${esc(u.title)} — ${esc(u.sub)}.
      ${courseDone ? "И это был последний юнит курса." :
        nextIdx >= 0 ? `Следующий: «${esc(unitAt(nextIdx).title)}».` : ""}</p>
    <div class="finish__stats">
      <div class="finish__stat"><b>${tasksOf(u).filter(t => taskDone(t.id)).length}</b>
        <span>${plural(tasksOf(u).length, "задача", "задачи", "задач")} решено</span></div>
      <div class="finish__stat"><b>${quizzesOf(u).filter(q => quizDone(q.id)).length}</b>
        <span>вопросов пройдено</span></div>
      <div class="finish__stat"><b>+${xp}</b><span>XP за юнит</span></div>
    </div>
    <div class="finish__acts">
      ${nextIdx >= 0 && unlockAt(nextIdx)
        ? `<button class="btn btn--primary btn--lg" data-act="next" data-idx="${nextIdx}">
             Следующий юнит: ${esc(unitAt(nextIdx).title)}</button>` : ""}
      <button class="btn btn--ghost" data-act="again">Пройти юнит заново</button>
      <button class="btn btn--quiet" data-act="map">К карте курса</button>
    </div>`
  : `
    <div class="finish__art finish__art--pending" aria-hidden="true">◐</div>
    <h1 class="finish__title">Шаги кончились, задачи — нет</h1>
    <p class="finish__sub">В юните «${esc(u.title)}» осталось
      ${left.length} ${plural(left.length, "задание", "задания", "заданий")}.
      Юнит засчитается, когда закроешь их — или хотя бы ${Math.ceil(totalIn(u) * 0.7)} из ${totalIn(u)},
      чтобы открыть следующий.</p>
    <div class="finish__stats">
      <div class="finish__stat"><b>${doneIn(u)} из ${totalIn(u)}</b><span>сделано</span></div>
      <div class="finish__stat"><b>+${xp}</b><span>XP набрано</span></div>
    </div>
    <div class="finish__acts">
      ${left.slice(0, 3).map(b => `<button class="btn btn--ghost" data-act="step" data-i="${stepOf(b.id)}">
        ${b.type === "task" ? "Задача" : "Вопрос"}: ${esc(strip(b.prompt || b.q).slice(0, 46))}…</button>`).join("")}
      <button class="btn btn--quiet" data-act="map">К карте курса</button>
    </div>`;

  const node = el(`<div class="view-scroll"><div class="finish">
    <section class="finish__card ${done ? "" : "finish__card--pending"}">${body}</section>
  </div></div>`);

  delegate(node, "click", "[data-act]", (e, btn) => {
    switch(btn.dataset.act){
      case "next":  return nav.openUnit(+btn.dataset.idx, 0);
      case "again": return nav.openUnit(unitIdx, 0);
      case "step":  return nav.openUnit(unitIdx, +btn.dataset.i);
      case "map":   return nav.go("map");
    }
  });

  root.replaceChildren(node);
}
