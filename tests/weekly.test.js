import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,weekKey} from '../dist/core.js';
import {addWeeklyItem,confirmWeeklyPlan,currentWeek,removeWeeklyItem,weeklyPanel} from '../dist/weekly.js';

const empty=()=>validate({version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}});

test('週は月曜日に始まり、古いデータには週次計画を補う',()=>{
  const data=empty();
  assert.equal(weekKey(new Date(2026,9,11,12)), '2026-10-05');
  assert.equal(weekKey(new Date(2026,9,12,12)), '2026-10-12');
  assert.deepEqual(data.settings.weeklyPlans,{});
});

test('やることと曜日を追加し、設定済みにできる',()=>{
  const data=empty(),now=new Date(2026,9,12,20,30);
  addWeeklyItem(data,'数学の復習',[3,1,3],now,'weekly-1');
  assert.deepEqual(currentWeek(data,now).plan.items,[{id:'weekly-1',title:'数学の復習',weekdays:[1,3]}]);
  confirmWeeklyPlan(data,now);
  assert.equal(currentWeek(data,now).plan.plannedAt,now.toISOString());
  assert.match(weeklyPanel(data,now),/設定済み/);
  removeWeeklyItem(data,0,now);
  assert.equal(currentWeek(data,now).plan.items.length,0);
  assert.equal(currentWeek(data,now).plan.plannedAt,undefined);
});

test('曜日なしや不正なバックアップを拒否する',()=>{
  const data=empty(),now=new Date(2026,9,12,20,30);
  assert.throws(()=>addWeeklyItem(data,'曜日なし',[],now,'weekly-1'));
  data.settings.weeklyPlans={'2026-10-12':{items:[{id:'x',title:'不正',weekdays:[0]}]}};
  assert.throws(()=>validate(data));
});

test('週次表示は入力文字列をエスケープする',()=>{
  const data=empty(),now=new Date(2026,9,12,20,30);
  addWeeklyItem(data,'<img src=x onerror=alert(1)>',[1],now,'weekly-1');
  const html=weeklyPanel(data,now);
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/&lt;img/);
});
