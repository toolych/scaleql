/* Тот же контракт, что у серверного api.js, но всё считается в браузере:
   DuckDB-WASM вместо сервера, localStorage вместо state.json.
   Файл подставляется вместо api.js при сборке статической версии. */

import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

const TABLES = ["users", "subscriptions", "payments", "events", "marketing_spend"];
const KEY = "scaleql.v1";
const BLANK = {xp:0, tasks:{}, quizzes:{}, answers:{}, streak:{days:0, last:""},
               goal:30, history:{}, tg:{chat_id:"", hour:20}, log:[]};

let conn = null, COURSE = null;

/* ── прогресс ────────────────────────────────────────────── */
function load(){
  try{ return Object.assign(structuredClone(BLANK), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch{ return structuredClone(BLANK); }
}
let S = load();
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch{ /* приватный режим */ } };

/* Дата по местному времени: toISOString() отдаёт UTC и ночью сдвигает день. */
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function award(xp){
  const d = dayKey();
  if(S.streak.last !== d){
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    S.streak.days = S.streak.last === yesterday ? S.streak.days + 1 : 1;
    S.streak.last = d;
  }
  S.xp += xp;
  S.history[d] = (S.history[d] || 0) + xp;
}
const publicState = () => structuredClone(S);

/* ── база в браузере ─────────────────────────────────────── */
const boot = (text, pct) => {
  const msg = document.getElementById("bootMsg"), bar = document.getElementById("bootBar");
  if(msg && text) msg.textContent = text;
  if(bar && pct) bar.style.width = pct + "%";
};

async function initDb(){
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {type:"text/javascript"}));
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  boot("Готовлю данные: год работы сервиса по подписке.", 55);
  for(const t of TABLES){
    const buf = new Uint8Array(await (await fetch(`data/${t}.parquet`)).arrayBuffer());
    await db.registerFileBuffer(`${t}.parquet`, buf);
  }
  conn = await db.connect();
  for(const t of TABLES) await conn.query(`CREATE TABLE ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
}

function norm(v){
  if(v === null || v === undefined) return null;
  if(typeof v === "bigint") return Number(v);
  if(v instanceof Date) return v.toISOString().slice(0, 10);
  if(typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
  return v;
}

async function query(text){
  const res = await conn.query(text);
  const fields = res.schema.fields;
  const cols = fields.map(f => f.name);
  const isDate = fields.map(f => /date|timestamp/i.test(String(f.type)));
  const rows = res.toArray().map(r => {
    const o = r.toJSON();
    return cols.map((c, i) => {
      let v = o[c];
      if(isDate[i] && typeof v === "number") v = new Date(v).toISOString().slice(0, 10);
      if(isDate[i] && typeof v === "bigint") v = new Date(Number(v)).toISOString().slice(0, 10);
      return norm(v);
    });
  });
  return {columns:cols, rows, total:rows.length};
}

const ERR_RU = [
  [/column "(\w+)" must appear in the GROUP BY/, n => `Колонка «${n}» стоит в SELECT без агрегатной функции и её нет в GROUP BY. В кучке много разных значений — база не знает, какое показать. Оберни в функцию или добавь в GROUP BY.`],
  [/Table with name (\w+) does not exist/, n => `Таблицы «${n}» в базе нет. Проверь имя по списку таблиц.`],
  [/Referenced column "(\w+)" not found/, n => `Колонки «${n}» нет в таблицах из FROM. Проверь написание или добавь нужную таблицу.`],
  [/syntax error at or near "([^"]+)"/, n => `Синтаксическая ошибка рядом с «${n}». Обычно лишнее слово, пропущенная запятая или сбитый порядок: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.`],
  [/syntax error at end of input/, () => "Запрос оборван — не хватает последней части."],
  [/Conversion Error/, () => "Не сошлись типы: текст сравнивается с числом. Обычно условие повешено не на ту колонку."],
  [/aggregate function calls cannot be nested/, () => "Агрегат внутри агрегата запрещён. Нужен второй шаг: посчитай первый уровень в WITH, потом усредняй."],
  [/WHERE clause cannot contain window functions/, () => "По оконной функции нельзя фильтровать в WHERE — она считается позже. Оберни запрос в WITH и фильтруй на следующем шаге."],
  [/No function matches/, () => "Такой функции нет или ей переданы не те аргументы."],
];
const ruError = m => { for(const [re, f] of ERR_RU){ const x = m.match(re); if(x) return f(x[1]); } return null; };

const preview = (res, n = 150) => ({
  columns:res.columns, rows:res.rows.slice(0, n), total:res.total, truncated:res.total > n});

const findBlock = (id, type) => {
  for(const u of COURSE.units) for(const b of u.blocks) if(b.type === type && b.id === id) return b;
  return null;
};

/* ── публичный контракт (совпадает с серверным api.js) ───── */
export async function getCourse(){
  const bootBox = document.getElementById("boot");
  if(bootBox) bootBox.hidden = false;
  try{
    boot("Загружаю движок базы. Первый раз это несколько мегабайт, дальше — из кэша.", 20);
    const [course, schema] = await Promise.all([
      fetch("course.json").then(r => r.json()),
      fetch("schema.json").then(r => r.json()),
    ]);
    COURSE = course;
    await initDb();
    boot("Готово.", 100);
    return {units:course.units, schema, state:publicState(), today:dayKey(),
            tg_ready:false, mode:"browser"};
  }catch{
    return {netError:true, message:"Не удалось загрузить базу. Проверь интернет и обнови страницу."};
  }finally{
    if(bootBox) bootBox.hidden = true;
  }
}

export async function runSql(text){
  try{
    return preview(await query(text));
  }catch(e){
    const msg = String(e.message || e);
    return {error:msg, error_ru:ruError(msg)};
  }
}

export async function checkTask(id, text){
  const task = findBlock(id, "task");
  if(!task) return {ok:false, message:"Задача не найдена."};

  let got;
  try{
    got = await query(text);
  }catch(e){
    const msg = String(e.message || e);
    return {ok:false, error:msg, error_ru:ruError(msg), message:"Запрос не выполнился."};
  }
  const exp = await query(task.ref);

  if(got.columns.length !== exp.columns.length)
    return {ok:false, result:preview(got),
            message:`Колонок должно быть ${exp.columns.length}, а в ответе ${got.columns.length}.`};
  if(got.rows.length !== exp.rows.length)
    return {ok:false, result:preview(got),
            message:`Строк должно получиться ${exp.rows.length}, а вышло ${got.rows.length}. ` +
                    "Обычно это лишний или потерянный фильтр, либо не та группировка."};

  const key = rows => rows.map(r => r.map(String).join(""));
  const sameOrdered = key(got.rows).join("") === key(exp.rows).join("");
  const sameAny = key(got.rows).slice().sort().join("") === key(exp.rows).slice().sort().join("");
  const ok = task.ordered ? sameOrdered : sameAny;

  if(!ok && task.ordered && sameAny)
    return {ok:false, result:preview(got),
            message:"Значения верные, а порядок строк другой — проверь ORDER BY."};
  if(!ok)
    return {ok:false, result:preview(got),
            message:"Размер ответа сошёлся, а значения — нет. Сравни числа: скорее всего не та функция или не тот фильтр."};

  const first = S.tasks[id] !== "done";
  const xp = first ? (task.xp || 10) : 0;
  S.tasks[id] = "done";
  S.answers[id] = text;
  if(first){
    award(xp);
    S.log.push({ts:new Date().toISOString().slice(0, 19), task:id});
  }
  save();
  return {ok:true, result:preview(got), message:"Верно.", xp, state:publicState()};
}

export async function answerQuiz(id, choice){
  const q = findBlock(id, "quiz");
  if(!q) return {ok:false, message:"Вопрос не найден."};
  const right = Number(choice) === q.answer;
  let xp = 0;
  if(right && S.quizzes[id] !== "done"){
    xp = q.xp || 5;
    S.quizzes[id] = "done";
    award(xp);
  }
  save();
  return {ok:right, answer:q.answer, explain:q.explain, xp, state:publicState()};
}

export async function saveGoal(goal){
  S.goal = Math.max(10, Math.min(200, Number(goal) || 30));
  save();
  return publicState();
}

export async function saveHour(hour){
  S.tg.hour = Math.max(0, Math.min(23, Number(hour) || 20));
  save();
  return publicState();
}

export async function linkTg(){
  return {ok:false, message:"В версии для браузера напоминания настраиваются в репозитории, " +
                            "через GitHub Actions — не отсюда."};
}
