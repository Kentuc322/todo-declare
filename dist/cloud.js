import {firebaseConfig} from './firebase-config.js';
import {validate} from './core.js';
export class CloudStore {
  configured=Boolean(firebaseConfig?.apiKey&&firebaseConfig?.projectId&&firebaseConfig?.authDomain&&firebaseConfig?.appId);
  user=null;ready=false;revision=0;busy=false;unsubscribe=null;
  constructor(onUser,onRemote,onError){Object.assign(this,{onUser,onRemote,onError});}
  async init(){
    if(!this.configured)return;
    const [app,auth,db]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
    ]);
    this.authAPI=auth;this.dbAPI=db;
    const instance=app.initializeApp(firebaseConfig);
    this.auth=auth.getAuth(instance);this.db=db.getFirestore(instance);
    auth.onAuthStateChanged(this.auth,user=>{void this.switchUser(user).catch(this.onError);});
  }
  async switchUser(user){
    this.unsubscribe?.();this.unsubscribe=null;this.user=user;this.ready=false;this.revision=0;
    this.onUser(user,null);
    if(!user)return;
    const uid=user.uid;
    this.ref=this.dbAPI.doc(this.db,'users',uid,'todo','state');
    const snapshot=await this.dbAPI.getDocFromServer(this.ref);
    if(this.user?.uid!==uid)return;
    const record=snapshot.exists()?snapshot.data():null;
    this.revision=record?.revision||0;this.ready=true;
    this.onUser(user,record?validate(record.data):{version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}});
    this.unsubscribe=this.dbAPI.onSnapshot(this.ref,{includeMetadataChanges:true},snap=>{
      if(this.user?.uid!==uid||this.busy||snap.metadata.fromCache||snap.metadata.hasPendingWrites||!snap.exists())return;
      const record=snap.data();
      if(record.revision>this.revision)this.onRemote(validate(record.data),record.revision);
    },this.onError);
  }
  async login(){if(!this.auth)throw Error('Firebaseの初期設定が必要です。');const provider=new this.authAPI.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return this.authAPI.signInWithPopup(this.auth,provider);}
  async logout(){if(this.busy)throw Error('保存が終わってからログアウトしてください。');await this.authAPI.signOut(this.auth);}
  async save(data){
    if(!this.user||!this.ready)throw Error('クラウドデータの読み込みが完了していません。');
    if(this.busy)throw Error('保存中です。少し待ってから再度お試しください。');
    if(new TextEncoder().encode(JSON.stringify(data)).length>750000)throw Error('クラウド保存の容量上限に達しました。バックアップを保存してください。');
    validate(data);
    const expected=this.revision,ref=this.ref,uid=this.user.uid;
    this.busy=true;
    try{
      await this.dbAPI.runTransaction(this.db,async tx=>{
        const snapshot=await tx.get(ref),current=snapshot.exists()?snapshot.data().revision:0;
        if(this.user?.uid!==uid)throw Error('ログインユーザーが変更されました。');
        if(current!==expected)throw Error('別の端末で更新されています。バックアップを保存してから、最新データを読み込んでください。');
        tx.set(ref,{data,revision:expected+1,updatedAt:this.dbAPI.serverTimestamp()});
      });
      this.revision=expected+1;
    }finally{this.busy=false;}
  }
  async reload(){if(!this.user)throw Error('Googleログインが必要です。');await this.switchUser(this.user);}
}
