(function(){
 'use strict';
 const C=window.SceneModelCore,$=id=>document.getElementById(id),canvas=$('model'),ctx=canvas.getContext('2d');
 const interiorRooms=['assembly','management','reception','store1','store2'];
 if(!ctx){$('viewStatus').textContent='この環境ではモデルを表示できません';return;}
 const query=new URLSearchParams(location.search),initialLevel=['1','2','all'].includes(query.get('floor'))?query.get('floor'):'1';
 const exterior=window.FactoryExterior.create(C);
 const view={yaw:-.35,pitch:1,zoom:1,target:[0,0,0]},state={selected:null,wallHigh:true,labels:true,level:initialLevel,focusRoom:null,closeUp:false,previousLabels:true,structure:query.get('structure')==='exterior'?'exterior':'interior',renderMode:query.get('render')==='solid'?'solid':'particles'};
 let interiorSnapshot=null;
 let width=0,height=0,scheduled=false,floors=[],labels=[],pointers=new Map(),gesture=null,tap=null;
 const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let assembleStarted=performance.now(),clouds={};
 function cloud(){if(state.structure==='exterior')return clouds.exterior??=(C.pointCloud(exterior.faces));const key=state.level+':'+state.wallHigh+':'+state.focusRoom;return clouds[key]??=(C.pointCloud(C.scene(state.wallHigh,null,state.level,state.focusRoom)));}
 if(new URLSearchParams(location.search).get('mode')==='pixel')document.body.classList.add('pixel');
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
 function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
 function draw(now=performance.now()){
  scheduled=false;ctx.clearRect(0,0,width,height);
  const project=p=>C.project(p,view,width,height);
  ctx.lineWidth=.5;ctx.strokeStyle='#39516066';
  const gridY=state.level==='2'?C.floorHeight-.3:-.55;
  if(state.structure==='interior'&&!state.focusRoom)for(let n=-20;n<=20;n+=2){for(const line of [[[n,gridY,-15],[n,gridY,15]],[[-20,gridY,n],[20,gridY,n]]]){const p=line.map(project);ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.stroke();}}
  const faces=(state.structure==='exterior'?exterior.faces:C.scene(state.wallHigh,state.selected,state.level,state.focusRoom)).map(f=>({...f,projected:f.points.map(project)}));
  for(const f of faces)f.depth=f.projected.reduce((sum,p)=>sum+p.depth,0)/f.projected.length;
  const layer=f=>f.kind==='base'?0:f.kind==='floor'?1:f.kind==='shadow'?1.5:state.focusRoom&&f.kind==='wall'?1.8:state.focusRoom&&f.kind==='rack'?1.9:2;
  faces.sort((a,b)=>a.level-b.level||layer(a)-layer(b)||a.depth-b.depth);
  floors=[];
  for(const f of faces){if(f.kind==='floor')floors.push(f);}
  if(state.renderMode==='solid'){
   for(const f of faces){path(f.projected);ctx.globalAlpha=f.alpha??1;ctx.fillStyle=f.emissive?f.color:C.shade(f.color,f.shade);ctx.shadowColor=f.color;ctx.shadowBlur=f.emissive?5:0;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=f.kind==='floor'?'#b5dce02e':'#0a192544';ctx.lineWidth=f.kind==='robot'?.35:.7;ctx.stroke();}ctx.globalAlpha=1;
  }else{
   const progress=reducedMotion?1:C.clamp((now-assembleStarted)/1500,0,1),ease=1-Math.pow(1-progress,3),points=cloud(),scale=C.scale(view,width,height);
   ctx.globalCompositeOperation='lighter';
   const robotPixels=new Set();
   // 建物の点群の後に人型を描く。加算発光を使わず、点の重なりによる白飛びを防ぐ。
   const ordered=[...points.filter(p=>p.kind!=='robot'),...points.filter(p=>p.kind==='robot')];
   for(const p of ordered){
    const pos=p.position.map((v,i)=>v+(1-ease)*(i===1?3+p.seed*9:Math.sin(p.seed*57+i*9)*9));
    const projected=project(pos),selected=Boolean(!state.focusRoom&&state.selected&&state.selected===p.room),base=p.kind==='base',robot=p.kind==='robot';
    const depth=C.clamp((projected.depth+20)/40,.18,1),detail=p.kind==='machine'||p.kind==='stair'||p.kind==='robot';
    const weight=p.kind==='rack'?.55:detail?.48:1;
    const dimmed=!state.focusRoom&&state.selected&&!selected;
    const opacity=robot?(p.edge?.92:.7)*(dimmed?.45:1)*(.3+ease*.7):(base?.16:p.edge?.75:.33)*weight*(selected?1.45:state.selected?.55:1)*(.6+depth*.4)*(.3+ease*.7);
    const size=robot?C.clamp(scale*.035,.85,1.5):C.clamp(scale*.055,.75,1.9)*(p.edge?1.13:1);
    if(projected.x<-8||projected.x>width+8||projected.y<-8||projected.y>height+8)continue;
    if(robot){const cell=Math.max(1.15,size),key=Math.round(projected.x/cell)+':'+Math.round(projected.y/cell);if(robotPixels.has(key))continue;robotPixels.add(key);ctx.globalCompositeOperation='source-over';}
    ctx.fillStyle=robot?(selected?'#ffe2b4':p.edge?'#c7fff3':'#6ed9d5'):p.emissive?p.color:selected?'#ffd6a1':p.edge?'#a7fff1':p.kind==='floor'?'#57b9cf':'#5adbe7';
    if(p.edge&&p.seed>.64&&p.kind!=='robot'){ctx.globalAlpha=opacity*.075;ctx.fillRect(projected.x-size*2.5,projected.y-size*2.5,size*5,size*5);}
    ctx.globalAlpha=Math.min(opacity,1);ctx.fillRect(projected.x-size/2,projected.y-size/2,size,size);
   }
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   $('renderStatus').textContent=progress<1?'RECONSTRUCTING':'POINT CLOUD';
   if(progress<1)schedule();
  }
  labels=[];
  const occupied=[];
  function label(lines,position,room=null,small=false){
   const original=project(position),p={...original},selected=room&&state.selected===room;
   const compact=width<500,lineHeight=compact?12:14;
   ctx.font=`400 ${small?compact?8:9:compact?9:12}px Dot, monospace`;
   const bw=Math.max(...lines.map(text=>ctx.measureText(text).width))+(small||compact?12:18),bh=lines.length*lineHeight+(small?6:compact?8:10);
   if(!state.labels){if(room)labels.push({...p,room,bw,bh});return;}
   if(p.x<-50||p.x>width+50||p.y<-50||p.y>height+50)return;
   for(let n=0;n<10&&occupied.some(r=>Math.abs(p.x-r.x)<(bw+r.bw)/2+3&&Math.abs(p.y-r.y)<(bh+r.bh)/2+2);n++)p.y=original.y+(n%2?1:-1)*(Math.floor(n/2)+1)*(bh+4);
   p.x=C.clamp(p.x,bw/2+5,width-bw/2-5);p.y=C.clamp(p.y,bh/2+4,height-bh/2-28);
   occupied.push({...p,bw,bh});if(room)labels.push({...p,room,bw,bh});
   if(Math.hypot(p.x-original.x,p.y-original.y)>8){ctx.beginPath();ctx.moveTo(original.x,original.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle='#95c7ca80';ctx.lineWidth=.65;ctx.stroke();}
   ctx.fillStyle=selected?'#ffe0bf':small?'#10232dd9':'#102635ed';ctx.strokeStyle=selected?'#ffd0a2':small?'#a5baaa55':'#87bdc680';ctx.lineWidth=1;
   ctx.beginPath();ctx.roundRect(p.x-bw/2,p.y-bh/2,bw,bh,small?3:5);ctx.fill();ctx.stroke();ctx.fillStyle=selected?'#332517':small?'#c2d8d1':'#dbeef1';ctx.textAlign='center';ctx.textBaseline='middle';
   lines.forEach((text,n)=>ctx.fillText(text,p.x,p.y+(n-(lines.length-1)/2)*lineHeight+1));
  }
  if(state.structure==='interior'){
   for(const r of C.visibleRooms(state.level).filter(r=>!state.focusRoom||r.id===state.focusRoom)){const[x,z,w,d]=r.rect;const text=r.lines||[r.name];label(state.level==='all'?[r.level+'F',...text]:text,r.label||[x+w/2,(r.level-1)*C.floorHeight+.08,z+d/2],r.id);}
   if(state.level==='1'){for(const z of C.zones)label([z.name],z.position,null,true);for(const opening of C.openings)label([opening.name],opening.position,null,true);}
   if(state.level==='2'&&!state.focusRoom){label(['通路'],[.2,C.floorHeight+.1,0],null,true);label(['階段'],[-2.1,C.floorHeight+.1,8.15],null,true);}
  }
  if(window.SecondTestBoard)window.SecondTestBoard.draw({ctx,C,view,width,height,state});
  ctx.font='9px Dot, monospace';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillStyle='#8fa9b8';ctx.fillText((state.renderMode==='particles'?`POINTS ${cloud().length.toLocaleString()}`:'MODEL 01')+'   /   参考図ベース・寸法は仮設定',12,height-10);
 }
 function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule();}
 function sync(){
  const outside=state.structure==='exterior';
  $('interiorMode').setAttribute('aria-pressed',String(!outside));$('exteriorMode').setAttribute('aria-pressed',String(outside));$('structureStatus').textContent=outside?'建物全体':'フロア表示';$('floorTools').hidden=outside;$('roomsPanel').hidden=outside;
  $('wallToggle').disabled=outside;$('labelsToggle').disabled=outside;document.body.dataset.structure=state.structure;
  $('zoom').value=Math.round(view.zoom*100);$('zoomText').textContent=Math.round(view.zoom*100)+'%';
  const top=view.pitch>1.5;$('topView').setAttribute('aria-pressed',String(top));$('orbitView').setAttribute('aria-pressed',String(!top));
  $('viewStatus').textContent=top?'真上から表示':outside?'外観表示':state.focusRoom?'室内表示':'斜めから表示';
  $('wallToggle').textContent=state.wallHigh?'壁を低く':'壁を高く';$('wallToggle').setAttribute('aria-pressed',String(state.wallHigh));
  $('labelsToggle').textContent='部屋名 '+(state.labels?'ON':'OFF');$('labelsToggle').setAttribute('aria-pressed',String(state.labels));
  $('particleMode').setAttribute('aria-pressed',String(state.renderMode==='particles'));$('solidMode').setAttribute('aria-pressed',String(state.renderMode==='solid'));
  $('rebuild').disabled=state.renderMode!=='particles';if(state.renderMode==='solid')$('renderStatus').textContent='SOLID';
  $('floor1').setAttribute('aria-pressed',String(state.level==='1'));$('floor2').setAttribute('aria-pressed',String(state.level==='2'));$('allFloors').setAttribute('aria-pressed',String(state.level==='all'));$('floorTitle').textContent=state.level==='all'?'1・2階':state.level+'階';
  $('warehouseTools').hidden=outside;
  for(const room of interiorRooms){const button=$('focus'+room[0].toUpperCase()+room.slice(1)),r=C.rooms.find(r=>r.id===room);button.hidden=state.level!=='all'&&String(r.level)!==state.level;button.setAttribute('aria-pressed',String(state.focusRoom===room));}$('floorOverview').disabled=!state.focusRoom;
  document.body.dataset.room=state.focusRoom||'';$('reset').textContent=state.focusRoom?'室内全体へ ↺':'全体に戻す ↺';$('clearSelection').textContent=outside?'内装へ戻る':state.focusRoom?state.level+'階全体へ戻る':'選択を解除して全体へ';
  $('closeView').hidden=!state.focusRoom;$('closeView').setAttribute('aria-pressed',String(state.closeUp));
  for(const button of document.querySelectorAll('[data-room]'))button.setAttribute('aria-pressed',String(button.dataset.room===state.selected));
  const room=C.rooms.find(r=>r.id===state.selected);$('selectedTitle').textContent=outside?'工場 外観':room?room.name:state.level==='all'?'建物全体':state.level+'階全体';
  $('selectedDescription').textContent=outside?'金属外壁、大型シャッター、2か所の入口、屋上手すり、配管と換気設備を配置。内装の間取りと出入口位置を基準にした外観試作です。高さ・屋根・外構は仮設定です。':room?room.description:'手描きの間取りを基に配置しています。寸法と階高は仮設定です。';
  if(typeof history!=='undefined'&&history.replaceState){const params=new URLSearchParams(location.search);params.set('floor',state.level);params.set('render',state.renderMode==='solid'?'solid':'particles');if(outside)params.set('structure','exterior');else params.delete('structure');if(state.focusRoom)params.set('room',state.focusRoom);else params.delete('room');if(state.closeUp)params.set('view','close');else params.delete('view');history.replaceState(null,'',location.pathname+'?'+params.toString()+(location.hash||''));}
  schedule();
 }
 function setZoom(value){view.zoom=C.clamp(value,.65,2.8);sync();}
 function reset(){
  state.closeUp=false;
  if(state.structure==='exterior'){Object.assign(view,{yaw:-.65,pitch:.44,zoom:1,target:[0,0,3.2],fit:[30,22,11]});state.selected=null;}
  else if(state.focusRoom){const r=C.rooms.find(r=>r.id===state.focusRoom),[x,z,w,d]=r.rect;Object.assign(view,{yaw:-.45,pitch:.58,zoom:1,target:[x+w/2,z+d/2,(r.level-1)*C.floorHeight+.8],fit:[w,d,3.6]});state.selected=r.id;}
  else{Object.assign(view,{yaw:-.35,pitch:1,zoom:state.level==='all'?.9:1,target:state.level==='2'?[6.3,0,C.floorHeight]:state.level==='all'?[0,0,1.5]:[0,0,0],fit:state.level==='2'?[15.4,19.5,3.8]:[28.5,19.5,state.level==='all'?8:4.2]});state.selected=null;}
  sync();
 }
 function closeView(){
  if(!state.focusRoom)return;if(state.closeUp){reset();return;}state.closeUp=true;
  const cameras={assembly:{yaw:-.5,pitch:.42,target:[.9,-4.75,1.17],fit:[4.2,4.2,3.2]},store1:{yaw:-.48,pitch:.5,target:[8,-5,C.floorHeight+1.3],fit:[9.6,7.8,3.6]},store2:{yaw:-.65,pitch:.3,target:[7.5,5,C.floorHeight+1.4],fit:[7.8,6.8,3.6]},management:{yaw:-.4,pitch:.52,target:[2.5,5.2,1.2],fit:[6.8,7.8,3.6]},reception:{yaw:-.5,pitch:.56,target:[9.75,-5.9,.7],fit:[5.5,6.2,3.2]}};Object.assign(view,cameras[state.focusRoom],{zoom:1});sync();
 }
 function selectRoom(id){if(state.structure==='exterior')return;const room=C.rooms.find(r=>r.id===id);if(!room)return;if(state.focusRoom){setFocus(id);return;}state.selected=id;const [x,z,w,d]=room.rect;view.target=[x+w/2,z+d/2,(room.level-1)*C.floorHeight];view.zoom=room.zoom;sync();}
 function roomButtons(){const list=$('roomList');list.replaceChildren();for(const room of C.visibleRooms(state.level)){const button=document.createElement('button');button.dataset.room=room.id;button.setAttribute('aria-pressed','false');button.innerHTML=`<small>${room.level}F</small><span>${room.name}</span><em>↗</em>`;button.addEventListener('click',()=>selectRoom(room.id));list.append(button);}$('roomCount').textContent=C.visibleRooms(state.level).length+' AREAS';}
 function setLevel(level){if(state.structure==='exterior')return;if(state.focusRoom)state.labels=state.previousLabels;state.focusRoom=null;state.level=level;roomButtons();assembleStarted=performance.now();reset();}
 function setStructure(mode){
  if(mode===state.structure)return;
  if(mode==='exterior'){
   interiorSnapshot={state:{selected:state.selected,wallHigh:state.wallHigh,labels:state.labels,level:state.level,focusRoom:state.focusRoom,closeUp:state.closeUp,previousLabels:state.previousLabels},view:{...view,target:[...view.target],fit:view.fit?[...view.fit]:undefined}};
   state.structure='exterior';state.focusRoom=null;state.selected=null;assembleStarted=performance.now();reset();
  }else{
   state.structure='interior';assembleStarted=performance.now();
   if(interiorSnapshot){Object.assign(state,interiorSnapshot.state);Object.assign(view,interiorSnapshot.view);interiorSnapshot=null;roomButtons();sync();}else{roomButtons();reset();}
  }
 }
 function setFocus(id){
  if(state.structure==='exterior')return;
  if(!interiorRooms.includes(id)){if(state.focusRoom)state.labels=state.previousLabels;state.focusRoom=null;}
  else{if(!state.focusRoom)state.previousLabels=state.labels;state.focusRoom=id;state.level=String(C.rooms.find(r=>r.id===id).level);state.labels=false;}
  roomButtons();assembleStarted=performance.now();reset();
 }
 window.addEventListener('board:change',schedule);
 roomButtons();
 $('zoom').addEventListener('input',e=>setZoom(Number(e.target.value)/100));
 $('zoomIn').addEventListener('click',()=>setZoom(view.zoom+.2));$('zoomOut').addEventListener('click',()=>setZoom(view.zoom-.2));
 $('reset').addEventListener('click',reset);$('clearSelection').addEventListener('click',()=>state.structure==='exterior'?setStructure('interior'):state.focusRoom?setFocus(null):reset());
 $('interiorMode').addEventListener('click',()=>setStructure('interior'));$('exteriorMode').addEventListener('click',()=>setStructure('exterior'));
 $('topView').addEventListener('click',()=>{view.pitch=Math.PI/2;view.yaw=0;sync();});
 $('orbitView').addEventListener('click',()=>{view.pitch=state.structure==='exterior'?.44:state.focusRoom?.58:1;view.yaw=state.structure==='exterior'?-.65:state.focusRoom?-.45:-.35;sync();});
 $('wallToggle').addEventListener('click',()=>{state.wallHigh=!state.wallHigh;sync();});
 $('labelsToggle').addEventListener('click',()=>{state.labels=!state.labels;sync();});
 $('particleMode').addEventListener('click',()=>{if(state.renderMode==='particles')return;state.renderMode='particles';assembleStarted=performance.now();sync();});
 $('solidMode').addEventListener('click',()=>{state.renderMode='solid';sync();});
 $('rebuild').addEventListener('click',()=>{if(state.renderMode!=='particles')return;assembleStarted=performance.now();sync();});
 $('floor1').addEventListener('click',()=>setLevel('1'));$('floor2').addEventListener('click',()=>setLevel('2'));$('allFloors').addEventListener('click',()=>setLevel('all'));
 for(const room of interiorRooms)$('focus'+room[0].toUpperCase()+room.slice(1)).addEventListener('click',()=>setFocus(room));$('floorOverview').addEventListener('click',()=>setFocus(null));
 $('closeView').addEventListener('click',closeView);
 function point(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function pair(){const p=[...pointers.values()];return {distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};}
 function pick(p){
  if(window.SecondTestBoard?.pick(p))return;
  if(state.structure==='exterior')return;
  if(state.labels){const hit=[...labels].reverse().find(l=>Math.abs(l.x-p.x)<l.bw/2&&Math.abs(l.y-p.y)<l.bh/2);if(hit){selectRoom(hit.room);return;}}
  const hit=[...floors].reverse().find(f=>C.inside(p,f.projected));if(hit)selectRoom(hit.room);
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  const p=point(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
  if(pointers.size===1){tap={...p,moved:0};gesture=null;}
  if(pointers.size===2){gesture={distance:Math.max(pair().distance,1),zoom:view.zoom};tap=null;}
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const p=point(e),previous=pointers.get(e.pointerId);pointers.set(e.pointerId,p);
  if(pointers.size===2&&gesture){setZoom(gesture.zoom*pair().distance/gesture.distance);return;}
  if(pointers.size===1){const dx=p.x-previous.x,dy=p.y-previous.y;if(tap)tap.moved+=Math.hypot(dx,dy);view.yaw+=dx*.009;view.pitch=C.clamp(view.pitch+dy*.008,.2,Math.PI/2);sync();}
 });
 function release(e,cancelled=false){if(!pointers.has(e.pointerId))return;const wasSingle=pointers.size===1,p=point(e);pointers.delete(e.pointerId);if(wasSingle&&!cancelled&&tap&&tap.moved<7)pick(p);tap=null;gesture=null;}
 canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(view.zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
 canvas.addEventListener('keydown',e=>{let handled=true;switch(e.key){case 'ArrowLeft':view.yaw-=.15;break;case 'ArrowRight':view.yaw+=.15;break;case 'ArrowUp':view.pitch=C.clamp(view.pitch+.12,.2,Math.PI/2);break;case 'ArrowDown':view.pitch=C.clamp(view.pitch-.12,.2,Math.PI/2);break;case '+':case '=':setZoom(view.zoom+.2);break;case '-':setZoom(view.zoom-.2);break;case 'r':case 'R':reset();break;default:handled=false;}if(handled){e.preventDefault();sync();}});
 new ResizeObserver(resize).observe(canvas);if(state.structure==='interior'&&interiorRooms.includes(query.get('room'))){setFocus(query.get('room'));if(query.get('view')==='close')closeView();}else reset();
})();

