# -*- coding: utf-8 -*-
"""ScaleQL — программа курса. Юниты → блоки: text / ex / task / quiz."""
import re as _re
import diagrams as D

_BREAK = ["FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "JOIN", "LEFT JOIN"]

def fmt(sql):
    s = " ".join(sql.split())
    for kw in sorted(_BREAK, key=len, reverse=True):
        s = _re.sub(r"(?i)(?<!\n)\s+(" + kw.replace(" ", r"\s+") + r")\b", r"\n\1", s)
    lines = []
    for ln in s.split("\n"):
        ln = ln.strip()
        m = _re.match(r"(?i)^(SELECT|FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|LEFT JOIN|JOIN)\b\s*(.*)$", ln)
        if m:
            head, rest = m.group(1).upper(), m.group(2)
            lines.append(f"{head} {rest}" if head == "LEFT JOIN" else f"{head:<9}{rest}")
        else:
            lines.append(ln)
    return "\n".join(lines)

def T(html):         return {"type": "text", "html": html.strip()}
def E(sql, note=""): return {"type": "ex", "sql": fmt(sql), "note": note}
def Q(id, prompt, ref, ordered=False, hints=(), xp=10):
    return {"type": "task", "id": id, "prompt": prompt, "ref": ref.strip(),
            "ordered": ordered, "hints": list(hints), "xp": xp}
def V(id, q, options, answer, explain, xp=5):
    return {"type": "quiz", "id": id, "q": q, "options": list(options),
            "answer": answer, "explain": explain, "xp": xp}

UNITS = [

{"id": "u1", "icon": "▤", "title": "Первые запросы", "sub": "SELECT · FROM · LIMIT", "blocks": [
 T("""<p>База — набор таблиц. Таблица устроена как лист в Google Таблицах: колонки
 сверху, строки данных под ними. SQL — способ текстом сказать, какие строки и какие
 колонки тебе нужны.</p>
 <table class="g">
 <tr><td><code>SELECT</code></td><td>что показать — список колонок через запятую</td></tr>
 <tr><td><code>FROM</code></td><td>откуда взять — имя таблицы</td></tr>
 <tr><td><code>LIMIT</code></td><td>сколько строк показать</td></tr></table>
 <p>Звёздочка <code>*</code> значит «все колонки».</p>""" + D.anatomy()),
 E("SELECT * FROM users LIMIT 3", "Три строки таблицы пользователей целиком."),
 E("SELECT user_id, country FROM users LIMIT 5", "Только две нужные колонки."),
 Q("t1", "Покажи пять строк из <code>payments</code>: колонки <code>user_id</code>, <code>amount</code>, <code>status</code>.",
   "SELECT user_id, amount, status FROM payments LIMIT 5",
   hints=["SELECT, три колонки через запятую, потом FROM payments.", "В конце LIMIT 5."]),
 T("""<p>В ответе один <code>user_id</code> встречается несколько раз. Строка в
 <code>payments</code> — это платёж, а не человек: он платит каждый месяц, и каждый
 платёж занимает свою строку. Путаница «строка = человек» даёт половину ошибок в отчётах.</p>"""),
 V("q1", "Что вернёт <code>SELECT * FROM subscriptions LIMIT 10</code>?",
   ["Первые 10 строк таблицы со всеми колонками", "10 случайных строк",
    "Все строки, но только 10 колонок", "Ошибку: LIMIT нельзя без WHERE"],
   0, "LIMIT ограничивает строки, а не колонки. Порядок без ORDER BY база не гарантирует, но это не случайная выборка."),
 Q("t2", "Покажи 8 строк из таблицы <code>subscriptions</code> — все колонки.",
   "SELECT * FROM subscriptions LIMIT 8", hints=["Звёздочка вместо списка колонок."]),
 V("q2", "Сколько строк вернёт запрос по <code>payments</code> без LIMIT?",
   ["6580 — все строки таблицы", "100 по умолчанию", "1", "Ошибку"],
   0, "Без LIMIT возвращается всё, что подошло. На больших таблицах это способ подвесить себя и базу."),
]},

{"id": "u2", "icon": "⌦", "title": "Фильтры", "sub": "WHERE · AND · IN · NULL", "blocks": [
 T("""<p><code>WHERE</code> ставится после <code>FROM</code> и оставляет только строки,
 где условие истинно.</p>
 <table class="g">
 <tr><td><code>=</code></td><td>равно — одно равно, не два</td></tr>
 <tr><td><code>&gt; &lt; &gt;= &lt;=</code></td><td>сравнение чисел и дат</td></tr>
 <tr><td><code>&lt;&gt;</code></td><td>не равно</td></tr>
 <tr><td><code>AND</code> / <code>OR</code></td><td>оба условия / хотя бы одно</td></tr>
 <tr><td><code>BETWEEN a AND b</code></td><td>диапазон, границы включаются</td></tr>
 <tr><td><code>IN ('a','b')</code></td><td>значение из списка</td></tr></table>
 <p>Текст и даты — в одинарных кавычках. Числа — без.</p>""" + D.where_filter()),
 E("SELECT user_id, amount, status FROM payments WHERE status = 'failed' LIMIT 5",
   "Только платежи, которые не прошли."),
 E("SELECT user_id, signup_dt, channel FROM users WHERE channel IN ('social','referral') AND country = 'RU' LIMIT 5",
   "Канал из списка И страна Россия."),
 Q("t3", "Покажи <code>payment_id</code>, <code>user_id</code>, <code>amount</code> по платежам со статусом <code>failed</code> и суммой больше 900. Первые 10 строк.",
   "SELECT payment_id, user_id, amount FROM payments WHERE status='failed' AND amount>900 LIMIT 10",
   hints=["Два условия соединяются словом AND.", "WHERE status = 'failed' AND amount > 900"]),
 V("q3", "Почему <code>WHERE payment_id = 'failed'</code> даёт Conversion Error?",
   ["Условие повешено не на ту колонку: payment_id — число, статус лежит в status",
    "Нельзя сравнивать через одно равно", "Текст надо писать в двойных кавычках", "Забыт LIMIT"],
   0, "База пытается превратить 'failed' в число и не может. Conversion Error почти всегда значит: условие не на той колонке."),
 T("""<p>Пустые значения. <code>NULL</code> — это не ноль и не пустая строка, а
 «значения нет». Сравнивать с ним через <code>=</code> нельзя: результат не истина
 и не ложь, а неизвестность, и строка в ответ не попадёт.</p>
 <p class="rule">Для пустых значений есть отдельные слова: <code>IS NULL</code> и
 <code>IS NOT NULL</code>.</p>"""),
 E("SELECT COUNT(*) AS aktivnyh FROM subscriptions WHERE ended_at IS NULL",
   "Подписки без даты окончания — живые на сегодня."),
 Q("t4", "Сколько подписок уже закончились? Одна колонка с числом.",
   "SELECT COUNT(*) AS zakonchilis FROM subscriptions WHERE ended_at IS NOT NULL",
   hints=["Закончились = дата окончания проставлена.", "WHERE ended_at IS NOT NULL"]),
 Q("t5", "Покажи все платежи пользователя <code>user_id</code> = 74, все колонки.",
   "SELECT * FROM payments WHERE user_id = 74", hints=["Число в кавычки не берут."]),
 V("q4", "Что вернёт <code>WHERE ended_at = NULL</code>?",
   ["Ноль строк — сравнение с NULL всегда неизвестность", "Все строки с пустой датой",
    "Ошибку синтаксиса", "Все строки таблицы"],
   0, "Запрос выполнится, ошибки не будет, ответ пустой. Нужно IS NULL."),
]},

{"id": "u3", "icon": "↕", "title": "Сортировка и вычисления", "sub": "ORDER BY · арифметика · ROUND", "blocks": [
 T("""<p><code>ORDER BY</code> сортирует ответ: <code>DESC</code> — по убыванию.
 Ставится после фильтров, перед <code>LIMIT</code>. Связка
 <code>ORDER BY ... DESC LIMIT 10</code> — это «топ-10», самый частый запрос аналитика.</p>"""),
 E("SELECT payment_id, user_id, amount FROM payments WHERE status='success' ORDER BY amount DESC LIMIT 5",
   "Пять самых крупных успешных платежей — это годовые подписки."),
 T("""<p>В <code>SELECT</code> можно считать: <code>+ - * /</code>, скобки, функции.
 Новой колонке дают имя через <code>AS</code>.</p>
 <p class="rule">Деление целых даёт целое: <code>3/4</code> = 0. Чтобы получить дробь,
 одно число делают дробным: <code>100.0 * a / b</code>. На этом теряют проценты чаще,
 чем на чём-либо ещё.</p>"""),
 E("SELECT amount, ROUND(amount * 0.77, 2) AS za_vychetom_komissii FROM payments WHERE status='success' LIMIT 5",
   "Сколько остаётся после комиссии 23%. ROUND(x, 2) — до двух знаков."),
 Q("t6", "Покажи 10 самых ранних регистраций: <code>user_id</code>, <code>signup_dt</code>, <code>channel</code>, от старых к новым.",
   "SELECT user_id, signup_dt, channel FROM users ORDER BY signup_dt LIMIT 10", ordered=True,
   hints=["По возрастанию — просто ORDER BY signup_dt."]),
 Q("t7", "Топ-10 успешных платежей по сумме: <code>user_id</code>, <code>amount</code>, <code>paid_at</code>, от большего к меньшему.",
   "SELECT user_id, amount, paid_at FROM payments WHERE status='success' ORDER BY amount DESC LIMIT 10", ordered=True,
   hints=["Фильтр по статусу, потом ORDER BY amount DESC, потом LIMIT."]),
 Q("t8", "Для 10 первых успешных платежей покажи <code>payment_id</code>, <code>amount</code> и колонку <code>chistymi</code> — сумму минус комиссия 23%, округлённую до 2 знаков. Сортировка по payment_id.",
   "SELECT payment_id, amount, ROUND(amount * 0.77, 2) AS chistymi FROM payments WHERE status='success' ORDER BY payment_id LIMIT 10", ordered=True,
   hints=["Минус 23% — значит умножить на 0.77.", "ROUND(amount * 0.77, 2) AS chistymi"]),
 V("q5", "Чему равно <code>100 * (3 / 4)</code> в целых числах?",
   ["0 — скобка считается первой и даёт 0", "75", "0.75", "Ошибка деления"],
   0, "3/4 в целых числах это 0, дальше 100*0 = 0. Поэтому в формулах долей множитель 100.0 ставят первым: 100.0 * a / b."),
]},

{"id": "u4", "icon": "Σ", "title": "Агрегация", "sub": "COUNT · SUM · AVG · MIN · MAX", "blocks": [
 T("""<p>Агрегатная функция схлопывает много строк в одно число.</p>
 <table class="g">
 <tr><td><code>COUNT(*)</code></td><td>сколько строк</td></tr>
 <tr><td><code>SUM(колонка)</code></td><td>сумма</td></tr>
 <tr><td><code>AVG(колонка)</code></td><td>среднее</td></tr>
 <tr><td><code>MIN</code> / <code>MAX</code></td><td>наименьшее и наибольшее</td></tr></table>
 <p>Порядок работы базы: <code>FROM</code> берёт таблицу → <code>WHERE</code> выбрасывает
 строки → функция считает то, что осталось. Фильтр всегда до подсчёта.</p>"""),
 E("SELECT COUNT(*) AS platezhey, SUM(amount) AS summa, ROUND(AVG(amount),1) AS sredniy_chek FROM payments WHERE status='success'",
   "Сколько успешных платежей, на какую сумму, средний чек."),
 Q("t9", "По таблице <code>users</code>: сколько всего пользователей, самая ранняя и самая поздняя дата регистрации. Три колонки.",
   "SELECT COUNT(*) AS vsego, MIN(signup_dt) AS pervaya, MAX(signup_dt) AS poslednyaya FROM users",
   hints=["MIN и MAX работают и с датами."]),
 Q("t10", "Сколько денег не дошло из-за отказов? Сумма <code>amount</code> по статусу <code>failed</code>, одна колонка.",
   "SELECT SUM(amount) AS poteryano FROM payments WHERE status='failed'",
   hints=["Фильтр в WHERE, потом SUM."]),
 V("q6", "Чем <code>AVG(amount)</code> опасен как метрика среднего чека?",
   ["Редкие годовые подписки по 9480 ₽ вытянут среднее вверх, и оно перестанет описывать типичного клиента",
    "AVG не умеет считать деньги", "AVG игнорирует нули", "Ничем, это лучшая метрика центра"],
   0, "Среднее чувствительно к выбросам. Рядом всегда смотрят медиану: сильно разошлись — распределение перекошено."),
 E("SELECT ROUND(AVG(amount),1) AS srednee, MEDIAN(amount) AS mediana, MAX(amount) AS maksimum FROM payments WHERE status='success'",
   "Среднее выше медианы — это след годовых подписок в данных."),
 Q("t11", "По успешным платежам: среднее (округли до 1 знака), медиана, максимум суммы.",
   "SELECT ROUND(AVG(amount),1) AS srednee, MEDIAN(amount) AS mediana, MAX(amount) AS maksimum FROM payments WHERE status='success'",
   hints=["Три функции — три колонки."]),
 V("q7", "Что вернёт <code>COUNT(*)</code>, если под условие не подошла ни одна строка?",
   ["Одну строку с нулём", "Ноль строк, пустой ответ", "NULL", "Ошибку"],
   0, "Агрегат по пустому набору всё равно даёт строку: COUNT — 0, SUM и AVG — NULL."),
]},
]

UNITS += [

{"id": "u5", "icon": "▦", "title": "Группировка", "sub": "GROUP BY", "blocks": [
 T("""<p><code>GROUP BY</code> раскладывает строки по кучкам и считает функцию внутри
 каждой. Это поле в области «строки» сводной таблицы. Больше он не делает ничего.</p>
 <p>В ответе будет одна строка на кучку, поэтому каждой колонке нужно правило, как
 схлопнуть кучку в одно значение.</p>
 <p class="rule">В SELECT при группировке допустимы только колонки из GROUP BY плюс
 агрегатные функции. Голая колонка запрещена: в кучке сотни разных значений, а место одно.</p>"""
 + D.groupby()),
 E("SELECT country, COUNT(*) AS users_count FROM users GROUP BY country ORDER BY users_count DESC",
   "Пользователи по странам."),
 E("SELECT status, COUNT(*) AS platezhey, SUM(amount) AS summa FROM payments WHERE payment_id BETWEEN 20 AND 27 GROUP BY status",
   "Восемь строк раскладываются на две кучки. Сверь руками: в кучке success шесть платежей по 990 и один на 9480 — вместе 15 420."),
 Q("t12", "По каждому статусу платежа: сколько платежей и на какую сумму. Три колонки, сортировка по количеству по убыванию.",
   "SELECT status, COUNT(*) AS payments_count, SUM(amount) AS total_amount FROM payments GROUP BY status ORDER BY payments_count DESC",
   ordered=True,
   hints=["Кучки по status — значит GROUP BY status.",
          "Количество — COUNT(*), деньги — SUM(amount), две отдельные колонки."]),
 Q("t13", "Сколько пользователей пришло по каждому каналу? Канал и количество, по убыванию.",
   "SELECT channel, COUNT(*) AS users_count FROM users GROUP BY channel ORDER BY users_count DESC",
   ordered=True, hints=["Таблица users, кучки по channel."]),
 V("q8", "Запрос <code>SELECT status, amount, COUNT(*) FROM payments GROUP BY status</code> — что не так?",
   ["amount без функции: в кучке много разных сумм, база не знает, какую показать",
    "COUNT нельзя вместе с другими колонками", "Не хватает ORDER BY", "Всё верно"],
   0, "Либо обернуть в функцию — SUM(amount), MAX(amount), — либо добавить в GROUP BY, но тогда кучки станут мельче."),
 T("""<p>Группировать можно сразу по нескольким колонкам. Тогда кучка — это уникальная
 пара значений, и строк в ответе будет столько, сколько таких пар встретилось.</p>"""),
 E("SELECT country, channel, COUNT(*) AS users_count FROM users GROUP BY country, channel ORDER BY users_count DESC LIMIT 8",
   "Два уровня группировки: страна и канал. Восемь самых крупных сочетаний."),
 Q("t14", "Сколько подписок каждого тарифа (<code>plan</code>) и какой у них средний <code>mrr</code>? Средний округли до 1 знака, сортировка по количеству по убыванию.",
   "SELECT plan, COUNT(*) AS podpisok, ROUND(AVG(mrr),1) AS sredniy_mrr FROM subscriptions GROUP BY plan ORDER BY podpisok DESC",
   ordered=True, hints=["Кучки по plan."]),
 Q("t15", "Сколько событий каждого типа (<code>event_name</code>) в таблице <code>events</code>? По убыванию количества.",
   "SELECT event_name, COUNT(*) AS sobytiy FROM events GROUP BY event_name ORDER BY sobytiy DESC",
   ordered=True, hints=["Одна таблица, кучки по event_name."]),
 V("q9", "Сколько строк вернёт <code>GROUP BY country, channel</code>, если стран 4, а каналов 6?",
   ["Не больше 24 — столько, сколько пар реально встретилось в данных",
    "Ровно 24 всегда", "10 — сумма 4 и 6", "4 — по числу стран"],
   0, "Группировка создаёт кучки только для тех сочетаний, что есть в данных. Пустые пары не появляются."),
]},

{"id": "u6", "icon": "#", "title": "COUNT изнутри", "sub": "NULL · DISTINCT · FILTER", "blocks": [
 T("""<p>Считать строки кажется простым, и поэтому здесь ошибаются чаще всего.
 У COUNT три формы, и они дают разные числа.</p>
 <table class="g">
 <tr><td><code>COUNT(*)</code></td><td>сколько <b>строк</b>, что бы в них ни лежало</td></tr>
 <tr><td><code>COUNT(колонка)</code></td><td>сколько строк, где в колонке <b>есть значение</b>: NULL пропускается</td></tr>
 <tr><td><code>COUNT(DISTINCT колонка)</code></td><td>сколько <b>разных</b> значений</td></tr></table>"""),
 E("SELECT COUNT(*) AS vsego_podpisok, COUNT(ended_at) AS zakonchilis, COUNT(*) - COUNT(ended_at) AS aktivnye FROM subscriptions",
   "У активной подписки дата окончания пустая. Разница между COUNT(*) и COUNT(ended_at) — число живых подписок. Так же проверяют заполненность любой колонки."),
 E("SELECT COUNT(*) AS platezhey, COUNT(DISTINCT user_id) AS lyudey FROM payments",
   "6580 платежей сделали 1670 человек. Один вопрос «сколько платящих» — числа отличаются вчетверо."),
 T("""<p class="rule">Первый вопрос перед любым COUNT: я считаю строки, события или людей?</p>"""),
 Q("t16", "Сколько разных пользователей встречается в таблице <code>events</code> и сколько всего событий? Две колонки.",
   "SELECT COUNT(*) AS sobytiy, COUNT(DISTINCT user_id) AS lyudey FROM events",
   hints=["Людей — COUNT(DISTINCT user_id)."]),
 T("""<p>Часто нужно посчитать не всё, а часть — с условием. Для этого есть
 <code>FILTER</code>: он навешивает условие на одну функцию, не трогая остальные колонки.
 Через <code>WHERE</code> так не выйдет — он выбросил бы строки сразу для всех колонок.</p>"""),
 E("SELECT COUNT(*) AS vsego, COUNT(*) FILTER (WHERE status='failed') AS otkazov, ROUND(100.0 * COUNT(*) FILTER (WHERE status='failed') / COUNT(*), 1) AS dolya FROM payments",
   "Всего платежей, отказов и доля отказов одним запросом."),
 Q("t17", "По месяцам: всего платежей, отказов и доля отказов в процентах с одним знаком. Месяц — <code>date_trunc('month', paid_at)</code>, сортировка по месяцу. Один месяц выбивается — заметь какой.",
   "SELECT date_trunc('month', paid_at) AS month, COUNT(*) AS vsego, COUNT(*) FILTER (WHERE status='failed') AS otkazov, ROUND(100.0 * COUNT(*) FILTER (WHERE status='failed') / COUNT(*), 1) AS dolya FROM payments GROUP BY month ORDER BY month",
   ordered=True,
   hints=["Группируй по date_trunc('month', paid_at).",
          "Доля = 100.0 * отказы / всего. Множитель 100.0, иначе целочисленное деление даст ноль."], xp=15),
 Q("t18", "Сколько разных людей платили успешно в каждом месяце? Месяц и число людей, по месяцу.",
   "SELECT date_trunc('month', paid_at) AS month, COUNT(DISTINCT user_id) AS lyudey FROM payments WHERE status='success' GROUP BY month ORDER BY month",
   ordered=True, hints=["Людей, а не платежи — COUNT(DISTINCT user_id)."]),
 V("q10", "В таблице 100 строк, в колонке <code>phone</code> заполнено 62. Что даст <code>COUNT(phone)</code>?",
   ["62 — NULL не считаются", "100", "38", "Ошибку"],
   0, "COUNT(колонка) — рабочий способ измерить заполненность поля в грязной выгрузке."),
 V("q11", "Чем <code>COUNT(*) FILTER (WHERE ...)</code> лучше, чем тот же фильтр в WHERE?",
   ["Позволяет в одном запросе считать и часть, и целое — а WHERE выбросит строки для всех колонок сразу",
    "Работает быстрее", "Это одно и то же", "FILTER умеет считать людей"],
   0, "Отсюда все доли и конверсии в одном запросе: часть и целое считаются рядом."),
]},

{"id": "u7", "icon": "⚑", "title": "HAVING", "sub": "фильтр по результату подсчёта", "blocks": [
 T("""<p><code>WHERE</code> фильтрует строки <b>до</b> группировки, <code>HAVING</code> —
 готовые кучки <b>после</b>. Условие на исходную колонку идёт в WHERE, условие на
 агрегат — в HAVING.</p>
 <pre class="skel">SELECT   что показать
FROM     откуда
WHERE    какие строки брать
GROUP BY по чему кучки
HAVING   какие кучки оставить
ORDER BY как сортировать
LIMIT    сколько строк</pre>""" + D.pipeline()),
 E("SELECT country, COUNT(*) AS users_count FROM users GROUP BY country HAVING COUNT(*) > 500 ORDER BY users_count DESC",
   "Только страны, где больше 500 пользователей."),
 Q("t19", "Какие каналы привели больше 800 пользователей? Канал и количество, по убыванию.",
   "SELECT channel, COUNT(*) AS users_count FROM users GROUP BY channel HAVING COUNT(*) > 800 ORDER BY users_count DESC",
   ordered=True, hints=["Условие на COUNT — значит HAVING, а не WHERE."]),
 Q("t20", "Найди пользователей, у которых больше 8 успешных платежей. Колонки: <code>user_id</code> и число платежей, по убыванию, первые 10.",
   "SELECT user_id, COUNT(*) AS platezhey FROM payments WHERE status='success' GROUP BY user_id HAVING COUNT(*) > 8 ORDER BY platezhey DESC LIMIT 10",
   ordered=True,
   hints=["Статус — в WHERE (условие на строку), число платежей — в HAVING (условие на кучку)."], xp=15),
 V("q12", "Куда поставить условие «только успешные платежи» при группировке по месяцам?",
   ["В WHERE — это условие на отдельную строку", "В HAVING — раз есть GROUP BY",
    "В ORDER BY", "Всё равно куда"],
   0, "WHERE отсекает строки до подсчёта, и считается уже только нужное. Поставить в HAVING нельзя: там доступны только агрегаты."),
 V("q13", "Что вернёт <code>HAVING SUM(amount) > 200000</code> без GROUP BY?",
   ["Одну строку по всей таблице, если сумма больше порога, иначе ничего",
    "Ошибку", "Все строки", "То же, что WHERE"],
   0, "Без GROUP BY вся таблица — одна кучка. HAVING проверяет её целиком."),
]},

{"id": "u8", "icon": "⋈", "title": "JOIN", "sub": "соединение таблиц", "blocks": [
 T("""<p>Данные разложены по таблицам, чтобы не дублировать: кто такой пользователь —
 в <code>users</code>, что он платил — в <code>payments</code>. Чтобы увидеть их рядом,
 таблицы соединяют по общей колонке.</p>
 <pre class="skel">FROM payments p
JOIN users u ON u.user_id = p.user_id</pre>
 <p><code>p</code> и <code>u</code> — короткие имена таблиц, чтобы не писать полное имя
 перед каждой колонкой. <code>ON</code> — по какому совпадению склеивать.</p>
 <p class="rule">JOIN размножает строки: если справа на одну строку слева приходится
 несколько совпадений, строк станет больше. COUNT(*) после этого считает уже не то,
 что кажется.</p>""" + D.join()),
 E("SELECT u.country, p.amount, p.status FROM payments p JOIN users u ON u.user_id = p.user_id LIMIT 5",
   "Страна пользователя оказалась рядом с его платежом."),
 E("SELECT COUNT(*) AS strok_posle_joina FROM users u JOIN payments p ON p.user_id = u.user_id",
   "Строк стало больше, чем пользователей: у каждого платящего несколько платежей."),
 Q("t21", "Сумма успешных платежей по странам. Страна и сумма, по убыванию суммы.",
   "SELECT u.country, SUM(p.amount) AS total_amount FROM payments p JOIN users u ON u.user_id=p.user_id WHERE p.status='success' GROUP BY u.country ORDER BY total_amount DESC",
   ordered=True, hints=["Соедини payments с users по user_id, потом группируй по country."]),
 Q("t22", "Сколько успешных платежей и на какую сумму пришло по каждому каналу за август 2026? Оставь каналы с суммой больше 200 000, сортировка по сумме по убыванию.",
   "SELECT u.channel, COUNT(*) AS payments_count, SUM(p.amount) AS total_amount FROM payments p JOIN users u ON u.user_id=p.user_id WHERE p.status='success' AND p.paid_at BETWEEN '2026-08-01' AND '2026-08-31' GROUP BY u.channel HAVING SUM(p.amount) > 200000 ORDER BY total_amount DESC",
   ordered=True,
   hints=["Канал в users, платежи в payments — нужен JOIN по user_id.",
          "Статус и даты — в WHERE, сумма — в HAVING."], xp=20),
 Q("t23", "Средний чек успешного платежа по тарифам: соедини <code>payments</code> с <code>subscriptions</code> по user_id, покажи <code>plan</code> и средний чек с одним знаком, по убыванию чека.",
   "SELECT s.plan, ROUND(AVG(p.amount),1) AS sredniy_chek FROM payments p JOIN subscriptions s ON s.user_id = p.user_id WHERE p.status='success' GROUP BY s.plan ORDER BY sredniy_chek DESC",
   ordered=True, hints=["Соединяем по user_id, группируем по plan."]),
 V("q14", "После <code>JOIN</code> таблицы пользователей с платежами <code>COUNT(*)</code> даёт 4184. Что это за число?",
   ["Число пар «пользователь + его платёж», то есть по сути число платежей у платящих",
    "Число пользователей", "Число платящих пользователей", "Ошибка в данных"],
   0, "Строки после соединения — артефакт склейки. Людей считают через COUNT(DISTINCT user_id)."),
]},

{"id": "u9", "icon": "⟕", "title": "LEFT JOIN", "sub": "когда совпадения нет", "blocks": [
 T("""<p><code>JOIN</code> оставляет только строки, где совпадение нашлось. Значит
 пользователи без единого платежа из ответа исчезнут — а именно они обычно и есть
 предмет анализа.</p>
 <p><code>LEFT JOIN</code> оставляет все строки левой таблицы, а где совпадения нет,
 подставляет <code>NULL</code> в колонки правой.</p>
 <p class="rule">После LEFT JOIN считай колонку правой таблицы, а не звёздочку:
 <code>COUNT(*)</code> посчитает и строки без совпадения, <code>COUNT(p.payment_id)</code> — нет.</p>"""),
 E("SELECT u.channel, COUNT(*) AS strok, COUNT(p.payment_id) AS platezhey, COUNT(DISTINCT u.user_id) AS lyudey FROM users u LEFT JOIN payments p ON p.user_id = u.user_id GROUP BY u.channel ORDER BY strok DESC LIMIT 4",
   "Три числа в строке, все верные, но отвечают на разные вопросы. Строки бизнесу не показывают."),
 Q("t24", "Сколько всего пользователей и сколько из них хоть раз платили успешно — по каждому каналу? Колонки: канал, всего, платящих. По числу пользователей, по убыванию.",
   "SELECT u.channel, COUNT(DISTINCT u.user_id) AS vsego, COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) AS platyaschih FROM users u LEFT JOIN payments p ON p.user_id=u.user_id GROUP BY u.channel ORDER BY vsego DESC",
   ordered=True,
   hints=["Нужен LEFT JOIN: неплатящие должны остаться в ответе.",
          "Платящих считаем COUNT(DISTINCT ...), иначе человек с пятью платежами посчитается пять раз."], xp=20),
 Q("t25", "Конверсия в оплату по каналам: канал, всего пользователей, платящих и доля платящих в процентах с одним знаком. По доле, по убыванию.",
   "SELECT u.channel, COUNT(DISTINCT u.user_id) AS vsego, COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) AS platyaschih, ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) / COUNT(DISTINCT u.user_id), 1) AS konversiya FROM users u LEFT JOIN payments p ON p.user_id=u.user_id GROUP BY u.channel ORDER BY konversiya DESC",
   ordered=True,
   hints=["Это предыдущая задача плюс одна колонка с долей.",
          "Доля = 100.0 * платящих / всего."], xp=25),
 T("""<p>Посмотри на результат последней задачи внимательно. Каналы, которые приводят
 больше всего людей, и каналы, которые приводят платящих, — это разные каналы. Отчёт
 «сколько регистраций по каналам» без колонки конверсии приводит к решению вкладывать
 деньги не туда.</p>"""),
 V("q15", "Пользователь не сделал ни одного платежа. Что вернёт по нему <code>COUNT(*)</code> после LEFT JOIN?",
   ["1 — строка есть, просто платёжные колонки пустые", "0", "NULL", "Он не попадёт в ответ"],
   0, "Ровно поэтому COUNT(*) после LEFT JOIN завышает: он считает и «пустые» строки."),
 V("q16", "Чем <code>JOIN</code> отличается от <code>LEFT JOIN</code> при подсчёте конверсии?",
   ["JOIN выбросит неплатящих, и конверсия получится 100%",
    "Ничем", "LEFT JOIN считает быстрее", "JOIN подставит нули вместо NULL"],
   0, "Самая дорогая ошибка в отчётах по конверсии: знаменатель теряет тех, кто не дошёл, и метрика становится бессмысленной."),
]},
]

UNITS += [

{"id": "u10", "icon": "◷", "title": "Даты и динамика", "sub": "date_trunc · интервалы · рост", "blocks": [
 T("""<p>Аналитик почти никогда не смотрит на «всего за всё время». Смысл появляется
 в динамике: как менялось по месяцам, неделям, дням.</p>
 <table class="g">
 <tr><td><code>date_trunc('month', d)</code></td><td>обрезает дату до начала месяца: 17 марта → 1 марта</td></tr>
 <tr><td><code>date_diff('day', a, b)</code></td><td>сколько дней между датами</td></tr>
 <tr><td><code>d + INTERVAL 7 DAY</code></td><td>сдвиг даты</td></tr>
 <tr><td><code>EXTRACT(dow FROM d)</code></td><td>день недели числом</td></tr></table>
 <p>Обрезка — главный приём: она превращает 365 разных дат в 12 групп, по которым уже
 можно группировать.</p>"""),
 E("SELECT date_trunc('month', signup_dt) AS mesyats, COUNT(*) AS registraciy FROM users GROUP BY mesyats ORDER BY mesyats",
   "Регистрации по месяцам — первая картинка, которую строят по любому продукту."),
 Q("t26", "Успешные платежи по месяцам: месяц, число платежей, сумма. По месяцу.",
   "SELECT date_trunc('month', paid_at) AS mesyats, COUNT(*) AS platezhey, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY mesyats ORDER BY mesyats",
   ordered=True, hints=["Обрезаем paid_at до месяца и группируем по этой колонке."]),
 Q("t27", "Сколько дней прожил каждый из 10 первых закончившихся подписок? Колонки: <code>sub_id</code>, <code>started_at</code>, <code>ended_at</code>, <code>dney</code>. Сортировка по sub_id.",
   "SELECT sub_id, started_at, ended_at, date_diff('day', started_at, ended_at) AS dney FROM subscriptions WHERE ended_at IS NOT NULL ORDER BY sub_id LIMIT 10",
   ordered=True, hints=["Только закончившиеся: ended_at IS NOT NULL.",
                        "date_diff('day', started_at, ended_at)"]),
 T("""<p>Средний срок жизни, посчитанный так, всегда занижен: подписки, которые ещё
 живы, в него не попадают, а живут они как раз дольше всех. Это называется смещением
 выжившего, и в отчётах по оттоку оно встречается постоянно.</p>"""),
 Q("t28", "Регистрации и число платящих по неделям за август 2026. Колонки: неделя (<code>date_trunc('week', signup_dt)</code>) и число регистраций. По неделе.",
   "SELECT date_trunc('week', signup_dt) AS nedelya, COUNT(*) AS registraciy FROM users WHERE signup_dt BETWEEN '2026-08-01' AND '2026-08-31' GROUP BY nedelya ORDER BY nedelya",
   ordered=True, hints=["Фильтр по датам в WHERE, обрезка до недели в SELECT и GROUP BY."]),
 V("q17", "Зачем обрезать дату через date_trunc, если можно группировать по самой дате?",
   ["Группировка по дате даст сотни строк по одной на день — динамику по ним не увидеть",
    "date_trunc работает быстрее", "Иначе база выдаст ошибку", "Чтобы отсортировать"],
   0, "Обрезка — это способ выбрать масштаб. День для инцидента, неделя для операционки, месяц для отчёта руководству."),
 V("q18", "Средний срок жизни подписки, посчитанный только по закончившимся, — что с ним не так?",
   ["Он занижен: живые подписки не учтены, а они живут дольше всех",
    "Он завышен", "Ничего, это верный способ", "Он не считается без ML"],
   0, "Смещение выжившего. Честно считают либо по когортам с одинаковым возрастом, либо через кривую удержания."),
]},

{"id": "u11", "icon": "⑂", "title": "CASE", "sub": "условия внутри запроса", "blocks": [
 T("""<p><code>CASE</code> — это «если … то … иначе» внутри SQL. Им размечают данные:
 разносят суммы по корзинам, помечают сегменты, считают части одного целого.</p>
 <pre class="skel">CASE WHEN условие THEN значение
     WHEN другое условие THEN другое значение
     ELSE значение по умолчанию
END</pre>"""),
 E("SELECT CASE WHEN amount >= 5000 THEN 'годовая' WHEN amount >= 900 THEN 'месячная' ELSE 'прочее' END AS tip, COUNT(*) AS platezhey, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY tip ORDER BY summa DESC",
   "Платежи разложены по типу подписки прямо в запросе — в данных такой колонки нет."),
 T("""<p>Второй приём: <code>SUM</code> и <code>COUNT</code> поверх <code>CASE</code>.
 Так считают доли и сегменты, когда FILTER недоступен (в старых базах его нет).</p>"""),
 E("SELECT COUNT(*) AS vsego, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS otkazov, ROUND(100.0 * SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) / COUNT(*), 1) AS dolya FROM payments",
   "То же, что FILTER, но через CASE: каждой строке ставим 1 или 0 и складываем единицы."),
 Q("t29", "Раздели пользователей на группы по стране: <code>'RU'</code> → «Россия», всё остальное → «Зарубеж». Колонки: группа и число пользователей, по убыванию.",
   "SELECT CASE WHEN country = 'RU' THEN 'Россия' ELSE 'Зарубеж' END AS gruppa, COUNT(*) AS lyudey FROM users GROUP BY gruppa ORDER BY lyudey DESC",
   ordered=True, hints=["CASE идёт прямо в SELECT, а потом по нему же группируем."]),
 Q("t30", "По каждому каналу посчитай успешные и отказавшие платежи в двух колонках. Колонки: канал, <code>uspeshnyh</code>, <code>otkazov</code>. По успешным, по убыванию.",
   "SELECT u.channel, COUNT(*) FILTER (WHERE p.status='success') AS uspeshnyh, COUNT(*) FILTER (WHERE p.status='failed') AS otkazov FROM payments p JOIN users u ON u.user_id=p.user_id GROUP BY u.channel ORDER BY uspeshnyh DESC",
   ordered=True, hints=["Соединяем таблицы, потом две функции с FILTER или с CASE внутри."], xp=15),
 Q("t31", "Разложи успешные платежи по корзинам суммы: до 1000 — «мелкий», от 1000 до 5000 — «средний», больше — «крупный». Колонки: корзина, число платежей, сумма. По сумме, по убыванию.",
   "SELECT CASE WHEN amount < 1000 THEN 'мелкий' WHEN amount <= 5000 THEN 'средний' ELSE 'крупный' END AS korzina, COUNT(*) AS platezhey, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY korzina ORDER BY summa DESC",
   ordered=True, hints=["Условия в CASE проверяются сверху вниз — первое подошедшее выигрывает."], xp=15),
 V("q19", "Почему в CASE важен порядок условий?",
   ["Проверка идёт сверху вниз, срабатывает первое подошедшее условие",
    "Порядок не важен", "База выбирает самое узкое условие", "Последнее условие всегда главное"],
   0, "Если поставить WHEN amount >= 900 первым, то платёж на 9480 попадёт в «месячные», потому что он тоже больше 900."),
]},

{"id": "u12", "icon": "⊂", "title": "Подзапросы и CTE", "sub": "запрос внутри запроса", "blocks": [
 T("""<p>Когда задача не решается одним проходом, её делят на шаги: сначала считаем
 промежуточную таблицу, потом работаем с ней. Для этого есть <code>WITH</code> —
 именованный подзапрос, он же CTE.</p>
 <pre class="skel">WITH имя AS (
    промежуточный запрос
)
SELECT ... FROM имя</pre>
 <p>Читается сверху вниз, как список шагов. Вложенные подзапросы в скобках делают то же
 самое, но читаются наизнанку, поэтому в аналитике почти всегда пишут WITH.</p>"""),
 E("WITH platezhi_po_lyudyam AS (SELECT user_id, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY user_id) SELECT ROUND(AVG(summa),1) AS srednee_na_cheloveka, MAX(summa) AS maksimum FROM platezhi_po_lyudyam",
   "Двухшаговый расчёт: сначала суммы по каждому человеку, потом среднее по этим суммам. В один проход это не считается — агрегат от агрегата запрещён."),
 T("""<p class="rule">Правило, которое стоит запомнить: <b>среднее по людям — это не
 среднее по строкам</b>. Средний чек и средняя выручка на клиента считаются на разных
 уровнях, и их постоянно путают.</p>"""),
 Q("t32", "Сколько в среднем успешных платежей приходится на одного платящего? Сначала посчитай платежи по каждому <code>user_id</code>, потом усредни. Одна колонка, округли до 2 знаков.",
   "WITH p AS (SELECT user_id, COUNT(*) AS n FROM payments WHERE status='success' GROUP BY user_id) SELECT ROUND(AVG(n),2) AS srednee FROM p",
   hints=["Первый шаг в WITH: COUNT(*) по каждому user_id.",
          "Второй шаг: AVG от полученной колонки."], xp=20),
 Q("t33", "Найди пользователей, которые заплатили суммарно больше 10 000 ₽. Колонки: <code>user_id</code>, сумма. По сумме, по убыванию, первые 10.",
   "SELECT user_id, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY user_id HAVING SUM(amount) > 10000 ORDER BY summa DESC LIMIT 10",
   ordered=True, hints=["Здесь CTE не нужен — хватает HAVING."]),
 Q("t34", "Средняя выручка на платящего по каналам. Шаг 1: сумма по каждому пользователю. Шаг 2: соединяем с users и усредняем по каналу. Колонки: канал, средняя выручка с 1 знаком. По убыванию.",
   "WITH p AS (SELECT user_id, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY user_id) SELECT u.channel, ROUND(AVG(p.summa),1) AS srednyaya_vyruchka FROM p JOIN users u ON u.user_id = p.user_id GROUP BY u.channel ORDER BY srednyaya_vyruchka DESC",
   ordered=True,
   hints=["В WITH считаем сумму по каждому платящему.", "Потом соединяем результат с users и группируем по каналу."], xp=25),
 V("q20", "Почему нельзя написать <code>AVG(SUM(amount))</code>?",
   ["Агрегат от агрегата запрещён — нужен второй шаг через WITH или подзапрос",
    "Можно, это работает", "Нужно поменять порядок функций", "Нужен ORDER BY"],
   0, "База считает агрегат один раз за проход. Двухуровневый расчёт требует двух проходов, и WITH ровно это и оформляет."),
 V("q21", "Чем WITH удобнее вложенного подзапроса?",
   ["Читается сверху вниз как шаги, каждый шаг можно назвать и выполнить отдельно",
    "Работает быстрее", "Позволяет больше строк", "Не требует GROUP BY"],
   0, "Скорость обычно одинаковая. Выигрыш в том, что запрос на 40 строк остаётся понятным через месяц."),
]},

{"id": "u13", "icon": "◫", "title": "Оконные функции", "sub": "ROW_NUMBER · SUM OVER · LAG", "blocks": [
 T("""<p>Агрегат схлопывает кучку в одну строку. Оконная функция считает по той же
 кучке, но <b>оставляет все строки на месте</b> — результат просто дописывается
 колонкой. Это нужно, когда рядом со строкой должен стоять её ранг, доля от общего
 или значение предыдущего месяца.</p>
 <pre class="skel">функция() OVER (PARTITION BY по_чему_бьём ORDER BY по_чему_сортируем)</pre>
 <p><code>PARTITION BY</code> — это «GROUP BY внутри окна», <code>ORDER BY</code> внутри
 скобок задаёт порядок для нумерации и накопления.</p>"""),
 E("SELECT user_id, paid_at, amount, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY paid_at) AS nomer_platezha FROM payments WHERE status='success' AND user_id IN (2,6) ORDER BY user_id, paid_at",
   "У каждого пользователя своя нумерация платежей: первый, второй, третий. Так находят первый заказ, повторные покупки, шаги воронки."),
 E("SELECT date_trunc('month', paid_at) AS mesyats, SUM(amount) AS summa, SUM(SUM(amount)) OVER (ORDER BY date_trunc('month', paid_at)) AS nakoplennym_itogom FROM payments WHERE status='success' GROUP BY mesyats ORDER BY mesyats",
   "Выручка по месяцам и она же накопленным итогом. Обычный SUM группирует, оконный SUM идёт по уже сгруппированным строкам."),
 Q("t35", "Пронумеруй успешные платежи каждого пользователя по дате. Колонки: <code>user_id</code>, <code>paid_at</code>, <code>amount</code>, <code>nomer</code>. Только пользователи 13 и 17, сортировка по user_id и дате.",
   "SELECT user_id, paid_at, amount, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY paid_at) AS nomer FROM payments WHERE status='success' AND user_id IN (13,17) ORDER BY user_id, paid_at",
   ordered=True, hints=["PARTITION BY user_id ORDER BY paid_at внутри OVER."], xp=20),
 T("""<p><code>LAG</code> достаёт значение предыдущей строки окна. Это стандартный способ
 посчитать прирост «месяц к месяцу» — без него пришлось бы соединять таблицу саму
 с собой.</p>"""),
 E("WITH m AS (SELECT date_trunc('month', paid_at) AS mesyats, SUM(amount) AS summa FROM payments WHERE status='success' GROUP BY mesyats) SELECT mesyats, summa, LAG(summa) OVER (ORDER BY mesyats) AS proshlyy_mesyats, ROUND(100.0 * (summa - LAG(summa) OVER (ORDER BY mesyats)) / LAG(summa) OVER (ORDER BY mesyats), 1) AS rost_proc FROM m ORDER BY mesyats",
   "Выручка, прошлый месяц и прирост в процентах. В первой строке прирост пустой — предыдущего месяца просто нет."),
 Q("t36", "Помесячная динамика числа платящих: месяц, число разных плательщиков, прошлый месяц через <code>LAG</code>. По месяцу.",
   "WITH m AS (SELECT date_trunc('month', paid_at) AS mesyats, COUNT(DISTINCT user_id) AS lyudey FROM payments WHERE status='success' GROUP BY mesyats) SELECT mesyats, lyudey, LAG(lyudey) OVER (ORDER BY mesyats) AS proshlyy FROM m ORDER BY mesyats",
   ordered=True, hints=["Сначала CTE с месяцами, потом LAG поверх него."], xp=20),
 Q("t37", "Топ-3 пользователя по сумме успешных платежей внутри каждой страны. Колонки: страна, user_id, сумма, место. Сортировка по стране и месту.",
   "WITH p AS (SELECT u.country, p.user_id, SUM(p.amount) AS summa FROM payments p JOIN users u ON u.user_id=p.user_id WHERE p.status='success' GROUP BY u.country, p.user_id), r AS (SELECT country, user_id, summa, ROW_NUMBER() OVER (PARTITION BY country ORDER BY summa DESC) AS mesto FROM p) SELECT country, user_id, summa, mesto FROM r WHERE mesto <= 3 ORDER BY country, mesto",
   ordered=True,
   hints=["Шаг 1: сумма по паре страна+пользователь.",
          "Шаг 2: ROW_NUMBER с PARTITION BY country ORDER BY summa DESC.",
          "Шаг 3: оставить строки, где номер не больше 3. Фильтровать по окну можно только на следующем шаге."], xp=30),
 V("q22", "Чем оконная функция отличается от обычного агрегата?",
   ["Она не схлопывает строки: считает по группе, но результат дописывает к каждой строке",
    "Работает быстрее", "Не требует GROUP BY, но схлопывает так же", "Считает только суммы"],
   0, "Отсюда всё, что нельзя сделать GROUP BY: ранги, доли от общего, накопленный итог, сравнение с прошлым периодом."),
 V("q23", "Почему <code>WHERE ROW_NUMBER() OVER (...) <= 3</code> не работает?",
   ["WHERE выполняется раньше окна — фильтровать по нему можно только на следующем шаге, в CTE или подзапросе",
    "ROW_NUMBER нельзя сравнивать с числом", "Нужен HAVING", "Нужны скобки"],
   0, "Порядок выполнения: WHERE → GROUP BY → оконные функции → SELECT. Окно ещё не посчитано, когда работает WHERE."),
]},

{"id": "u14", "icon": "◎", "title": "Продуктовые метрики", "sub": "воронка · когорты · retention", "blocks": [
 T("""<p>Последний юнит — то, ради чего всё предыдущее. Здесь нет новых конструкций,
 только сборка: воронка, когорты и удержание считаются тем, что ты уже знаешь.</p>
 <p><b>Воронка</b> — сколько людей дошло до каждого шага. Считается по людям
 (<code>COUNT(DISTINCT user_id)</code>), а не по событиям, и обязательно с долей от
 предыдущего шага.</p>"""),
 E("SELECT COUNT(DISTINCT u.user_id) AS registraciy, COUNT(DISTINCT e.user_id) FILTER (WHERE e.event_name='create_project') AS sozdali_proekt, COUNT(DISTINCT p.user_id) FILTER (WHERE p.status='success') AS zaplatili FROM users u LEFT JOIN events e ON e.user_id=u.user_id LEFT JOIN payments p ON p.user_id=u.user_id",
   "Три шага воронки одним запросом. LEFT JOIN обязателен: те, кто не дошёл, должны остаться в знаменателе."),
 Q("t38", "Воронка по каналам: канал, число регистраций, число заплативших и конверсия в процентах с 1 знаком. По конверсии, по убыванию.",
   "SELECT u.channel, COUNT(DISTINCT u.user_id) AS registraciy, COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) AS zaplatili, ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) / COUNT(DISTINCT u.user_id), 1) AS konversiya FROM users u LEFT JOIN payments p ON p.user_id=u.user_id GROUP BY u.channel ORDER BY konversiya DESC",
   ordered=True, hints=["Это задача 25 — если решил её, эта уже решена."], xp=20),
 T("""<p><b>Когорта</b> — группа людей, пришедших в один период. Сравнивать декабрьских
 новичков с августовскими напрямую нельзя: у них разный возраст. Когорты уравнивают
 возраст и показывают, меняется ли качество новых пользователей.</p>"""),
 E("SELECT date_trunc('month', signup_dt) AS kogorta, COUNT(*) AS prishlo, COUNT(DISTINCT s.user_id) AS oformili_podpisku, ROUND(100.0 * COUNT(DISTINCT s.user_id) / COUNT(*), 1) AS konversiya FROM users u LEFT JOIN subscriptions s ON s.user_id = u.user_id GROUP BY kogorta ORDER BY kogorta",
   "Конверсия в подписку по месячным когортам. Если она падает от месяца к месяцу — привлечение начало приводить кого-то не того."),
 Q("t39", "Когорты по месяцу регистрации: месяц, сколько пришло, сколько оформили подписку, конверсия в процентах с 1 знаком. По месяцу.",
   "SELECT date_trunc('month', u.signup_dt) AS kogorta, COUNT(DISTINCT u.user_id) AS prishlo, COUNT(DISTINCT s.user_id) AS oformili, ROUND(100.0 * COUNT(DISTINCT s.user_id) / COUNT(DISTINCT u.user_id), 1) AS konversiya FROM users u LEFT JOIN subscriptions s ON s.user_id = u.user_id GROUP BY kogorta ORDER BY kogorta",
   ordered=True, hints=["Когорта — date_trunc('month', signup_dt).",
                        "LEFT JOIN с subscriptions, чтобы не потерять тех, кто не оформил."], xp=25),
 T("""<p><b>Удержание</b> — сколько людей из когорты остались живы через N месяцев.
 Считается как доля от размера когорты, а не от прошлого месяца.</p>"""),
 Q("t40", "Сколько подписок каждой когорты (по месяцу старта) прожили больше 90 дней? Колонки: когорта, всего подписок, прожили больше 90 дней, доля в процентах с 1 знаком. По когорте.",
   "SELECT date_trunc('month', started_at) AS kogorta, COUNT(*) AS vsego, COUNT(*) FILTER (WHERE ended_at IS NULL OR date_diff('day', started_at, ended_at) > 90) AS dolgozhiteli, ROUND(100.0 * COUNT(*) FILTER (WHERE ended_at IS NULL OR date_diff('day', started_at, ended_at) > 90) / COUNT(*), 1) AS dolya FROM subscriptions GROUP BY kogorta ORDER BY kogorta",
   ordered=True,
   hints=["Живые подписки тоже считаются долгожителями: ended_at IS NULL.",
          "Условие внутри FILTER: ended_at IS NULL OR date_diff('day', started_at, ended_at) > 90."], xp=30),
 T("""<p class="rule">Обрати внимание на последние когорты в ответе: у них доля резко
 падает. Это не ухудшение продукта — просто эти подписки физически не успели прожить
 90 дней. Метрика, посчитанная по недозревшим когортам, врёт, и её либо обрезают, либо
 считают только по тем, у кого срок вышел.</p>"""),
 Q("t41", "Финальная. Сводка по каналам за всё время: канал, пользователей, платящих, выручка, конверсия в процентах, средняя выручка на платящего. Всё с 1 знаком после запятой, сортировка по выручке по убыванию.",
   "SELECT u.channel, COUNT(DISTINCT u.user_id) AS polzovateley, COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) AS platyaschih, ROUND(SUM(CASE WHEN p.status='success' THEN p.amount ELSE 0 END),1) AS vyruchka, ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END) / COUNT(DISTINCT u.user_id),1) AS konversiya, ROUND(SUM(CASE WHEN p.status='success' THEN p.amount ELSE 0 END) / COUNT(DISTINCT CASE WHEN p.status='success' THEN p.user_id END),1) AS na_platyaschego FROM users u LEFT JOIN payments p ON p.user_id=u.user_id GROUP BY u.channel ORDER BY vyruchka DESC",
   ordered=True,
   hints=["Собери по одной колонке за раз, проверяя результат кнопкой «Выполнить».",
          "Выручка: SUM(CASE WHEN p.status='success' THEN p.amount ELSE 0 END).",
          "Последняя колонка — выручка, делённая на число платящих."], xp=40),
 V("q24", "Почему воронку считают по людям, а не по событиям?",
   ["Один человек может сделать шаг многократно — по событиям конверсия окажется больше 100%",
    "События считать дольше", "Событий меньше", "Разницы нет"],
   0, "COUNT(DISTINCT user_id) на каждом шаге — базовое правило воронки."),
 V("q25", "Последняя когорта показывает удержание вдвое хуже остальных. Первая гипотеза?",
   ["Когорта не дозрела: у неё физически не прошло нужное время",
    "Продукт сломался", "Пришли плохие пользователи", "Ошибка в данных"],
   0, "Недозревшие когорты — самая частая причина «падения» метрики. Сначала проверяют возраст когорты, потом ищут причины в продукте."),
]},
]
