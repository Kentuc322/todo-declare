import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudStore} from '../dist/cloud.js';
const data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};
function fixture(revision=0){
  const store=new CloudStore(()=>{},()=>{},()=>{}),writes=[];
  store.user={uid:'user-a'};store.ready=true;store.ref='users/user-a/todo/state';
  store.dbAPI={serverTimestamp:()=>123,runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({revision})}),set:(ref,record)=>writes.push({ref,record})})};
  return {store,writes};
}
test('保存に本人用パスとrevisionを使う',async()=>{const {store,writes}=fixture();await store.save(data);assert.equal(writes[0].ref,'users/user-a/todo/state');assert.equal(store.revision,1);assert.equal(store.busy,false);});
test('他端末の更新を上書きしない',async()=>{const {store,writes}=fixture(2);await assert.rejects(store.save(data),/別の端末/);assert.equal(writes.length,0);assert.equal(store.revision,0);assert.equal(store.busy,false);});
test('未認証・読み込み中の保存を拒否',async()=>{const {store}=fixture();store.user=null;await assert.rejects(store.save(data),/読み込み/);store.user={uid:'a'};store.ready=false;await assert.rejects(store.save(data),/読み込み/);});
test('通信失敗を成功扱いしない',async()=>{const {store}=fixture();store.dbAPI.runTransaction=async()=>{throw Error('offline');};await assert.rejects(store.save(data),/offline/);assert.equal(store.revision,0);assert.equal(store.busy,false);});
