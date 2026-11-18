// 第二テスト 交換式の試作（2026-10-26）。元の second-test/app.js を作り替えたもの。
import {memoryArtHtml, caseArtHtml, MemoryArtView} from './memory-art.js';
import {memoryArtNumbers} from './art-catalog.mjs';
import {request as onlineRequest, statusText, unlockHost, isUnlocked} from './online-transport.js';
const memoryArt = new MemoryArtView();
// 2026-11-15 UI改修：アルバム・小さな手札・タップで選ぶ交換・下から出る申し込み。ルールとサーバー処理は変更なし。
const artKeys=new Set(memoryArtNumbers);
const artImg=(key,side='')=>artKeys.has(String(key))?`<span class="art-fill" data-memory-figure hidden><img data-memory-art="m${key}${side?'-'+side:''}.webp" alt="" decoding="async"></span>`:'';
const offerLabel=id=>/-B$/.test(id)?'#'+id:id==='J'?'読取不能データ':'効果カード';
const freshRestored=new Map();let seenDone=null;
let cameraRecords=[],renderCameraRecords=()=>'<p class="camera-note">防犯カメラ画像を読み込めませんでした。</p>';
try{({cameraRecords,renderCameraRecords}=await import('./camera-records.js'));}catch{}
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playerCopy=value=>String(value??'').replaceAll('ジョーカー','読取不能データ');
// ジョーカーの内部ID・扱いはそのまま、画面では壊れた記録として見せる。
const corruptedRecord={label:'繝�繧ｿ_縺ｿ��.dat',text:'縺薙�險倬鹸縺ｯ�\n繧｢繝�繧ｿ::��▒�\n�縺ｿ繝�繧�::░��'};
const cardBody=c=>c.kind==='joker'?`<span class="corrupted-data" role="img" aria-label="文字化けして読み取れないデータ"><span aria-hidden="true">${esc(corruptedRecord.text)}</span></span>`:esc(playerCopy(c.text));
let cameraFilter='all';
let handFilter='all';
const disclosureState=new Map(),tabScroll=new Map();
const disclosureOpen=(id)=>disclosureState.get(id)??!matchMedia('(max-width:760px)').matches;
let lastRevealStep=null,lastPhase=null,S=null,auth=null,tab='hand',renderedRev=-1,busy=false,lastNotice=null,lastAnnounce=null,tutorialSelected=new Set(),clockOffset=0;
const names={lobby:'開始前',play:'交換と議論',discuss:'照合と議論',vote:'投票',finished:'終了'};
const params=new URLSearchParams(location.search);
const makeLink=(room,key)=>`${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&key=${encodeURIComponent(key)}`;
const storage={get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
function toast(text){$('toast').textContent=playerCopy(text);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000);}
async function request(url,body,key=auth?.key){return onlineRequest(url,body,key);}
function accept(data){if(!S||data.rev>=S.rev){S=data;clockOffset=data.now-Date.now();}}
async function action(a){if(busy)return;busy=true;try{accept(await request(`/api/rooms/${auth.room}/action`,a));render(true);return true;}catch(e){toast(e.message);return false;}finally{busy=false;}}
function setConnection(ok){const el=$('connection');if(!el)return;el.hidden=ok;el.textContent=ok?'':(statusText()==='進行担当の画面が閉じています'?'進行担当の画面が閉じています。進行担当が画面を開くまで、操作は待機します。':'接続が切れています。つながり直すまでお待ちください…');}
async function poll(){if(!auth)return;try{accept(await request(`/api/rooms/${auth.room}`));setConnection(statusText()==='接続済み');render();}catch(e){setConnection(false);if(!S)toast(e.message);}}
function storeCreated(d,solo){storage.set('uzu-second-v2-host-'+d.id,{...d,solo});return d;}
async function create(solo){$('soloStart').disabled=$('createRoom').disabled=true;try{const d=storeCreated(await request('/api/rooms',{},null),solo);if(solo){await request(`/api/rooms/${d.id}/action`,{type:'begin'},d.token);location.href=makeLink(d.id,d.invites[0].token);}else location.href=makeLink(d.id,d.token);}catch(e){toast(e.message);$('soloStart').disabled=$('createRoom').disabled=false;}}
$('soloStart').onclick=()=>create(true);$('createRoom').onclick=()=>create(false);
const heading=(eyebrow,title,text='',className='')=>`<div class="pane-heading ${className}"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${text?`<p>${esc(text)}</p>`:''}</div></div>`;
const seats=()=>S.players.filter(p=>p.seat!==S.me.seat).map(p=>`<option value="${p.seat}">PC${p.seat}</option>`).join('');
const photoUrl=p=>`/api/rooms/${S.id}/photos/${p.id}?key=${encodeURIComponent(auth.key)}&v=${S.rev}`;
const cardLabel=c=>c.kind==='b'?'#'+c.id:c.kind==='effect'?c.title:corruptedRecord.label;

