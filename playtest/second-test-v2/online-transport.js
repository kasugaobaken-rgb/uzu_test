// V5：第二テスト 交換式 v2 のオンライン通信。V4の仕組み（進行担当ブラウザが処理・参加者は自分の受信箱だけ読む）をそのまま使う。
import '../firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInAnonymously} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getDatabase,ref,get,set,onValue,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import {makeEngine} from './online-engine.mjs';
import {populateViews,settleRoom,hasWork,normalizeCatalog} from './online-state.mjs';
import {decryptCatalog,accessHash} from './online-vault.mjs';
const firebase=initializeApp(window.FIREBASE_CONFIG),auth=getAuth(firebase),db=getDatabase(firebase);
const boot=new Promise(resolve=>{onAuthStateChanged(auth,()=>{resolve();queueMicrotask(()=>emit());});});
let catalog=null,creationHash=null,current=null,listeners=[],lastPresence=null,connected=false,authTask=null,processorError='',serverOffset=0;
const sessions=new Map(),processors=new Map(),connecting=new Map();
const emit=()=>listeners.forEach(fn=>fn());
onValue(ref(db,'.info/connected'),s=>{connected=s.val()===true;emit();});
// 残り時間は全員がFirebaseのサーバー時刻を基準にする（端末の時計のずれを受けない）。
onValue(ref(db,'.info/serverTimeOffset'),s=>{serverOffset=Number(s.val())||0;});
export const serverNow=()=>Date.now()+serverOffset;
export const onChange=fn=>listeners.push(fn);
export const isUnlocked=()=>Boolean(catalog&&creationHash);
export function statusText(){return processorError?'進行処理エラー：'+processorError:!connected?'再接続中':lastPresence&&Math.abs(serverNow()-lastPresence.at)<45000?'接続済み':'進行担当の画面が閉じています';}
export async function unlockHost(secret){
 const response=await fetch(new URL('host-vault.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('最新版の公開ファイルが不足しています。host-vault.json を確認してください。');
 const c=await decryptCatalog(await response.json(),secret);
 makeEngine(c);await ensureAuth();catalog=c;creationHash=await accessHash(secret);emit();
}
function safeId(value,pattern){if(!pattern.test(value||''))throw Error('招待リンクを確認してください。');return value;}
function roomPath(id){return `onlineV4/${safeId(id,/^[A-F0-9]{8}$/)}`;}
async function ensureAuth(){await boot;if(auth.currentUser)return auth.currentUser;if(!authTask)authTask=signInAnonymously(auth).finally(()=>{authTask=null;});return (await authTask).user;}
function startProcessor(id){
 if(processors.has(id))return;
 const base=roomPath(id),rootRef=ref(db,base),p={busy:false,data:null};processors.set(id,p);
 async function process(){
  if(p.busy||!hasWork(p.data,serverNow()))return;p.busy=true;
  try{await runTransaction(rootRef,data=>data?.ownerUid===auth.currentUser?.uid&&hasWork(data,serverNow())?settleRoom(data,serverNow()):undefined,{applyLocally:false});processorError='';}
  catch(e){processorError=e.code||'通信を確認してください';emit();}
  finally{p.busy=false;if(hasWork(p.data,serverNow()))setTimeout(process,750);}
 }
 p.off=onValue(rootRef,s=>{p.data=s.val();process();},e=>{p.data=null;processorError=e.code||'権限を確認してください';emit();});
 // 40分・5分の締め切りは、進行担当の画面が時刻を見て処理する。
 p.clock=setInterval(process,1000);
 const beat=()=>set(ref(db,base+'/presence'),{at:serverTimestamp()}).catch(()=>{});
 beat();p.timer=setInterval(beat,15000);
}
async function connect(id,key){
 const sk=id+':'+key;
 if(connecting.has(sk))return connecting.get(sk);
 const pending=connectInternal(id,key);connecting.set(sk,pending);
 try{return await pending;}finally{connecting.delete(sk);}
}
async function connectInternal(id,key){
 safeId(key,/^[A-Za-z0-9_-]{32}$/);const sk=id+':'+key;
 if(sessions.has(sk)){current=sessions.get(sk);return current;}
 const user=await ensureAuth(),base=roomPath(id),boxPath=base+'/mailboxes/'+key;
 const role=(await get(ref(db,boxPath+'/role'))).val();
 if(!role)throw Error('招待リンクが無効、または部屋がありません。');
 const owner=(await get(ref(db,base+'/ownerUid'))).val();
 if(owner===user.uid)startProcessor(id);
 if(role==='host'){
  if(owner!==user.uid)throw Error('この部屋を作成したブラウザで進行リンクを開いてください。');
 }else{
  const uidRef=ref(db,boxPath+'/uid');
  let claimed=(await get(uidRef)).val();
  if(!claimed){const claim=await runTransaction(uidRef,uid=>uid===null?user.uid:undefined,{applyLocally:false});claimed=claim.snapshot.val();}
  if(claimed!==user.uid)throw Error('このPCリンクは別の端末・ブラウザで使用中です。最初に開いた端末で開いてください。');
 }
 const s={id,key,view:null};sessions.set(sk,s);current=s;
 s.ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('進行担当の画面が応答していません。担当者が進行画面を開いてから、再読み込みしてください。')),40000);
  s.off=onValue(ref(db,boxPath+'/view'),snap=>{const v=snap.val();if(v?._readyUid===user.uid){s.view=normalizeView(v);clearTimeout(timer);resolve();emit();}},e=>{clearTimeout(timer);reject(e);});
 });
 try{await s.ready;}catch(e){s.off?.();sessions.delete(sk);throw e;}
 s.presenceOff=onValue(ref(db,base+'/presence'),snap=>{lastPresence=snap.val();emit();});
 return s;
}
const arr=v=>Array.isArray(v)?v.filter(x=>x!=null):Object.values(v||{});
function normalizeView(v){
 for(const k of ['players','photos','evidence','announcements','returnLog','timeline','offers'])v[k]=arr(v[k]);
 v.started??=null;v.deadline??=null;v.results=v.results?arr(v.results):null;
 if(v.host){v.invites=arr(v.invites);v.progress=arr(v.progress);v.photoCandidates=arr(v.photoCandidates);}
 else{for(const k of ['hand','memories','restored','shared','notices','flash'])v.me[k]=arr(v.me[k]);v.me.vote??=null;v.art||={};for(const c of v.me.hand){c.effect??=null;c.title??='';}}
 // 結果発表（空の配列・nullはFirebaseに残らないので戻す）
 v.reveal??=null;
 if(v.reveal){const R=v.reveal;R.votes=arr(R.votes);R.steps=arr(R.steps).map(s=>({...s,lines:arr(s.lines),points:s.points?arr(s.points).map(p=>({...p,refs:arr(p.refs),key:Boolean(p.key)})):undefined}));R.evaluation??=null;if(R.evaluation){const E=R.evaluation;E.identifiers=arr(E.identifiers);E.fastest=arr(E.fastest);E.gather=arr(E.gather).map(g=>({...g,vote:g.vote??null}));}}
 return v;
}
const fresh=v=>v&&{...v,now:serverNow()};
async function command(s,body){
 const nonce=crypto.randomUUID(),base=roomPath(s.id)+'/mailboxes/'+s.key;
 let cleanup=()=>{};
 const result=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{off();reject(Error('操作の完了を確認できません。進行担当の画面が開いているか確認し、連打せずに少し待ってください。'));},25000);
  const off=onValue(ref(db,base+'/receipts/'+nonce),snap=>{
   const receipt=snap.val();if(!receipt)return;clearTimeout(timer);off();
   if(receipt.ok)resolve(receipt);else reject(Error(receipt.error));
  },e=>{clearTimeout(timer);reject(e);});
  cleanup=()=>{clearTimeout(timer);off();};
 });
 result.catch(()=>{});
 try{await set(ref(db,base+'/requests/'+nonce),{payload:JSON.stringify(body),at:serverTimestamp()});}catch(e){cleanup();throw e;}
 await result;
 s.view=normalizeView((await get(ref(db,base+'/view'))).val());
 return fresh(s.view);
}
export async function request(url,body,key){
 if(url==='/api/rooms'&&body){
  await ensureAuth();
  if(!catalog||!creationHash)throw Error('部屋を作れるのは進行担当だけです。担当者専用URLから開いてください。');
  const game=makeEngine(normalizeCatalog(catalog)),room=game.createRoom(),uid=auth.currentUser.uid;
  const mailboxes={[room.hostToken]:{role:'host',uid}};
  for(const p of room.players)mailboxes[p.token]={role:p.seat};
  const data=populateViews({ownerUid:uid,accessHash:creationHash,private:{catalog,state:room},mailboxes,members:{[uid]:true},presence:{at:serverNow()}},serverNow());
  await runTransaction(ref(db,roomPath(room.id)),old=>old===null?data:undefined,{applyLocally:false}).then(x=>{if(!x.committed)throw Error('部屋番号が重複しました。もう一度作成してください。');});
  startProcessor(room.id);
  return {id:room.id,token:room.hostToken,invites:room.players.map(p=>({seat:p.seat,token:p.token}))};
 }
 const m=url.match(/^\/api\/rooms\/([A-F0-9]{8})(\/action)?$/);
 if(!m)throw Error('操作先が不明です。');
 const s=await connect(m[1],key);return m[2]?command(s,body):fresh(s.view);
}
