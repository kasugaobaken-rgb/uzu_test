// Generic engine only. Story data is supplied privately by the facilitator.
export function makeEngine(catalog){
const VERSION=catalog.version,units=catalog.units,cards=new Map(catalog.cards.map(c=>[c.id,c])),evidence=catalog.evidence,arrivals=catalog.arrivals,backgrounds=catalog.backgrounds;
class GameError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=(s,status)=>{throw new GameError(s,status);};
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const hex=n=>[...bytes(n)].map(v=>v.toString(16).padStart(2,'0')).join('');
const token=()=>btoa(String.fromCharCode(...bytes(24))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function randomInt(max){const limit=Math.floor(4294967296/max)*max;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);return n%max;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function createRoom(){
 const room={id:hex(4).toUpperCase(),hostToken:token(),phase:'lobby',rev:1,offers:[],photos:Array.from({length:6},(_,i)=>({id:String(i+1),title:`写真 ${String(i+1).padStart(2,'0')}`,caption:'',image:null})),players:[],created:Date.now(),started:null};
 for(let seat=1;seat<=5;seat++)room.players.push({seat,token:token(),hand:[],restored:[],shared:[],notices:[],tutorial:false,joined:false,steals:1,vote:null});
 return room;
}
function identify(room,key){if(key===room.hostToken)return {host:true};const player=room.players.find(p=>p.token===key);if(!player)fail('参加情報が確認できません。招待リンクを開き直してください。',401);return {host:false,player};}
function notice(p,text){p.notices.unshift({id:token().slice(0,9),text,at:Date.now()});p.notices=p.notices.slice(0,20);}
function stateCard(id,seat){const c=cards.get(id);return {id:c.id,title:c.title,text:c.text,kind:c.kind,needed:c.owner===seat};}
function snapshot(room,who){
 const common={id:room.id,phase:room.phase,rev:room.rev,started:room.started,evidence,photos:room.photos.map(({image,...p})=>({...p,ready:Boolean(image)})),players:room.players.map(p=>({seat:p.seat,joined:p.joined})),version:VERSION};
 if(who.host)return {...common,host:true,invites:room.players.map(p=>({seat:p.seat,token:p.token})),progress:room.players.map(p=>({seat:p.seat,tutorial:p.tutorial,hand:p.hand.length,restored:p.restored.length,vote:p.vote})),pairCount:units.length,cardCount:cards.size,photoCandidates:['追加の現場画像','追加の現場画像','追加の現場画像','追加の現場画像','追加の現場画像','追加の現場画像']};
 const p=who.player;
 const restored=p.restored.map(key=>{const u=units.find(u=>u.key===key);return {key:u.key,title:u.title,text:u.text};});
 return {...common,host:false,me:{seat:p.seat,tutorial:p.tutorial,arrival:arrivals[p.seat],background:backgrounds[p.seat],hand:p.hand.map(id=>stateCard(id,p.seat)),restored,shared:p.shared,notices:p.notices,steals:p.steals,vote:p.vote,needed:units.filter(u=>u.owner===p.seat).map(u=>({key:u.key,title:u.title,cards:u.cardIds,done:p.restored.includes(u.key)}))},offers:room.offers.filter(o=>o.from===p.seat||o.to===p.seat).map(o=>({id:o.id,from:o.from,to:o.to,cardId:o.cardId,request:o.request})),results:room.phase==='finished'?Array.from({length:5},(_,i)=>({seat:i+1,votes:room.players.filter(p=>p.vote===i+1).length})):null};
}
function act(room,who,a){
 if(!a||typeof a.type!=='string')fail('操作が指定されていません。');
 const p=who.player;
 if(!who.host&&['begin','votePhase','finish','photo','removePhoto'].includes(a.type))fail('進行担当のみ操作できます。',403);
 if(a.type==='tutorial'&&!who.host){p.tutorial=true;p.joined=true;room.rev++;return;}
 if(a.type==='join'&&!who.host){p.joined=true;room.rev++;return;}
 if(who.host){
  if(a.type==='begin'){
   if(room.phase!=='lobby')fail('すでに開始しています。');
   const deck=shuffle([...cards.keys()]);room.players.forEach(p=>{p.hand=[];p.restored=[];p.shared=[];p.steals=1;p.vote=null;p.notices=[];});
   deck.forEach((id,i)=>room.players[i%5].hand.push(id));room.phase='play';room.started=Date.now();room.offers=[];
  }else if(a.type==='votePhase'){if(room.phase!=='play')fail('交換中から投票へ進めてください。');room.phase='vote';room.offers=[];
  }else if(a.type==='finish'){if(room.phase!=='vote')fail('投票中に終了できます。');room.phase='finished';
  }else if(a.type==='photo'){
   const ph=room.photos.find(p=>p.id===String(a.id));if(!ph)fail('写真枠がありません。');
   if(typeof a.image!=='string'||a.image.length>2200000)fail('写真は約1.5MB以下にしてください。');
   const match=a.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)fail('PNG・JPEG・WebPを選んでください。');
   const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
   const ascii=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
   const valid=match[1]==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
   if(!valid)fail('画像ファイルを確認できません。');
   ph.image={dataUrl:a.image,type:'image/'+match[1]};ph.title=String(a.title||ph.title).slice(0,100);ph.caption=String(a.caption||'').slice(0,1500);
  }else if(a.type==='removePhoto'){const ph=room.photos.find(p=>p.id===String(a.id));if(!ph)fail('写真枠がありません。');ph.image=null;
  }else fail('進行担当向けの操作ではありません。',403);
  room.rev++;return;
 }
 if(a.type==='vote'){
  if(room.phase!=='vote')fail('まだ投票時間ではありません。');const seat=Number(a.seat);if(!room.players.some(p=>p.seat===seat))fail('投票先を選んでください。');p.vote=seat;room.rev++;return;
 }
 if(room.phase!=='play')fail('カードの操作は交換時間中に行えます。');
 const target=()=>{const t=room.players.find(p=>p.seat===Number(a.to));if(!t||t===p)fail('相手を選んでください。');return t;};
 const has=(player,id)=>player.hand.includes(String(id));
 const move=(from,to,id)=>{id=String(id);if(!has(from,id))fail('カードが移動しています。手札を確認してください。');from.hand.splice(from.hand.indexOf(id),1);to.hand.push(id);};
 if(a.type==='give'){
  const t=target();move(p,t,a.cardId);notice(t,`PC${p.seat}から記憶カード #${a.cardId}を受け取りました。`);
 }else if(a.type==='offer'){
  const t=target();if(!has(p,a.cardId))fail('そのカードは手元にありません。');if(room.offers.some(o=>o.from===p.seat&&o.cardId===String(a.cardId)))fail('このカードは交換提案中です。');if(room.offers.length>=20)fail('未処理の提案を先に確認してください。');
  const request=String(a.request||'').trim().replace(/^#/,'').toUpperCase();
  if(request&&!/^(?:\d{3}-[AB]|J)$/.test(request))fail('カード番号は123-A、123-B、Jの形式で指定してください。');
  if(request&&!cards.has(request))fail('そのカード番号はありません。');
  room.offers.push({id:token().slice(0,12),from:p.seat,to:t.seat,cardId:String(a.cardId),request});notice(t,`PC${p.seat}から交換の提案が届きました。`);
 }else if(a.type==='accept'){
  const o=room.offers.find(o=>o.id===a.offerId&&o.to===p.seat);if(!o)fail('交換提案が見つかりません。');const from=room.players[o.from-1];
  if(!has(from,o.cardId)||!has(p,a.cardId))fail('カードが移動しています。提案を取り消して確認してください。');if(o.request&&o.request!==String(a.cardId))fail(`指定されたカード #${o.request}を選んでください。`);
  move(from,p,o.cardId);move(p,from,a.cardId);room.offers=room.offers.filter(x=>x.id!==o.id);notice(from,`PC${p.seat}との交換が成立しました。`);notice(p,`PC${from.seat}との交換が成立しました。`);
 }else if(a.type==='decline'){
  const o=room.offers.find(o=>o.id===a.offerId&&(o.to===p.seat||o.from===p.seat));if(!o)fail('交換提案がありません。');room.offers=room.offers.filter(x=>x.id!==o.id);
 }else if(a.type==='steal'){
  const t=target();if(p.steals<1)fail('この効果は使用済みです。');if(!t.hand.length)fail('相手には手札がありません。');const id=t.hand[randomInt(t.hand.length)];move(t,p,id);p.steals--;notice(t,`記憶カード #${id}が手札から失われました。取得者は記録されていません。`);notice(p,`記憶カード #${id}を取得しました。`);
 }else if(a.type==='restore'){
  const u=units.find(u=>u.key===String(a.key)&&u.owner===p.seat);if(!u||!u.cardIds.every(id=>has(p,id)))fail('自分の対象となる二枚をそろえてください。');if(p.restored.includes(u.key))fail('復元済みです。');p.hand=p.hand.filter(id=>!u.cardIds.includes(id));p.restored.push(u.key);notice(p,'一つの記憶を復元しました。復元した記憶で読み返せます。');
 }else if(a.type==='share'){
  const u=units.find(u=>u.key===String(a.key)&&p.restored.includes(u.key));if(!u)fail('復元した自分の記憶を選んでください。');const ts=a.to==='all'?room.players.filter(x=>x!==p):[target()];
  for(const t of ts){if(!t.shared.some(s=>s.key===u.key&&s.from===p.seat))t.shared.push({key:u.key,from:p.seat,title:u.title,text:u.text});notice(t,`PC${p.seat}から復元した情報が共有されました。`);}
 }else fail('操作を確認できません。');
 room.rev++;
}

return {createRoom,identify,snapshot,act};
}
