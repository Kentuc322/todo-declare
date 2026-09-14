import {dateKey,score,validate} from './core.js';
import {createFeedback} from './feedback.js';
import {CloudStore} from './cloud.js';
const KEY='todo-declare.v1';
let data;
try { data=validate(JSON.parse(localStorage.getItem(KEY))); } catch { data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}}; }
let view='today',selected=dateKey(),month=new Date(new Date().getFullYear(),new Date().getMonth(),1),connected=false,timerEnd=0,remaining=1500;
const $=s=>document.querySelector(s),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>data.days[selected]||{tasks:[]};
const feedback=createFeedback(document);
let syncingTimer,manualSync=false,cloudDirty=false,formDirty=false,saving=false,adoptRemote=false;
const cacheKey=()=>cloud.user?`${KEY}.user.${cloud.user.uid}`:KEY;
function tell(s,kind='success'){$('#status').textContent=s;feedback(s,kind);}
function sync(manual=false){
  manualSync ||= manual;
  if(manual){tell('Frictionに接続しています…','pending');clearTimeout(syncingTimer);syncingTimer=setTimeout(()=>{manualSync=false;tell('Frictionから応答がありません。拡張機能を再読み込みし、同じブラウザでこのページを開き直してください。','error');},5000);}
  window.postMessage({source:'todo-declare',type:'sync',data},location.origin);
}
async function save(message='保存しました'){
  if(saving){tell('保存中です。完了するまでお待ちください。','pending');return false;}
  saving=true;
  document.body.classList.add('saving');$('#content').setAttribute('aria-busy','true');
  const snapshot=structuredClone(data);
  const targetKey=cacheKey();
  try{
    localStorage.setItem(targetKey,JSON.stringify(snapshot));
    if(cloud.user){cloudDirty=true;localStorage.setItem(targetKey+'.pending',JSON.stringify({data:snapshot,revision:cloud.revision}));tell('クラウドに保存しています…','pending');await cloud.save(snapshot);cloudDirty=false;localStorage.removeItem(targetKey+'.pending');tell(`${message} · クラウド同期済み`);}
    else tell(`${message} · この端末に保存`);
    formDirty=false;sync();return true;
  }catch(error){tell(`保存を完了できませんでした：${error.message}。入力はこの画面に残っています。バックアップを保存してください。`,'error');return false;}
  finally{saving=false;document.body.classList.remove('saving');$('#content').setAttribute('aria-busy','false');}
}
const cloud=new CloudStore((user,remote)=>{
  if(!user){cloudDirty=false;try{data=validate(JSON.parse(localStorage.getItem(KEY)));}catch{data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};}render();return;}
  if(!remote){try{const pending=JSON.parse(localStorage.getItem(cacheKey()+'.pending'));data=validate(pending?.data||JSON.parse(localStorage.getItem(cacheKey())));}catch{data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};}render();tell('アカウントのデータを読み込んでいます…','pending');return;}
  let pending;
  try{pending=JSON.parse(localStorage.getItem(cacheKey()+'.pending'));if(pending)validate(pending.data);}catch{pending=null;}
  if(pending&&!adoptRemote){data=pending.data;cloud.revision=pending.revision;cloudDirty=true;render();tell('この端末に未同期の記録が残っています。バックアップを保存し、保存を再試行するか最新データを読み込んでください。','error');return;}
  if(adoptRemote){localStorage.removeItem(cacheKey()+'.pending');adoptRemote=false;}
  data=remote;cloudDirty=false;formDirty=false;localStorage.setItem(cacheKey(),JSON.stringify(data));render();sync();tell('専用ユーザーのデータを読み込みました');
},(remote,revision)=>{
  if(cloudDirty||formDirty){tell('別の端末で更新されました。入力をバックアップしてから「最新データを読み込む」を押してください。','error');return;}
  data=remote;cloud.revision=revision;localStorage.setItem(cacheKey(),JSON.stringify(data));render();sync();tell('別の端末からの変更を反映しました');
},error=>tell(`クラウドに接続できません：${error.message}`,'error'));
document.addEventListener('input',e=>{if(e.target.closest('#taskForm,#reviewForm,#settingsForm'))formDirty=true;});
document.addEventListener('click',e=>{if(saving&&e.target.closest('#content,nav')){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{if(saving&&e.target.closest('#content,nav')){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='friction-todo')return;connected=e.data.ok;$('#connection').textContent=connected?'Friction 接続済み':'Friction 未接続';if(manualSync){clearTimeout(syncingTimer);manualSync=false;tell(e.data.ok?'Frictionとの同期が完了しました':e.data.error||'Frictionに接続できません',''+(e.data.ok?'success':'error'));}});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#dateLabel').textContent=new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'});$('#content').innerHTML=view==='today'?today():view==='calendar'?calendar():settings();bind();}
function today(){const d=day(),s=score(d),minutes=d.tasks.reduce((n,t)=>n+t.minutes,0);return `<div class="top"><div><p class="eyebrow">DECLARE → FOCUS → REFLECT</p><h1>今日の一歩を、決めよう。</h1><span class="muted">やることを絞って、完了条件まで明確に。</span></div><label>計画する日<input id="selected" type="date" value="${selected}" min="${dateKey()}"></label></div><div class="cards"><div class="card"><small>宣言したタスク</small><div class="metric">${d.tasks.length}<small> 件</small></div></div><div class="card"><small>見積もりの合計</small><div class="metric">${minutes}<small> 分</small></div></div><div class="card"><small>${d.reviewed?'確定達成度':'現在の進捗'}</small><div class="metric">${s}<small> %</small></div></div></div><div class="layout"><div><section class="panel"><div class="row"><h2>${esc(selected)} のタスク</h2><span class="badge">${d.reviewed?'振り返り済み':d.declared?'宣言済み':'計画中'}</span></div>${d.tasks.length?d.tasks.map((t,i)=>`<div class="task"><div class="row"><span class="task-title">${esc(t.title)}</span>${!d.declared?`<button data-remove="${i}" aria-label="タスクを削除">×</button>`:''}</div><p>完了条件：${esc(t.condition)}<br>${t.minutes} 分 · 重要度 ${t.weight}${t.skill?' · '+esc(t.skill):''}</p><div class="row"><small>進捗</small><select aria-label="${esc(t.title)} の進捗" data-progress="${i}" ${d.reviewed||selected!==dateKey()||!d.declared?'disabled':''}>${[0,25,50,75,100].map(v=>`<option value="${v}" ${t.progress===v?'selected':''}>${v}%${v===100?' 完了':''}</option>`).join('')}</select></div></div>`).join(''):'<div class="empty">まずは、いちばん大切なタスクから。<br>1〜3件を目安に始めましょう。</div>'}${!d.declared?`<form id="taskForm" class="form-grid"><label class="full">タスク<input name="title" maxlength="200" placeholder="例：英単語を30語覚える" required></label><label class="full">完了条件<input name="condition" maxlength="300" placeholder="例：確認テストで24問以上正解する" required></label><label>見積時間（分）<input name="minutes" type="number" min="1" max="480" value="30" required></label><label>重要度<select name="weight"><option value="1">1 · 通常</option><option value="2" selected>2 · 重要</option><option value="3">3 · 最優先</option></select></label><label class="full">身につけたい能力（任意）<input name="skill" maxlength="100" placeholder="語彙力、問題解決力など"></label><button type="submit">＋ タスクを追加</button></form><div class="actions"><button class="primary" id="declare" ${d.tasks.length?'':'disabled'}>この計画を宣言する</button><button id="carry">未完了を引き継ぐ</button></div><p class="muted">宣言後は計画を固定します。見積もりは無理なく。</p>`:''}</section>${d.declared&&!d.reviewed&&selected===dateKey()?`<section class="panel"><p class="eyebrow">EVENING REFLECTION</p><h2>今日の経験を、明日の力に。</h2><form id="reviewForm"><label>できたこと・学んだこと<textarea name="learned" required maxlength="2000"></textarea></label><label>つまずいた原因と、明日変える一つのこと<textarea name="next" required maxlength="2000"></textarea></label><div class="actions"><button class="primary">振り返りを確定する</button></div><p class="muted">重要度付き進捗率で確定。50%未満：対象サイト合計20分/日、80%未満：40分/日。どちらも待機を30秒追加。翌日から、80%以上の振り返りまで継続します。</p></form></section>`:d.reviewed?`<section class="panel"><h2>振り返り</h2><p>${esc(d.learned)}</p><p class="muted">次の一歩：${esc(d.next)}</p></section>`:''}</div><div class="side-panels"><section class="panel"><p class="eyebrow">FOCUS SESSION</p><h2>一つだけに集中</h2><label>集中するタスク<select id="focusTask"><option>タスクを選択</option>${d.tasks.map(t=>`<option>${esc(t.title)}</option>`).join('')}</select></label><div class="timer" id="timer">${timerText()}</div><div class="actions"><button id="timerToggle" class="primary">${timerEnd?'一時停止':'開始'}</button><button id="timerReset">リセット</button></div><p class="muted">25分集中したら5分休憩。タイマーはこのページを開いたまま使ってください。</p></section><section class="panel"><h2>今日のルール</h2><p>朝 ${data.settings.morning}：当日計画<br>夜 ${data.settings.night}：翌日計画<br>夜 ${data.settings.evening}：振り返り</p><div class="notice">未提出の計画・振り返りがあると、Frictionの対象サイトをロックします。</div></section></div></div>`;}
function calendar(){const y=month.getFullYear(),m=month.getMonth(),first=month.getDay(),count=new Date(y,m+1,0).getDate();return `<div class="top"><div><p class="eyebrow">PROGRESS JOURNAL</p><h1>積み重ねを、見える形に。</h1></div><div class="actions"><button id="prev" aria-label="前月">←</button><h2>${y}年 ${m+1}月</h2><button id="nextMonth" aria-label="翌月">→</button></div></div><section class="panel"><div class="calendar">${['日','月','火','水','木','金','土'].map(x=>`<span class="week">${x}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({length:count},(_,i)=>{const k=dateKey(new Date(y,m,i+1)),d=data.days[k],s=score(d);return `<button data-day="${k}" class="${d?.reviewed?s>=80?'good':s>=50?'mid':'low':''}">${i+1}<b>${d?.reviewed?s+'%':d?.declared?'宣言済':'—'}</b></button>`;}).join('')}</div><p class="muted">緑：80%以上　黄：50〜79%　赤：50%未満　—：記録なし</p></section><section class="panel" id="journal"><h2>日付を選んで振り返る</h2><p class="muted">計画・進捗・学んだことを確認できます。</p></section>`;}
function settings(){return `<div class="settings"><p class="eyebrow">YOUR ROUTINE</p><h1>続けるための仕組み。</h1><section class="panel"><h2>通知時刻</h2><form id="settingsForm" class="form-grid">${[['morning','当日計画'],['night','翌日計画'],['evening','振り返り']].map(([k,l])=>`<label>${l}<input type="time" name="${k}" value="${data.settings[k]}" required></label>`).join('')}<button class="primary">保存する</button></form><div class="actions"><button id="notifications">ブラウザ通知を許可</button></div><p class="muted">ページを開いている間に通知します。ページを閉じた状態での通知にはFriction連携が必要です。ブラウザ終了中・端末スリープ中の定刻通知は保証されません。</p></section><section class="panel"><h2>Frictionと連携</h2><p>Frictionの設定で「Todo Declare URL」に、下のURLを登録してください。その後「同期する」を押します。</p><input readonly aria-label="Todo Declare URL" value="${esc(location.origin+location.pathname)}"><div class="actions"><button id="sync" class="primary">同期する</button></div><p class="muted">計画・振り返りと通知時刻を拡張機能へ同期します。連携中は翌日計画の未提出もロック対象です。制限は自己管理用で、拡張機能の無効化などを防ぐものではありません。</p></section><section class="panel"><h2>データを守る</h2><p class="muted">この端末・ブラウザ限定で保存します。アカウント同期はありません。定期的にバックアップしてください。</p><div class="actions"><button id="export">バックアップを保存</button><label>バックアップを読み込む<input type="file" id="import" accept="application/json,.json"></label></div></section></div>`;}
function bind(){if($('#selected'))$('#selected').onchange=e=>{selected=e.target.value;render();};if($('#taskForm'))$('#taskForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),d=day();if(d.tasks.length>=100)return tell('タスクは100件までです');d.tasks.push({id:crypto.randomUUID(),title:f.get('title').trim(),condition:f.get('condition').trim(),minutes:Number(f.get('minutes')),weight:Number(f.get('weight')),progress:0,skill:f.get('skill').trim()});data.days[selected]=d;save();render();};document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{day().tasks.splice(+b.dataset.remove,1);save();render();});document.querySelectorAll('[data-progress]').forEach(b=>b.onchange=()=>{day().tasks[+b.dataset.progress].progress=+b.value;save();render();});if($('#declare'))$('#declare').onclick=()=>{if(!confirm('計画を固定します。無理のない量ですか？'))return;day().declared=new Date().toISOString();save();render();};if($('#carry'))$('#carry').onclick=()=>{const previous=Object.keys(data.days).filter(k=>k<selected).sort().at(-1);if(!previous)return tell('引き継ぐ記録がありません');const d=day();data.days[ selected]=d;data.days[previous].tasks.filter(t=>t.progress<100&&!d.tasks.some(x=>x.title===t.title)).forEach(t=>d.tasks.push({...t,id:crypto.randomUUID(),progress:0}));save();render();};if($('#reviewForm'))$('#reviewForm').onsubmit=e=>{e.preventDefault();if(!confirm('進捗と振り返りを確定しますか？確定後は編集できません。'))return;const f=new FormData(e.target);Object.assign(day(),{reviewed:new Date().toISOString(),learned:f.get('learned').trim(),next:f.get('next').trim()});save();render();tell('振り返りを記録しました。次の一歩を明日の計画へ。');};if($('#timerToggle'))$('#timerToggle').onclick=()=>{if(timerEnd){remaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerEnd=0;}else{if(remaining<=0)remaining=1500;timerEnd=Date.now()+remaining*1000;}render();};if($('#timerReset'))$('#timerReset').onclick=()=>{timerEnd=0;remaining=1500;render();};if($('#prev'))$('#prev').onclick=()=>{month.setMonth(month.getMonth()-1);render();};if($('#nextMonth'))$('#nextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);render();};document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{const d=data.days[b.dataset.day];$('#journal').innerHTML=`<h2>${b.dataset.day} の記録</h2>${d?`<p>達成度 ${score(d)}% ${d.reviewed?'（確定）':'（未確定）'}</p>${d.tasks.map(t=>`<p>${esc(t.title)} · ${t.progress}%<br><small>完了条件：${esc(t.condition)}</small></p>`).join('')}<p>${esc(d.learned)}</p><p class="muted">${esc(d.next)}</p>`:'<p class="muted">記録がありません。</p>'}`;});if($('#settingsForm'))$('#settingsForm').onsubmit=e=>{e.preventDefault();const s=Object.fromEntries(new FormData(e.target));try{validate({...data,settings:s});data.settings=s;save();tell('通知時刻を保存しました');}catch(err){tell(err.message);}};if($('#sync'))$('#sync').onclick=()=>{sync();tell('Frictionの設定にこのURLを登録してあることを確認してください。');};if($('#notifications'))$('#notifications').onclick=async()=>{if(!('Notification'in window))return tell('このブラウザでは通知を利用できません');tell(await Notification.requestPermission()==='granted'?'通知を許可しました':'通知が許可されていません');};if($('#export'))$('#export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=`todo-declare-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};if($('#import'))$('#import').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>2000000)throw Error('2MB以下のJSONを選んでください');const next=validate(JSON.parse(await f.text()));if(!confirm('現在の記録をバックアップの内容で置き換えますか？'))return;data=next;save();render();tell('読み込みました');}catch(err){tell(err.message);}};}
const originalBind=bind;
bind=function(){
  const past=selected<dateKey();
  if($('#selected')) {
    $('#selected').removeAttribute('min');
    const next=new Date();next.setDate(next.getDate()+1);$('#selected').max=dateKey(next);
  }
  if(past){
    $('#taskForm')?.remove();$('#declare')?.remove();$('#carry')?.remove();
    if(!day().reviewed){
      data.days[selected] ||= {tasks:[]};
      document.querySelector('#content .layout > div')?.insertAdjacentHTML('beforeend',`<section class="panel"><h2>提出を忘れた日の振り返り</h2><p class="muted">宣言がなかった日は達成度0%で記録します。次の計画を小さく始めましょう。</p><form id="reviewForm"><label>できたこと・学んだこと<textarea name="learned" required maxlength="2000"></textarea></label><label>原因と、次に変えること<textarea name="next" required maxlength="2000"></textarea></label><div class="actions"><button class="primary">振り返りを確定する</button></div></form></section>`);
      if(day().declared)document.querySelectorAll('[data-progress]').forEach(s=>s.disabled=false);
    }
  }
  originalBind();
  bindPersistence();
};
function accountPanel(){return `<section class="panel"><h2>専用ユーザーと端末間同期</h2><p>${cloud.user?`ログイン中：${esc(cloud.user.email)}<br>${cloud.ready?'クラウド接続済み':'クラウドの読み込みが必要です'}`:cloud.configured?'専用のメールアドレス・パスワードでログインしてください。':'Firebase公開設定をこの端末に登録してください。'}</p><div class="actions">${cloud.user?'<button id="cloudReload">最新データを読み込む</button><button id="migrateGuest">この端末の記録を取り込む</button><button id="logout">ログアウト</button>':`<button id="login" class="primary" ${cloud.configured?'':'disabled'}>専用ユーザーでログイン</button><button id="configureCloud">Firebase接続設定</button>`}</div><p class="muted">指定した一人だけがアクセスできます（Firestore側のルール設定が必要です）。未ログインの記録は自動送信しません。ログイン情報はアプリに保存せず、ページを開き直すと再ログインが必要です。</p></section>`;}
function bindPersistence(){
  const settingView=$('#content .settings');
  if(settingView){
    settingView.querySelector('h1').insertAdjacentHTML('afterend',accountPanel());
    const privacy=settingView.lastElementChild.querySelector('p');
    privacy.textContent='ログイン中はクラウドに保存し、同じ専用ユーザーで各端末から利用できます。未ログイン時はこの端末だけに保存します。定期的なバックアップもおすすめします。';
    const account=settingView.querySelector('.panel');
    if($('#configureCloud'))$('#configureCloud').onclick=async()=>{try{await cloud.configure();}catch(error){tell(error.message,'error');}};
  }
  const asideLabel=$('.aside-bottom p');if(asideLabel)asideLabel.textContent=cloud.user?'専用ユーザーで端末間同期':'データはこのブラウザに保存';
  if($('#sync'))$('#sync').onclick=()=>sync(true);
  if($('#notifications'))$('#notifications').onclick=async()=>{
    try{if(!('Notification'in window))throw Error('このブラウザでは通知を利用できません');const permission=await Notification.requestPermission();tell(permission==='granted'?'ブラウザ通知を許可しました':'通知は許可されませんでした',permission==='granted'?'success':'error');}catch(err){tell(err.message,'error');}
  };
  if($('#settingsForm'))$('#settingsForm').onsubmit=async e=>{
    e.preventDefault();const next=Object.fromEntries(new FormData(e.target));
    try{validate({...data,settings:next});data.settings=next;await save('通知時刻を保存しました');}catch(err){tell(err.message,'error');}
  };
  if($('#taskForm'))$('#taskForm').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),d=day();
    if(d.tasks.length>=100)return tell('タスクは100件までです','error');
    const title=f.get('title').trim(),condition=f.get('condition').trim();
    if(!title||!condition)return tell('タスクと完了条件を入力してください','error');
    d.tasks.push({id:crypto.randomUUID(),title,condition,minutes:Number(f.get('minutes')),weight:Number(f.get('weight')),progress:0,skill:f.get('skill').trim()});data.days[selected]=d;
    if(await save('タスクを追加しました'))render();
  };
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{day().tasks.splice(+b.dataset.remove,1);if(await save('タスクを削除しました'))render();});
  document.querySelectorAll('[data-progress]').forEach(b=>b.onchange=async()=>{day().tasks[+b.dataset.progress].progress=+b.value;if(await save('進捗を保存しました'))render();});
  if($('#declare'))$('#declare').onclick=async()=>{if(!confirm('この計画を宣言して固定しますか？'))return;day().declared=new Date().toISOString();if(await save('計画を宣言しました'))render();};
  if($('#reviewForm'))$('#reviewForm').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),learned=f.get('learned').trim(),next=f.get('next').trim();
    if(!learned||!next)return tell('振り返りの両方の欄を入力してください','error');
    if(!confirm('進捗と振り返りを確定しますか？確定後は編集できません。'))return;
    data.days[selected] ||= {tasks:[]};Object.assign(day(),{reviewed:new Date().toISOString(),learned,next});
    if(await save('振り返りを記録しました'))render();
  };
  if($('#carry'))$('#carry').onclick=async()=>{
    const prev=Object.keys(data.days).filter(k=>k<selected).sort().at(-1);
    if(!prev)return tell('引き継ぐ記録がありません','error');
    const d=day(),tasks=data.days[prev].tasks.filter(t=>t.progress<100&&!d.tasks.some(x=>x.title===t.title));
    if(d.tasks.length+tasks.length>100)return tell('引き継ぐと100件を超えます','error');
    d.tasks.push(...tasks.map(t=>({...t,id:crypto.randomUUID(),progress:0})));data.days[selected]=d;
    if(await save(`${tasks.length}件を引き継ぎました`))render();
  };
  if($('#export'))$('#export').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`todo-declare-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('バックアップのダウンロードを開始しました');
  };
  if($('#import'))$('#import').onchange=async e=>{
    try{const file=e.target.files[0];if(!file||file.size>2000000)throw Error('2MB以下のJSONを選んでください');const next=validate(JSON.parse(await file.text()));
      if(!confirm(`${cloud.user?'この専用ユーザーの':'この端末の'}記録をバックアップの内容で置き換えますか？`))return;
      data=next;if(await save('バックアップを読み込みました'))render();
    }catch(err){tell(err.message,'error');}
  };
  if($('#login'))$('#login').onclick=async()=>{if(formDirty&&!confirm('入力中の内容があります。ログイン画面へ進みますか？'))return;try{tell('ログイン画面を開いています…','pending');await cloud.login();}catch(err){tell(`ログインできませんでした：${err.message}`,'error');}};
  if($('#logout'))$('#logout').onclick=async()=>{if(cloudDirty||formDirty)return tell('未保存の記録があります。保存またはバックアップをしてからログアウトしてください。','error');try{await cloud.logout();tell('ログアウトしました');}catch(err){tell(err.message,'error');}};
  if($('#cloudReload'))$('#cloudReload').onclick=async()=>{if((cloudDirty||formDirty)&&!confirm('最新データに切り替えると現在の入力は画面から消えます。バックアップを保存しましたか？'))return;try{adoptRemote=true;await cloud.reload();}catch(err){adoptRemote=false;tell(err.message,'error');}};
  if(cloud.user&&cloud.ready&&settingView){
    $('#cloudReload').insertAdjacentHTML('afterend','<button id="retrySave">保存を再試行</button>');
    $('#retrySave').onclick=async()=>{await save('クラウドへの保存が完了しました');};
  }
  if($('#migrateGuest'))$('#migrateGuest').onclick=async()=>{
    try{const guest=validate(JSON.parse(localStorage.getItem(KEY)));const missing=Object.keys(guest.days).filter(k=>!data.days[k]);
      if(!missing.length)return tell('取り込める日付がありません。同じ日付の記録は上書きしません。');
      if(!confirm(`この端末の${missing.length}日分の記録を ${cloud.user.email} のクラウドへ送信しますか？同じ日付は上書きしません。`))return;
      for(const k of missing)data.days[k]=structuredClone(guest.days[k]);
      if(await save('端末の記録を取り込みました'))render();
    }catch(err){tell(`取り込めませんでした：${err.message}`,'error');}
  };
  if(cloud.user&&!cloud.ready)document.querySelectorAll('#content input,#content textarea,#content select,#content button').forEach(el=>{if(!['cloudReload','logout','export','reauth'].includes(el.id))el.disabled=true;});
}
function timerText(){const n=timerEnd?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):remaining;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function notify(text){tell(text);if('Notification'in window&&Notification.permission==='granted')new Notification('Todo Declare',{body:text});}
setInterval(()=>{if($('#timer'))$('#timer').textContent=timerText();if(timerEnd&&Date.now()>=timerEnd){timerEnd=0;remaining=0;notify('25分の集中が終了しました。5分休憩しましょう。');render();}const now=new Date(),time=now.toTimeString().slice(0,5),k=dateKey();for(const [key,text]of [['morning','今日の計画を宣言しましょう'],['night','明日の計画を宣言しましょう'],['evening','今日の進捗を振り返りましょう']]){const marker=`todo-notified.${k}.${key}`;if(time===data.settings[key]&&!sessionStorage.getItem(marker)){sessionStorage.setItem(marker,'1');if(!connected)notify(text);}}},1000);
window.addEventListener('storage',e=>{if(e.key===cacheKey()&&!cloud.user){try{if(formDirty){tell('別タブで更新されました。入力を保存してからページを開き直してください。','error');return;}data=validate(JSON.parse(e.newValue));render();sync();tell('別タブの変更を反映しました');}catch{tell('別タブのデータを読み込めません','error');}}});
render();void cloud.init().then(()=>render()).catch(()=>tell('Firebase接続を準備できません。接続設定とネットワークを確認してください。','error'));setTimeout(()=>sync(),300);setInterval(()=>sync(),60000);
