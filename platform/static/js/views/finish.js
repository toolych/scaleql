/* Итог юнита. Момент, ради которого возвращаются: видно, что сделано,
   сколько заработано и куда идти дальше. */

import { store, unitAt, units, tasksOf, quizzesOf, taskDone, quizDone,
         unitDone, doneIn, totalIn, unlockAt, buildSteps, courseTotals } from "../store.js";
import { esc, el, delegate, plural, fillIcons } from "../ui.js";
import { icon } from "../icons.js";

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
    <div class="finish__k">${icon("trophy", 18)}<span class="caps">юнит закрыт</span></div>
    <h1 class="finish__t">${esc(u.title)}</h1>
    <p class="finish__s">${esc(u.sub)}. ${courseDone ? "И это был последний юнит курса."
      : nextIdx >= 0 ? `Следующий: «${esc(unitAt(nextIdx).title)}».` : ""}</p>
    <div class="finish__n">
      <div><b>${tasksOf(u).filter(t => taskDone(t.id)).length}</b>
        <span>${plural(tasksOf(u).length, "задача", "задачи", "задач")}</span></div>
      <div><b>${quizzesOf(u).filter(q => quizDone(q.id)).length}</b><span>вопросов</span></div>
      <div><b>+${xp}</b><span>опыта</span></div>
    </div>
    <div class="finish__a">
      ${nextIdx >= 0 && unlockAt(nextIdx)
        ? `<button class="btn btn--primary btn--lg" data-act="next" data-idx="${nextIdx}">
             Дальше: ${esc(unitAt(nextIdx).title)}</button>` : ""}
      <button class="btn" data-act="again">Пройти юнит заново</button>
      <button class="btn btn--quiet" data-act="map">К программе курса</button>
    </div>`
  : `
    <div class="finish__k">${icon("tasks", 18)}<span class="caps">шаги кончились</span></div>
    <h1 class="finish__t">Осталось ${left.length}
      ${plural(left.length, "задание", "задания", "заданий")}</h1>
    <p class="finish__s">Юнит «${esc(u.title)}» засчитается, когда закроешь их. Чтобы открыть
      следующий, хватит ${Math.ceil(totalIn(u) * 0.7)} из ${totalIn(u)}.</p>
    <div class="finish__n">
      <div><b>${doneIn(u)}/${totalIn(u)}</b><span>сделано</span></div>
      <div><b>+${xp}</b><span>опыта набрано</span></div>
    </div>
    <div class="finish__a">
      ${left.slice(0, 3).map(b => `<button class="btn" data-act="step" data-i="${stepOf(b.id)}">
        ${b.type === "task" ? "Задача" : "Вопрос"}: ${esc(strip(b.prompt || b.q).slice(0, 42))}…</button>`).join("")}
      <button class="btn btn--quiet" data-act="map">К программе курса</button>
    </div>`;

  const node = el(`<div class="scroll"><div class="finish ${done ? "" : "finish--part"}">
    <section class="finish__in">${body}</section></div></div>`);
  fillIcons(node);

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
