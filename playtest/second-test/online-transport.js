import '../firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInAnonymously,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getDatabase,ref,get,set,onValue,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import {makeEngine} from './online-engine.mjs';
import {populateViews,settleRoom,hasWork} from './online-state.mjs';
const firebase=initializeApp(window.FIREBASE_CONFIG),auth=getAuth(firebase),db=getDatabase(firebase);
const boot=new Promise(resolve=>{const off=onAuthStateChanged(auth,()=>{off();resolve();});});
let catalog=null,current=null,listeners=[],lastPresence=null,connected=false,assets={};
const sessions=new Map(),processors=new Map(),connecting=new Map();
const emit=()=>listeners.forEach(fn=>fn());
onValue(ref(db,'.info/connected'),s=>{connected=s.val()===true;emit();});
export const onChange=fn=>listeners.push(fn);
export const photoUrl=p=>assets[p.id]||'';
export function statusText(){return !connected?'再接続中':lastPresence&&Date.now()-lastPresence.at<45000?'同期中':'進行画面の再開待ち';}
export async function hostLogin(){await boot;await signInWithPopup(auth,new GoogleAuthProvider());emit();}
export async function loadCatalog(file){
 if(!file||file.size>250000)throw Error('運営専用の記憶データ.jsonを選んでください。');
 const c=JSON.parse(await file.text());
 if(c.units?.length!==36||c.cards?.length!==73||c.evidence?.length!==9||!c.version||!c.backgrounds)throw Error('運営データの形式を確認してください。');
 makeEngine(c);catalog=c;
}
function safeId(value,pattern){if(!pattern.test(value||''))throw Error('招待リンクを確認してください。');return value;}
function roomPath(id){return `onlineV3/${safeId(id,/^[A-F0-9]{8}$/)}`;}
async function ensureAuth(){await boot;if(!auth.currentUser)await signInAnonymously(auth);return auth.currentUser;}
function startProcessor(id){
 if(processors.has(id))return;
 const base=roomPath(id),rootRef=ref(db,base),p={busy:false,data:null};processors.set(id,p);
 async function process(){
  if(p.busy||!hasWork(p.data))return;p.busy=true;
  try{await runTransaction(rootRef,data=>data?.ownerUid===auth.currentUser?.uid&&hasWork(data)?settleRoom(data):undefined,{applyLocally:false});}
  catch(e){console.error('進行処理が待機しています',e.code);}
  finally{p.busy=false;if(hasWork(p.data))setTimeout(process,750);}
 }
 p.off=onValue(rootRef,s=>{p.data=s.val();process();},()=>{p.data=null;});
 const beat=()=>set(ref(db,base+'/presence'),{at:serverTimestamp()}).catch(()=>{});
 beat();p.timer=setInterval(beat,15000);
 // Reload recovery: catalog and canonical state are kept in the host-only DB area.
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
 if(role==='host'){
  if(user.isAnonymous)throw Error('進行担当のGoogleログインを行ってから、このリンクを開き直してください。');
  const owner=(await get(ref(db,base+'/ownerUid'))).val();
  if(owner!==user.uid)throw Error('部屋を作ったGoogleアカウントでログインしてください。');
  startProcessor(id);
 }else{
  const uidRef=ref(db,boxPath+'/uid');
  let claimed=(await get(uidRef)).val();
  if(!claimed){const claim=await runTransaction(uidRef,uid=>uid===null?user.uid:undefined,{applyLocally:false});claimed=claim.snapshot.val();}
  if(claimed!==user.uid)throw Error('このPCリンクは別のブラウザで使用中です。同じブラウザで開いてください。');
 }
 const s={id,key,view:null};sessions.set(sk,s);current=s;
 s.ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('進行担当の画面が応答していません。担当者が進行リンクを開いてから再読み込みしてください。')),40000);
  s.off=onValue(ref(db,boxPath+'/view'),snap=>{const v=snap.val();if(v?._readyUid===user.uid){s.view=normalizeView(v);clearTimeout(timer);resolve();emit();}},e=>{clearTimeout(timer);reject(e);});
 });
 try{await s.ready;}catch(e){s.off?.();sessions.delete(sk);throw e;}
 s.presenceOff=onValue(ref(db,base+'/presence'),snap=>{lastPresence=snap.val();emit();});
 s.assetsOff=onValue(ref(db,base+'/assets'),v=>{assets=v.val()||{};emit();});
 return s;
}
function arr(v){return Array.isArray(v)?v:Object.values(v||{});}
function normalizeView(v){
 v.players=arr(v.players);v.photos=arr(v.photos);v.evidence=arr(v.evidence);v.started??=null;
 if(v.host){v.invites=arr(v.invites);v.progress=arr(v.progress);v.photoCandidates=arr(v.photoCandidates);}
 else{for(const k of ['hand','restored','shared','notices','needed'])v.me[k]=arr(v.me[k]);v.offers=arr(v.offers);v.results=v.results?arr(v.results):null;v.me.vote??=null;for(const u of v.me.needed)u.cards=arr(u.cards);}
 return v;
}
async function command(s,body){
 const nonce=crypto.randomUUID(),base=roomPath(s.id)+'/mailboxes/'+s.key;
 // No optimistic success: only the facilitator's committed receipt confirms an action.
 let cleanup=()=>{};
 const result=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{off();reject(Error('操作の完了は未確認です。進行担当の画面と通知を確認し、連打せず再接続を待ってください。'));},25000);
  const off=onValue(ref(db,base+'/receipts/'+nonce),snap=>{
   const receipt=snap.val();if(!receipt)return;clearTimeout(timer);off();
   if(receipt.ok)resolve(receipt);else reject(Error(receipt.error));
  },e=>{clearTimeout(timer);reject(e);});
  cleanup=()=>{clearTimeout(timer);off();};
 });
 // Attach immediately, so a failed request write cannot cause an unhandled rejection.
 result.catch(()=>{});
 try{await set(ref(db,base+'/requests/'+nonce),{payload:JSON.stringify(body),at:serverTimestamp()});}catch(e){cleanup();throw e;}
 const receipt=await result;
 // A receipt and its corresponding private view were committed atomically.
 s.view=normalizeView((await get(ref(db,base+'/view'))).val());
 return s.view;
}
export async function request(url,body,key){
 if(url==='/api/rooms'&&body){
  await boot;if(!auth.currentUser||auth.currentUser.isAnonymous)throw Error('先に進行担当としてGoogleログインしてください。');
  if(!catalog)throw Error('先に運営用の記憶データ.jsonを選んでください。');
  const game=makeEngine(catalog),room=game.createRoom(),uid=auth.currentUser.uid;
  const mailboxes={[room.hostToken]:{role:'host',uid}};
  for(const p of room.players)mailboxes[p.token]={role:p.seat};
  const data=populateViews({ownerUid:uid,private:{catalog,state:room},mailboxes,members:{[uid]:true},presence:{at:Date.now()}});
  await runTransaction(ref(db,roomPath(room.id)),old=>old===null?data:undefined,{applyLocally:false}).then(x=>{if(!x.committed)throw Error('部屋番号が重複しました。もう一度作成してください。');});
  startProcessor(room.id);
  return {id:room.id,token:room.hostToken,invites:room.players.map(p=>({seat:p.seat,token:p.token}))};
 }
 const m=url.match(/^\/api\/rooms\/([A-F0-9]{8})(\/action)?$/);
 if(!m)throw Error('操作先が不明です。');
 const s=await connect(m[1],key);return m[2]?command(s,body):s.view;
}
