/* 倉庫内装の形状試作。人型は機械・義体の仮モデルで、実在の人物や事件の証拠ではない。 */
(function(root){
 'use strict';
 function create(room,base,box,detailed=false){
  // 整備設備は1階の室寸法に合わせて配置。倉庫2の座標と形状は変更しない。
  const level=room==='assembly'?1:2;
  const faces=[];let transform=room==='assembly'?p=>[(p[0]-1.85)*.57-.9,p[1]*.9+base,(p[2]+9.2)*.72-9]:p=>[p[0],p[1]+base,p[2]],prop='',robotCount=0;
  const vec={sub:(a,b)=>a.map((v,i)=>v-b[i]),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit:a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);}};
  function face(points,color,kind='object',emissive=false,shade=1){faces.push({points:points.map(transform),color,kind,emissive,shade,room,level,prop});}
  function block(x,y,z,w,h,d,color='#4d5a59',kind='object',emissive=false){for(const f of box(x,y,z,w,h,d,color,kind))face(f.points,f.color,kind,emissive,emissive?1:f.shade);}
  function item(id,fn){const previous=prop;prop=id;fn();prop=previous;}
  function at(position,yaw,fn){const previous=transform,c=Math.cos(yaw),s=Math.sin(yaw);transform=p=>previous([position[0]+p[0]*c+p[2]*s,position[1]+p[1],position[2]-p[0]*s+p[2]*c]);fn();transform=previous;}
  function rod(a,b,r,color='#596864',kind='pipe',emissive=false,sides=6){
   const axis=vec.unit(vec.sub(b,a)),u=vec.unit(vec.cross(axis,Math.abs(axis[1])>.85?[1,0,0]:[0,1,0])),v=vec.cross(axis,u),rings=[];
   for(const center of [a,b])rings.push(Array.from({length:sides},(_,i)=>center.map((n,k)=>n+r*(u[k]*Math.cos(i*2*Math.PI/sides)+v[k]*Math.sin(i*2*Math.PI/sides)))));
   for(let i=0;i<sides;i++){const j=(i+1)%sides;face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],color,kind,emissive,.72+.27*(i%3)/2);}
  }
  function ball(center,radius,color,kind='robot',emissive=false,lat=2,lon=6){
   const p=(i,j)=>[center[0]+radius[0]*Math.sin(i*Math.PI/lat)*Math.cos(j*2*Math.PI/lon),center[1]+radius[1]*Math.cos(i*Math.PI/lat),center[2]+radius[2]*Math.sin(i*Math.PI/lat)*Math.sin(j*2*Math.PI/lon)];
   for(let i=0;i<lat;i++)for(let j=0;j<lon;j++)face([p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j)],color,kind,emissive,.75+.2*(j%3)/2);
  }
  function robot(position,yaw=0,pose='standing',size=1){
   item(room+'-robot-'+robotCount++,()=>at(position,yaw,()=>{
    const previous=transform;transform=p=>previous(pose==='lying'?[p[0]*size,.25-p[2]*size,(.95-p[1])*size]:p.map(n=>n*size));
    const metal='#85938f',dark='#273b3f',joint='#45575a',segments=detailed?8:5;
    block(-.22,.83,-.14,.44,.22,.28,dark,'robot');rod([0,.96,0],[0,1.5,0],.1,dark,'robot');
    block(-.29,1.12,-.15,.58,.38,.3,metal,'robot');block(-.2,1.23,.15,.4,.18,.035,'#657f7d','robot');
    rod([0,1.48,0],[0,1.59,0],.075,joint,'robot');ball([0,1.76,0],[.17,.22,.16],metal,'robot',false,detailed?3:2,detailed?8:6);
    block(-.12,1.76,.145,.24,.055,.025,'#6ec4ce','robot');
    for(const sign of [-1,1]){
     const shoulder=[sign*.35,1.42,0],elbow=[sign*.46,1.06,.04],wrist=[sign*.46,.79,.08],hip=[sign*.14,.84,0],knee=[sign*.17,.46,.04],ankle=[sign*.19,.12,0];
     for(const[a,b,r]of [[shoulder,elbow,.075],[elbow,wrist,.065],[hip,knee,.095],[knee,ankle,.075]])rod(a,b,r,metal,'robot',false,segments);
     if(detailed)for(const p of [shoulder,elbow,knee])ball(p,[.09,.09,.09],joint);
     block(sign*.46-.065,.63,.02,.13,.18,.15,joint,'robot');block(sign*.19-.095,0,-.08,.19,.12,.39,dark,'robot');
    }
    if(detailed){for(const y of [1.28,1.34])block(-.1,y,.19,.2,.018,.01,'#80b9b5','robot');}
    transform=previous;
   }));
  }
  function ring(x,y,z,r=.7,color='#9af4ef'){
   item(room+'-light-'+x+'-'+z,()=>{
    const n=detailed?24:16;
    for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;face([[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r-.09),y,z+Math.sin(b)*(r-.09)],[x+Math.cos(a)*(r-.09),y,z+Math.sin(a)*(r-.09)]],color,'light',true);}
    rod([x,y+.02,z],[x,y+.5,z],.035,'#4e6060');
   });
  }
  function monitor(position,yaw=0,large=false){
   const w=large?1.85:.85,h=large?1.15:.62;
   item(room+'-screen-'+position.join('-'),()=>at(position,yaw,()=>{
    block(-w/2,0,-.09,w,h,.18,'#162f37','console');block(-w/2+.05,.05,.095,w-.1,h-.1,.012,'#10454e','screen');
    const color='#58ceda';
    for(const y of [.08,h-.08])rod([-w/2+.06,y,.12],[w/2-.06,y,.12],.014,color,'screen',true,4);
    const sx=-w*.23,sy=h*.55;
    ball([sx,sy+.18,.12],[.055,.06,.014],color,'screen',true,2,6);
    for(const[a,b]of [[[sx,sy+.11,.12],[sx,sy-.13,.12]],[[sx-.11,sy+.03,.12],[sx+.11,sy+.03,.12]],[[sx,sy-.13,.12],[sx-.08,sy-.28,.12]],[[sx,sy-.13,.12],[sx+.08,sy-.28,.12]]])rod(a,b,.012,color,'screen',true,4);
    for(let i=0;i<4;i++)rod([.03,.12+i*h*.17,.12],[w*.32-(i%2)*w*.1,.12+i*h*.17,.12],.012,color,'screen',true,4);
   }));
  }
  function cable(points,color='#263d40',radius=.025){for(let n=1;n<points.length;n++)rod(points[n-1],points[n],radius,color,'cable',false,5);}
  function crate(x,y,z,w=1.1,d=.8){
   block(x,y,z,w,.62,d,'#655e4d','crate');block(x+.05,y+.62,z+.05,w-.1,.06,d-.1,'#777460','crate');
   for(const sx of [x+.08,x+w-.16])block(sx,y+.05,z-.015,.08,.5,.035,'#ac9a6d','crate');block(x+w*.37,y+.37,z-.02,w*.25,.06,.04,'#202e31','crate');
  }
  function shadow(x,z,w,d){face([[x,.035,z],[x+w,.035,z],[x+w,.035,z+d],[x,.035,z+d]],'#061014','shadow');faces[faces.length-1].alpha=.3;}
  if(room==='assembly'){
   item('assembly-floor-lines',()=>{
    for(const x of [2.5,12.9])block(x,.025,-8.8,.055,.015,8,'#bdad53','stripe');
    block(2.5,.025,-.8,10.45,.015,.055,'#bdad53','stripe');
   });
   // 図の外周や出入口を動かさず、室内に2台の整備台を追加。
   const beds=[[5,-3.3],[9.6,-5.8]];
   beds.forEach(([x,z],n)=>{
    item('assembly-bench-'+n,()=>{
     shadow(x-1.06,z-1.66,2.24,3.55);
     block(x-1,.05,z-1.7,2,.76,3.4,'#3b4f50','bench');block(x-.9,.82,z-1.65,1.8,.18,3.3,'#9da49a','bench');block(x-.7,1,z-1.55,1.4,.08,3.1,'#33494b','bench');
     for(const side of [-1,1]){rod([x+side*.96,1.04,z-1.45],[x+side*.96,1.04,z+1.45],.035,'#a1ada4','bench');block(x+side*.9,.18,z+1.28,.16,.4,.18,'#182c31','bench');}
     block(x-.5,.35,z-1.76,1,.25,.08,'#73928d','bench');
    });
    robot([x,1.08,z],0,'lying',1.32);ring(x,3.02,z,.8);
    item('assembly-console-'+n,()=>{block(x+1.22,0,z+.6,.8,.85,.75,'#4f6361','console');rod([x+1.6,.85,z+.9],[x+1.6,1.5,z+.9],.05,'#596f70','console');});
    monitor([x+1.6,1.5,z+.9],-.2);
    cable([[x+.7,.12,z+1.45],[x+1.2,.05,z+1.65],[x+1.7,.05,z+1.4],[x+1.8,.7,z+1]],'#314e52',.035);
   });
   for(const x of [3.2,5.4,7.6,11.4]){
    item('assembly-frame-'+x,()=>{for(const sx of [x-.44,x+.44])rod([sx,0,-8.6],[sx,2.75,-8.6],.045,'#455b5d');rod([x-.44,2.75,-8.6],[x+.44,2.75,-8.6],.05,'#60726c');});
    robot([x,.15,-8.35],0,'standing',1.1);
   }
   ring(3.2,3.05,-7.4,.58);monitor([13.28,1.3,-5.8],-Math.PI/2,true);monitor([8.8,1.65,-8.94],0,true);
   item('assembly-parts-rack',()=>{
    for(const x of [2.5,6.7])rod([x,0,-.7],[x,1.3,-.7],.055,'#5d6d67');
    for(const y of [.3,.95]){block(2.45,y,-1.18,4.35,.08,.62,'#5c6761','rack');for(let n=0;n<5;n++){const x=2.75+n*.75;block(x,y+.08,-1.08,.45,.18,.38,'#87918a','part');rod([x+.12,y+.28,-.95],[x+.35,y+.5,-.95],.07,'#455f63','part');}}
   });
   // 機械用の配管と吊りケーブル。人体の処置やゲーム上の事実は設定しない。
   for(const z of [-8.95,-7.9])cable(Array.from({length:13},(_,i)=>[2.1+i*.92,3.42-.32*Math.sin(i*Math.PI/12),z]),'#455b5b',.035);
   for(const x of [2.2,12.95])rod([x,.1,-8.9],[x,3.3,-8.9],.065,'#536866');
  }else if(room==='store2'){
   const rackCenters=[[3.6,2.2,Math.PI/2],[11.4,2.2,-Math.PI/2],[3.6,7.4,Math.PI/2],[11.4,7.4,-Math.PI/2]];
   rackCenters.forEach(([x,z,yaw],n)=>at([x,0,z],yaw,()=>{
    item('store2-rack-'+n,()=>{
     shadow(-1.55,-.64,3.2,1.55);
     for(const sx of [-1.5,1.5])for(const sz of [-.66,.66])block(sx,0,sz,.085,3.34,.085,'#7d7660','rack');
     for(const y of [.04,1.64,3.24]){block(-1.5,y,-.66,3.08,.09,1.4,'#555e55','rack');rod([-1.46,y+.1,.72],[1.55,y+.1,.72],.025,'#b4a06b','rack');}
     for(let i=0;i<=6;i++)rod([-1.46+i*.5,.1,-.62],[-1.46+i*.5,3.2,-.62],.012,'#596354','rack');
     rod([-1.45,.1,-.62],[1.5,3.2,-.62],.018,'#6d745f','rack');rod([1.5,.1,-.62],[-1.45,3.2,-.62],.018,'#6d745f','rack');
     rod([-1.4,3.35,.2],[1.4,3.35,.2],.025,'#d4ae62','light',true);
    });
    for(const y of [.13,1.73])for(const sx of [-.67,.7])robot([sx,y,.05],0,'standing',.73);
   }));
   item('store2-cases',()=>{for(const x of [2.7,4.6,9.6,11.5])crate(x,0,.35,1.35,1);crate(2.5,0,4.15,1,.8);crate(11.5,0,4.15,1,.8);});
   item('store2-aisle',()=>{
    for(const x of [5.7,9.1])block(x,.025,.5,.065,.015,8.4,'#bd9d4e','stripe');
    block(2,.025,5.2,11.4,.015,.06,'#bd9d4e','stripe');
   });
   item('store2-cart',()=>{
    block(7.2,.14,7.5,1,.45,1.1,'#7e774d','cart');for(const x of [7.15,8.03])for(const z of [7.65,8.3])ball([x,.18,z],[.12,.18,.18],'#233638','cart');
    for(const x of [7.22,8.02])rod([x,.58,8.5],[x,1.3,8.5],.04,'#6d7763','cart');rod([7.22,1.3,8.5],[8.02,1.3,8.5],.04,'#949075','cart');
   });
   for(const x of [4.9,10.2])rod([x,3.48,.3],[x,3.48,9],.045,'#6b7464');
   for(const z of [1.1,4.75,8.5]){rod([2.2,3.43,z],[13.2,3.43,z],.04,'#626d5f');rod([6.8,3.37,z],[8.5,3.37,z],.035,'#e0bc76','light',true);}
  }
  return faces;
 }
 root.WarehouseProps={create};
})(typeof window==='undefined'?globalThis:window);
