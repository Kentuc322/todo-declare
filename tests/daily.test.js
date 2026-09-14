import {test} from 'node:test';
import assert from 'node:assert/strict';
import {score,closeDays,actualTime,validate} from '../dist/core.js';
import {smallPanel,journal} from '../dist/task-extras.js';
const state=()=>({version:1,settings:{morning:'08:00',night:'20:00',evening:'21:00'},days:{'2026-09-14':{declared:'yes',reviewed:'yes',tasks:[{title:'勉強',condition:'問題集',minutes:30,weight:2,progress:25}],smallTasks:[{title:'返信',done:true,actualMinutes:5}]}}});
test('振り返り後の当日更新は翌日確定値に反映される',()=>{const data=state(),day=data.days['2026-09-14'];assert.equal(closeDays(data,new Date(2026,8,14,21)),false);assert.equal(score(day),25);day.tasks[0].progress=100;day.tasks[0].actualMinutes=42;assert.equal(closeDays(data,new Date(2026,8,15,0)),true);assert.equal(score(day),100);assert.equal(closeDays(data,new Date(2026,8,15,8)),false);day.tasks[0].progress=0;assert.equal(score(day),100);});
test('小規模タスクは宣言達成度に加算しない',()=>{const data=state();assert.equal(score(data.days['2026-09-14']),25);assert.equal(validate(data),data);});
test('実績時間の範囲とバックアップ互換性',()=>{assert.equal(actualTime('0'),0);assert.equal(actualTime('1440'),1440);for(const value of [null,'',-1,1441,1.5,'abc'])assert.throws(()=>actualTime(value));const data=state();data.days['2026-09-14'].tasks[0].actualMinutes=-1;assert.throws(()=>validate(data));});
test('カレンダー記録は実績分数と小規模タスクを表示しHTMLをエスケープ',()=>{const data=state(),day=data.days['2026-09-14'];day.tasks[0].actualMinutes=42;day.smallTasks[0].title='<script>';const html=journal(day);assert.match(html,/実績：42 分/);assert.match(html,/&lt;script&gt;/);assert.match(smallPanel(day,false),/disabled/);});
