/* Прогресс. Не «72%», а «18 из 25»: процент без знаменателя ничего не значит. */

import { store, units, unitAt, doneIn, totalIn, unitDone, courseTotals,
         levelOf, reviewDue, unlockAt } from "../store.js";
import { esc, el, delegate, ring, plural, nDays, emptyState } from "../ui.js";

/* Ключ дня по местному времени. toISOString() отдаёт UTC и в Москве
   сдвигает ночные занятия на вчера — график тогда врёт. */
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

  if(!sum) return emptyState({art:"▁▂▃", title:"Здесь появится твоя активность",
    text:"График рисуется по XP за день. Реши первую задачу — и первый столбик встанет сегодня."});

  return `<div class="chart">${days.map(d => `
      <div class="chart__col ${d.xp ? "" : "is-empty"} ${d.today ? "is-today" : ""}"
           title="${d.key}: ${d.xp} XP">
        <span class="chart__val">${d.xp || ""}</span>
        <i class="chart__bar" style="height:${Math.max(4, Math.round(90 * d.xp / max))}%"></i>
      </div>`).join("")}</div>
    <div class="chart__axis" aria-hidden="true">${days.map(d =>
      `<span class="${d.today ? "is-today" : ""}">${d.lbl}</span>`).join("")}</div>
    <p class="card__sub" style="margin-top:var(--sp-3)">
      За две недели ${sum} XP, занимался ${nDays(active)} из 14.</p>`;
}

function mastery(){
  return `<ul class="mastery">${units().map((u, i) => {
    const d = doneIn(u), t = totalIn(u), done = unitDone(u), open = unlockAt(i);
    return `<li class="mastery__item ${done ? "is-done" : ""}">
      <span class="mastery__icon" aria-hidden="true">${done ? "✓" : open ? u.icon : "🔒"}</span>
      <button class="mastery__name" data-act="unit" data-idx="${i}"
        ${open ? "" : "disabled"}>${esc(u.title)}</button>
      <span class="progress ${done ? "progress--ok" : ""}">
        <i class="progress__fill" style="width:${t ? Math.round(100 * d / t) : 0}%"></i></span>
      <span class="mastery__num">${d} из ${t}</span>
    </li>`;
  }).join("")}</ul>`;
}

export function renderStats(root, nav){
  const st = store.state, t = courseTotals(), lv = levelOf(st.xp);
  const todayXp = st.history[store.course.today] || 0;
  const due = reviewDue();

  const node = el(`<div class="view-scroll"><div class="stats">
    <h1 class="stats__title">Прогресс</h1>

    <div class="kpis">
      <div class="kpi"><b>${st.streak.days || 0}</b><span>${plural(st.streak.days || 0, "день", "дня", "дней")} подряд</span></div>
      <div class="kpi"><b>${st.xp}<small> XP</small></b><span>уровень ${lv.level}</span></div>
      <div class="kpi"><b>${t.tasksDone}<small> из ${t.tasks}</small></b><span>задач решено</span></div>
      <div class="kpi"><b>${t.quizzesDone}<small> из ${t.quizzes}</small></b><span>вопросов пройдено</span></div>
    </div>

    <div class="card stack u-mb-4" >
      <div class="goal">
        ${ring(todayXp, st.goal)}
        <div class="goal__body">
          <h2 class="card__title">Дневная цель</h2>
          <p class="card__sub">${
            todayXp >= st.goal
              ? "Цель на сегодня закрыта. Серия дней продлена."
              : `Осталось ${st.goal - todayXp} XP — это одна задача среднего веса.`}</p>
          <button class="btn btn--ghost btn--sm" data-act="settings">Изменить цель</button>
        </div>
      </div>
    </div>

    <div class="card stack u-mb-4" >
      <div>
        <h2 class="card__title">Уровень ${lv.level}</h2>
        <p class="card__sub">${
          lv.need ? `До ${lv.level + 1} уровня — ${lv.need} XP` : "Максимальный уровень"}</p>
        <span class="progress progress--lg" role="progressbar" aria-valuenow="${lv.inLevel}"
          aria-valuemin="0" aria-valuemax="${lv.span}" aria-label="Прогресс уровня">
          <i class="progress__fill" style="width:${Math.round(100 * lv.inLevel / lv.span)}%"></i></span>
      </div>
    </div>

    <div class="card u-mb-4">
      <h2 class="card__title">Последние 14 дней</h2>
      ${chart()}
    </div>

    ${due.length ? `<div class="card u-mb-4">
      <h2 class="card__title">Пора повторить</h2>
      <p class="card__sub">Закрыто больше недели назад.
        Пройди задачи ещё раз — на этот раз без подсказок.</p>
      <div class="row">${due.slice(0, 4).map(x =>
        `<button class="btn btn--ghost btn--sm" data-act="unit" data-idx="${x.i}">${esc(x.u.title)}</button>`).join("")}
      </div></div>` : ""}

    <div class="card u-mb-4">
      <h2 class="card__title">Освоение тем</h2>
      ${mastery()}
    </div>

    <div class="card">
      <h2 class="card__title">Напоминания</h2>
      <p class="card__sub">${
        st.tg.chat_id
          ? `Telegram подключён. Бот напишет в ${st.tg.hour}:00, если дневная цель не закрыта.`
          : "Telegram не подключён. Бот может напоминать о занятии и присылать серию дней."}</p>
      <button class="btn btn--ghost btn--sm" data-act="settings">Настроить</button>
    </div>
  </div></div>`);

  delegate(node, "click", "[data-act]", (e, btn) => {
    if(btn.dataset.act === "settings") return nav.settings();
    if(btn.dataset.act === "unit") return nav.openUnit(+btn.dataset.idx);
  });

  root.replaceChildren(node);
}
