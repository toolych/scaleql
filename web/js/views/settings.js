/* Настройки в диалоге: цель, напоминания, горячие клавиши.
   Одно место, чтобы редактировать — а не две копии на разных экранах. */

import { store, setState } from "../store.js";
import * as api from "../api.js";
import { $, el, delegate, toast, esc } from "../ui.js";

export function openSettings(){
  const dlg = document.getElementById("dialog");
  const st = store.state;
  const browser = store.course.mode === "browser";

  dlg.innerHTML = `
    <div class="dialog__head">
      <h2 class="dialog__title" id="dialogTitle">Настройки</h2>
      <button class="icon-btn" data-act="close" aria-label="Закрыть">✕</button>
    </div>
    <div class="dialog__body stack stack--lg">

      <form class="stack" id="goalForm" novalidate>
        <div class="field">
          <label class="field__label" for="goalInput">Дневная цель, XP</label>
          <div class="row">
            <input class="input input--num" id="goalInput" type="number" inputmode="numeric"
              min="10" max="200" step="10" value="${st.goal}" aria-describedby="goalHint">
            <button class="btn btn--sm btn--primary" type="submit" data-role="save">Сохранить</button>
          </div>
          <p class="field__hint" id="goalHint">От 10 до 200. Одна задача — от 10 до 30 XP.
            Цель закрывается — серия дней продолжается.</p>
          <p class="field__error" id="goalError" hidden></p>
        </div>
      </form>

      <form class="stack" id="tgForm" novalidate>
        <div class="field">
          <span class="field__label">Напоминания в Telegram</span>
          <p class="field__hint">${browser
            ? "В версии для браузера напоминания присылает GitHub Actions по расписанию из репозитория."
            : st.tg.chat_id
              ? "Чат подключён. Бот пишет, если за день цель не набрана."
              : store.course.tg_ready
                ? "Открой бота в Telegram, напиши ему любое сообщение и нажми «Подключить»."
                : "Токен бота не задан в .env — напоминания выключены."}</p>
        </div>
        <div class="row" ${browser ? "hidden" : ""}>
          <button class="btn btn--sm ${st.tg.chat_id ? "btn--ghost" : "btn--primary"}" type="button"
            data-act="link" ${store.course.tg_ready ? "" : "disabled"}>
            ${st.tg.chat_id ? "Переподключить" : "Подключить"}</button>
          <label class="field__label" for="hourInput">Время</label>
          <input class="input input--num" id="hourInput" type="number" inputmode="numeric"
            min="0" max="23" step="1" value="${st.tg.hour}" aria-label="Час напоминания">
          <button class="btn btn--sm btn--ghost" type="submit">Сохранить время</button>
        </div>
        <p class="field__hint" id="tgResult" role="status"></p>
      </form>

      <div class="stack stack--sm">
        <span class="field__label">Горячие клавиши</span>
        <table class="kbd-table">
          ${[["Cmd / Ctrl + Enter", "проверить решение"],
             ["1 – 4", "выбрать вариант в вопросе"],
             ["Enter", "перейти к следующему шагу"],
             ["Esc", "вернуться на карту курса"],
             ["Tab", "отступ в редакторе"]].map(([k, v]) =>
            `<tr><td><span class="kbd">${esc(k)}</span></td><td>${esc(v)}</td></tr>`).join("")}
        </table>
      </div>
    </div>
    <div class="dialog__foot">
      <button class="btn btn--ghost btn--sm" data-act="close">Закрыть</button>
    </div>`;

  delegate(dlg, "click", "[data-act]", async (e, btn) => {
    if(btn.dataset.act === "close") return dlg.close();
    if(btn.dataset.act === "link"){
      const box = $("#tgResult", dlg);
      btn.disabled = true;
      box.innerHTML = `<span class="spinner" aria-hidden="true"></span> Ищу твой чат…`;
      const r = await api.linkTg();
      btn.disabled = false;
      box.textContent = r.netError ? r.message : r.message;
      if(r.state) setState(r.state);
    }
  });

  $("#goalForm", dlg).addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("#goalInput", dlg), err = $("#goalError", dlg);
    const value = Number(input.value);
    if(!Number.isFinite(value) || value < 10 || value > 200){
      input.setAttribute("aria-invalid", "true");
      err.hidden = false;
      err.textContent = "Цель должна быть от 10 до 200 XP.";
      return;
    }
    input.removeAttribute("aria-invalid");
    err.hidden = true;
    const btn = $('[data-role="save"]', dlg);
    btn.disabled = true;
    const r = await api.saveGoal(value);
    btn.disabled = false;
    if(r.netError) return toast(r.message, "bad");
    setState(r);
    toast("Цель сохранена", "ok");
  });

  $("#tgForm", dlg).addEventListener("submit", async e => {
    e.preventDefault();
    const hour = Number($("#hourInput", dlg).value);
    if(!Number.isFinite(hour) || hour < 0 || hour > 23) return toast("Час — число от 0 до 23", "bad");
    const r = await api.saveHour(hour);
    if(r.netError) return toast(r.message, "bad");
    setState(r);
    toast("Время сохранено", "ok");
  });

  dlg.showModal();
}
