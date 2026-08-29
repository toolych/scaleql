# -*- coding: utf-8 -*-
"""ScaleQL — сервер тренажёра: уроки, проверка задач, XP, серия дней."""
import json, os, re, sys, datetime, decimal, mimetypes, urllib.request, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

import duckdb

ROOT = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(ROOT)
sys.path.insert(0, ROOT)
from curriculum import UNITS

DB = os.path.join(BASE, "data", "saas.duckdb")
STATE = os.path.join(ROOT, "state.json")
STATIC = os.path.join(ROOT, "static")
PORT = int(os.environ.get("SCALEQL_PORT", "8777"))
TG_TOKEN = os.environ.get("TG_TOKEN", "")

ERR_RU = [
 (r'column "(\w+)" must appear in the GROUP BY',
  'Колонка «{0}» стоит в SELECT без агрегатной функции и её нет в GROUP BY. '
  'В кучке много разных значений — база не знает, какое показать. Оберни в функцию или добавь в GROUP BY.'),
 (r'Table with name (\w+) does not exist', 'Таблицы «{0}» в базе нет. Проверь имя по списку таблиц.'),
 (r'Referenced column "(\w+)" not found',
  'Колонки «{0}» нет в таблицах из FROM. Проверь написание или добавь нужную таблицу.'),
 (r'syntax error at or near "([^"]+)"',
  'Синтаксическая ошибка рядом с «{0}». Обычно лишнее слово, пропущенная запятая или сбитый порядок: '
  'SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT.'),
 (r'syntax error at end of input', 'Запрос оборван — не хватает последней части.'),
 (r'Conversion Error', 'Не сошлись типы: текст сравнивается с числом. Обычно условие повешено не на ту колонку.'),
 (r'Binder Error: No function matches', 'Такой функции нет или ей переданы не те аргументы.'),
 (r'aggregate function calls cannot be nested',
  'Агрегат внутри агрегата запрещён. Нужен второй шаг: посчитай первый уровень в WITH, потом усредняй.'),
 (r'WHERE clause cannot contain window functions',
  'По оконной функции нельзя фильтровать в WHERE — она считается позже. Оберни запрос в WITH и фильтруй на следующем шаге.'),
]

def ru_error(msg):
    for pat, tpl in ERR_RU:
        m = re.search(pat, msg)
        if m:
            return tpl.format(*m.groups())
    return None

def norm(v):
    if isinstance(v, (float, decimal.Decimal)): return round(float(v), 2)
    if isinstance(v, (datetime.date, datetime.datetime)): return str(v)
    return v

def run_sql(sql, limit=200000):
    con = duckdb.connect(DB, read_only=True)
    try:
        rel = con.sql(sql)
        if rel is None: return {"columns": [], "rows": [], "total": 0}
        cols = list(rel.columns)
        rows = [[norm(v) for v in r] for r in rel.fetchmany(limit)]
        return {"columns": cols, "rows": rows, "total": len(rows)}
    finally:
        con.close()

def preview(res, n=150):
    return {"columns": res["columns"], "rows": res["rows"][:n],
            "total": res["total"], "truncated": res["total"] > n}

DEFAULT_STATE = {"xp": 0, "tasks": {}, "quizzes": {}, "answers": {},
                 "streak": {"days": 0, "last": ""}, "goal": 30, "history": {},
                 "tg": {"chat_id": "", "hour": 20}, "log": []}

def load_state():
    if os.path.exists(STATE):
        s = json.load(open(STATE, encoding="utf-8"))
        for k, v in DEFAULT_STATE.items(): s.setdefault(k, v)
        return s
    return json.loads(json.dumps(DEFAULT_STATE))

