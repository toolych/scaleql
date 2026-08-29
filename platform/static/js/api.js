/* Сеть. Наружу отдаём либо данные, либо {netError:true} —
   пользователю никогда не показываем стек и статус-коды. */

async function req(url, body){
  const opt = body === undefined ? {}
    : {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)};
  let r;
  try{
    r = await fetch(url, opt);
  }catch{
    return {netError:true, message:"Сервер тренажёра не отвечает. Проверь, запущен ли ./start.sh."};
  }
  if(!r.ok) return {netError:true, message:"Сервер ответил ошибкой. Перезапусти ./start.sh и попробуй снова."};
  try{
    return await r.json();
  }catch{
    return {netError:true, message:"Ответ сервера не удалось прочитать."};
  }
}

export const getCourse = ()          => req("/api/course");
export const runSql    = sql         => req("/api/run",   {sql});
export const checkTask = (id, sql)   => req("/api/check", {task_id:id, sql});
export const answerQuiz= (id, choice)=> req("/api/quiz",  {quiz_id:id, choice});
export const saveGoal  = goal        => req("/api/goal",  {goal});
export const saveHour  = hour        => req("/api/tg/hour", {hour});
export const linkTg    = ()          => req("/api/tg/link", {});
