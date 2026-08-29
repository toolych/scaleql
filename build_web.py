#!/usr/bin/env python
"""Собирает статическую версию ScaleQL в web/: данные, программу курса, схему.

    .venv/bin/python build_web.py

После правок в platform/curriculum.py запускать обязательно — иначе на сайте
останется старая программа.
"""
import json, os, sys
import duckdb

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE, "platform"))
from curriculum import UNITS

TABLES = ["users", "subscriptions", "payments", "events", "marketing_spend"]
WEB = os.path.join(BASE, "web")
os.makedirs(os.path.join(WEB, "data"), exist_ok=True)

con = duckdb.connect(os.path.join(BASE, "data", "saas.duckdb"), read_only=True)

for t in TABLES:
    out = os.path.join(WEB, "data", f"{t}.parquet")
    con.execute(f"COPY {t} TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    print(f"{t:17} {os.path.getsize(out)//1024:>5} KB")

json.dump({"units": UNITS}, open(os.path.join(WEB, "course.json"), "w", encoding="utf-8"),
          ensure_ascii=False)

schema = []
for (t,) in con.execute("SELECT table_name FROM information_schema.tables ORDER BY table_name").fetchall():
    cols = con.execute("SELECT column_name, data_type FROM information_schema.columns "
                       "WHERE table_name=? ORDER BY ordinal_position", [t]).fetchall()
    n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    schema.append({"table": t, "rows": n, "columns": [{"name": c, "type": d} for c, d in cols]})
json.dump(schema, open(os.path.join(WEB, "schema.json"), "w", encoding="utf-8"), ensure_ascii=False)

bad = 0
for u in UNITS:
    for b in u["blocks"]:
        if b["type"] in ("task", "ex"):
            q = b.get("ref") or b["sql"]
            try:
                rows = con.sql(q).fetchall()
                if b["type"] == "task" and not rows:
                    print("ПУСТО:", b["id"]); bad += 1
            except Exception as e:
                print("ОШИБКА:", b.get("id"), str(e)[:90]); bad += 1

tasks = sum(1 for u in UNITS for b in u["blocks"] if b["type"] == "task")
quizzes = sum(1 for u in UNITS for b in u["blocks"] if b["type"] == "quiz")
print(f"\nюнитов {len(UNITS)} · задач {tasks} · тестов {quizzes} · проблем {bad}")
print("готово:", WEB)
