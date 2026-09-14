import {cloudConfig} from './cloud-config.js';
import {validate} from './core.js';
const empty=()=>({version:1,days:{},settings:{morning:'08:00',night:'20:00',evening:'21:00'}});
export class CloudStore {
  user=null;ready=false;revision=0;busy=false;token=null;pollTimer=null;loginPending=null;
  configured=Boolean(cloudConfig.apiBase&&cloudConfig.googleClientId);
  constructor(onUser,onRemote,onError){Object.assign(this,{onUser,onRemote,onError});}
  async init(){
    if(!this.configured)return;
    const url=new URL(cloudConfig.apiBase);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('バックエンドURLはHTTPSで指定してください。');
    if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cloudConfig.googleClientId))throw Error('Google OAuthクライアントIDが不正です。');
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client?hl=ja';script.async=true;
      script.onload=resolve;script.onerror=()=>reject(Error('Googleログインを読み込めません。'));document.head.append(script);
    });
    google.accounts.id.initialize({client_id:cloudConfig.googleClientId,auto_select:false,callback:response=>{
      const pending=this.loginPending;if(!pending)return;
      this.loginPending=null;pending.dialog.remove();
      void this.acceptCredential(response.credential).then(pending.resolve,pending.reject);
    }});
    this.gisReady=true;
  }
  async request(path,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(cloudConfig.apiBase.replace(/\/$/,'')+path,{
        ...options,signal:controller.signal,credentials:'omit',cache:'no-store',
        headers:{Authorization:`Bearer ${this.token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}
      });
      const result=await response.json();
      if(!response.ok){if(response.status===401)this.ready=false;throw Error(result.error||'クラウド通信に失敗しました。');}
      return result;
    }finally{clearTimeout(timer);}
  }
  async acceptCredential(token){
    this.token=token;
    try{
      const result=await this.request('/v1/me');
      this.user=result.user;this.ready=false;this.onUser(this.user,null);
      await this.reload();
      clearInterval(this.pollTimer);this.pollTimer=setInterval(()=>{void this.poll().catch(this.onError);},30000);
    }catch(error){if(!this.user)this.token=null;throw error;}
  }
  login(){
    if(!this.gisReady)return Promise.reject(Error('バックエンドの初期設定、またはGoogleログインの読み込みが必要です。'));
    if(this.loginPending)return Promise.reject(Error('Googleログイン画面は既に開いています。'));
    return new Promise((resolve,reject)=>{
      const dialog=document.createElement('dialog'),title=document.createElement('h2'),buttonHost=document.createElement('div'),close=document.createElement('button');
      title.textContent='Googleアカウントを選択';close.textContent='キャンセル';dialog.append(title,buttonHost,close);document.body.append(dialog);
      this.loginPending={dialog,resolve,reject};
      const cancel=()=>{this.loginPending=null;dialog.remove();reject(Error('ログインをキャンセルしました。'));};
      close.onclick=cancel;dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
      google.accounts.id.renderButton(buttonHost,{theme:'outline',size:'large',locale:'ja'});dialog.showModal();
    });
  }
  async logout(){
    if(this.busy)throw Error('保存完了までお待ちください。');
    clearInterval(this.pollTimer);this.token=null;this.user=null;this.ready=false;this.revision=0;
    if(this.gisReady)google.accounts.id.disableAutoSelect();this.onUser(null,null);
  }
  async reload(){
    if(!this.user)throw Error('Googleログインが必要です。');
    const uid=this.user.uid;this.ready=false;
    const record=await this.request('/v1/state');
    if(this.user?.uid!==uid)return;
    const data=validate(record.data||empty());
    this.revision=record.revision;this.ready=true;this.onUser(this.user,data);
  }
  async poll(){
    if(!this.user||!this.ready||this.busy||document.hidden)return;
    const uid=this.user.uid,record=await this.request('/v1/state');
    if(this.user?.uid===uid&&!this.busy&&record.revision>this.revision)this.onRemote(validate(record.data),record.revision);
  }
  async save(data){
    if(!this.user||!this.ready)throw Error('読み込み未完了、またはログインの有効期限切れです。Googleでログインし直してください。');
    if(this.busy)throw Error('保存中です。');validate(data);this.busy=true;
    try{const result=await this.request('/v1/state',{method:'PUT',body:JSON.stringify({data,revision:this.revision})});this.revision=result.revision;}
    finally{this.busy=false;}
  }
}
