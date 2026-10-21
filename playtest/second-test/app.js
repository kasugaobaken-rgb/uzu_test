import {cameraRecords,renderCameraRecords} from './camera-records.js';
import {request,photoUrl as onlinePhotoUrl,statusText,hostLogin,loadCatalog,onChange,setupState} from './online-transport.js';
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cameraFilter='all';
let S=null,auth=null,tab='hand',renderedRev=-1,busy=false,lastNotice=null,tutorialSelected=new Set(),handFilter='all';
const names={lobby:'開始前',play:'記憶を交換中',vote:'投票',finished:'終了'};
const params=new URLSearchParams(location.hash.slice(1)||location.search);
const makeLink=(room,key)=>`${location.origin}${location.pathname}#room=${encodeURIComponent(room)}&key=${encodeURIComponent(key)}`;
function goToSession(url){location.replace(url);location.reload();}
const setupStatus=document.createElement('p');setupStatus.id='setupStatus';setupStatus.setAttribute('role','status');setupStatus.setAttribute('aria-live','polite');$('hostLogin').after(setupStatus);
function renderSetupState(){const s=setupState();$('hostLogin').textContent=s.loggedIn?'✓ ログイン済み（アカウントを変更）':'進行担当としてGoogleでログイン';setupStatus.textContent=(s.loggedIn?'✓ ログイン済み：'+s.email:'① Googleログインが必要です。')+' ／ '+(s.catalogReady?'✓ 記憶データ読込済み（36記憶・73枚）':'② 記憶データを選択または貼り付けてください。');}
function showSetupError(e){let message=e.message||'操作を完了できませんでした。';if(/permission_denied|PERMISSION_DENIED/.test(message))message='部屋作成の権限がありません。進行担当用のGoogleアカウントでログインしてください。';if(e.code==='auth/popup-blocked')message='ログイン画面がブロックされました。このサイトのポップアップを許可して再度お試しください。';setupStatus.textContent='確認が必要：'+message;toast(message);}
const storage={get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
async function action(a){if(busy)return;busy=true;try{const data=await request(`/api/rooms/${auth.room}/action`,a,auth.key);if(!S||data.rev>=S.rev)S=data;render(true);return true;}catch(e){toast(e.message);return false;}finally{busy=false;}}
async function poll(){if(!auth)return;try{const data=await request(`/api/rooms/${auth.room}`,undefined,auth.key);if(!S||data.rev>=S.rev)S=data;$('connection').textContent=statusText();render();}catch(e){$('connection').textContent='接続待ち';if(!S)toast(e.message);}}
function storeCreated(d,solo){storage.set('uzu-second-host-'+d.id,{...d,solo});return d;}
async function create(solo){$('soloStart').disabled=$('createRoom').disabled=true;try{const d=storeCreated(await request('/api/rooms',{},null),solo);if(solo){await request(`/api/rooms/${d.id}/action`,{type:'begin'},d.token);goToSession(makeLink(d.id,d.invites[0].token));}else goToSession(makeLink(d.id,d.token));}catch(e){showSetupError(e);$('soloStart').disabled=$('createRoom').disabled=false;}}
$('soloStart').onclick=()=>create(true);$('createRoom').onclick=()=>create(false);
$('hostLogin').onclick=async()=>{try{$('hostLogin').disabled=true;setupStatus.textContent='Googleログインを確認中…';await hostLogin();renderSetupState();toast('進行担当のログインが完了しました。');poll();}catch(e){showSetupError(e);}finally{$('hostLogin').disabled=false;}};
$('catalogFile').onchange=async e=>{try{await loadCatalog(e.target.files[0]);renderSetupState();toast('運営用データを読み込みました。');}catch(e){showSetupError(e);}};
$('catalogPasteLoad').onclick=async()=>{try{const text=$('catalogPaste').value;await loadCatalog(new Blob([text],{type:'application/json'}));$('catalogPaste').value='';$('pasteData').open=false;renderSetupState();toast('運営用データを読み込みました。');}catch(e){showSetupError(e);}};
onChange(()=>{renderSetupState();renderedRev=-1;poll();});renderSetupState();
const heading=(eyebrow,title,text='')=>`<div class="pane-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${text?`<p>${esc(text)}</p>`:''}</div></div>`;
const seats=()=>S.players.filter(p=>p.seat!==S.me.seat).map(p=>`<option value="${p.seat}">PC${p.seat}</option>`).join('');
const photoUrl=p=>onlinePhotoUrl(p);
function render(force=false){
 if(!S)return;
 if(!force&&document.activeElement?.matches('input,textarea,select'))return;
 if(!force&&renderedRev===S.rev)return;
 $('landing').hidden=true;$('host').hidden=!S.host;$('game').hidden=S.host;
 $('identity').textContent=S.host?'進行担当':`PC${S.me.seat}`;
 if(S.host){renderHost();renderedRev=S.rev;return;}
 $('roomLabel').textContent=`ROOM ${S.id}`;$('phaseLabel').textContent=names[S.phase];
 const local=storage.get('uzu-second-host-'+S.id);
 $('soloSwitch').innerHTML=local?.solo?`<label>ひとり確認 <select id="seatSwitch" aria-label="確認するPC">${local.invites.map(p=>`<option value="${esc(p.token)}" ${p.seat===S.me.seat?'selected':''}>PC${p.seat}</option>`).join('')}</select></label> <a href="${esc(makeLink(S.id,local.token))}" target="_blank" rel="noopener">進行画面</a>`:'';
 if($('seatSwitch'))$('seatSwitch').onchange=e=>goToSession(makeLink(S.id,e.target.value));
 $('handCount').textContent=S.me.hand.length;$('restoreCount').textContent=`${S.me.restored.length}/${S.me.needed.length}`;
 document.querySelectorAll('#tabs [data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
 $('pane').hidden=tab==='scene';$('scenePane').hidden=tab!=='scene';
 if(tab==='scene'){if(!$('sceneFrame').getAttribute('src'))$('sceneFrame').src=`scene.html?mode=pixel&session=${S.id}&seat=${S.me.seat}`;}
 else $('pane').innerHTML=({hand:renderHand,restored:renderRestored,case:renderCase,photos:renderPhotos,tutorial:renderTutorial}[tab]||renderHand)();
 if(lastNotice!==S.me.notices[0]?.id){if(lastNotice!==null&&S.me.notices[0])toast(S.me.notices[0].text);lastNotice=S.me.notices[0]?.id||'empty';}
 renderedRev=S.rev;
}
// Collection view helpers: only use the current player's hand and target IDs.
function collectionSummary(me){
 const held=new Set(me.hand.map(c=>c.id));
 const pairs=me.needed.map(u=>({...u,held:u.cards.filter(id=>held.has(id)),missing:u.done?[]:u.cards.filter(id=>!held.has(id))}));
 return {pairs,missing:pairs.flatMap(u=>u.missing),held:pairs.filter(u=>!u.done).reduce((n,u)=>n+u.held.length,0),restored:pairs.filter(u=>u.done).length,ready:pairs.filter(u=>!u.done&&!u.missing.length)};
}
function renderCollectionGuide(me,play){
 const c=collectionSummary(me);
 return `<section class="collection-guide" aria-label="あなたが集めるカード"><div class="collection-heading"><div><div class="eyebrow">YOUR MEMORY / PC${me.seat}</div><h2>あなたが集めるカード</h2></div><a href="#handDeck">手札へ ↓</a></div><p class="collection-rule">下の番号の <b>A ＋ B</b> をそろえると、あなたの記憶になります。</p><div class="collection-counts"><span><b>${c.missing.length}</b> 枚を探す</span><span>対象が手元に <b>${c.held}</b> 枚</span><span>復元 <b>${c.restored} / ${c.pairs.length}</b></span></div><div class="wanted-list"><span class="wanted-label">${c.missing.length?'探している番号':'未入手のカードはありません'}</span>${c.missing.map(id=>`<span class="target-id missing"><span>探す</span> #${esc(id)}</span>`).join('')}</div><p class="collection-private">この一覧はあなただけに表示。誰が持っているかは会話で探してください。</p>${c.ready.map(u=>`<div class="collection-ready"><span>✓ A・Bがそろいました：${esc(u.title)}</span><button class="primary" data-action="restore" data-key="${esc(u.key)}" ${!play?'disabled':''}>記憶を復元する</button></div>`).join('')}<details class="collection-details"><summary>A・Bの組み合わせと進み具合を見る</summary><div class="target-pairs">${c.pairs.map(u=>`<div class="target-pair ${u.done?'complete':''}"><h3>${esc(u.title)}</h3><div class="pair-status">${u.cards.map(id=>`<span class="target-id ${u.done?'complete':u.held.includes(id)?'held':'missing'}"><span>${u.done?'復元済':u.held.includes(id)?'✓ 手元':'探す'}</span> #${esc(id)}</span>`).join('<span class="pair-plus">＋</span>')}</div><small>${u.done?'復元した記憶に保存済み':u.missing.length?'あと'+u.missing.length+'枚：'+u.missing.map(id=>'#'+esc(id)).join('・'):'二枚が手元にあります'}</small></div>`).join('')}</div></details></section>`;
}
function renderCardRole(c){return c.kind==='joker'?'<span class="card-role unknown">読取不可</span>':c.needed?'<span class="card-role own">▶ あなたが集めるカード</span>':'<span class="card-role trade">交換に使うカード</span>';}
function renderMemoryCard(c,me){
 const pair=me.needed.find(u=>u.cards.includes(c.id)),other=pair?.cards.find(id=>id!==c.id),hasOther=me.hand.some(x=>x.id===other);
 return `<article class="card ${c.needed?'needed':''}">${renderCardRole(c)}<div class="card-no">#${esc(c.id)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>${c.needed?`<div class="partner-hint ${hasOther?'ready':''}">${hasOther?'✓ A・Bがそろっています':'相方の #'+esc(other)+' を探そう'}</div>`:''}<button data-action="open" data-id="${esc(c.id)}">読む・やり取りする</button></article>`;
}
// End collection view helpers.
function renderHand(){
 const me=S.me,play=S.phase==='play';
 let intro='緑の印はあなたの記憶。下の「探す」番号を集め、同じ番号のAとBをそろえてください。';
 if(S.phase==='lobby')intro='進行担当が開始すると記憶カードが届きます。事件資料・写真枠・3D現場は先に確認できます。';
 const cards=[...me.hand].sort((a,b)=>Number(b.needed)-Number(a.needed)||a.id.localeCompare(b.id));
 const visibleCards=cards.filter(c=>handFilter==='mine'?c.needed:handFilter==='trade'?!c.needed:true);
 const offers=S.offers.map(o=>`<div class="panel offer"><h3>${o.to===me.seat?`PC${o.from}から交換提案`:`PC${o.to}へ提案中`}</h3><p>受け渡す記憶 #${esc(o.cardId)}${o.request?` ／ 返却指定 #${esc(o.request)}`:' ／ 返却カードは受取側が選択'}</p>${o.to===me.seat?`<form data-form="accept" data-offer="${esc(o.id)}" class="row"><select name="cardId" aria-label="交換で返すカード" required>${me.hand.filter(c=>!o.request||c.id===o.request).map(c=>`<option value="${esc(c.id)}">#${esc(c.id)} ${esc(c.title)}</option>`).join('')}</select><button class="primary" ${!play||!me.hand.some(c=>!o.request||c.id===o.request)?'disabled':''}>交換する</button></form>`:''}<button class="small-button" data-action="decline" data-offer="${esc(o.id)}">${o.from===me.seat?'提案を取り消す':'断る'}</button></div>`).join('');
 return heading('MEMORY EXCHANGE','記憶カード',intro)+(S.phase==='vote'?renderVote():'')+(S.phase==='finished'?renderResults():'')+renderCollectionGuide(me,play)+`<div class="hand-deck-heading" id="handDeck"><h2>いまの手札</h2><span>緑の印＝自分用 ／ 印なし＝交換用</span></div><div class="hand-filters" role="group" aria-label="手札の表示"><button data-action="filterHand" data-filter="all" aria-pressed="${handFilter==='all'}">すべて ${cards.length}</button><button data-action="filterHand" data-filter="mine" aria-pressed="${handFilter==='mine'}">▶ 自分の対象 ${cards.filter(c=>c.needed).length}</button><button data-action="filterHand" data-filter="trade" aria-pressed="${handFilter==='trade'}">交換用・その他 ${cards.filter(c=>!c.needed).length}</button></div><div class="columns"><section><div class="grid">${visibleCards.map(c=>renderMemoryCard(c,me)).join('')||'<div class="empty">この分類のカードは手元にありません。</div>'}</div></section><aside><div class="panel"><h2>効果カード</h2><p>匿名奪取：残り ${me.steals} 回</p><p class="muted">選んだPCからランダムに一枚取得します。取得者は相手に通知されません。</p><form data-form="steal" class="row"><select name="to" aria-label="奪取の対象">${seats()}</select><button class="danger" ${!play||!me.steals?'disabled':''}>一枚を取得</button></form></div>${offers?'<h2>交換提案</h2>'+offers:''}<details class="panel"><summary>自分への通知</summary>${me.notices.map(n=>`<div class="notice">${esc(n.text)}<time>${new Date(n.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join('')||'<p>通知はありません。</p>'}</details></aside></div>`;

}
function shareControls(u){return `<form data-form="share" data-key="${esc(u.key)}" class="row"><select name="to" aria-label="情報の共有先"><option value="all">全員に共有</option>${seats()}</select><button ${S.phase!=='play'?'disabled':''}>この情報を共有</button></form>`;}
function renderRestored(){return heading('RESTORED MEMORIES','復元した記憶','復元した本文は保存されます。共有すると相手にも内容が残ります。')+`<div class="stack">${S.me.restored.map(u=>`<article class="panel"><h2>${esc(u.title)}</h2><p>${esc(u.text)}</p>${shareControls(u)}</article>`).join('')||'<div class="empty">自分の対象となる二枚を集めて復元してください。</div>'}</div><h2>他のPCから共有された情報</h2>${S.me.shared.map(u=>`<article class="panel"><span class="badge">PC${u.from}から共有</span><h2>${esc(u.title)}</h2><p>${esc(u.text)}</p></article>`).join('')||'<p class="muted">共有された情報はありません。</p>'}`;}
function renderCase(){return heading('SHARED CASE FILES','事件資料','全員共通の資料です。本編開始時から全て参照できます。')+`<div class="grid">${S.evidence.map((e,i)=>`<article class="panel"><div class="eyebrow">CASE FILE ${String(i+1).padStart(2,'0')}</div><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p></article>`).join('')}</div>`;}
function renderPhotos(){const extra=S.photos.filter(p=>p.ready);return heading('SECURITY CAMERA / SHARED RECORDS','防犯カメラ','現場に残った23枚の画像。全員が最初から閲覧できます。')+renderCameraRecords(cameraFilter)+(extra.length?`<h2>追加の共有画像</h2><div class="grid">${extra.map(p=>`<article class="panel photo"><a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(p))}" alt="${esc(p.title)}" loading="lazy"></a><div class="caption"><h2>${esc(p.title)}</h2><p>${esc(p.caption)}</p><small>画像を押すと拡大できます。</small></div></article>`).join('')}</div>`:'');}
function openCamera(id){const r=cameraRecords.find(r=>r.id===id);if(!r)return;$('cameraTitle').textContent=`${r.room} / 抽出画像 ${r.id}`;const img=$('cameraImage');img.src=r.src;img.alt=`${r.room}の防犯カメラ抽出画像 ${r.id}`;$('cameraOriginal').href=r.src;$('cameraImageFrame').classList.remove('zoomed');$('cameraZoom').textContent='原寸で見る';$('cameraZoom').setAttribute('aria-pressed','false');$('cameraDialog').showModal();}
function renderTutorial(){return heading('ORIENTATION','導入と操作','到着・会議の共通記憶を照合してから、事件を調べます。')+`<div class="columns"><section><article class="panel"><h2>あなたの導入情報</h2><p>PC${S.me.seat}の到着：${esc(S.me.arrival)}<small>（既存の仮時刻）</small></p><p>${esc(S.me.background)}</p></article><article class="panel"><h2>二つの断片を照合する</h2><p>二枚を選び、組み合わせてみてください。</p><div class="tutorial-cards"><button data-action="tutorialPick" data-id="a" class="${tutorialSelected.has('a')?'selected':''}">全員が管理室に集まり、会議をした。</button><button data-action="tutorialPick" data-id="b" class="${tutorialSelected.has('b')?'selected':''}">それぞれが持つ情報をPC3へ手渡した。</button></div><p><button class="primary" data-action="tutorial" ${tutorialSelected.size!==2?'disabled':''}>共通の記憶として照合する</button></p>${S.me.tutorial?'<p>✓ 全員で管理室に集まり、各自の情報をPC3へ渡した。PC1は外部侵入を防ぐ暗号化を始め、会議後も残って仕上げた。この作業だけでは内側からの退出は妨げられない。</p>':''}</article></section><aside class="panel"><h2>基本の遊び方</h2><p>記憶カードは、受け取った人が読めます。自分に必要なカードは光りますが、他人の手札番号や内容は一覧表示されません。</p><p>「管理室の記憶を持っている人はいない？」などと会話し、必要な情報を交換してください。</p><p>同じ番号のAとB（例：#100-A／#100-B）が一つの記憶のペアです。自分の対象となる二枚を持つと復元でき、復元した記憶は別タブへ保存されます。</p><p>3D現場のコマは自分の仮説です。全員の画面へ自動で共有されません。</p><div class="test-note">動作確認用：カードは仮分割。復元時に二枚を手札から除去。匿名奪取は一回。ジョーカーの内容やゲーム終了後の演出は未実装。</div></aside></div>`;}
function renderVote(){return `<article class="panel"><h2>投票</h2><p>誰が仲間を閉じ込め、生き残ったと思いますか？</p><form data-form="vote" class="row"><select name="seat" aria-label="投票先">${S.players.map(p=>`<option value="${p.seat}" ${S.me.vote===p.seat?'selected':''}>PC${p.seat}</option>`).join('')}</select><button class="primary">投票する</button></form>${S.me.vote?`<p>現在の投票先：PC${S.me.vote}。締切までは変更できます。</p>`:''}</article>`;}
function renderResults(){return `<article class="panel"><h2>第二テストの投票終了</h2><p>${S.results.map(r=>`PC${r.seat}：${r.votes}票`).join(' ／ ')}</p><p>以後は進行担当の案内に従ってください。真実の映像・AIの台詞は、この試作では表示しません。</p></article>`;}
function openCard(id){const c=S.me.hand.find(c=>c.id===id);if(!c)return;const play=S.phase==='play';$('cardDetail').innerHTML=`<div class="eyebrow">FRAGMENT #${esc(c.id)}</div><h2>${esc(c.title)}</h2>${renderCardRole(c)}<div class="dialog-text">${esc(c.text)}</div><form data-form="offer" data-card="${esc(c.id)}" class="stack"><h3>交換を提案する</h3><label class="field">相手<select name="to">${seats()}</select></label><label class="field">返してほしいカード番号（任意）<input name="request" maxlength="6" placeholder="例：123-B / 空欄なら相手が選ぶ"></label><button class="primary" ${!play?'disabled':''}>交換を提案</button></form><div class="divider"></div><form data-form="give" data-card="${esc(c.id)}" class="row"><select name="to" aria-label="カードを渡す相手">${seats()}</select><button ${!play?'disabled':''}>そのまま一枚渡す</button></form>`;$('cardDialog').showModal();}
function renderHost(){
 $('host').innerHTML=`<div class="host-head"><div class="eyebrow">FACILITATOR / PRIVATE CONTROL</div><h1>進行画面 / ONLINE</h1><p>この画面のURLが、進行担当専用の「進行リンク」です。保存しておき、参加者には下のPC別リンクだけを渡してください。</p><p role="status">この画面を開いたままにし、端末をスリープさせないでください。閉じている間、参加者のカード操作は待機します。</p><p>部屋 ${esc(S.id)} ／ ${names[S.phase]} ／ ${S.cardCount}枚・${S.pairCount}記憶</p></div><div class="panel"><h2>参加リンク</h2><p>各PCには自分のリンクだけを渡してください。進行画面のリンクは共有しないでください。</p>${S.invites.map(p=>{const link=makeLink(S.id,p.token);return `<div class="invite"><b>PC${p.seat}</b><input readonly value="${esc(link)}" aria-label="PC${p.seat}の参加リンク"><a href="${esc(link)}" target="_blank" rel="noopener">開く ↗</a></div>`;}).join('')}</div><div class="panel"><h2>進行</h2><div class="host-controls"><button class="primary" data-host-action="begin" ${S.phase!=='lobby'?'disabled':''}>開始して全カードを配る</button><button data-host-action="votePhase" ${S.phase!=='play'?'disabled':''}>交換を終了し投票へ</button><button data-host-action="finish" ${S.phase!=='vote'?'disabled':''}>投票を締め切る</button></div><p>${S.progress.map(p=>`PC${p.seat}：${p.tutorial?'導入済':'導入前'} / 手札${p.hand} / 復元${p.restored}${p.vote?' / 投票済':''}`).join('<br>')}</p></div><div class="panel"><h2>テスト版の仮仕様</h2><p>精査後のWordの記憶本文36単位を二枚ずつに仮分割しています。ペアには共通番号とA・Bを付け、番号はPC順にしていません。単文の一部は同じ事実を別の断片表現にしています。復元は本人の対象カード二枚で行い、元カードは消費されます。効果は各PC一回のランダム奪取です。これらは確定した最終仕様ではありません。</p><p>資料は最初から公開。真実・AI演出は未実装。進行担当の画面を開いている間、カード操作を処理します。閉じてもデータは保存され、同じGoogleアカウントで進行画面を開き直すと再開できます。参加リンクが認証を兼ねるため、テスト参加者以外へ公開しないでください。</p></div><h2>登録済みの防犯カメラ</h2>${renderCameraRecords(cameraFilter)}<h2>追加の全体共有画像</h2><p class="muted">上の23枚は標準で全員に公開されています。以下は追加画像の登録枠です。約250KB以下のPNG・JPEG・WebP。</p><div class="grid">${S.photos.map((p,i)=>`<article class="panel"><h3>枠 ${p.id} ${p.ready?'登録済':'未登録'}</h3><small>候補：${esc(S.photoCandidates[i])}</small>${p.ready?`<img src="${esc(photoUrl(p))}" alt="${esc(p.title)}" style="width:100%;max-height:180px;object-fit:contain">`:''}<form data-form="photo" data-id="${p.id}" class="stack"><label class="field">公開タイトル<input name="title" value="${esc(p.title)}" maxlength="100"></label><label class="field">公開する説明<textarea name="caption" maxlength="1500">${esc(p.caption)}</textarea></label><label class="field">画像<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label><button class="primary">この枠へ登録して全体共有</button></form>${p.ready?`<button class="small-button danger" data-host-action="removePhoto" data-id="${p.id}">画像を取り下げる</button>`:''}</article>`).join('')}</div>`;
}
document.addEventListener('click',async e=>{
 const cameraButton=e.target.closest('[data-action="cameraOpen"],[data-action="cameraFilter"],[data-action="cameraZoom"]');
 if(cameraButton){if(cameraButton.dataset.action==='cameraOpen')openCamera(cameraButton.dataset.id);else if(cameraButton.dataset.action==='cameraFilter'){cameraFilter=cameraButton.dataset.room;render(true);}else{const zoomed=$('cameraImageFrame').classList.toggle('zoomed');$('cameraZoom').textContent=zoomed?'全体を表示':'原寸で見る';$('cameraZoom').setAttribute('aria-pressed',String(zoomed));}return;}
 const tabButton=e.target.closest('[data-tab]');if(tabButton){tab=tabButton.dataset.tab;render(true);return;}
 const hostButton=e.target.closest('[data-host-action]');if(hostButton){if(!confirm('進行を変更しますか？'))return;await action({type:hostButton.dataset.hostAction,id:hostButton.dataset.id});return;}
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='filterHand'){handFilter=['all','mine','trade'].includes(b.dataset.filter)?b.dataset.filter:'all';render(true);}
 else if(a==='open')openCard(b.dataset.id);
 else if(a==='restore'){if(await action({type:'restore',key:b.dataset.key})){tab='restored';render(true);}}
 else if(a==='decline')await action({type:'decline',offerId:b.dataset.offer});
 else if(a==='tutorialPick'){const id=b.dataset.id;tutorialSelected.has(id)?tutorialSelected.delete(id):tutorialSelected.add(id);render(true);}
 else if(a==='tutorial'){await action({type:'tutorial'});toast('共通の記憶を照合しました。事件資料と手札を確認してください。');}
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const f=new FormData(form),type=form.dataset.form;
 if(type==='photo'){
  const file=f.get('image');if(!file?.size)return;if(file.size>240000){toast('約250KB以下の画像を選んでください。');return;}
  const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});await action({type:'photo',id:form.dataset.id,title:f.get('title'),caption:f.get('caption'),image});return;
 }
 if(type==='steal'&&!confirm('この効果は一回だけです。選んだ相手からランダムに一枚取得しますか？'))return;
 const a={type,to:f.get('to'),cardId:form.dataset.card||f.get('cardId'),request:f.get('request'),offerId:form.dataset.offer,key:form.dataset.key,seat:f.get('seat')};
 if(await action(a)){if($('cardDialog').open)$('cardDialog').close();if(type==='offer')toast('交換を提案しました。');if(type==='vote')toast('投票を保存しました。');}
});
if(params.get('room')&&params.get('key')){
 auth={room:params.get('room'),key:params.get('key')};
 try{S=await request(`/api/rooms/${auth.room}`,undefined,auth.key);if(!S.host){await action({type:'join'});tab=S.me.tutorial?'hand':'tutorial';}render(true);}catch(e){toast(e.message);}
 setInterval(poll,1200);
}
