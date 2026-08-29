/* Состояние курса и производные величины.
   Прогресс шагов-теории живёт локально: сервер про них не знает. */

export const store = {
  course:null,    // {units, schema, today, tg_ready}
  state:null,     // серверное состояние: xp, tasks, quizzes, streak, goal, history, log
  view:"map",
  unitIdx:0,
};

/* ── локальная память браузера ───────────────────────────── */
const LS = {
  get(key, fallback){
    try{ const v = localStorage.getItem("scaleql."+key); return v===null ? fallback : JSON.parse(v); }
    catch{ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem("scaleql."+key, JSON.stringify(value)); }catch{ /* приватный режим */ }
  },
};

let seen = new Set(LS.get("seen", []));
export const isSeen  = id => seen.has(id);
export const markSeen = id => { if(!seen.has(id)){ seen.add(id); LS.set("seen", [...seen]); } };

export const lastStep = unitId => LS.get("step."+unitId, 0);
export const rememberStep = (unitId, i) => LS.set("step."+unitId, i);

export const isFirstRun = () => !store.state.xp && !Object.keys(store.state.tasks).length;

/* ── срезы по юнитам ─────────────────────────────────────── */
export const units     = ()  => store.course.units;
export const unitAt    = i   => store.course.units[i];
export const tasksOf   = u   => u.blocks.filter(b => b.type === "task");
export const quizzesOf = u   => u.blocks.filter(b => b.type === "quiz");
export const taskDone  = id  => store.state.tasks[id]   === "done";
export const quizDone  = id  => store.state.quizzes[id] === "done";

export const doneIn  = u => tasksOf(u).filter(t => taskDone(t.id)).length
                          + quizzesOf(u).filter(q => quizDone(q.id)).length;
export const totalIn = u => tasksOf(u).length + quizzesOf(u).length;
export const unitDone = u => totalIn(u) > 0 && doneIn(u) === totalIn(u);
export const unitStarted = u => doneIn(u) > 0;

/* Юнит открывается, когда предыдущий закрыт на 70% — так тема
   не пропускается целиком, но одна упрямая задача не блокирует курс. */
export const unlockAt = i => {
  if(i <= 0) return true;
  const prev = units()[i-1];
  return doneIn(prev) >= Math.ceil(totalIn(prev) * 0.7);
};
export const unlockThreshold = i => Math.ceil(totalIn(units()[i-1]) * 0.7);

/* Первый незакрытый доступный юнит — то, что предлагаем «продолжить». */
export const currentUnitIdx = () => {
  const i = units().findIndex((u, k) => unlockAt(k) && !unitDone(u));
  return i < 0 ? units().length - 1 : i;
};

/* ── шаги урока ──────────────────────────────────────────── */
/* Блоки склеиваются в короткие шаги: немного теории и сразу
   одно действие. Так урок читается как лестница, а не как стена. */
export function buildSteps(unit){
  const steps = [];
  let ctx = [];
  unit.blocks.forEach(b => {
    if(b.type === "task" || b.type === "quiz"){
      steps.push({kind:b.type, ctx, main:b});
      ctx = [];
    }else{
      ctx.push(b);
    }
  });
  if(ctx.length) steps.push({kind:"learn", ctx, main:null});
  steps.forEach((s, i) => { s.i = i; s.id = unit.id + ":" + i; });
  return steps;
}
export const stepDone = s =>
  s.kind === "task" ? taskDone(s.main.id) :
  s.kind === "quiz" ? quizDone(s.main.id) : isSeen(s.id);

export const firstUndoneStep = steps => {
  const i = steps.findIndex(s => !stepDone(s));
  return i < 0 ? 0 : i;
};

/* ── курс целиком ────────────────────────────────────────── */
export const courseTotals = () => {
  const us = units();
  return {
    units: us.length,
    unitsDone: us.filter(unitDone).length,
    tasks: us.reduce((a,u) => a + tasksOf(u).length, 0),
    tasksDone: us.reduce((a,u) => a + tasksOf(u).filter(t => taskDone(t.id)).length, 0),
    quizzes: us.reduce((a,u) => a + quizzesOf(u).length, 0),
    quizzesDone: us.reduce((a,u) => a + quizzesOf(u).filter(q => quizDone(q.id)).length, 0),
    xpTotal: us.reduce((a,u) => a + u.blocks.reduce((b,x) => b + (x.xp || 0), 0), 0),
  };
};

/* ── уровни ──────────────────────────────────────────────── */
/* Шаг между уровнями растёт: 60, 70, 80 … Весь курс — примерно
   восьмой уровень, так что лестница не кончается раньше курса. */
const LEVELS = (() => {
  const out = [0];
  for(let n = 1; n < 14; n++) out.push(out[n-1] + 50 + 10*n);
  return out;
})();
export function levelOf(xp){
  let lv = 1;
  while(lv < LEVELS.length && xp >= LEVELS[lv]) lv++;
  const from = LEVELS[lv-1], to = LEVELS[lv] ?? from;
  return {level:lv, from, to, inLevel:xp - from, need:Math.max(0, to - xp), span:Math.max(1, to - from)};
}

/* ── повторение ──────────────────────────────────────────── */
/* Юнит закрыт неделю назад и с тех пор не открывался — пора вернуться. */
export function reviewDue(days = 7){
  const log = store.state.log || [];
  const when = {};
  log.forEach(e => {
    const u = units().find(x => x.blocks.some(b => b.id === e.task));
    if(u && (!when[u.id] || e.ts > when[u.id])) when[u.id] = e.ts;
  });
  const edge = Date.now() - days*864e5;
  return units()
    .map((u, i) => ({u, i, ts:when[u.id]}))
    .filter(x => unitDone(x.u) && x.ts && Date.parse(x.ts) < edge);
}

/* ── обновление состояния ────────────────────────────────── */
const listeners = new Set();
export const onState = fn => listeners.add(fn);
export function setState(next){
  if(!next) return;
  const before = store.state ? store.state.xp : 0;
  store.state = {...store.state, ...next};
  listeners.forEach(fn => fn(store.state, before));
}
