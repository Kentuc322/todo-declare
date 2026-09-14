import {validate} from './core.js';
const CONFIG_KEY='todo-declare.firebase-public-config';
const empty=()=>({version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}});
export function publicConfig(value){
  const keys=['apiKey','authDomain','projectId','appId','ownerUid'];
  if(!value||Object.keys(value).some(key=>!keys.includes(key)))throw Error('公開設定以外の項目は入力しないでください。');
  for(const key of keys)if(typeof value[key]!=='string'||!value[key].trim())throw Error(`${key} が必要です。`);
  if(!/^[a-z0-9-]+$/.test(value.projectId)||value.authDomain!==`${value.projectId}.firebaseapp.com`||!/^[\w-]{1,128}$/.test(value.ownerUid))throw Error('接続設定の形式が不正です。');
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
function formDialog(title,fields){
  return new Promise((resolve,reject)=>{
    const dialog=document.createElement('dialog'),form=document.createElement('form'),heading=document.createElement('h2');heading.textContent=title;form.append(heading);form.id=fields.some(field=>field.type==='password')?'loginForm':'firebaseConfigForm';form.method='post';form.autocomplete='on';
    const inputs={};for(const field of fields){const label=document.createElement('label'),input=document.createElement(field.type==='textarea'?'textarea':'input');label.textContent=field.label;if(field.type!=='textarea')input.type=field.type;input.name=field.name;input.id=`${form.id}-${field.name}`;label.htmlFor=input.id;input.required=true;input.autocomplete=field.autocomplete||'off';inputs[field.name]=input;label.append(input);form.append(label);}
    const submit=document.createElement('button'),cancel=document.createElement('button');submit.type='submit';submit.textContent='続ける';cancel.type='button';cancel.textContent='キャンセル';form.append(submit,cancel);dialog.append(form);document.body.append(dialog);
    const clear=()=>{for(const input of Object.values(inputs))input.value='';dialog.remove();};
    const abort=()=>{clear();reject(Error('操作をキャンセルしました。'));};cancel.onclick=abort;dialog.addEventListener('cancel',event=>{event.preventDefault();abort();});
    form.onsubmit=event=>{event.preventDefault();const values=Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]));if(form.id==='loginForm'){submit.disabled=true;cancel.disabled=true;resolve({...values,finish:clear});}else{clear();resolve(values);}};dialog.showModal();
  });
}
export class CloudStore {
  user=null;ready=false;revision=0;busy=false;configured=false;unsubscribe=null;
  constructor(onUser,onRemote,onError){Object.assign(this,{onUser,onRemote,onError});}
  async init(){
    const raw=globalThis.localStorage?.getItem(CONFIG_KEY);if(!raw)return;
    this.config=publicConfig(JSON.parse(raw));this.configured=true;
    const [app,auth,db]=await Promise.all(['app','auth','firestore'].map(name=>import(`https://www.gstatic.com/firebasejs/12.18.0/firebase-${name}.js`)));
    this.sdk={...auth,...db};const {ownerUid,...config}=this.config;
    this.app=app.initializeApp(config);this.auth=auth.initializeAuth(this.app,{persistence:[auth.indexedDBLocalPersistence,auth.browserLocalPersistence]});this.db=db.getFirestore(this.app);
    await this.auth.authStateReady();await this.acceptUser(this.auth.currentUser);
    this.authObserver=auth.onAuthStateChanged(this.auth,user=>{void this.acceptUser(user).catch(this.onError);});
  }
  async acceptUser(user){
    if(!user){this.unsubscribe?.();this.unsubscribe=null;this.user=null;this.ready=false;this.revision=0;this.onUser(null,null);return;}
    if(user.uid!==this.config.ownerUid){await this.sdk.signOut(this.auth);throw Error('このユーザーにはアクセス権がありません。');}
    if(this.user?.uid===user.uid)return this.loading;
    this.user={uid:user.uid,email:user.email};this.ref=this.sdk.doc(this.db,'users',user.uid,'todo','state');this.onUser(this.user,null);this.loading=this.reload();await this.loading;
  }
  async configure(){
    if(this.user)throw Error('ログアウトしてから設定してください。');
    const values=await formDialog('Firebase公開設定（秘密鍵・パスワードは入力しない）',[{name:'json',label:'apiKey / authDomain / projectId / appId / ownerUid のJSON',type:'textarea'}]);
    const config=publicConfig(JSON.parse(values.json));localStorage.setItem(CONFIG_KEY,JSON.stringify(config));location.reload();
  }
  async login(){
    if(!this.auth)throw Error('Firebase接続設定を確認してください。');if(this.user)throw Error('先にログアウトしてください。');
    const credentials=await formDialog('専用ユーザーでログイン',[{name:'email',label:'メールアドレス',type:'email',autocomplete:'username'},{name:'password',label:'パスワード',type:'password',autocomplete:'current-password'}]);
    try{const result=await this.sdk.signInWithEmailAndPassword(this.auth,credentials.email,credentials.password);await this.acceptUser(result.user);}catch{throw Error('ログインまたはデータの読み込みに失敗しました。入力内容とFirebaseルールを確認してください。');}finally{credentials.finish();credentials.password='';credentials.email='';}
  }
  watch(){
    this.unsubscribe?.();const uid=this.user.uid;
    this.unsubscribe=this.sdk.onSnapshot(this.ref,snapshot=>{
      if(this.user?.uid!==uid||!snapshot.exists()||snapshot.metadata.hasPendingWrites)return;
      const record=snapshot.data();if(!this.busy&&record.revision>this.revision){try{this.onRemote(validate(record.data),record.revision);}catch{this.onError(Error('クラウドのデータ形式を確認してください。'));}}
    },()=>{this.ready=false;this.onError(Error('クラウド接続が失敗しました。アクセスルールを確認し、最新データを読み込んでください。'));});
  }
  async logout(){
    if(this.busy)throw Error('保存完了までお待ちください。');await this.sdk?.signOut(this.auth);this.unsubscribe?.();this.unsubscribe=null;this.user=null;this.ready=false;this.revision=0;this.onUser(null,null);
  }
  async reload(){
    if(!this.user)throw Error('ログインが必要です。');const uid=this.user.uid;this.ready=false;
    const snapshot=await this.sdk.getDocFromServer(this.ref);if(this.user?.uid!==uid)return;
    const record=snapshot.exists()?snapshot.data():{data:empty(),revision:0};const data=validate(record.data);this.revision=record.revision;this.ready=true;this.onUser(this.user,data);this.watch();
  }
  async save(data){
    if(!this.user||!this.ready)throw Error('ログインとクラウドの読み込みが必要です。');if(this.busy)throw Error('保存中です。');const snapshot=structuredClone(validate(data));this.busy=true;
    try{const revision=await this.sdk.runTransaction(this.db,async transaction=>{
      const current=await transaction.get(this.ref),record=current.exists()?current.data():{revision:0};
      if(record.revision!==this.revision)throw Error('別の端末で更新されています。バックアップ後、最新データを読み込んでください。');
      const revision=this.revision+1;transaction.set(this.ref,{data:snapshot,revision,updatedAt:this.sdk.serverTimestamp()});return revision;
    });this.revision=revision;}finally{this.busy=false;}
  }
}
