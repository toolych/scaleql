# -*- coding: utf-8 -*-
"""Схемы к урокам. Инлайновый SVG под тёмную тему платформы."""

C = dict(bg="#11161d", box="#1b212a", line="#2b3441", tx="#dfe5ee", dim="#8b95a5",
         acc="#6cc4ff", kw="#7dd3fc", ok="#5fd08a", warn="#f0b46c", red="#ff8f8f", str_="#a5e075")

def _wrap(inner, w, h, caption=""):
    return (f'<figure class="dia"><svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" '
            f'style="width:100%;height:auto">{inner}</svg>'
            + (f'<figcaption>{caption}</figcaption>' if caption else "") + '</figure>')

def _row(x, y, w, h, fill, stroke, text, tcolor, size=13, mono=True, anchor="start", tx=None):
    f = "ui-monospace,Menlo,monospace" if mono else "-apple-system,Segoe UI,sans-serif"
    tx = x + 10 if tx is None else tx
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}"/>'
            f'<text x="{tx}" y="{y+h/2+4.5}" fill="{tcolor}" font-size="{size}" '
            f'font-family="{f}" text-anchor="{anchor}">{text}</text>')

def _arrow(x1, y1, x2, y2, color=None):
    color = color or C["dim"]
    return (f'<defs><marker id="a{int(x1)}{int(y1)}" markerWidth="8" markerHeight="8" refX="7" refY="4" '
            f'orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="{color}"/></marker></defs>'
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.6" '
            f'marker-end="url(#a{int(x1)}{int(y1)})"/>')

def _label(x, y, text, color=None, size=12.5, anchor="start", mono=False, weight="normal"):
    f = "ui-monospace,Menlo,monospace" if mono else "-apple-system,Segoe UI,sans-serif"
    return (f'<text x="{x}" y="{y}" fill="{color or C["dim"]}" font-size="{size}" font-family="{f}" '
            f'text-anchor="{anchor}" font-weight="{weight}">{text}</text>')


def anatomy():
    p = []
    parts = [("SELECT", "user_id, amount, status", "какие колонки показать", C["kw"]),
             ("FROM", "payments", "из какой таблицы взять", C["kw"]),
             ("WHERE", "status = 'failed'", "какие строки оставить", C["kw"]),
             ("LIMIT", "5", "сколько строк вывести", C["kw"])]
    y = 18
    for kw, rest, note, col in parts:
        p.append(f'<rect x="14" y="{y}" width="330" height="38" rx="7" fill="{C["box"]}" stroke="{C["line"]}"/>')
        p.append(_label(28, y + 24, kw, col, 14, mono=True, weight="700"))
        p.append(_label(28 + 8 * len(kw) + 14, y + 24, rest, C["str_"] if "'" in rest else C["tx"], 13.5, mono=True))
        p.append(_arrow(350, y + 19, 388, y + 19))
        p.append(_label(396, y + 23, note, C["dim"], 13))
        y += 48
    return _wrap("".join(p), 620, y + 6, "Любой запрос — набор частей, каждая отвечает на свой вопрос. Порядок частей менять нельзя.")


def where_filter():
    p = [_label(14, 16, "все строки таблицы", C["dim"], 12)]
    data = [("990  success", False), ("990  success", False), ("990  failed", True),
            ("9480 success", False), ("990  failed", True), ("990  success", False)]
    y = 26
    for txt, keep in data:
        col = C["red"] if keep else C["dim"]
        fill = "#221a1a" if keep else C["box"]
        p.append(_row(14, y, 170, 26, fill, C["line"] if not keep else "#4a2f2f", txt, col, 12.5))
        y += 31
    p.append(f'<rect x="222" y="60" width="176" height="62" rx="8" fill="#141c25" stroke="{C["acc"]}"/>')
    p.append(_label(310, 86, "WHERE", C["kw"], 13.5, "middle", mono=True, weight="700"))
    p.append(_label(310, 106, "status = 'failed'", C["str_"], 12.5, "middle", mono=True))
    p.append(_arrow(190, 91, 218, 91))
    p.append(_arrow(402, 91, 432, 91))
    p.append(_label(440, 16, "в ответ попали только они", C["dim"], 12))
    p.append(_row(440, 66, 166, 26, "#221a1a", "#4a2f2f", "990  failed", C["red"], 12.5))
    p.append(_row(440, 97, 166, 26, "#221a1a", "#4a2f2f", "990  failed", C["red"], 12.5))
    return _wrap("".join(p), 620, 218,
                 "WHERE — сито. Он не считает и не меняет данные, только решает, какие строки пройдут дальше.")


