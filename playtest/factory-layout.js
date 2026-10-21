/* 手描き間取りを優先した工場モデル。寸法と階高は仮設定。事件の証拠や人物は含まない。 */
(function(root){
 'use strict';
 const floorHeight=4.2;
 const rooms=[
  {id:'workshop',level:1,code:'01',name:'作業場',rect:[-13.7,-9.2,12.1,18.4],label:[-11.2,.12,0],color:'#52676a',zoom:1.35,description:'図の左側。プレス機、研磨機、加工機の3区画と、左壁側の通路を配置しています。'},
  {id:'assembly',level:1,code:'02',name:'組立・プログラミング室',lines:['組立','プログラミング室'],rect:[-1.1,-9.2,7.2,7.05],color:'#24383c',zoom:2.1,description:'1階の応接室の隣。整備台2台、人型機械の仮モデル、リング照明、診断端末を配置しています。下側の横通路につながります。'},
  {id:'reception',level:1,code:'03',name:'応接室',rect:[6.45,-9.2,7.25,7.05],color:'#565e55',zoom:2.1,description:'簡素なソファ2脚とローテーブルを配置した応接室。1階図右上で、下側の横通路につながります。'},
  {id:'management',level:1,code:'04',name:'管理室',rect:[-1.1,.65,7.2,8.55],color:'#465c58',zoom:2,description:'PC席4組・モニター8台、奥にサーバーラック2基とネットワーク収納、両端に書類棚2基を配置。右側通路へ出入口があります。'},
  {id:'stairs',level:1,code:'05',name:'階段',rect:[-10,7.15,8.55,2.05],label:[-5.7,1.9,8.15],color:'#8f897a',zoom:2,description:'作業場の図下側に配置。右側棟2階の通路へ上がる接続として仮合わせしています。'},
  {id:'store1',level:2,code:'06',name:'倉庫1',rect:[1.85,-9.2,11.85,8.95],color:'#50594c',zoom:1.65,description:'機械部品の保管室。棚5基に歯車・モーター・部品箱を並べ、在庫管理端末と大型部品を配置。左側通路に出入口があります。'},
  {id:'store2',level:2,code:'07',name:'倉庫2',rect:[1.85,.1,11.85,9.1],color:'#35372e',zoom:1.65,description:'2段の保管ラック4基に人型機械を並べ、部品ケースと中央通路を配置した内装試作です。'}
 ];
 const zones=[
  {id:'press',name:'プレス機',position:[-5.6,.15,-6.5],level:1},
  {id:'grinding',name:'研磨機',position:[-5.6,.15,-1.4],level:1},
  {id:'machining',name:'加工機',position:[-5.6,.15,3.5],level:1}
 ];
 const openings=[
  {id:'top-entry',name:'入口',level:1,position:[-10.85,.1,-9.8],axis:'z',range:[-12,-9.65]},
  {id:'shutter',name:'シャッター',level:1,position:[-14.4,1.5,0],axis:'x',range:[-5.8,6.2]},
  {id:'right-entry',name:'入口',level:1,position:[14.2,.1,5.1],axis:'x',range:[3.9,6.1]}
 ];
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function visibleRooms(level){return rooms.filter(r=>level==='all'||r.level===Number(level));}
 function scale(view,width,height){
  const [w,d,h]=view.fit||[28.5,19.5,4.2],c=Math.abs(Math.cos(view.yaw)),s=Math.abs(Math.sin(view.yaw));
  return Math.min(width/(w*c+d*s+2.5),height/((d*c+w*s)*Math.sin(view.pitch)+h*Math.cos(view.pitch)+4))*view.zoom;
 }
 function project(p,view,width,height){
  const x=p[0]-view.target[0],y=p[1]-(view.target[2]||0),z=p[2]-view.target[1];
  const c=Math.cos(view.yaw),s=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
  const rx=x*c-z*s,rz=x*s+z*c,unit=scale(view,width,height);
  return {x:width/2+rx*unit,y:height*.53-(y*cp-rz*sp)*unit,depth:rz*cp+y*sp};
 }
 function inside(point,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }return hit;}
 function box(x,y,z,w,h,d,color,kind='object'){
  const v=[[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]];
  return [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].map((ids,n)=>({points:ids.map(i=>v[i]),color,shade:[.72,.84,.76,.92,1.12][n],kind}));
 }
 function scene(wallHigh=false,selected=null,level='1',focusRoom=null){
  const faces=[];let currentLevel=1;
  const add=(shape,room=null)=>{for(const face of shape)faces.push({...face,level:currentLevel,room});};
  const block=(x,y,z,w,h,d,color='#596367',kind='object',room=null)=>add(box(x,y,z,w,h,d,color,kind),room);
  const wall=(x,z,w,d,y=0)=>block(x,y,z,w,wallHigh?3.6:.72,d,'#929b99','wall');
  const roomFloor=(r,y)=>{const[x,z,w,d]=r.rect;faces.push({points:[[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d]],level:r.level,color:selected===r.id&&!focusRoom?'#c69568':r.color,shade:1,kind:'floor',room:r.id});};
  const floor=(x,z,w,d,y,color)=>faces.push({points:[[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d]],level:currentLevel,color,shade:1,kind:'floor',room:null});
  // 1階 左作業場と右側棟。図上側に入口、図左側に大きなシャッター、図右下寄りに入口。
  block(-14.25,-.4,-9.75,28.5,.4,19.5,'#334b54','base');
  for(const r of rooms.filter(r=>r.level===1&&r.id!=='stairs'))roomFloor(r,.01);
  floor(-1.1,-1.9,14.8,2.3,.01,'#405764');floor(6.45,.4,7.25,8.8,.01,'#405764');
  wall(-14,-9.5,2,.28);wall(-9.65,-9.5,23.65,.28);wall(-14,9.22,28,.28);
  wall(-14,-9.5,.28,3.7);wall(-14,6.2,.28,3.3);
  block(-13.98,0,-5.8,.2,wallHigh?3.4:.72,12,'#535d62','shutter');
  for(let y=.35;y<(wallHigh?3.4:.72);y+=.38)block(-13.72,y,-5.8,.045,.035,12,'#89908a','shutter');
  wall(13.72,-9.5,.28,13.4);wall(13.72,6.1,.28,3.4);
  wall(-1.4,-9.22,.28,7.75);wall(-1.4,-.1,.28,9.32);
  wall(6.15,-9.22,.28,7.3);
  wall(-1.12,-2.14,4.8,.28);wall(4.95,-2.14,4.95,.28);wall(11.2,-2.14,2.52,.28);
  wall(-1.12,.38,7.55,.28);wall(6.15,.66,.28,3.6);wall(6.15,5.65,.28,3.57);
  for(const z of [-8.6,-5,-1.4,2.2,5.8,8.8])block(-13.64,0,z,.18,wallHigh?3.8:.85,.2,'#4b555a','wall');
  // プレス機 4列2段。ベース、支柱、上部フレーム、金型と操作盤。
  for(const z of [-8.5,-5.25])for(let n=0;n<4;n++){
   const x=-8.85+n*1.85;
   block(x,0,z,1.35,.22,1.4,'#646b65','machine','workshop');
   for(const sx of [x,x+1.16])block(sx,.22,z+.12,.19,1.8,1.1,'#717a72','machine','workshop');
   block(x,.22,z+1.15,1.35,1.8,.17,'#4d5758','machine','workshop');
   block(x,1.83,z+.12,1.35,.42,1.1,'#7e8378','machine','workshop');
   block(x+.35,.85,z+.25,.65,.32,.8,'#b38242','machine','workshop');
   block(x+1.35,.6,z+.45,.25,.75,.45,'#344b54','machine','workshop');
  }
  // 研磨機 4台。横向き砥石を角の多い円筒で表現する。
  for(let n=0;n<4;n++){
   const x=-8.85+n*1.85,z=-2.6;
   block(x,0,z,1.4,.85,1.5,'#6c7774','machine','workshop');block(x+.25,.85,z+.4,.9,.35,.8,'#515f61','machine','workshop');
   const cx=x+.7,cy=1.38,rad=.43,segments=12;
   for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    const p=[cx+Math.cos(a)*rad,cy+Math.sin(a)*rad],q=[cx+Math.cos(b)*rad,cy+Math.sin(b)*rad];
    add([{points:[[p[0],p[1],z+.2],[q[0],q[1],z+.2],[q[0],q[1],z+.7],[p[0],p[1],z+.7]],color:'#9ba2a1',shade:.9,kind:'machine'}],'workshop');
   }
  }
  // 加工機 4列2段。画像の金属製工作機械に寄せた輪郭。
  for(const z of [1.35,4.65])for(let n=0;n<4;n++){
   const x=-8.85+n*1.85;
   block(x,0,z,1.45,.55,1.45,'#626f6f','machine','workshop');block(x,.55,z+.62,1.45,1.02,.83,'#858c80','machine','workshop');
   block(x+.2,.78,z+.57,.92,.52,.08,'#263e48','machine','workshop');block(x+.18,.55,z+.12,1.1,.18,.55,'#8a9691','machine','workshop');
   block(x+1.45,.5,z+.55,.24,.9,.55,'#3d5359','machine','workshop');
  }
  // 図下側の階段は作業場から2階通路へ右向きに上がる仮の接続。
  const steps=17;
  for(let i=0;i<steps;i++)block(-10+i*.5,0,7.2,.5,(i+1)*floorHeight/steps,1.95,'#8b8c80','stair','stairs');
  block(-1.5,floorHeight-.15,7.2,3.1,.15,1.95,'#8b8c80','stair','stairs');
  // 家具は雰囲気の補助。遺留品や事件の証拠ではない。
  if(root.WarehouseProps&&level!=='2')faces.push(...root.WarehouseProps.create('assembly',0,box,focusRoom==='assembly'));
  if(root.FactoryRoomProps&&level!=='2')for(const room of ['management','reception'])faces.push(...root.FactoryRoomProps.create(room,0,box));
  currentLevel=2;
  // 2階は右側棟のみ。左側通路、上側と下側に倉庫。
  block(-1.4,floorHeight-.2,-9.5,15.4,.2,19,'#344b54','base');
  for(const r of rooms.filter(r=>r.level===2))roomFloor(r,floorHeight+.01);
  floor(-1.1,-9.2,2.6,18.4,floorHeight+.01,'#405764');
  // 2階図の左下に描かれた階段口。下から上がる最終部分を平面の段で示す。
  for(let i=0;i<5;i++)block(-2.8+i*.28,floorHeight,7.2,.08,.06,1.95,'#a0a293','landing');
  wall(-1.4,-9.5,15.4,.28,floorHeight);wall(-1.4,9.22,15.4,.28,floorHeight);wall(13.72,-9.5,.28,19,floorHeight);
  wall(-1.4,-9.5,.28,16.65,floorHeight);
  wall(1.55,-9.22,.28,2.6,floorHeight);wall(1.55,-5.3,.28,9.8,floorHeight);wall(1.55,5.8,.28,3.42,floorHeight);
  wall(1.83,-.2,11.89,.28,floorHeight);
  if(root.FactoryRoomProps&&level!=='1')faces.push(...root.FactoryRoomProps.create('store1',floorHeight,box));
  if(root.WarehouseProps&&level!=='1')faces.push(...root.WarehouseProps.create('store2',floorHeight,box,focusRoom==='store2'));
  if(focusRoom&&['assembly','management','reception','store1','store2'].includes(focusRoom))return focusScene(faces,focusRoom,wallHigh);
  return faces.filter(f=>level==='all'||f.level===Number(level));
 }
 function focusScene(faces,id,wallHigh){
  const room=rooms.find(r=>r.id===id),[x,z,w,d]=room.rect,y=(room.level-1)*floorHeight,h=wallHigh?3.6:.72;
  const out=faces.filter(f=>f.room===id);
  const add=(shape,kind)=>{for(const f of shape)out.push({...f,kind,level:room.level,room:id});};
  add(box(x-.12,y-.16,z-.12,w+.24,.16,d+.24,'#253b40','base'),'base');
  // 室内表示だけ、手前と左手の壁を省略する。間取りの壁や扉の位置は変えない。
  add(box(x-.1,y,z-.18,w+.26,h,.16,id==='assembly'?'#354a4a':'#484b3e','wall'),'wall');
  add(box(x+w,y,z,.16,h,d,'#414f47','wall'),'wall');
  return out;
 }
 function shade(hex,k){return '#'+hex.slice(1).match(/../g).map(v=>Math.round(clamp(parseInt(v,16)*k,0,255)).toString(16).padStart(2,'0')).join('');}
 function pointCloud(faces){
  const points=new Map(),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  function add(position,face,edge){
   const key=face.level+':'+position.map(v=>v.toFixed(3)).join(','),existing=points.get(key);
   if(existing){existing.edge=existing.edge||edge;if(face.emissive){existing.emissive=true;existing.color=face.color;}return;}
   const seed=Math.abs(Math.sin(position[0]*12.9898+position[1]*78.233+position[2]*37.719)*43758.5453)%1;
   const room=face.room||[...rooms].reverse().find(r=>{const[x,z,w,d]=r.rect;return r.level===face.level&&position[0]>=x-.32&&position[0]<=x+w+.32&&position[2]>=z-.32&&position[2]<=z+d+.32;})?.id||null;
   points.set(key,{position,kind:face.kind,edge,seed,room,level:face.level,emissive:Boolean(face.emissive),color:face.color,prop:face.prop||null});
  }
  for(const f of faces){
   if(f.kind==='shadow'||(f.level===0&&f.kind==='weathering'))continue;
   // 人型は小さな頭・関節・指先まで残す。建物と同じ間隔では輪郭が欠ける。
   const[a,b,c,d]=f.points,spacing=f.level===0?(f.kind==='light'?.3:f.kind==='base'?1.4:f.kind==='roof'?1.05:.8):f.kind==='robot'?.11:f.kind==='floor'?.7:f.kind==='base'?.9:f.kind==='machine'?.45:.48;
   const nu=Math.max(1,Math.ceil(distance(a,b)/spacing)),nv=Math.max(1,Math.ceil(distance(a,d)/spacing));
   for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){
    const u=i/nu,v=j/nv;add(a.map((n,k)=>n*(1-u)*(1-v)+b[k]*u*(1-v)+c[k]*u*v+d[k]*(1-u)*v),f,false);
   }
   if(f.kind==='base')continue;
   for(const [a,b] of [[f.points[0],f.points[1]],[f.points[1],f.points[2]],[f.points[2],f.points[3]],[f.points[3],f.points[0]]]){
    const count=Math.max(1,Math.ceil(distance(a,b)/(f.level===0?.42:f.kind==='robot'?.1:.26)));for(let n=0;n<=count;n++)add(a.map((v,i)=>v+(b[i]-v)*n/count),f,true);
   }
  }
  return [...points.values()];
 }
 root.SceneModelCore={rooms,zones,openings,floorHeight,visibleRooms,clamp,scale,project,inside,box,scene,shade,pointCloud};
})(typeof window==='undefined'?globalThis:window);
