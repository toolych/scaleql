/* Точка входа: загрузка курса, маршрутизация, шапка, горячие клавиши. */

import { store, setState, onState, currentUnitIdx, levelOf, isFirstRun } from "./store.js";
import * as api from "./api.js";
import { $, $$, el, toast, bump, skeletonMap, emptyState, nDays } from "./ui.js";
import { renderMap }    from "./views/map.js";
import { renderStats }  from "./views/stats.js";
import { renderFinish } from "./views/finish.js";
import { renderUnit, unitKeydown } from "./views/unit.js";
import { openSettings } from "./views/settings.js";

const root = $("#view");
let live = null;   // активный экран урока — чтобы корректно его закрыть

/* ── шапка ───────────────────────────────────────────────── */
function paintHud(prevXp){
  const st = store.state;
  if(!st) return;
  const streak = $("#hudStreak"), xp = $("#hudXp");
  streak.querySelector("b").textContent = st.streak.days || 0;
  streak.title = st.streak.days ? `${nDays(st.streak.days)} подряд` : "Серия ещё не начата";
  xp.querySelector("b").textContent = st.xp;
  const lv = levelOf(st.xp);
  xp.title = `Уровень ${lv.level}${lv.need ? ` · до следующего ${lv.need} XP` : ""}`;
  if(prevXp != null && st.xp > prevXp) bump(xp);
}
function paintNav(){
  $$("[data-view]").forEach(b =>
    b.setAttribute("aria-current", b.dataset.view === store.view ? "page" : "false"));
}

/* ── маршрутизация ───────────────────────────────────────── */
const nav = {
  go(view){
    if(view === "settings") return openSettings();   // диалог поверх текущего экрана
    if(live){ live.destroy(); live = null; }
    store.view = view;
    paintNav();
    if(view === "stats") renderStats(root, nav);
    else renderMap(root, nav);
    root.focus({preventScroll:true});
  },
  openUnit(i, step){
    if(live){ live.destroy(); live = null; }
    store.view = "unit";
    store.unitIdx = i;
    paintNav();
    live = renderUnit(root, nav, i, step);
  },
  finishUnit(i){
    if(live){ live.destroy(); live = null; }
    store.view = "finish";
    paintNav();
    renderFinish(root, nav, i);
  },
  settings: openSettings,
};

/* ── старт ───────────────────────────────────────────────── */
function bindShell(){
  $("#brandBtn").addEventListener("click", () => nav.go("map"));
  $("#settingsBtn").addEventListener("click", openSettings);
  $$("[data-view]").forEach(b => b.addEventListener("click", () => nav.go(b.dataset.view)));
  document.addEventListener("keydown", e => {
    if(document.getElementById("dialog").open) return;   // диалог сам ловит Esc
    if(store.view === "unit") unitKeydown(e);
  });
  onState((st, before) => paintHud(before));
}

function failScreen(message){
  const node = el(`<div class="view-scroll">${emptyState({
    art:"⚡", title:"Тренажёр не отвечает", text:message,
    action:`<button class="btn btn--primary" data-act="retry">Попробовать снова</button>`})}</div>`);
  node.addEventListener("click", e => { if(e.target.closest('[data-act="retry"]')) boot(); });
  root.replaceChildren(node);
}

async function boot(){
  root.replaceChildren(el(skeletonMap()));
  const data = await api.getCourse();
  if(data.netError) return failScreen(data.message);

  store.course = data;
  store.state = data.state;
  store.unitIdx = currentUnitIdx();
  paintHud();
  paintNav();

  if(isFirstRun()) nav.go("map");
  else nav.go("map");
}

bindShell();
boot();