def groupby():
    p = [_label(12, 14, "8 строк таблицы", C["dim"], 12)]
    rows = [("success", "990"), ("success", "990"), ("failed", "990"), ("success", "990"),
            ("success", "9480"), ("success", "990"), ("success", "990"), ("success", "990")]
    y = 24
    for st, am in rows:
        col = C["ok"] if st == "success" else C["warn"]
        p.append(_row(12, y, 132, 22, C["box"], C["line"], f'{st}', col, 11.5))
        p.append(_label(136, y + 15, am, C["tx"], 11.5, "end", mono=True, ))
        y += 26
    p.append(_arrow(152, 120, 184, 120))
    p.append(_label(190, 14, "GROUP BY status", C["kw"], 12.5, mono=True))
    p.append(f'<rect x="190" y="24" width="150" height="184" rx="8" fill="none" stroke="{C["line"]}" stroke-dasharray="4 4"/>')
    p.append(_label(200, 44, "кучка success", C["ok"], 11.5))
    yy = 52
    for am in ["990", "990", "990", "9480", "990", "990", "990"]:
        p.append(_row(200, yy, 128, 18, "#16231b", "#2c4433", am, C["tx"], 11))
        yy += 21
    p.append(f'<rect x="352" y="24" width="150" height="60" rx="8" fill="none" stroke="{C["line"]}" stroke-dasharray="4 4"/>')
    p.append(_label(362, 44, "кучка failed", C["warn"], 11.5))
    p.append(_row(362, 52, 128, 18, "#231e16", "#443a2c", "990", C["tx"], 11))
    p.append(_arrow(510, 60, 538, 60))
    p.append(_label(520, 130, "", C["dim"]))
    p.append(_arrow(510, 120, 538, 120))
    p.append(_label(546, 14, "ответ", C["dim"], 12))
    p.append(_row(546, 46, 62, 28, C["box"], C["line"], "7", C["ok"], 13, anchor="middle", tx=577))
    p.append(_row(546, 106, 62, 28, C["box"], C["line"], "1", C["warn"], 13, anchor="middle", tx=577))
    p.append(_label(577, 92, "COUNT(*)", C["acc"], 10.5, "middle", mono=True))
    p.append(_label(577, 152, "COUNT(*)", C["acc"], 10.5, "middle", mono=True))
    return _wrap("".join(p), 620, 220,
                 "GROUP BY только раскладывает строки по кучкам. Превращает кучку в одно число уже функция: COUNT считает строки, SUM складывает значения.")


def pipeline():
    steps = [("FROM", "берём таблицу"), ("WHERE", "отсекаем строки"), ("GROUP BY", "делим на кучки"),
             ("HAVING", "отсекаем кучки"), ("SELECT", "считаем колонки"), ("ORDER BY", "сортируем"),
             ("LIMIT", "обрезаем")]
    p, x = [], 8
    for i, (kw, note) in enumerate(steps):
        w = 84
        p.append(f'<rect x="{x}" y="26" width="{w}" height="46" rx="7" fill="{C["box"]}" stroke="{C["line"]}"/>')
        p.append(_label(x + w / 2, 46, kw, C["kw"], 11.5, "middle", mono=True, weight="700"))
        p.append(_label(x + w / 2, 62, note, C["dim"], 10, "middle"))
        if i < len(steps) - 1:
            p.append(_arrow(x + w + 2, 49, x + w + 12, 49))
        x += w + 14
    p.append(_label(8, 16, "порядок, в котором база на самом деле выполняет запрос", C["dim"], 12))
    return _wrap("".join(p), 700, 86,
                 "Пишем запрос в одном порядке, а выполняется он в другом. Отсюда правило: WHERE фильтрует строки до подсчёта, HAVING — готовые кучки после.")


def join():
    p = [_label(12, 14, "users", C["acc"], 12.5, mono=True)]
    p.append(_row(12, 24, 180, 26, C["box"], C["line"], "74   social   RU", C["tx"], 12))
    p.append(_label(12, 78, "payments", C["acc"], 12.5, mono=True))
    for i, a in enumerate(["74   990   success", "74   990   failed", "74   990   success"]):
        p.append(_row(12, 88 + i * 30, 180, 26, C["box"], C["line"], a, C["tx"], 12))
    p.append(_label(212, 60, "JOIN", C["kw"], 13, mono=True, weight="700"))
    p.append(_label(212, 78, "ON u.user_id", C["dim"], 11, mono=True))
    p.append(_label(212, 92, "   = p.user_id", C["dim"], 11, mono=True))
    p.append(_arrow(198, 40, 300, 40))
    p.append(_arrow(198, 100, 300, 100))
    p.append(_label(320, 14, "результат: 3 строки, пользователь продублирован", C["dim"], 12))
    for i, a in enumerate(["74  social  RU   990  success", "74  social  RU   990  failed", "74  social  RU   990  success"]):
        p.append(_row(320, 24 + i * 30, 288, 26, "#1a2029", "#33404f", a, C["tx"], 12))
    p.append(_label(320, 136, "COUNT(*) здесь посчитает платежи, а не людей", C["red"], 12))
    return _wrap("".join(p), 620, 190,
                 "Соединение размножает строки: на одного пользователя приходится столько строк, сколько у него платежей. Из-за этого COUNT(*) после JOIN почти всегда считает не то, что кажется.")
