"""Генератор учебной базы: онлайн-сервис по подписке. Сентябрь 2025 — август 2026."""
import numpy as np, pandas as pd, duckdb, datetime as dt

rng = np.random.default_rng(7)
START, END = dt.date(2025, 9, 1), dt.date(2026, 8, 31)
DAYS = (END - START).days + 1

CHANNELS = ["organic", "seo", "context", "social", "referral", "email"]
CH_W     = [0.18, 0.14, 0.26, 0.22, 0.11, 0.09]
COUNTRY  = ["RU", "KZ", "BY", "AM"]
CO_W     = [0.74, 0.12, 0.09, 0.05]

# конверсия в оплату и качество канала: social даёт много регистраций и плохо платит
CONV = {"organic": .42, "seo": .38, "context": .30, "social": .14, "referral": .47, "email": .35}
# базовый месячный отток по каналу
CHURN = {"organic": .055, "seo": .06, "context": .085, "social": .155, "referral": .045, "email": .075}

N = 5200
signup_day = rng.integers(0, DAYS, N)
signup_day = np.sort(signup_day)
users = pd.DataFrame({
    "user_id": np.arange(1, N + 1),
    "signup_dt": [START + dt.timedelta(days=int(d)) for d in signup_day],
    "channel": rng.choice(CHANNELS, N, p=CH_W),
    "country": rng.choice(COUNTRY, N, p=CO_W),
})

subs, pays, evts = [], [], []
sub_id = pay_id = 1
for u in users.itertuples():
    ch = u.channel
    if rng.random() > CONV[ch]:
        # не платил, но какая-то активность была
        for _ in range(rng.poisson(2)):
            d = u.signup_dt + dt.timedelta(days=int(rng.integers(0, 14)))
            if d <= END:
                evts.append((u.user_id, d, rng.choice(["login", "create_project", "export"], p=[.7, .2, .1])))
        continue

    annual = rng.random() < 0.16
    plan = "annual" if annual else "monthly"
    mrr = 790.0 if annual else 990.0
    start = u.signup_dt + dt.timedelta(days=int(rng.integers(0, 15)))
    if start > END:
        continue

    # отток: в первый месяц выше, дальше затухает; годовые уходят реже
    base = CHURN[ch] * (0.45 if annual else 1.0)
    months_alive, m = 0, 0
    while True:
        m += 1
        hazard = base * (2.1 if m == 1 else 1.4 if m == 2 else 1.0)
        if start + dt.timedelta(days=30 * m) > END:
            months_alive = m
            ended = None
            break
        if rng.random() < hazard:
            months_alive = m
            ended = start + dt.timedelta(days=30 * m)
            break
        if m >= 24:
            months_alive, ended = m, None
            break

    subs.append((sub_id, u.user_id, plan, start, ended, mrr))

    step = 365 if annual else 30
    amount = 790 * 12 if annual else 990.0
    n_pay = max(1, months_alive // 12 if annual else months_alive)
    for k in range(n_pay):
        d = start + dt.timedelta(days=step * k)
        if d > END:
            break
        st = "success"
        r = rng.random()
        # сбой биллинга: 8–14 июня 2026 массовые отказы платежей
        outage = dt.date(2026, 6, 8) <= d <= dt.date(2026, 6, 14)
        if outage and rng.random() < 0.62:
            st = "failed"
        elif r < 0.047:
            st = "failed"
        elif r < 0.058:
            st = "refunded"
        pays.append((pay_id, u.user_id, d, amount, st))
        pay_id += 1

    # активность: выше у тех, кто дольше живёт
    for k in range(months_alive):
        for _ in range(rng.poisson(6 if months_alive > 3 else 2)):
            d = start + dt.timedelta(days=30 * k + int(rng.integers(0, 30)))
            if d <= END:
                evts.append((u.user_id, d,
                             rng.choice(["login", "create_project", "invite", "export"], p=[.62, .18, .08, .12])))
    sub_id += 1

subscriptions = pd.DataFrame(subs, columns=["sub_id", "user_id", "plan", "started_at", "ended_at", "mrr"])
payments = pd.DataFrame(pays, columns=["payment_id", "user_id", "paid_at", "amount", "status"])
events = pd.DataFrame(evts, columns=["user_id", "event_dt", "event_name"]).sort_values("event_dt")

spend_rows = []
for i in range(DAYS):
    d = START + dt.timedelta(days=i)
    for ch, base in [("context", 42000), ("social", 31000), ("email", 4200), ("seo", 9000)]:
        s = base * (0.75 + 0.5 * rng.random()) * (1 + 0.25 * np.sin(i / 40))
        spend_rows.append((d, ch, round(s, 2)))
marketing_spend = pd.DataFrame(spend_rows, columns=["date", "channel", "spend"])

con = duckdb.connect("data/saas.duckdb")
for name, df in [("users", users), ("subscriptions", subscriptions),
                 ("payments", payments), ("events", events), ("marketing_spend", marketing_spend)]:
    con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM df")
    print(f"{name:17} {len(df):>7} строк")
con.close()
