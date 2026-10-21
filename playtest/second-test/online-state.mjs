import {makeEngine} from './online-engine.mjs';
const list=x=>Array.isArray(x)?x:Object.values(x||{});
export function normalizeRoom(raw){
 const r=structuredClone(raw);r.offers=list(r.offers);r.photos=list(r.photos);
 r.started??=null;
 for(const p of r.photos){p.image??=null;p.caption??='';}
 r.players=list(r.players).sort((a,b)=>a.seat-b.seat);
 for(const p of r.players){for(const k of ['hand','restored','shared','notices'])p[k]=list(p[k]);p.vote??=null;}
 return r;
}
export function populateViews(data){
 const game=makeEngine(data.private.catalog),room=normalizeRoom(data.private.state);
 data.assets||={};
 for(const ph of room.photos){
  if(ph.image?.dataUrl){data.assets[ph.id]=ph.image.dataUrl;ph.image={ready:true};}
  else if(!ph.image)delete data.assets[ph.id];
 }
 for(const [token,box] of Object.entries(data.mailboxes))box.view={...game.snapshot(room,game.identify(room,token)),_readyUid:box.uid||null};
 data.private.state=room;return data;
}
export function hasWork(data){return Object.values(data?.mailboxes||{}).some(b=>b.uid&&(!data.members?.[b.uid]||b.view?._readyUid!==b.uid)||Object.keys(b.requests||{}).length);}
// One atomic DB transaction handles state, requests, receipts, and role-specific views.
export function settleRoom(raw,now=Date.now()){
 const data=structuredClone(raw),game=makeEngine(data.private.catalog);
 data.members||={};let room=normalizeRoom(data.private.state);
 const pending=[];
 for(const [token,b] of Object.entries(data.mailboxes)){
  if(b.uid)data.members[b.uid]=true;
  for(const [nonce,q] of Object.entries(b.requests||{}))pending.push({token,nonce,q});
 }
 pending.sort((a,b)=>(a.q.at||0)-(b.q.at||0)||a.nonce.localeCompare(b.nonce));
 for(const {token,nonce,q} of pending){
  const box=data.mailboxes[token];box.receipts||={};
  if(!box.receipts[nonce]){
   try{
    const candidate=normalizeRoom(room);
    game.act(candidate,game.identify(candidate,token),JSON.parse(q.payload));
    room=candidate;box.receipts[nonce]={ok:true,rev:room.rev,at:now};
   }catch(e){box.receipts[nonce]={ok:false,error:e.status?e.message:'操作を処理できませんでした。',at:now};}
  }
  delete box.requests[nonce];
  const old=Object.entries(box.receipts).sort((a,b)=>b[1].at-a[1].at);
  for(const [id] of old.slice(30))delete box.receipts[id];
 }
 data.private.state=room;return populateViews(data);
}
