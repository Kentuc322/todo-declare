import {dateKey,ensureWeekly,weekKey} from './core.js';

export const weekdays=[
  {value:1,label:'月'}, {value:2,label:'火'}, {value:3,label:'水'},
  {value:4,label:'木'}, {value:5,label:'金'}, {value:6,label:'土'}, {value:7,label:'日'}
];

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function currentWeek(data,now=new Date()){
  const key=weekKey(now),plans=ensureWeekly(data);
  plans[key]||={items:[]};
  return {key,plan:plans[key]};
}

export function weekLabel(now=new Date()){
  const start=new Date(`${weekKey(now)}T12:00:00`),end=new Date(start);end.setDate(end.getDate()+6);
  return `${start.getMonth()+1}/${start.getDate()} – ${end.getMonth()+1}/${end.getDate()}`;
}

export function weeklyPanel(data,now=new Date()){
  const {plan}=currentWeek(data,now),todayValue=now.getDay()===0?7:now.getDay();
  const isMondayNight=now.getDay()===1&&now.getHours()>=20&&!plan.plannedAt;
  return `<section class="weekly-panel">
    <div class="weekly-heading"><div><p class="eyebrow">WEEKLY COMPASS</p><h2>今週の予定</h2><p class="week-range">${weekLabel(now)}</p></div><span class="weekly-status ${plan.plannedAt?'done':''}">${plan.plannedAt?'設定済み':'月曜夜に設定'}</span></div>
    ${isMondayNight?'<div class="weekly-prompt"><strong>今週の方向を決める時間です</strong><span>やることと曜日だけ、短く決めましょう。</span></div>':''}
    <div class="weekly-list">${plan.items.length?plan.items.map((item,index)=>`<article class="weekly-item ${item.weekdays.includes(todayValue)?'is-today':''}"><div><strong>${esc(item.title)}</strong><div class="day-row">${weekdays.map(day=>`<span class="day-dot ${item.weekdays.includes(day.value)?'selected':''} ${day.value===todayValue?'today':''}">${day.label}</span>`).join('')}</div></div><button class="icon-button" data-weekly-remove="${index}" aria-label="${esc(item.title)}を削除">×</button></article>`).join(''):'<div class="weekly-empty"><span>＋</span><strong>今週やることを追加</strong><small>曜日だけ決めて、毎日ここで確認できます。</small></div>'}</div>
    <details class="weekly-editor" ${!plan.items.length||isMondayNight?'open':''}><summary>${plan.items.length?'予定を編集':'予定をつくる'}</summary><form id="weeklyForm"><label>やること<input name="title" maxlength="200" placeholder="例：英語の問題集を進める" required></label><fieldset><legend>取り組む曜日</legend><div class="weekday-picker">${weekdays.map(day=>`<label><input type="checkbox" name="weekday" value="${day.value}"><span>${day.label}</span></label>`).join('')}</div></fieldset><button type="submit">＋ 今週に追加</button></form></details>
    <button id="confirmWeek" class="primary weekly-confirm" ${plan.items.length?'':'disabled'}>${plan.plannedAt?'今週の予定を更新':'今週の予定を設定'}</button>
    <p class="weekly-footnote">設定後も編集できます。今週いっぱい、すべての画面に表示されます。</p>
  </section>`;
}

export function addWeeklyItem(data,title,dayValues,now=new Date(),id=crypto.randomUUID()){
  const clean=String(title).trim(),weekdaysSelected=[...new Set(dayValues.map(Number))].sort((a,b)=>a-b);
  if(!clean)throw Error('やることを入力してください');
  if(!weekdaysSelected.length)throw Error('取り組む曜日を1つ以上選んでください');
  if(weekdaysSelected.some(day=>!Number.isInteger(day)||day<1||day>7))throw Error('曜日が不正です');
  const {plan}=currentWeek(data,now);if(plan.items.length>=50)throw Error('週次予定は50件までです');
  plan.items.push({id,title:clean,weekdays:weekdaysSelected});delete plan.plannedAt;
  return plan;
}

export function removeWeeklyItem(data,index,now=new Date()){
  const {plan}=currentWeek(data,now);if(!Number.isInteger(index)||index<0||index>=plan.items.length)throw Error('削除する予定が見つかりません');
  plan.items.splice(index,1);delete plan.plannedAt;return plan;
}

export function confirmWeeklyPlan(data,now=new Date()){
  const {plan}=currentWeek(data,now);if(!plan.items.length)throw Error('今週やることを1件以上追加してください');
  plan.plannedAt=now.toISOString();return plan;
}
