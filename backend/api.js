import {validate} from '../dist/core.js';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function validateState(body){
  if(!body||!Number.isSafeInteger(body.revision)||body.revision<0)throw new HttpError(400,'保存バージョンが不正です。');
  if(Buffer.byteLength(JSON.stringify(body.data)||'')>750000)throw new HttpError(413,'保存容量の上限に達しました。');
  try{validate(body.data);}catch{throw new HttpError(400,'保存データが不正です。');}
  const clean={version:1,settings:{...body.data.settings},days:{}};
  for(const [key,day]of Object.entries(body.data.days)){
    const date=new Date(key+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==key)throw new HttpError(400,'日付が不正です。');
    for(const t of day.tasks){
      if(typeof t.id!=='string'||t.id.length>100||!t.title.trim()||typeof t.condition!=='string'||t.condition.length>300||typeof(t.skill||'')!=='string'||(t.skill||'').length>100)throw new HttpError(400,'タスクが不正です。');
    }
    for(const k of ['learned','next'])if(day[k]!==undefined&&(typeof day[k]!=='string'||day[k].length>2000))throw new HttpError(400,'振り返りが不正です。');
    for(const k of ['declared','reviewed'])if(day[k]!==undefined&&(typeof day[k]!=='string'||!Number.isFinite(Date.parse(day[k]))))throw new HttpError(400,'記録日時が不正です。');
    clean.days[key]={tasks:day.tasks.map(({id,title,condition,minutes,weight,progress,skill})=>({id,title,condition,minutes,weight,progress,skill:skill||''}))};
    for(const k of ['declared','reviewed','learned','next'])if(day[k]!==undefined)clean.days[key][k]=day[k];
  }
  clean.settings={morning:body.data.settings.morning,night:body.data.settings.night,evening:body.data.settings.evening};
  return {data:clean,revision:body.revision};
}
async function readJson(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new HttpError(415,'JSON形式で送信してください。');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>800000)throw new HttpError(413,'リクエストが大きすぎます。');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'JSONが不正です。');}
}
export function createHandler({origin,verifyToken,readState,writeState}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    try{
      if(req.url==='/health'&&req.method==='GET')return send(200,{ok:true});
      if(req.headers.origin!==origin)throw new HttpError(403,'この送信元は許可されていません。');
      res.setHeader('Access-Control-Allow-Origin',origin);
      if(req.method==='OPTIONS'){
        res.setHeader('Access-Control-Allow-Methods','GET, PUT, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');return send(204,null);
      }
      if(!['/v1/me','/v1/state'].includes(req.url))throw new HttpError(404,'ページが見つかりません。');
      if(!(req.method==='GET'||req.method==='PUT'&&req.url==='/v1/state'))throw new HttpError(405,'許可されていない操作です。');
      const match=/^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(req.headers.authorization||'');
      if(!match)throw new HttpError(401,'Googleログインが必要です。');
      let user;try{user=await verifyToken(match[1]);}catch{throw new HttpError(401,'Googleログインが無効、または期限切れです。ログインし直してください。');}
      // Never accept uid, email, document paths or roles from the request body.
      if(req.url==='/v1/me')return send(200,{user});
      if(req.method==='GET')return send(200,await readState(user.uid));
      const body=validateState(await readJson(req));
      return send(200,await writeState(user.uid,body));
    }catch(error){send(error.status||503,{error:error.status?error.message:'クラウド保存に接続できません。時間をおいて再試行してください。'});}
  };
}
