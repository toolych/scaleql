# -*- coding: utf-8 -*-
"""Напоминания ScaleQL в Telegram.

Запускается раз в час через launchd. Сам решает, пора ли писать:
шлёт сообщение один раз в день, в час из настроек, и только если
дневная цель ещё не закрыта.

  python3 bot.py           обычный прогон (для планировщика)
  python3 bot.py --now     отправить сразу, игнорируя час и цель
  python3 bot.py --test    проверить связь с ботом
"""
import json, os, sys, datetime, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, "state.json")
ENV = os.path.join(os.path.dirname(ROOT), ".env")

def token():
    if os.environ.get("TG_TOKEN"):
        return os.environ["TG_TOKEN"]
    if os.path.exists(ENV):
        for line in open(ENV, encoding="utf-8"):
            if line.strip().startswith("TG_TOKEN="):
                return line.split("=", 1)[1].strip()
    return ""

def api(method, **params):
    t = token()
    if not t:
        return {"ok": False, "description": "TG_TOKEN не найден (.env)"}
    url = f"https://api.telegram.org/bot{t}/{method}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.load(r)
    except Exception as e:
        return {"ok": False, "description": str(e)}

def state():
    return json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}

def save(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def text_for(st):
    today = datetime.date.today().isoformat()
    xp = st.get("history", {}).get(today, 0)
    goal = st.get("goal", 30)
    streak = st.get("streak", {}).get("days", 0)
    solved = len(st.get("tasks", {}))
    if xp == 0 and streak > 0:
        head = f"Серия {streak} дней под угрозой — сегодня ещё ноль."
    elif xp == 0:
        head = "Сегодня ещё не занимался."
    else:
        head = f"Сегодня {xp} XP из {goal}. Осталось {max(0, goal - xp)}."
    return (f"{head}\n"
            f"Решено задач: {solved} из 41. Серия: {streak} дн.\n"
            f"Открыть: http://localhost:8777")

def main():
    st = state()
    chat = st.get("tg", {}).get("chat_id")
    force = "--now" in sys.argv
    if "--test" in sys.argv:
        print(api("getMe")); return
    if not chat:
        print("chat_id не привязан: открой ScaleQL → Прогресс → Подключить"); return
    now = datetime.datetime.now()
    today = now.date().isoformat()
    if not force:
        if now.hour != int(st.get("tg", {}).get("hour", 20)):
            return
        if st.get("tg", {}).get("last_sent") == today:
            return
        if st.get("history", {}).get(today, 0) >= st.get("goal", 30):
            return
    r = api("sendMessage", chat_id=chat, text=text_for(st), disable_web_page_preview="true")
    if r.get("ok"):
        st.setdefault("tg", {})["last_sent"] = today
        save(st)
    print("отправлено" if r.get("ok") else "ошибка: " + str(r.get("description")))

if __name__ == "__main__":
    main()
