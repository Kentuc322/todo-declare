const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function smallPanel(day,editable){
  const tasks=day.smallTasks||[];
  return `<section class="panel" id="smallTasks"><h2>小規模タスク</h2><p class="muted">宣言とは別に追加できます。宣言の達成度・閲覧制限には影響しません。</p>${tasks.map((t,i)=>`<div class="task"><div class="row"><span>${esc(t.title)}</span><button data-small="${i}" ${editable?'':'disabled'}>${t.done?'完了を取り消す':'完了を登録'}</button></div><p>実績：${t.actualMinutes===undefined?'未記録':t.actualMinutes+' 分'} · ${t.done?'完了':'未完了'}</p></div>`).join('')||'<p class="muted">小規模タスクはありません。</p>'}${editable?'<form id="smallTaskForm"><label>タスク名<input name="title" required maxlength="200" placeholder="例：メールを返信する"></label><button type="submit">小規模タスクを追加</button></form>':''}</section>`;
}
export function journal(day){
  if(!day)return '<p class="muted">記録がありません。</p>';
  const rows=(tasks,small=false)=>tasks.map(task=>`<p>${esc(task.title)} · ${small?(task.done?'完了':'未完了'):task.progress+'%'}<br>${small?'':`見積：${task.minutes} 分 · `}実績：${task.actualMinutes===undefined?'未記録':task.actualMinutes+' 分'}${small?'':`<br>完了条件：${esc(task.condition)}`}</p>`).join('');
  return `<h3>宣言タスク</h3>${rows(day.tasks)}<h3>小規模タスク</h3>${rows(day.smallTasks||[],true)||'<p>記録なし</p>'}<h3>振り返り</h3><p>${esc(day.learned)}</p><p>${esc(day.next)}</p>`;
}