// 残り時間（交換の15分）
function remaining(){if(!S||!['play','vote'].includes(S.phase)||!S.deadline)return null;return Math.max(0,S.deadline-(Date.now()+clockOffset));}
function fmt(ms){const s=Math.ceil(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
// 残り3分で色が変わり、残り1分で点滅する。進行画面の時計も同じ処理で動かす。
function updateClock(){const r=remaining();document.querySelectorAll('[data-timer]').forEach(el=>{el.hidden=r===null;if(r===null)return;el.innerHTML=`<small>${S.phase==='vote'?'投票 残り':'残り'}</small><b>${fmt(r)}</b>`;el.classList.toggle('urgent',r<(S.phase==='vote'?60000:300000));el.classList.toggle('final',r<60000);});if(r===0)poll();}
setInterval(updateClock,500);

function render(force=false){
 if(!S)return;
 if(!force&&document.activeElement?.matches('input,textarea,select'))return;
 if(!force&&renderedRev===S.rev)return;
 memoryArt.update(S,auth);
 $('landing').hidden=true;$('host').hidden=!S.host;$('game').hidden=S.host;
 $('identity').textContent=S.host?'進行担当':`PC${S.me.seat}`;
 document.body.classList.toggle('in-game',!S.host);
 if(S.host){renderHost();renderedRev=S.rev;updateClock();return;}
 // 40分が終わって投票に移ったら、投票欄のある手札の画面へ移る。
 if(lastPhase&&lastPhase!==S.phase&&S.phase==='vote'){tab='hand';window.scrollTo({top:0,behavior:'instant'});}
 // 結果発表が始まった・進んだら、発表のある手札の画面へ移る。
 if(lastRevealStep!==null&&(S.reveal?.step||0)!==lastRevealStep&&tab!=='hand'){tab='hand';window.scrollTo({top:0,behavior:'instant'});}
 lastPhase=S.phase;
 // 上の帯はPC・段階・残り時間だけ。部屋番号とPC切替は、ひとり確認の部屋のときだけ「確認用の操作」に出す。
 $('seatLabel').textContent=`PC${S.me.seat}`;$('phaseLabel').textContent=names[S.phase];
 $('roomLabel').textContent=`ROOM ${S.id}`;
 const local=storage.get('uzu-second-v2-host-'+S.id);
 $('devBar').hidden=!local?.solo;
 $('soloSwitch').innerHTML=local?.solo?`<label>表示するPC <select id="seatSwitch" aria-label="確認するPC">${local.invites.map(p=>`<option value="${esc(p.token)}" ${p.seat===S.me.seat?'selected':''}>PC${p.seat}</option>`).join('')}</select></label> <a href="${esc(makeLink(S.id,local.token))}" target="_blank" rel="noopener">進行画面を開く ↗</a>`:'';
 if($('seatSwitch'))$('seatSwitch').onchange=e=>location.href=makeLink(S.id,e.target.value);
 $('handCount').textContent=S.me.hand.length;$('restoreCount').textContent=`${S.me.restored.length}/${S.me.memories.length}`;$('timelineCount').textContent=(S.timeline||[]).length||'';
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
 $('pane').hidden=tab==='scene';$('scenePane').hidden=tab!=='scene';
 if(tab==='scene'){if(!$('sceneFrame').getAttribute('src'))$('sceneFrame').src=`scene.html?mode=pixel&session=${S.id}&seat=${S.me.seat}`;}
 else $('pane').innerHTML=({hand:renderHand,timeline:renderTimeline,restored:renderRestored,case:renderCase,photos:renderPhotos,tutorial:renderTutorial}[tab]||renderHand)();
 if(lastNotice!==(S.me.notices[0]?.id||'empty')){if(lastNotice!==null&&S.me.notices[0])toast(S.me.notices[0].text);lastNotice=S.me.notices[0]?.id||'empty';}
 if(lastAnnounce!==(S.announcements[0]?.id||'empty')){if(lastAnnounce!==null&&S.announcements[0])toast(S.announcements[0].text);lastAnnounce=S.announcements[0]?.id||'empty';}
 renderOfferSheet();
 memoryArt.hydrate();renderedRev=S.rev;updateClock();
 queueFlashes();
 // 結果発表が1段進んだら、いちばん新しい段へ移る。
 const step=S.reveal?.step||0;
 if(step!==lastRevealStep){const first=lastRevealStep===null;lastRevealStep=step;if(step&&!first)requestAnimationFrame(()=>$('rv-'+(step-1))?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'}));}
}

// 記憶の断片：自分で記憶を復元した瞬間に、本人の画面にだけ一瞬出る。カード本文とは別の、説明されない記憶。
// 一度出た断片は、この端末では二度と出さない（読み返す場所も作らない）。
let flashQueue=[],flashBusy=false;
function queueFlashes(){
 if(!S||S.host||!S.me.flash?.length)return;
 const store='uzu-second-v2-flash-'+S.id+'-'+S.me.seat,seen=new Set(storage.get(store)||[]);
 let added=false;
 for(const f of S.me.flash){const id=f.key+'@'+f.at;if(seen.has(id))continue;seen.add(id);flashQueue.push(f);added=true;}
 if(!added)return;
 storage.set(store,[...seen].slice(-80));
 if(!flashBusy)nextFlash();
}
function nextFlash(){
 const f=flashQueue.shift(),el=$('memoryFlash');
 if(!f||!el){flashBusy=false;return;}
 flashBusy=true;
 el.className='memory-flash'+(f.truth?' truth':'');
 el.innerHTML=`<div class="flash-noise" aria-hidden="true"></div><p class="flash-text">${esc(f.text)}</p>`;
 // カードの詳細などのダイアログが開いていても、その上に出す（popoverで最前面へ）。
 el.hidden=false;try{el.showPopover?.();}catch{}void el.offsetWidth;el.classList.add('on');
 setTimeout(()=>{el.classList.remove('on');el.classList.add('off');setTimeout(()=>{try{el.hidePopover?.();}catch{}el.hidden=true;el.innerHTML='';el.className='memory-flash';setTimeout(nextFlash,250);},450);},f.truth?2600:2200);
}

// 届いた交換の申し込みは、どのタブにいても画面の下からせり出す。
function renderOfferSheet(){
 const me=S.me,play=S.phase==='play',incoming=S.offers.filter(o=>o.to===me.seat),el=$('offerSheet');
 el.hidden=!incoming.length;
 if(!incoming.length){el.innerHTML='';return;}
 el.innerHTML=`<div class="sheet-head"><b>交換の申し込み</b><span>${incoming.length}件</span></div>`+incoming.map(o=>{
  const choices=me.hand.filter(c=>!o.request||c.id===o.request);
  const back=o.request
   ?`<p class="sheet-return">返すカード：<b>#${esc(o.request)}</b><small>（相手の指定）</small></p><input type="hidden" name="cardId" value="${esc(o.request)}">`
   :`<label class="sheet-return">返すカード<select name="cardId" aria-label="交換で返すカード" required>${choices.map(c=>`<option value="${esc(c.id)}">${esc(cardLabel(c))}</option>`).join('')}</select></label>`;
  const can=play&&choices.length>0;
  return `<form class="sheet-offer" data-form="accept" data-offer="${esc(o.id)}"><p class="sheet-line"><b class="sheet-from">PC${o.from}</b>からの申し込み</p><p class="sheet-return">もらうカード：<b class="sheet-card">${esc(offerLabel(o.cardId))}</b></p>${back}${o.request&&!choices.length?'<p class="sheet-warn">指定されたカードは、いま手元にありません。</p>':''}<div class="sheet-actions"><button class="primary" ${can?'':'disabled'}>受ける</button><button type="button" data-action="decline" data-offer="${esc(o.id)}">断る</button></div></form>`;
 }).join('');
}

// 自分の記憶（A）のアルバム。Aが左半分に入っていて、同じ番号のBが来ると右半分がはまり1枚の絵になる。
function trackRestored(me){
 const done=me.memories.filter(m=>m.done).map(m=>m.key);
 if(seenDone===null){seenDone=new Set(done);return;}
 for(const k of done)if(!seenDone.has(k)){seenDone.add(k);freshRestored.set(k,Date.now());}
}
function renderAlbum(me){
 trackRestored(me);
 const open=me.memories.filter(m=>!m.done),done=me.memories.filter(m=>m.done),now=Date.now();
 const slots=me.memories.map(m=>{
  const fresh=now-(freshRestored.get(m.key)||0)<4000;
  const visual=m.done
   ?`<span class="slot-art whole">${artImg(m.key)}</span>`
   :`<span class="slot-art half-a">${artImg(m.key,'A')}<span class="slot-label-a">A</span></span><span class="slot-art half-b"><span class="slot-want">#${esc(m.key)}-B</span><span class="slot-q">？</span></span>`;
  return `<button type="button" class="album-slot ${m.done?'done':'open'} ${fresh?'fresh':''}" data-action="slotOpen" data-key="${esc(m.key)}" aria-label="#${esc(m.key)} ${m.done?'復元済み':'#'+esc(m.key)+'-Bを探している'}"><span class="slot-frame">${visual}</span><span class="slot-cap"><b>#${esc(m.key)}</b><span>${m.done?'✓ 復元':'Bを探す'}</span></span></button>`;
 }).join('');
 return `<section class="album" aria-label="自分の記憶"><div class="album-head"><div><div class="eyebrow">YOUR MEMORY / PC${me.seat}</div><h2>自分の記憶</h2></div><div class="album-count" aria-label="復元 ${done.length} / ${me.memories.length}"><b>${done.length}</b><span>/ ${me.memories.length}</span><small>${open.length?'復元':'すべて復元'}</small></div></div><div class="album-grid">${slots}</div><p class="album-note">欲しい番号を口にすると、その記憶が自分のものだと周りに知られます。枠をタップするとAの全文を読めます。</p></section>`;
}
// 手札は小さなカードの一覧。番号を大きく、絵は小さく。タップで詳細と交換。
function renderHandCard(c){
 const kind=c.kind==='b'?'他の人の記憶 B':c.kind==='effect'?'効果カード':'読取不能データ';
 const sending=S.offers.some(o=>o.from===S.me.seat&&o.cardId===c.id);
 const thumb=c.kind==='b'?artImg(c.id.replace(/-B$/,''),'B'):`<span class="tile-glyph" aria-hidden="true">${c.kind==='effect'?'◆':'▒'}</span>`;
 const text=c.kind==='joker'?corruptedRecord.label:playerCopy(c.kind==='effect'?c.text:c.text);
 return `<button type="button" class="hand-tile kind-${c.kind}" data-action="open" data-id="${esc(c.id)}"><span class="tile-thumb">${thumb}</span><span class="tile-main"><span class="tile-kind">${kind}</span><b class="tile-no">${esc(cardLabel(c))}</b><span class="tile-text">${esc(text)}</span></span>${c.protected?'<span class="tile-flag guard">保護中</span>':''}${sending?'<span class="tile-flag sending">申し込み中</span>':''}</button>`;
}
function renderReturnLog(){
 if(!S.returnLog.length)return '';
 return `<article class="panel return-log"><h2>返却の記録</h2><p>プレイ時間が終わったとき、手元に残っていた記憶は持ち主へ返されました。最後に誰が持っていたかの記録です。</p><div class="table-wrap"><table><thead><tr><th>カード</th><th>最後に持っていた人</th></tr></thead><tbody>${S.returnLog.map(r=>`<tr><td>#${esc(r.id)}</td><td>PC${r.holder}</td></tr>`).join('')}</tbody></table></div></article>`;
}
function renderHand(){
 const me=S.me,play=S.phase==='play';
 let intro='Bを、会話・交換・効果カードで集めてください。嘘をついてもかまいません。40分たつと、残りの記憶は持ち主へ返され、投票に移ります。';
 if(S.phase==='lobby')intro='進行担当が開始すると、自分の記憶のAと手札が届きます。事件資料・防犯カメラ・3D現場は先に確認できます。';
 if(S.phase==='vote')intro='プレイ時間が終わりました。残っていた記憶は持ち主へ返されています。5分以内に投票してください。時間が来ると自動で締め切られます。';
 if(S.phase==='discuss')intro='交換は終わりました。記憶と資料を照合して、誰が仲間を閉じ込め、生き残ったのかを話し合ってください。';
 const order={b:0,effect:1,joker:2};
 const cards=[...me.hand].sort((a,b)=>order[a.kind]-order[b.kind]||a.id.localeCompare(b.id,undefined,{numeric:true}));
 const outgoing=S.offers.filter(o=>o.from===me.seat);
 const sent=outgoing.length?`<section class="sent-offers" aria-label="送った申し込み"><h2>送った申し込み</h2>${outgoing.map(o=>`<div class="sent-offer"><span>PC${o.to}へ <b>${esc(offerLabel(o.cardId))}</b>${o.request?` ／ <b>#${esc(o.request)}</b> を希望`:' ／ 返すカードは相手が選ぶ'}</span><button type="button" class="small-button" data-action="decline" data-offer="${esc(o.id)}">取り消す</button></div>`).join('')}</section>`:'';
 const filtered=cards.filter(c=>handFilter==='all'||c.kind===handFilter);
 const filters=[['all','すべて'],['b','記憶B'],['effect','効果'],['joker','その他']];
 if(S.phase==='finished')intro='投票は締め切られました。';
 return (S.reveal?renderReveal():'')+heading('MEMORY EXCHANGE','記憶カード',intro,play?'hand-heading':'')+(S.phase==='vote'?renderVote():'')+(S.phase==='finished'&&!S.reveal?renderResults():'')+renderHandoutCard(me)+renderReturnLog()+renderAlbum(me)+sent
  +`<div class="hand-deck-heading" id="handDeck"><h2>いまの手札 <span>${cards.length}枚</span></h2><span>タップで全文・交換</span></div><div class="hand-filters" role="group" aria-label="手札の種類">${filters.map(([value,label])=>`<button data-action="handFilter" data-kind="${value}" aria-pressed="${handFilter===value}">${label}<span>${value==='all'?cards.length:cards.filter(c=>c.kind===value).length}</span></button>`).join('')}</div><div class="columns hand-columns"><section><div class="hand-list">${filtered.map(renderHandCard).join('')||`<div class="empty">${handFilter==='all'?'手札はありません。':'この種類のカードはありません。'}</div>`}</div></section><aside><details class="panel" data-disclosure="announcements" ${disclosureOpen('announcements')?'open':''}><summary>全員へのお知らせ</summary>${S.announcements.map(n=>`<div class="notice">${esc(playerCopy(n.text))}<time>${new Date(n.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join('')||'<p>お知らせはありません。</p>'}</details><details class="panel" data-disclosure="notices" ${disclosureOpen('notices')?'open':''}><summary>自分への通知 <span>${me.notices.length}</span></summary>${me.notices.map(n=>`<div class="notice">${esc(playerCopy(n.text))}<time>${new Date(n.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join('')||'<p>通知はありません。</p>'}</details></aside></div>`;
}
function shareControls(u){return `<form data-form="share" data-key="${esc(u.key)}" class="row"><select name="to" aria-label="記憶の共有先"><option value="all">全員に見せる</option>${seats()}</select><button ${!['play','discuss','vote'].includes(S.phase)?'disabled':''}>この記憶を見せる</button></form>`;}
function renderRestored(){return heading('RESTORED MEMORIES','復元した記憶','見せるかどうかは、自分で決められます。見せると相手の画面にも残ります。')+`<div class="stack">${S.me.restored.map(u=>`<article class="panel"><div class="eyebrow">#${esc(u.key)}</div><h2>${esc(u.title)}</h2>${memoryArtHtml(u.key)}<p>${esc(u.text)}</p>${shareControls(u)}</article>`).join('')||'<div class="empty">まだ復元した記憶はありません。自分のBを集めてください。</div>'}</div><h2>他のPCから見せられた記憶</h2>${S.me.shared.map(u=>`<article class="panel"><span class="badge">PC${u.from}から</span><h2>${esc(u.title)}</h2>${memoryArtHtml(u.key)}<p>${esc(u.text)}</p></article>`).join('')||'<p class="muted">見せられた記憶はありません。</p>'}`;}
function renderCase(){return heading('SHARED CASE FILES','事件資料','全員共通の資料です。ゲーム中いつでも読めます。')+`<div class="grid case-grid">${S.evidence.map((e,i)=>`<article class="panel"><div class="eyebrow">CASE FILE ${String(i+1).padStart(2,'0')}</div><h2>${esc(e.title)}</h2>${caseArtHtml(e.id)}<p>${esc(e.text)}</p></article>`).join('')}</div>`;}
function renderPhotos(){const extra=S.photos.filter(p=>p.ready);return heading('SECURITY CAMERA / SHARED RECORDS','防犯カメラ','現場に残った23枚の画像。全員が最初から見られます。')+renderCameraRecords(cameraFilter)+(extra.length?`<h2>追加の共有画像</h2><div class="grid">${extra.map(p=>`<article class="panel photo"><a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(p))}" alt="${esc(p.title)}" loading="lazy"></a><div class="caption"><h2>${esc(p.title)}</h2><p>${esc(p.caption)}</p></div></article>`).join('')}</div>`:'');}
function openCamera(id){const r=cameraRecords.find(r=>r.id===id);if(!r)return;$('cameraTitle').textContent=`${r.room} / 抽出画像 ${r.id}`;const img=$('cameraImage');img.src=r.src;img.alt=`${r.room}の防犯カメラ抽出画像 ${r.id}`;$('cameraOriginal').href=r.src;$('cameraImageFrame').classList.remove('zoomed');$('cameraZoom').textContent='原寸で見る';$('cameraZoom').setAttribute('aria-pressed','false');$('cameraDialog').showModal();}
// 導入は1画面：ハンドアウト1枚＋絵付きの3ステップ＋共通の記憶の照合。細かいルールは折りたたむ。
function renderTutorial(){
 const me=S.me,first=me.memories.find(m=>!m.done)||me.memories[0],k=first?esc(first.key):'24';
 const steps=`<ol class="intro-steps" aria-label="遊び方の3ステップ">
<li><div class="step-visual"><span class="mini-slot"><span class="mini-a">A</span><span class="mini-b">#${k}-B</span></span></div><b>自分のAを見る</b><span>Aは最初から手元。番号を見れば、探すBが分かる。</span></li>
<li><div class="step-visual"><span class="mini-bubble">#${k}-B 持ってる人？</span></div><b>欲しい番号を聞く</b><span>もらう・交換する・効果カードで奪う。言うと自分の記憶だとばれる。</span></li>
<li><div class="step-visual"><span class="mini-slot done"><span class="mini-a">A</span><span class="mini-b">B</span></span></div><b>そろうと復元</b><span>同じ番号のBが来た瞬間、1枚の記憶になる。</span></li></ol>`;
 const check=`<article class="panel intro-check"><h2>はじめに：共通の記憶を照合する</h2><p class="muted">二枚を選んで、組み合わせてください。</p><div class="tutorial-cards"><button data-action="tutorialPick" data-id="a" class="${tutorialSelected.has('a')?'selected':''}">全員が管理室に集まり、会議をした。</button><button data-action="tutorialPick" data-id="b" class="${tutorialSelected.has('b')?'selected':''}">それぞれが持つ情報をPC3へ手渡した。</button></div><p><button class="primary" data-action="tutorial" ${tutorialSelected.size!==2?'disabled':''}>共通の記憶として照合する</button></p>${me.tutorial?'<p class="intro-done">✓ 全員で管理室に集まり、各自の情報をPC3へ渡した。PC1は外部侵入を防ぐ暗号化を始め、会議後も残って仕上げた。この作業だけでは内側からの退出は妨げられない。</p>':''}</article>`;
 const rules=`<details class="panel intro-rules"><summary>くわしい遊び方</summary><p><b>1.</b> 自分の記憶の前半（A）は、最初から手元にあります。番号を見れば、探すBが分かります（例：#24-A なら #24-B）。</p><p><b>2.</b> Bは他の人の手札にあります。持っている人は、本人より先に中身を読めます。</p><p><b>3.</b> 「#24-B持ってる人？」と聞いて、もらう・交換する・効果カードで奪う。欲しい番号を言うと、その記憶が自分のものだと知られます。</p><p><b>4.</b> 自分のBが手元に来ると、その場で復元されます。</p><p><b>5.</b> 持っていないと言っても、読んだ内容を偽って話してもかまいません。</p><p><b>6.</b> プレイ時間は40分。交換も話し合いも、この間に自由に行えます。時間が来ると、残りの記憶はすべて持ち主へ返され、最後に誰が持っていたかが全員に表示されて、投票に移ります。</p><p class="muted">UZUの採点：誰よりも早く情報を集められたか／裏切り者を特定できたか／自分が裏切り者だった場合、特定されずに済んだか。</p></details>`;
 return `<section class="intro"><article class="handout"><div class="eyebrow">HANDOUT / 導入情報（PC${me.seat}）</div><div class="handout-seat">AX-0${me.seat}</div><p class="handout-arrival">到着：${esc(me.arrival)}<small>（仮の時刻）</small></p><p>${esc(me.background)}</p><p class="handout-note">各モデルは、自らが裏切り者かどうかを判別できません。</p></article>${steps}${check}<p class="intro-go"><button class="primary" data-tab="hand">手札へ進む</button></p>${rules}</section>`;
}
function renderVote(){return `<article class="panel"><h2>投票（5分）</h2><p>誰が仲間を閉じ込め、生き残ったと思いますか？</p><form data-form="vote" class="row"><select name="seat" aria-label="投票先">${S.players.map(p=>`<option value="${p.seat}" ${S.me.vote===p.seat?'selected':''}>PC${p.seat}</option>`).join('')}</select><button class="primary">投票する</button></form>${S.me.vote?`<p>現在の投票先：PC${S.me.vote}。締め切りまでは変えられます。</p>`:''}</article>`;}
function renderResults(){return `<article class="panel"><h2>第二テストの投票終了</h2><p>投票を締め切りました。まもなく、この画面で結果が発表されます。</p></article>`;}
// 結果発表：進行担当が「次を表示する」を押すたびに、全員の画面に1段ずつ増える。
const ax=s=>`AX-0${s}`;
function renderReveal(){
 const R=S.reveal;if(!R)return '';
 const block=(st,i)=>{
  const lines=st.kind==='traitor'?st.lines.map((l,j)=>`<p class="${j<2?'rv-big':''}">${esc(l)}</p>`).join(''):st.lines.map(l=>`<p>${esc(l)}</p>`).join('');
  let body=lines;
  if(st.kind==='votes'){const max=Math.max(1,...R.votes.map(v=>v.votes));body+=`<ul class="rv-votes">${R.votes.map(v=>`<li><span class="rv-who">${ax(v.seat)}<small>PC${v.seat}</small></span><span class="rv-bar" aria-hidden="true"><i style="width:${v.votes/max*100}%"></i></span><b>${v.votes}票</b></li>`).join('')}</ul>`;}
  if(st.kind==='reasoning')body+=`<ol class="rv-points">${st.points.map(p=>`<li class="${p.key?'key':''}"><b>${esc(p.head)}</b><span>${esc(p.body)}</span><span class="rv-refs">${p.key?'<em>決め手</em>':''}${p.refs.map(r=>`<code>${esc(r)}</code>`).join('')}</span></li>`).join('')}</ol>${st.closing?`<p class="rv-closing">${esc(st.closing)}</p>`:''}`;
  if(st.kind==='evaluation'&&R.evaluation){
   const E=R.evaluation,list=a=>a.length?a.map(ax).join('、'):'該当するモデルはありません';
   body+=`<dl class="rv-eval"><div><dt>裏切り者を特定したモデル</dt><dd>${esc(list(E.identifiers))}</dd></div><div><dt>${ax(R.traitor)}</dt><dd>${E.identified?'特定されました':'特定を免れました'}<small>（${E.traitorVotes}票）</small></dd></div><div><dt>情報を最も早く集めたモデル</dt><dd>${esc(list(E.fastest))}</dd></div></dl><div class="table-wrap"><table class="rv-table"><thead><tr><th>モデル</th><th>自分で復元した記憶</th><th>投票先</th></tr></thead><tbody>${E.gather.map(g=>`<tr><td>${ax(g.seat)}<small> PC${g.seat}</small></td><td>${g.own} / ${g.need}</td><td>${g.vote?'PC'+g.vote:'—'}</td></tr>`).join('')}</tbody></table></div><p class="rv-basis">基準（仮）：「特定された」は${E.identifiedVotes}票以上。「早く集めた」は、40分の間に自分で集めて復元した割合が最も高いモデル（同じなら、最後の復元が早かったモデル）。</p>${st.closing?`<p class="rv-closing">${esc(st.closing)}</p>`:''}`;
  }
  return `<section class="rv-step rv-${st.kind} ${i===R.steps.length-1?'latest':''}" id="rv-${i}"><div class="eyebrow">${esc(st.eyebrow)}</div><h2>${esc(st.title)}</h2>${body}</section>`;
 };
 return `<article class="reveal" aria-label="結果発表" aria-live="polite"><div class="rv-head"><div class="eyebrow">UZU / SECOND TEST RESULT</div><h1>結果発表</h1></div>${R.steps.map(block).join('')}${R.step<R.total?'<p class="rv-wait">進行担当が次を表示するまで、お待ちください。</p>':''}</article>`;
}
function effectForm(c){
 const play=S.phase==='play',dis=!play?'disabled':'';
 const others=S.me.hand.filter(x=>x.id!==c.id&&x.kind!=='joker');
 const field={steal:`<label class="field">抜き取る相手<select name="to">${seats()}</select></label>`,peek:`<label class="field">のぞく相手<select name="to">${seats()}</select></label>`,name:'<label class="field">指名する番号<input name="number" inputmode="numeric" maxlength="4" placeholder="例：24" required></label>',trace:'<label class="field">追跡する番号<input name="number" inputmode="numeric" maxlength="4" placeholder="例：24" required></label>',protect:`<label class="field">守るカード<select name="keep">${others.map(x=>`<option value="${esc(x.id)}">${esc(cardLabel(x))}</option>`).join('')}</select></label>`,shuffle:'<p class="muted">全員の手札から1枚ずつ（保護中と読取不能データを除く）、左隣へ回ります。</p>'}[c.effect];
 return `<form data-form="effect" data-card="${esc(c.id)}" class="stack"><h3>この効果を使う</h3>${field}<button class="danger" ${dis}>使う（1回で捨て札）</button></form>`;
}
// 返してほしいカードは、自分が探している番号のボタンから選ぶ。手入力は「その他」のときだけ。
function requestPicker(){
 const open=S.me.memories.filter(m=>!m.done);
 const chip=(value,label,cls='',checked=false)=>`<label class="pick-chip ${cls}"><input type="radio" name="requestPick" value="${esc(value)}" ${checked?'checked':''}><span>${label}</span></label>`;
 return `<fieldset class="field request-pick"><legend>返してほしいカード</legend><div class="pick-row">${chip('','相手に選んでもらう','',true)}${open.map(m=>chip(m.key+'-B','#'+esc(m.key)+'-B','want')).join('')}${chip('__other','その他')}</div><input name="requestOther" maxlength="6" placeholder="例：12-B" aria-label="返してほしいカードの番号" hidden></fieldset>`;
}
function openCard(id){
 const c=S.me.hand.find(c=>c.id===id);if(!c)return;const play=S.phase==='play';
 const mode=c.kind==='effect'?'effect':'offer';
 const modes=[...(c.kind==='effect'?[['effect','効果を使う']]:[]),['offer','交換する'],['give','渡す']];
 $('cardDetail').innerHTML=`<div class="eyebrow">${c.kind==='b'?'MEMORY FRAGMENT':c.kind==='effect'?'EFFECT CARD':'UNREADABLE DATA'}</div><h2 class="${c.kind==='joker'?'corrupted-label':''}">${esc(cardLabel(c))}</h2>${c.protected?'<span class="shield">保護中</span>':''}<div class="dialog-card-preview">${c.kind==='b'?memoryArtHtml(c.id.replace(/-B$/,''),'B'):''}<div class="dialog-text">${cardBody(c)}</div></div><div class="card-action-tabs" role="group" aria-label="カードの操作">${modes.map(([value,label])=>`<button type="button" data-card-mode="${value}" aria-pressed="${mode===value}">${label}</button>`).join('')}</div>${c.kind==='effect'?`<section data-card-panel="effect">${effectForm(c)}</section>`:''}<section data-card-panel="offer" ${mode!=='offer'?'hidden':''}><form data-form="offer" data-card="${esc(c.id)}" class="stack"><h3>交換を申し込む</h3><label class="field">相手<select name="to">${seats()}</select></label>${requestPicker()}<button class="primary" ${!play?'disabled':''}>交換を申し込む</button></form></section><section data-card-panel="give" hidden><form data-form="give" data-card="${esc(c.id)}" class="stack"><h3>カードをそのまま渡す</h3><label class="field">渡す相手<select name="to" aria-label="カードを渡す相手">${seats()}</select></label><button class="primary" ${!play?'disabled':''}>そのまま渡す</button></form></section>`;
 memoryArt.hydrate($('cardDetail'));$('cardDialog').showModal();
}
// アルバムの枠をタップ：Aの全文と、復元していれば復元した記憶を見せる。
function openSlot(key){
 const m=S.me.memories.find(m=>m.key===key);if(!m)return;
 const u=S.me.restored.find(u=>u.key===key);
 $('cardDetail').innerHTML=`<div class="eyebrow">YOUR MEMORY / #${esc(key)}</div><h2>${m.done?'復元した記憶':'自分の記憶（A）'}</h2>${u?`<div class="dialog-card-preview">${memoryArtHtml(key)}<div class="dialog-text"><b>${esc(u.title)}</b><br>${esc(u.text)}</div></div><p class="muted">見せるかどうかは「復元」タブで選べます。</p>`:''}<div class="dialog-card-preview">${memoryArtHtml(key,'A')}<div class="dialog-text">${m.place?`<span class="place">場所：${esc(m.place)}</span><br>`:''}${esc(m.a)}</div></div>${m.done?'':`<p class="slot-hint">同じ番号の <b>#${esc(key)}-B</b> は、他の人の手札にあります。手元に来ると、その場で復元されます。</p>`}`;
 memoryArt.hydrate($('cardDetail'));$('cardDialog').showModal();
}
// 自分のハンドアウト：手札の画面でいつでも読み返せる（初期状態は開く。閉じたら閉じたまま）。
function renderHandoutCard(me){
 const open=disclosureState.get('handout')??true;
 return `<details class="panel my-handout" data-disclosure="handout" ${open?'open':''}><summary><span class="eyebrow">HANDOUT</span> AX-0${me.seat}（PC${me.seat}）<small>到着 ${esc(me.arrival)}</small></summary><p>${esc(me.background)}</p><p class="handout-note">各モデルは、自らが裏切り者かどうかを判別できません。</p></details>`;
}
// 全員で共有する時系列。時刻のあるものは時刻順、時刻の分からないものは最後にまとめる。
let timelineDraft={time:'',text:''};
function timelineItem(x,locked){
 return `<li class="tl-item"><span class="tl-time">${x.time?esc(x.time):'--:--'}</span><div class="tl-body"><p>${esc(x.text)}</p><small>${esc(x.by)}が追加${x.editedBy?`・${esc(x.editedBy)}が修正`:''}</small></div>${locked?'':`<div class="tl-tools"><button type="button" class="small-button" data-action="timelineEdit" data-id="${esc(x.id)}">直す</button><button type="button" class="small-button" data-action="timelineRemove" data-id="${esc(x.id)}">消す</button></div>`}</li>`;
}
function renderTimeline(){
 const locked=S.phase==='finished',items=S.timeline||[];
 const timed=items.filter(x=>x.time),untimed=items.filter(x=>!x.time);
 const form=locked?'':`<form data-form="timelineAdd" class="panel tl-form"><div class="tl-inputs"><label class="field tl-time-field">時刻<input type="time" name="time" value="${esc(timelineDraft.time)}" aria-label="時刻（分からなければ空欄）"></label><label class="field tl-text-field">出来事<input name="text" maxlength="200" required value="${esc(timelineDraft.text)}" placeholder="例：PC3が管理室に入った" aria-label="出来事"></label></div><div class="tl-form-foot"><small>時刻が分からなければ空欄のままで追加できます。</small><button class="primary">時系列に追加</button></div></form>`;
 const list=items.length?`<ol class="tl-list">${timed.map(x=>timelineItem(x,locked)).join('')}</ol>${untimed.length?`<h2 class="tl-sub">時刻が分からない出来事</h2><ol class="tl-list">${untimed.map(x=>timelineItem(x,locked)).join('')}</ol>`:''}`:'<div class="empty">まだ何もありません。分かった出来事を追加すると、全員の画面に並びます。</div>';
 return heading('SHARED TIMELINE','時系列','全員が同じ時系列を見ています。追加・修正・削除は誰でもでき、書いた人のPC番号が表示されます。')+form+list;
}
function openTimelineEdit(id){
 const x=(S.timeline||[]).find(x=>x.id===id);if(!x)return;
 $('cardDetail').innerHTML=`<div class="eyebrow">SHARED TIMELINE</div><h2>出来事を直す</h2><form data-form="timelineEdit" data-id="${esc(x.id)}" class="stack"><label class="field">時刻<input type="time" name="time" value="${esc(x.time)}"></label><label class="field">出来事<input name="text" maxlength="200" required value="${esc(x.text)}"></label><button class="primary">直した内容で保存</button></form>`;
 $('cardDialog').showModal();
}
function renderHost(){
 const r=remaining();
 $('host').innerHTML=`<div class="host-head"><div class="eyebrow">FACILITATOR / PRIVATE CONTROL</div><h1>進行画面 / オンライン版</h1><p><b>この画面は最後まで開いたままにしてください。</b>全員のカード操作と40分・5分の締め切りを、この画面が処理しています。閉じても部屋は残り、同じブラウザで開き直すと再開します。</p><p><button type="button" data-action="copyHost">進行画面のURLをコピー</button> <button type="button" data-action="wake">スリープ防止を有効にする</button></p><p>部屋 ${esc(S.id)} ／ ${names[S.phase]} ／ 配る${S.cardCount}枚・記憶${S.pairCount}組 <span class="timer" data-timer hidden></span></p></div><div class="panel"><h2>参加リンク</h2><p>各PCには、自分のリンクだけを「コピー」して送ってください。この進行画面で参加リンクを開かないでください（開いた端末にそのPCが固定されます）。進行画面のURLは共有しないでください。</p>${S.invites.map(p=>{const link=makeLink(S.id,p.token);return `<div class="invite"><b>PC${p.seat}</b><input readonly value="${esc(link)}" aria-label="PC${p.seat}の参加リンク"><button type="button" data-action="copyInvite" data-seat="${p.seat}">コピー</button></div>`;}).join('')}</div><div class="panel"><h2>進行</h2><div class="host-controls"><button class="primary" data-host-action="begin" ${S.phase!=='lobby'?'disabled':''}>開始してカードを配る（40分）</button><button data-host-action="endExchange" ${S.phase!=='play'?'disabled':''}>時間を待たずに終えて投票へ（返却する）</button><button data-host-action="finish" ${S.phase!=='vote'?'disabled':''}>投票を締め切る</button><button class="primary" data-host-action="reveal" data-quick="1" ${S.phase!=='finished'||(S.reveal?.step||0)>=S.revealTotal?'disabled':''}>${S.reveal?'結果発表：次を表示する':'結果発表を始める'}（${S.reveal?.step||0}/${S.revealTotal}）</button></div><p>${S.progress.map(p=>`PC${p.seat}：${p.tutorial?'導入済':'導入前'} / 手札${p.hand}枚 / 復元${p.restored}/${p.needed}${p.vote?' / 投票済':''}`).join('<br>')}</p>${S.results?`<p><b>投票結果</b>：${S.results.map(r=>`PC${r.seat} ${r.votes}票`).join(' ／ ')}</p>`:''}<p class="muted">プレイは40分。交換と議論はこの中で自由に行います。40分たつと自動で返却され、投票に移ります。投票は5分で自動的に締め切られます。この画面から先に締め切ることもできます。</p></div>${S.reveal?`<div class="panel host-reveal"><h2>参加者の画面に出ている結果発表（${S.reveal.step}/${S.revealTotal}）</h2>${renderReveal()}</div>`:S.phase==='finished'?'<div class="panel"><p class="muted">投票を締め切りました。「結果発表を始める」を押すと、全員の画面に1段ずつ結果が出ます（投票結果 → 事件記録 → 照合の手順 → 裏切り者 → 評価）。UZUの台詞は、画面の文をそのまま読みます。</p></div>':''}${S.returnLog.length?`<div class="panel"><h2>返却の記録</h2><p>${S.returnLog.map(r=>`#${esc(r.id)}→最後はPC${r.holder}`).join(' ／ ')}</p></div>`:''}<div class="panel"><h2>全員の時系列（${(S.timeline||[]).length}件）</h2>${(S.timeline||[]).length?`<ol class="tl-list">${S.timeline.map(x=>timelineItem(x,true)).join('')}</ol>`:'<p class="muted">まだ書き込みはありません。</p>'}</div><div class="panel"><h2>この試作のルール</h2><p>Wordの13章「記憶カード32組」をそのまま使用。各自のA（計32枚）は最初から手元にあり、奪われません。配るのはB32枚＋効果カード8枚（抜き取り2・追跡2・指名1・のぞき見1・保護1・攪乱1）＋ジョーカー1枚の41枚。自分のBは自分に配られず、手元に来るとその場で復元されます。データはFirebaseに保存されます。進行画面を閉じている間は、操作が待機します。</p></div><h2>登録済みの防犯カメラ</h2>${renderCameraRecords(cameraFilter)}`;
}
document.addEventListener('click',async e=>{
 const cardMode=e.target.closest('[data-card-mode]');if(cardMode){$('cardDetail').querySelectorAll('[data-card-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===cardMode)));$('cardDetail').querySelectorAll('[data-card-panel]').forEach(p=>p.hidden=p.dataset.cardPanel!==cardMode.dataset.cardMode);return;}
 const memoryButton=e.target.closest('[data-memory-open]');if(memoryButton){await memoryArt.open(memoryButton.dataset.memoryOpen);return;}
 const cameraButton=e.target.closest('[data-action="cameraOpen"],[data-action="cameraFilter"],[data-action="cameraZoom"]');
 if(cameraButton){if(cameraButton.dataset.action==='cameraOpen')openCamera(cameraButton.dataset.id);else if(cameraButton.dataset.action==='cameraFilter'){cameraFilter=cameraButton.dataset.room;render(true);}else{const zoomed=$('cameraImageFrame').classList.toggle('zoomed');$('cameraZoom').textContent=zoomed?'全体を表示':'原寸で見る';$('cameraZoom').setAttribute('aria-pressed',String(zoomed));}return;}
 const tabButton=e.target.closest('[data-tab]');if(tabButton){const next=tabButton.dataset.tab,same=tab===next;tabScroll.set(tab,window.scrollY);tab=next;render(true);window.scrollTo({top:same?0:tabScroll.get(tab)||0,behavior:'instant'});return;}
 const hostButton=e.target.closest('[data-host-action]');if(hostButton){if(!hostButton.dataset.quick&&!confirm('進行を変更しますか？'))return;await action({type:hostButton.dataset.hostAction,id:hostButton.dataset.id});return;}
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='copyHost'){try{await navigator.clipboard.writeText(location.href);toast('進行画面のURLをコピーしました。参加者には渡さないでください。');}catch{toast('アドレス欄のURLをコピーしてください。');}}
 else if(a==='copyInvite'){const p=S.invites.find(p=>p.seat===Number(b.dataset.seat));try{await navigator.clipboard.writeText(makeLink(S.id,p.token));toast('PC'+p.seat+'の参加URLをコピーしました。');}catch{toast('参加リンク欄を選択してコピーしてください。');}}
 else if(a==='wake'){try{window.uzuWakeLock=await navigator.wakeLock.request('screen');toast('スリープ防止を有効にしました。この画面を開いたままにしてください。');}catch{toast('この環境では使えません。パソコンの設定でスリープを止めてください。');}}
 else if(a==='open')openCard(b.dataset.id);
 else if(a==='slotOpen')openSlot(b.dataset.key);
 else if(a==='timelineEdit')openTimelineEdit(b.dataset.id);
 else if(a==='timelineRemove'){if(confirm('この出来事を時系列から消しますか？　全員の画面から消えます。')&&await action({type:'timelineRemove',id:b.dataset.id}))toast('時系列から消しました。');}
 else if(a==='handFilter'){handFilter=b.dataset.kind;render(true);}
 else if(a==='decline')await action({type:'decline',offerId:b.dataset.offer});
 else if(a==='tutorialPick'){const id=b.dataset.id;tutorialSelected.has(id)?tutorialSelected.delete(id):tutorialSelected.add(id);render(true);}
 else if(a==='tutorial'){await action({type:'tutorial'});toast('共通の記憶を照合しました。事件資料と手札を確認してください。');}
});
// 時系列の入力途中の内容は、他の人の操作で画面が更新されても消さない。
document.addEventListener('input',e=>{const form=e.target.closest('[data-form="timelineAdd"]');if(form&&(e.target.name==='time'||e.target.name==='text'))timelineDraft[e.target.name]=e.target.value;});
// 「その他」を選んだときだけ番号の入力欄を出す。
document.addEventListener('change',e=>{
 if(e.target.name!=='requestPick')return;
 const other=e.target.form?.querySelector('[name="requestOther"]');if(!other)return;
 other.hidden=e.target.value!=='__other';other.required=!other.hidden;if(!other.hidden)other.focus();
});
// Keep expanded sections stable when another player's action refreshes the hand.
document.addEventListener('toggle',e=>{if(e.target.matches('details[data-disclosure]')&&e.target.isConnected)disclosureState.set(e.target.dataset.disclosure,e.target.open);},true);
// Let the phone scroll one page rather than a clipped, separately scrolling 3D frame.
window.addEventListener('message',e=>{
 const frame=$('sceneFrame');
 if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
 const h=Number(e.data?.height);
 if(e.data?.type==='second-test-scene-height'&&Number.isFinite(h)&&h>=300&&h<=10000)frame.style.setProperty('--scene-height',`${Math.ceil(h)}px`);
 if(e.data?.type==='second-test-scene-focus'&&tab==='scene'&&matchMedia('(max-width:760px)').matches){
  const y=Number(e.data.top);if(!Number.isFinite(y)||y<0||y>10000||!Number.isFinite(h)||h<1||h>2000)return;
  const top=frame.getBoundingClientRect().top+window.scrollY+y-Math.max(16,(window.innerHeight-90-h)/2);
  window.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
 }
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const f=new FormData(form),type=form.dataset.form;
 if(type==='effect'&&!confirm('この効果カードを使いますか？　使うと捨て札になります。'))return;
 const pick=f.get('requestPick'),request=pick==='__other'?f.get('requestOther'):pick;
 if(type==='offer'&&pick==='__other'&&!String(request||'').trim()){toast('返してほしいカードの番号を入力してください。');return;}
 const a={type,to:f.get('to'),cardId:form.dataset.card||f.get('cardId'),request,offerId:form.dataset.offer,key:form.dataset.key,seat:f.get('seat'),number:f.get('number'),keep:f.get('keep'),time:f.get('time'),text:f.get('text'),id:form.dataset.id};
 if(await action(a)){if($('cardDialog').open)$('cardDialog').close();if(type==='offer')toast('交換を申し込みました。');if(type==='vote')toast('投票を保存しました。');if(type==='share')toast('記憶を見せました。');if(type==='timelineAdd'){timelineDraft={time:'',text:''};render(true);toast('時系列に追加しました。');}if(type==='timelineEdit')toast('時系列を直しました。');}
});
// オンライン版：部屋を作れるのは、#operator= の付いた進行担当URLだけ。参加者はPC別リンクから入る。
const operator=new URLSearchParams(location.hash.slice(1)).get('operator');
if(!params.get('room')){
 $('soloStart').hidden=$('createRoom').hidden=true;
 if(operator){$('fileStartup').textContent='進行担当の確認中…';$('fileStartup').hidden=false;try{await unlockHost(operator);$('fileStartup').textContent='進行担当として開いています。「5人用の部屋を作る」で本番の部屋、「ひとりで確認する」で確認用の部屋を作れます。このURLは参加者に渡さないでください。';$('soloStart').hidden=$('createRoom').hidden=false;history.replaceState(null,'',location.pathname);}catch(e){$('fileStartup').textContent=e.message;}}
 else{$('fileStartup').textContent='参加者の方は、進行担当から受け取った「PC別のリンク」を開いてください。';$('fileStartup').hidden=false;}
}
if(params.get('room')&&params.get('key')){
 auth={room:params.get('room'),key:params.get('key')};
 try{accept(await request(`/api/rooms/${auth.room}`));if(!S.host){await action({type:'join'});tab=S.me.tutorial?'hand':'tutorial';}render(true);}catch(e){toast(e.message);}
 setInterval(poll,1200);
}else if(params.get('start')==='solo'){
 // ファイルを直接開いた画面の「ひとりで確認する」から引き継ぐ。
 create(true);
}