def save_state(s):
    json.dump(s, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def today(): return datetime.date.today().isoformat()

def award(st, xp):
    """Начисляет XP, двигает серию дней и дневную историю."""
    d, last = today(), st["streak"]["last"]
    if last != d:
        yest = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        st["streak"]["days"] = st["streak"]["days"] + 1 if last == yest else 1
        st["streak"]["last"] = d
    st["xp"] += xp
    st["history"][d] = st["history"].get(d, 0) + xp
    return st

def find_task(tid):
    for u in UNITS:
        for b in u["blocks"]:
            if b["type"] == "task" and b["id"] == tid: return u, b
    return None, None

def find_quiz(qid):
    for u in UNITS:
        for b in u["blocks"]:
            if b["type"] == "quiz" and b["id"] == qid: return u, b
    return None, None

def check(tid, sql):
    unit, task = find_task(tid)
    if not task: return {"ok": False, "message": "Задача не найдена."}
    try:
        got = run_sql(sql)
    except Exception as e:
        return {"ok": False, "error": str(e), "error_ru": ru_error(str(e)),
                "message": "Запрос не выполнился."}
    exp = run_sql(task["ref"])
    g, e = got["rows"], exp["rows"]
    if len(got["columns"]) != len(exp["columns"]):
        return {"ok": False, "result": preview(got),
                "message": f"Колонок должно быть {len(exp['columns'])}, а в ответе {len(got['columns'])}."}
    if len(g) != len(e):
        return {"ok": False, "result": preview(got),
                "message": f"Строк должно получиться {len(e)}, а вышло {len(g)}. "
                           "Обычно это лишний или потерянный фильтр, либо не та группировка."}
    same = (g == e) if task.get("ordered") else (sorted(map(str, g)) == sorted(map(str, e)))
    if not same and task.get("ordered") and sorted(map(str, g)) == sorted(map(str, e)):
        return {"ok": False, "result": preview(got),
                "message": "Значения верные, а порядок строк другой — проверь ORDER BY."}
    if not same:
        return {"ok": False, "result": preview(got),
                "message": "Размер ответа сошёлся, а значения — нет. Сравни числа: скорее всего не та функция или не тот фильтр."}
    st = load_state()
    first = st["tasks"].get(tid) != "done"
    xp = task.get("xp", 10) if first else 0
    st["tasks"][tid] = "done"
    st["answers"][tid] = sql
    if first:
        award(st, xp)
        st["log"].append({"ts": datetime.datetime.now().isoformat(timespec="seconds"), "task": tid})
    save_state(st)
    return {"ok": True, "result": preview(got), "message": "Верно.", "xp": xp, "state": public_state(st)}

def quiz(qid, choice):
    unit, q = find_quiz(qid)
    if not q: return {"ok": False, "message": "Вопрос не найден."}
    st = load_state()
    right = int(choice) == q["answer"]
    first = st["quizzes"].get(qid) != "done"
    xp = 0
    if right:
        if first:
            xp = q.get("xp", 5)
            st["quizzes"][qid] = "done"
            award(st, xp)
        save_state(st)
    return {"ok": right, "answer": q["answer"], "explain": q["explain"],
            "xp": xp, "state": public_state(st)}

def public_state(st):
    return {k: st[k] for k in ("xp", "tasks", "quizzes", "answers", "streak", "goal", "history", "tg")}

def schema():
    con = duckdb.connect(DB, read_only=True)
    out = []
    for (t,) in con.execute("SELECT table_name FROM information_schema.tables ORDER BY table_name").fetchall():
        cols = con.execute("SELECT column_name, data_type FROM information_schema.columns "
                           "WHERE table_name = ? ORDER BY ordinal_position", [t]).fetchall()
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        out.append({"table": t, "rows": n, "columns": [{"name": c, "type": d} for c, d in cols]})
    con.close()
    return out

def tg_call(method, **params):
    if not TG_TOKEN: return {"ok": False, "description": "TG_TOKEN не задан"}
    url = f"https://api.telegram.org/bot{TG_TOKEN}/{method}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.load(r)
    except Exception as e:
        return {"ok": False, "description": str(e)}

def tg_link():
    """Ищет chat_id: пользователь должен написать боту любое сообщение."""
    upd = tg_call("getUpdates", limit=10, offset=-10)
    if not upd.get("ok"):
        return {"ok": False, "message": "Бот недоступен: " + str(upd.get("description"))}
    chats = [u["message"]["chat"] for u in upd.get("result", []) if "message" in u]
    if not chats:
        return {"ok": False, "message": "Не вижу сообщений. Открой бота в Telegram и напиши ему «привет», потом нажми ещё раз."}
    chat = chats[-1]
    st = load_state(); st["tg"]["chat_id"] = str(chat["id"]); save_state(st)
    tg_call("sendMessage", chat_id=chat["id"],
            text="ScaleQL на связи. Буду напоминать про занятия и присылать серию дней.")
    return {"ok": True, "message": f"Подключено: {chat.get('first_name','') or chat['id']}", "state": public_state(st)}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self._send(200, open(os.path.join(STATIC, "index.html"), "rb").read(),
                              "text/html; charset=utf-8")
        if path.startswith("/static/"):
            fp = os.path.normpath(os.path.join(STATIC, path[len("/static/"):]))
            if fp.startswith(STATIC) and os.path.isfile(fp):
                ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
                if fp.endswith(".woff2"): ctype = "font/woff2"
                return self._send(200, open(fp, "rb").read(), ctype)
            return self._send(404, {"error": "not found"})
        if path == "/api/course":
            return self._send(200, {"units": UNITS, "schema": schema(),
                                    "state": public_state(load_state()),
                                    "today": today(), "tg_ready": bool(TG_TOKEN)})
        if path == "/api/state":
            return self._send(200, public_state(load_state()))
        self._send(404, {"error": "not found"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or "{}")
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/run":
            sql = (body.get("sql") or "").strip().rstrip(";")
            if not sql: return self._send(200, {"error_ru": "Пустой запрос."})
            try:
                return self._send(200, preview(run_sql(sql)))
            except Exception as e:
                return self._send(200, {"error": str(e), "error_ru": ru_error(str(e))})
        if path == "/api/check":
            return self._send(200, check(body.get("task_id"), (body.get("sql") or "").strip().rstrip(";")))
        if path == "/api/quiz":
            return self._send(200, quiz(body.get("quiz_id"), body.get("choice")))
        if path == "/api/goal":
            st = load_state(); st["goal"] = max(10, min(200, int(body.get("goal", 30)))); save_state(st)
            return self._send(200, public_state(st))
        if path == "/api/tg/link":
            return self._send(200, tg_link())
        if path == "/api/tg/hour":
            st = load_state(); st["tg"]["hour"] = max(0, min(23, int(body.get("hour", 20)))); save_state(st)
            return self._send(200, public_state(st))
        self._send(404, {"error": "not found"})

if __name__ == "__main__":
    print(f"ScaleQL: http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
