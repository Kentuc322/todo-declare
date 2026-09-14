import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHandler,HttpError} from '../api.js';
const origin='https://kentuc322.github.io';
const state={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};
async function invoke({url='/v1/state',method='GET',requestOrigin=origin,token='valid_token_for_test_123456',body,writeState}={}){
  const writes=[];let status,record,headers={};
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  Object.assign(req,{url,method,headers:{origin:requestOrigin,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})}});
  const res={setHeader:(k,v)=>headers[k]=v,writeHead:s=>status=s,end:s=>record=s?JSON.parse(s):null};
  await createHandler({origin,verifyToken:async value=>{if(value!== 'valid_token_for_test_123456')throw Error('bad');return {uid:'verified_user_a',email:'a@example.com'};},readState:async uid=>({uid,data:state,revision:3}),writeState:writeState||(async(uid,body)=>{writes.push({uid,body});return {revision:body.revision+1};})})(req,res);
  return {status,record,writes,headers};
}
test('未認証を拒否',async()=>assert.equal((await invoke({token:null})).status,401));
test('不正・期限切れトークンを拒否',async()=>assert.equal((await invoke({token:'invalid_token_for_test_1234'})).status,401));
test('異なるOriginからは拒否',async()=>assert.equal((await invoke({requestOrigin:'https://evil.example'})).status,403));
test('UID指定URLを受け付けない',async()=>assert.equal((await invoke({url:'/v1/state?uid=other'})).status,404));
test('送信されたUIDでなく検証済み本人の領域へ保存',async()=>{const r=await invoke({method:'PUT',body:{uid:'victim',data:state,revision:3}});assert.equal(r.status,200);assert.equal(r.writes[0].uid,'verified_user_a');assert.equal(r.writes[0].body.uid,undefined);});
test('不正データを保存しない',async()=>{const r=await invoke({method:'PUT',body:{data:{version:1},revision:0}});assert.equal(r.status,400);assert.equal(r.writes.length,0);});
test('上書き競合を409として返す',async()=>{const r=await invoke({method:'PUT',body:{data:state,revision:3},writeState:async()=>{throw new HttpError(409,'conflict');}});assert.equal(r.status,409);});
test('内部情報やトークンをエラーに含めない',async()=>{const r=await invoke({method:'PUT',body:{data:state,revision:3},writeState:async()=>{throw Error('SECRET internal credential');}});assert.equal(r.status,503);assert.ok(!r.record.error.includes('SECRET'));assert.equal(r.headers['Cache-Control'],'no-store');});
test('プリフライトは許可したOriginのみ',async()=>{const r=await invoke({method:'OPTIONS',token:null});assert.equal(r.status,204);assert.equal(r.headers['Access-Control-Allow-Origin'],origin);assert.equal(r.headers['Access-Control-Allow-Credentials'],undefined);});
