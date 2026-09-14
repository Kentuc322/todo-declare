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
test('復元した認証ユーザーで共有設定を取得し、別端末の更新も反映',async()=>{
  const remote={...data,settings:{morning:'07:00',night:'19:00',evening:'22:00'}};let loaded,updated,watcher;
  const s=new CloudStore((user,state)=>{if(state)loaded=state;},(state,revision)=>{updated={state,revision};},()=>{});
  s.config={ownerUid:'owner'};s.sdk={doc:()=> 'owner/state',getDocFromServer:async()=>({exists:()=>true,data:()=>({data:remote,revision:3})}),onSnapshot:(ref,callback)=>{watcher=callback;return ()=>{};}};
  await s.acceptUser({uid:'owner',email:'owner@example.invalid'});assert.equal(s.ready,true);assert.deepEqual(loaded.settings,remote.settings);
  const changed={...remote,settings:{...remote.settings,evening:'23:00'}};watcher({exists:()=>true,metadata:{hasPendingWrites:false},data:()=>({data:changed,revision:4})});assert.equal(updated.state.settings.evening,'23:00');assert.equal(updated.revision,4);
});
test('復元された別UIDはサインアウトしてデータを取得しない',async()=>{const s=new CloudStore(()=>{},()=>{},()=>{});s.config={ownerUid:'owner'};let signedOut=false;s.sdk={signOut:async()=>{signedOut=true;}};await assert.rejects(s.acceptUser({uid:'other'}),/アクセス権/);assert.equal(signedOut,true);assert.equal(s.user,null);});
