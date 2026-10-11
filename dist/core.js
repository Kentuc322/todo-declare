export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function weekKey(d = new Date()) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateKey(monday);
}
export function ensureWeekly(data) {
  if (!data.settings.weeklyPlans) data.settings.weeklyPlans = {};
  return data.settings.weeklyPlans;
}
export function score(day) {
  if(Number.isFinite(day?.endScore))return day.endScore;
  const tasks = day?.tasks || [];
  const weight = tasks.reduce((n,t)=>n+Number(t.weight),0);
  return weight ? Math.round(tasks.reduce((n,t)=>n+t.weight*t.progress,0)/weight) : 0;
}
export function closeDays(data,now=new Date()) {
  let changed=false;const today=dateKey(now);
  for(const [key,day]of Object.entries(data.days))if(key<today&&day.endScore===undefined){day.endScore=score(day);day.closedAt=new Date(`${key}T00:00:00`);day.closedAt.setDate(day.closedAt.getDate()+1);day.closedAt=day.closedAt.toISOString();changed=true;}
  return changed;
}
export function actualTime(value) {
  const minutes=Number(value);if(value===null||String(value).trim()===''||!Number.isInteger(minutes)||minutes<0||minutes>1440)throw Error('実績時間は0〜1440分の整数で入力してください。');return minutes;
}
export function validate(data) {
  if (!data || data.version !== 1 || !data.days || !data.settings) throw Error('対応していないバックアップです');
  for (const [key,day] of Object.entries(data.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(new Date(`${key}T12:00:00`))!==key || !Array.isArray(day.tasks) || day.tasks.length>100) throw Error('日付またはタスクが不正です');
    for (const t of day.tasks) if (typeof t.title!=='string' || t.title.length>200 || ![1,2,3].includes(t.weight) || !Number.isFinite(t.progress) || t.progress<0 || t.progress>100 || !Number.isFinite(t.minutes) || t.minutes<1 || t.minutes>480) throw Error('タスクの値が不正です');
    if(day.smallTasks!==undefined&&(!Array.isArray(day.smallTasks)||day.smallTasks.length>100))throw Error('小規模タスクが不正です');
    for(const task of [...day.tasks,...(day.smallTasks||[])]){
      if(typeof task.title!=='string'||!task.title.trim()||task.title.length>200)throw Error('タスク名が不正です');
      if(task.actualMinutes!==undefined)actualTime(task.actualMinutes);
    }
    if(day.endScore!==undefined&&(!Number.isInteger(day.endScore)||day.endScore<0||day.endScore>100))throw Error('確定達成度が不正です');
  }
  for (const k of ['morning','evening','night']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.settings[k])) throw Error('通知時刻が不正です');
  if (!(data.settings.morning < data.settings.night && data.settings.night <= data.settings.evening)) throw Error('朝 < 翌日計画 ≤ 振り返り の順にしてください');
  const weeklyPlans=ensureWeekly(data);
  if(typeof weeklyPlans!=='object'||Array.isArray(weeklyPlans)||Object.keys(weeklyPlans).length>520)throw Error('週次計画が不正です');
  for(const [key,plan] of Object.entries(weeklyPlans)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||dateKey(new Date(`${key}T12:00:00`))!==key||!plan||!Array.isArray(plan.items)||plan.items.length>50)throw Error('週次計画が不正です');
    if(plan.plannedAt!==undefined&&plan.plannedAt!==null&&Number.isNaN(Date.parse(plan.plannedAt)))throw Error('週次計画の確定日時が不正です');
    for(const item of plan.items){
      if(typeof item.id!=='string'||!item.id||item.id.length>100||typeof item.title!=='string'||!item.title.trim()||item.title.length>200||!Array.isArray(item.weekdays)||!item.weekdays.length||item.weekdays.length>7||new Set(item.weekdays).size!==item.weekdays.length||item.weekdays.some(value=>!Number.isInteger(value)||value<1||value>7))throw Error('週次計画の項目が不正です');
    }
  }
  return data;
}
