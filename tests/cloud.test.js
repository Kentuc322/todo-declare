import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CloudStore,publicConfig} from '../dist/cloud.js';
const data={version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}};
function store(revision=2){const s=new CloudStore(()=>{},()=>{},()=>{});s.user={uid:'owner'};s.ready=true;s.revision=2;s.ref='owner/state';s.sdk={serverTimestamp:()=>123,runTransaction:async(db,callback)=>callback({get:async()=>({exists:()=>true,data:()=>({revision})}),set:(ref,value)=>{s.written={ref,value};}})};return s;}
test('トランザクションでrevisionを増やして保存',async()=>{const s=store();await s.save(data);assert.equal(s.revision,3);assert.equal(s.written.ref,'owner/state');assert.deepEqual(s.written.value.data,data);assert.equal(s.busy,false);});
test('別端末の更新を上書きしない',async()=>{const s=store(3);await assert.rejects(s.save(data),/別の端末/);assert.equal(s.written,undefined);assert.equal(s.revision,2);assert.equal(s.busy,false);});
test('未ログインを拒否',async()=>{await assert.rejects(new CloudStore(()=>{},()=>{},()=>{}).save(data),/ログイン/);});
test('公開設定にパスワードや秘密鍵を受け付けない',()=>{const config={apiKey:'public-placeholder',authDomain:'demo.firebaseapp.com',projectId:'demo',appId:'placeholder',ownerUid:'owner'};assert.deepEqual(publicConfig(config),config);for(const key of ['password','private_key','client_secret'])assert.throws(()=>publicConfig({...config,[key]:'not-a-real-secret'}));});
test('ログアウトはセッションと購読を破棄',async()=>{const s=store();let signedOut=false,unsubscribed=false;s.sdk.signOut=async()=>{signedOut=true;};s.unsubscribe=()=>{unsubscribed=true;};await s.logout();assert.ok(signedOut&&unsubscribed);assert.equal(s.user,null);assert.equal(s.ready,false);});
