(function(){
 'use strict';
 const params=new URLSearchParams(location.search),key=`uzu-second-board:${params.get('session')||'local'}:${params.get('seat')||'1'}`;
 const colors=['#f2b69f','#9ed7f0','#bde6ad','#dbc0ee','#f0d48b'];
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
 let data=saved&&Array.isArray(saved.scenes)?saved:{current:0,scenes:[{name:'配置 1',pieces:{},note:''}]};
 data.current=Math.min(Math.max(data.current||0,0),data.scenes.length-1);
 let selected=1,placing=false,frame=null;
 const current=()=>data.scenes[data.current];
 function save(){try{localStorage.setItem(key,JSON.stringify(data));}catch{}window.dispatchEvent(new Event('board:change'));}
 function controls(){
  const p=current();document.getElementById('boardControls').innerHTML=`<div class="board-heading"><h2>自分の配置</h2><span>PC${esc(params.get('seat')||'1')}のみ</span></div><p>人物を選び、配置モードで床をタップ。回転中は配置されません。</p><label>場面<select id="sceneChoice" aria-label="保存した場面">${data.scenes.map((s,i)=>`<option value="${i}" ${i===data.current?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><div class="board-row"><input id="sceneName" aria-label="場面の名前" maxlength="40" value="${esc(p.name)}"><button id="newScene">＋ 場面</button></div><div class="piece-buttons">${colors.map((c,i)=>`<button data-piece="${i+1}" aria-pressed="${selected===i+1}" style="--piece-color:${c}">PC${i+1}${p.pieces[i+1]?' •':''}</button>`).join('')}</div><div class="board-row"><button id="placeToggle" class="${placing?'placing':''}" aria-pressed="${placing}">${placing?'配置モード ON':'配置モードにする'}</button><button id="removePiece" ${!p.pieces[selected]?'disabled':''}>選択コマを外す</button></div><label>配置の根拠<select id="pieceKind"><option value="guess">推測</option><option value="memory">記憶からの配置</option><option value="record">資料からの配置</option></select></label><div id="placementStatus" class="board-status" role="status">${placing?'床をタップしてPC'+selected+'を置きます。':'通常はドラッグで回転できます。'}</div><label>この場面のメモ<textarea id="boardNote" placeholder="時刻不明、移動前後などの仮説" maxlength="3000">${esc(p.note)}</textarea></label><p class="private-hint">自動保存・この端末の自分用。ほかのPCへ送信されません。人物は正解位置ではありません。</p><button id="clearScene">この場面のコマを全て外す</button>`;
  document.getElementById('sceneChoice').onchange=e=>{data.current=Number(e.target.value);save();controls();};
  document.getElementById('sceneName').oninput=e=>{p.name=e.target.value||'名称未設定';const o=document.querySelector('#sceneChoice option:checked');if(o)o.textContent=p.name;save();};
  document.getElementById('newScene').onclick=()=>{if(data.scenes.length>=8){alert('テスト版では8場面まで保存できます。');return;}data.scenes.push({name:'配置 '+(data.scenes.length+1),pieces:{},note:''});data.current=data.scenes.length-1;save();controls();};
  document.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.piece);controls();});
  document.getElementById('placeToggle').onclick=()=>{placing=!placing;controls();};
  document.getElementById('removePiece').onclick=()=>{delete p.pieces[selected];save();controls();};
  document.getElementById('boardNote').oninput=e=>{p.note=e.target.value;save();};
  document.getElementById('clearScene').onclick=()=>{if(confirm('この場面のコマを全て外しますか？メモは残ります。')){p.pieces={};save();controls();}};
 }
 function projectAt(x,y,z){return frame.C.project([x,y,z],frame.view,frame.width,frame.height);}
 window.SecondTestBoard={
  draw(value){
   frame=value;const {ctx,C,state}=value;if(state.structure==='exterior')return;
   for(const [seat,p] of Object.entries(current().pieces)){
    if(state.level!=='all'&&Number(state.level)!==p.level)continue;
    if(state.focusRoom){const r=C.rooms.find(r=>r.id===state.focusRoom),[x,z,w,d]=r.rect;if(p.x<x||p.x>x+w||p.z<z||p.z>z+d)continue;}
    const base=projectAt(p.x,(p.level-1)*C.floorHeight+.1,p.z),head=projectAt(p.x,(p.level-1)*C.floorHeight+1.7,p.z),color=colors[Number(seat)-1];
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(head.x,head.y);ctx.stroke();ctx.beginPath();ctx.ellipse(base.x,base.y,11,5,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(head.x,head.y,Number(seat)===selected?17:14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#162a31';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='10px Dot, monospace';ctx.fillText('PC'+seat,head.x,head.y);ctx.fillStyle='#e9f2ed';ctx.font='10px Dot, monospace';ctx.fillText({guess:'推測',memory:'記憶',record:'資料'}[p.kind]||'推測',head.x,head.y-25);ctx.restore();
   }
  },
  pick(point){
   if(!placing||!frame)return false;const {C,state}=frame;
   if(state.structure==='exterior'||state.level==='all'){document.getElementById('placementStatus').textContent='内装の1階か2階を選んでから置いてください。';return true;}
   const level=Number(state.level),y=(level-1)*C.floorHeight+.1;
   const o=projectAt(0,y,0),a=projectAt(1,y,0),b=projectAt(0,y,1),ax=a.x-o.x,ay=a.y-o.y,bx=b.x-o.x,by=b.y-o.y,det=ax*by-ay*bx;
   if(Math.abs(det)<.001)return true;
   const dx=point.x-o.x,dy=point.y-o.y,x=(dx*by-dy*bx)/det,z=(ax*dy-ay*dx)/det;
   const valid=level===1?x>=-13.8&&x<=13.8&&z>=-9.3&&z<=9.3:x>=-1.1&&x<=13.8&&z>=-9.3&&z<=9.3;
   if(!valid){document.getElementById('placementStatus').textContent='建物の床の範囲に置いてください。';return true;}
   current().pieces[selected]={x:Math.round(x*100)/100,z:Math.round(z*100)/100,level,kind:document.getElementById('pieceKind').value};save();controls();document.getElementById('placementStatus').textContent=`PC${selected}を${level}階へ配置しました。`;return true;
  }
 };
 controls();
})();
