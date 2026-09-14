import http from 'node:http';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {OAuth2Client} from 'google-auth-library';
import {createHandler,HttpError} from './api.js';
const {GOOGLE_CLIENT_ID,ALLOWED_ORIGIN,GOOGLE_CLOUD_PROJECT}=process.env;
if(!GOOGLE_CLIENT_ID||!ALLOWED_ORIGIN||!GOOGLE_CLOUD_PROJECT)throw Error('Required public runtime configuration is missing');
if(new URL(ALLOWED_ORIGIN).origin!==ALLOWED_ORIGIN||!ALLOWED_ORIGIN.startsWith('https://'))throw Error('ALLOWED_ORIGIN must be an exact HTTPS origin');
initializeApp({credential:applicationDefault(),projectId:GOOGLE_CLOUD_PROJECT});
const db=getFirestore(),auth=getAuth(),google=new OAuth2Client(GOOGLE_CLIENT_ID);
const path=uid=>db.doc(`users/${uid}/todo/state`);
const uidCache=new Map();
async function resolveUid(sub){
  if(uidCache.has(sub))return uidCache.get(sub);
  const ref=db.doc(`todoIdentities/${sub}`),existing=await ref.get();
  let uid=existing.exists?existing.data().uid:null;
  if(!uid){
    let suggested=`google_${sub}`;
    // Preserve records created by the former Firebase browser login.
    try{const user=await auth.getUserByProviderUid('google.com',sub);if(user.disabled)throw Error('Account disabled');suggested=user.uid;}
    catch(error){if(error.code!=='auth/user-not-found')throw error;}
    uid=await db.runTransaction(async tx=>{const snapshot=await tx.get(ref);if(snapshot.exists)return snapshot.data().uid;tx.create(ref,{uid:suggested});return suggested;});
  }
  if(typeof uid!=='string'||uid.includes('/')||uid.length>128)throw Error('Invalid identity mapping');
  if(uidCache.size>5000)uidCache.clear();uidCache.set(sub,uid);return uid;
}
const handler=createHandler({origin:ALLOWED_ORIGIN,
  verifyToken:async token=>{
    const ticket=await google.verifyIdToken({idToken:token,audience:GOOGLE_CLIENT_ID}),claims=ticket.getPayload();
    if(!claims?.email_verified||!/^\d{1,64}$/.test(claims.sub))throw Error('Unverified Google identity');
    return {uid:await resolveUid(claims.sub),email:claims.email};
  },
  readState:async uid=>{const snapshot=await path(uid).get();return snapshot.exists?{data:snapshot.data().data,revision:snapshot.data().revision}:{data:null,revision:0};},
  writeState:async(uid,body)=>db.runTransaction(async tx=>{
    const ref=path(uid),snapshot=await tx.get(ref),revision=snapshot.exists?snapshot.data().revision:0;
    if(revision!==body.revision)throw new HttpError(409,'別の端末で更新されています。バックアップ後に最新データを読み込んでください。');
    tx.set(ref,{data:body.data,revision:revision+1,updatedAt:FieldValue.serverTimestamp()});return {revision:revision+1};
  })
});
const server=http.createServer(handler);server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Todo Declare API listening'));
