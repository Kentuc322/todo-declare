import {test} from 'node:test';
import assert from 'node:assert/strict';
import {score,dateKey,validate} from '../dist/core.js';
test('重要度付き達成度と空計画',()=>{assert.equal(score({tasks:[{weight:3,progress:100},{weight:1,progress:0}]}),75);assert.equal(score({tasks:[]}),0);});
test('ローカル日付',()=>assert.equal(dateKey(new Date(2026,8,14)), '2026-09-14'));
test('バックアップ検証',()=>{const d={version:1,settings:{morning:'08:00',night:'20:00',evening:'21:00'},days:{}};assert.equal(validate(d),d);assert.throws(()=>validate({...d,settings:{morning:'22:00',night:'20:00',evening:'21:00'}}));assert.throws(()=>validate({...d,days:{'2026-09-14':{tasks:[{title:'bad',weight:1,progress:999,minutes:30}]}}}));});
