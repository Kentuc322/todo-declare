export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function score(day) {
  const tasks = day?.tasks || [];
  const weight = tasks.reduce((n,t)=>n+Number(t.weight),0);
  return weight ? Math.round(tasks.reduce((n,t)=>n+t.weight*t.progress,0)/weight) : 0;
}
export function validate(data) {
  if (!data || data.version !== 1 || !data.days || !data.settings) throw Error('対応していないバックアップです');
  for (const [key,day] of Object.entries(data.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(day.tasks) || day.tasks.length>100) throw Error('日付またはタスクが不正です');
    for (const t of day.tasks) if (typeof t.title!=='string' || t.title.length>200 || ![1,2,3].includes(t.weight) || !Number.isFinite(t.progress) || t.progress<0 || t.progress>100 || !Number.isFinite(t.minutes) || t.minutes<1 || t.minutes>480) throw Error('タスクの値が不正です');
  }
  for (const k of ['morning','evening','night']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.settings[k])) throw Error('通知時刻が不正です');
  if (!(data.settings.morning < data.settings.night && data.settings.night <= data.settings.evening)) throw Error('朝 < 翌日計画 ≤ 振り返り の順にしてください');
  return data;
}
