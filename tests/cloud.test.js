import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudStore} from '../dist/cloud.js';
const data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};
test('UIDやキーを送信せずデータとrevisionのみ保存',async()=>{const store=new CloudStore(()=>{},()=>{},()=>{});store.user={uid:'a'};store.ready=true;store.revision=2;store.request=async(path,options)=>{assert.equal(path,'/v1/state');assert.deepEqual(JSON.parse(options.body),{data,revision:2});return {revision:3};};await store.save(data);assert.equal(store.revision,3);assert.equal(store.busy,false);});
test('競合・失敗を成功扱いしない',async()=>{const store=new CloudStore(()=>{},()=>{},()=>{});store.user={uid:'a'};store.ready=true;store.request=async()=>{throw Error('conflict');};await assert.rejects(store.save(data),/conflict/);assert.equal(store.revision,0);assert.equal(store.busy,false);});
test('未ログイン・期限切れを拒否',async()=>{const store=new CloudStore(()=>{},()=>{},()=>{});await assert.rejects(store.save(data),/Google/);});
test('ログアウトでメモリのトークンを破棄',async()=>{const store=new CloudStore(()=>{},()=>{},()=>{});store.token='private_dynamic_session';store.user={uid:'a'};await store.logout();assert.equal(store.token,null);assert.equal(store.user,null);});
