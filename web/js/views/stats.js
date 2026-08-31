/* Прогресс. Не «72%», а «18 из 25»: процент без знаменателя ничего не значит. */

import { store, units, doneIn, totalIn, unitDone, courseTotals,
         levelOf, reviewDue, unlockAt } from "../store.js";
import { esc, el, delegate, ring, plural, nDays, emptyState, pad2 } from "../ui.js";
import { icon } from "../icons.js";

/* Ключ дня по местному времени. toISOString() отдаёт UTC и в Москве
   сдвигает ночные занятия на вчера: график тогда врёт. */
const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function chart(){
  const days = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dayKey(d);
    return {key, xp:store.state.history[key] || 0,
            lbl:d.toLocaleDateString("ru", {weekday:"short"}).slice(0, 2),
            today:key === store.course.today};
  });
  const max = Math.max(store.state.goal, ...days.map(d => d.xp));
  const sum = days.reduce((a, d) => a + d.xp, 0);
  const active = days.filter(d => d.xp).length;

  if(!sum) return emptyState({ic:"chart", title:"Здесь появится активность",
    text:"График рисуется по опыту за день. Реши первую задачу, и первый столбик встанет сегодня."});

  return `<div class="chart">${days.map(d => `
      <div class="chart__c ${d.xp ? "" : "is-empty"} ${d.today ? "is-today" : ""}"
           title="${d.key}: ${d.xp} XP">
        <span class="chart__v">${d.xp || ""}</span>
        <i class="chart__b" style="height:${Math.max(2, Math.round(88 * d.xp / max))}%"></i>
      </div>`).join("")}</div>
    <div class="chart__x" aria-hidden="true">${days.map(d =>
      `<span class="${d.today ? "is-today" : ""}">${d.lbl}</span>`).join("")}</div>
    <p class="sec__note" style="margin-top:var(--sp-4)">
      За две недели ${sum} XP, занимался ${nDays(active)} из 14.</p>`;
}

const mastery = () => `<ul class="mastery">${units().map((u, i) => {
  const d = doneIn(u), t = totalIn(u), done = unitDone(u), open = unlockAt(i);
  return `<li class="${done ? "is-done" : ""}">
    <span class="mastery__n">${done ? icon("check", 13) : open ? pad2(i + 1) : icon("lock", 12)}</span>
    <button class="mastery__t" data-act="unit" data-idx="${i}" ${open ? "" : "disabled"}>${esc(u.title)}</button>
    <span class="bar ${done ? "bar--ok" : ""}"><i style="width:${t ? Math.round(100 * d / t) : 0}%"></i></span>
    <span class="mastery__c">${d}/${t}</span>
  </li>`;
}).join("")}</ul>`;

export function renderStats(root, nav){
  const st = store.state, t = courseTotals(), lv = levelOf(st.xp);
  const todayXp = st.history[store.course.today] || 0;
  const due = reviewDue();

  const node = el(`<div class="scroll"><div class="page page--wide">
    <h1 class="hero__t" style="margin-bottom:var(--sp-6)">Прогресс</h1>

    <div class="kpis">
      <div class="kpi"><b>${st.streak.days || 0}</b>
        <span>${plural(st.streak.days || 0, "день", "дня", "дней")} подряд</span></div>
      <div class="kpi"><b>${st.xp}<small> XP</small></b><span>уровень ${lv.level}</span></div>
      <div class="kpi"><b>${t.tasksDone}<small>/${t.tasks}</small></b><span>задач решено</span></div>
      <div class="kpi"><b>${t.quizzesDone}<small>/${t.quizzes}</small></b><span>вопросов пройдено</span></div>
    </div>

    <div class="sec">
      <div class="goal">
        ${ring(todayXp, st.goal)}
        <div class="goal__b">
          <h2 class="sec__h">Дневная цель</h2>
          <p class="sec__note">${todayXp >= st.goal
            ? "Цель на сегодня закрыта, серия дней продлена."
            : `Осталось ${st.goal - todayXp} XP: одна задача среднего веса.`}</p>
          <button class="btn btn--sm" data-act="settings">Изменить цель</button>
        </div>
      </div>
    </div>

    <div class="sec">
      <h2 class="sec__h">Уровень ${lv.level}</h2>
      <p class="sec__note">${lv.need
        ? `До ${lv.level + 1} уровня ещё ${lv.need} XP` : "Максимальный уровень"}</p>
      <span class="bar bar--tall" role="progressbar" aria-valuenow="${lv.inLevel}"
        aria-valuemin="0" aria-valuemax="${lv.span}" aria-label="Прогресс уровня">
        <i style="width:${Math.round(100 * lv.inLevel / lv.span)}%"></i></span>
    </div>

    <div class="sec">
      <h2 class="sec__h">Последние 14 дней</h2>
      ${chart()}
    </div>

    ${due.length ? `<div class="sec">
      <h2 class="sec__h">Пора повторить</h2>
      <p class="sec__note">Эти юниты закрыты больше недели назад. Пройди задачи ещё раз, без подсказок.</p>
      <div class="row">${due.slice(0, 4).map(x =>
        `<button class="btn btn--sm" data-act="unit" data-idx="${x.i}">${esc(x.u.title)}</button>`).join("")}
      </div></div>` : ""}

    <div class="sec">
      <h2 class="sec__h">Освоение тем</h2>
      ${mastery()}
    </div>

    <div class="sec">
      <h2 class="sec__h">Напоминания</h2>
      <p class="sec__note">${st.tg.chat_id
        ? `Telegram подключён, бот пишет в ${st.tg.hour}:00, если дневная цель не закрыта.`
        : "Telegram не подключён. Бот может напоминать о занятии и присылать серию дней."}</p>
      <button class="btn btn--sm" data-act="settings">Настроить</button>
    </div>
  </div></div>`);

  delegate(node, "click", "[data-act]", (e, btn) => {
    if(btn.dataset.act === "settings") return nav.settings();
    if(btn.dataset.act === "unit") return nav.openUnit(+btn.dataset.idx);
  });

  root.replaceChildren(node);
}
