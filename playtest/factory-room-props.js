/* 追加3室の備品。画像は材質と用途の参考。人物・遺留品・事件情報は含まない。 */
(function(root){
 'use strict';
 function create(room,base,box){
  const faces=[],level=room==='store1'?2:1;let transform=p=>[p[0],p[1]+base,p[2]],prop='';
  function face(points,color,kind='object',emissive=false,shade=1){faces.push({points:points.map(transform),color,kind,emissive,shade,room,level,prop});}
  function block(x,y,z,w,h,d,color='#596466',kind='object',emissive=false){for(const f of box(x,y,z,w,h,d,color,kind))face(f.points,color,kind,emissive,emissive?1:f.shade);}
  function item(id,fn){const prev=prop;prop=room+'-'+id;fn();prop=prev;}
  function at(x,z,yaw,fn){const prev=transform,c=Math.cos(yaw),s=Math.sin(yaw);transform=p=>prev([x+p[0]*c+p[2]*s,p[1],z-p[0]*s+p[2]*c]);fn();transform=prev;}
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  function rod(a,b,r,color,kind='part',emissive=false,sides=8){
   const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[1])>.85?[1,0,0]:[0,1,0])),v=cross(axis,u);
   const rings=[a,b].map(center=>Array.from({length:sides},(_,i)=>center.map((n,k)=>n+r*(u[k]*Math.cos(i*2*Math.PI/sides)+v[k]*Math.sin(i*2*Math.PI/sides)))));
   for(let i=0;i<sides;i++){const j=(i+1)%sides;face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],color,kind,emissive,.75+(i%3)*.12);}
   face([...rings[1]].reverse(),color,kind,emissive);
  }
  function gear(x,y,z){
   const n=24,inner=.075,outer=i=>i%4<2?.25:.20;
   const p=(r,i,depth)=>[x+r*Math.cos(i*2*Math.PI/n),y+r*Math.sin(i*2*Math.PI/n),z+depth];
   for(let i=0;i<n;i++){const j=i+1,r=outer(i),s=outer(j);face([p(inner,i,0),p(r,i,0),p(s,j,0),p(inner,j,0)],'#b0a584','part');face([p(r,i,0),p(r,i,.11),p(s,j,.11),p(s,j,0)],'#736f5c','part');}
  }
  function crate(x,y,z,w=.65,d=.6){block(x,y,z,w,.45,d,'#66634f','crate');block(x+.025,y+.45,z+.025,w-.05,.06,d-.05,'#8b8161','crate');for(const sx of [x+.07,x+w-.12])block(sx,y+.04,z-.015,.05,.37,.03,'#b19a67','crate');}
  function screen(x,y,z,w=.85,h=.55){
   block(x,y,z,w,h,.11,'#263c43','console');block(x+.04,y+.04,z+.115,w-.08,h-.08,.015,'#184754','screen');
   for(let i=0;i<4;i++)block(x+.1,y+.1+i*.095,z+.135,w*(i%2?.55:.7),.018,.008,'#65ced8','screen',true);
   rod([x+w/2,y,z+.04],[x+w/2,y-.18,z+.04],.035,'#647f7d','console');block(x+w*.28,y-.2,z-.08,w*.44,.035,.3,'#526965','console');
  }
  function rack(x,z,w,yaw,id){at(x,z,yaw,()=>{
   item('rack-'+id,()=>{
    for(const sx of [0,w-.08])for(const sz of [0,.78])block(sx,0,sz,.08,2.95,.08,'#857c62','rack');
    for(const y of [.14,1.02,1.9,2.78]){block(0,y,0,w,.08,.88,'#555e56','rack');block(0,y+.08,.84,w,.045,.035,'#baa46b','rack');}
   });
   for(let row=0;row<3;row++)for(let col=0;col<3;col++)item('parts-'+id+'-'+row+'-'+col,()=>{
    const px=.25+col*(w-.5)/3,py=.24+row*.88,kind=(row+col+id)%3;
    if(kind===0){crate(px,py,.12,.65,.6);for(let n=0;n<3;n++)block(px+.1+n*.16,py+.48,.22,.06,.15,.34,'#89938b','part');}
    else if(kind===1){gear(px+.33,py+.28,.67);gear(px+.65,py+.23,.38);block(px,py,.12,.82,.07,.62,'#47554f','part');}
    else{rod([px+.35,py+.2,.15],[px+.35,py+.2,.58],.19,'#7d8d89');rod([px+.35,py+.2,.58],[px+.35,py+.2,.8],.07,'#bea676');block(px+.05,py,.12,.62,.07,.6,'#45544f','part');}
   });
  });}
  function desk(x,z,n){
   item('desk-'+n,()=>{block(x,.74,z,2.35,.1,.9,'#879183','desk');for(const sx of [x+.06,x+1.84])block(sx,0,z+.08,.45,.74,.74,'#465956','desk');block(x+.5,.86,z+.57,1.1,.025,.22,'#a3aaa0','desk');
    block(x+.65,.85,z+.7,.88,.035,.25,'#253b40','keyboard');for(let k=0;k<6;k++)block(x+.7+k*.12,.888,z+.76,.075,.008,.1,'#8fa5a3','keyboard');block(x+1.35,.05,z+.18,.35,.59,.55,'#273d42','computer');block(x+1.6,.5,z+.74,.035,.035,.01,'#7ccebd','screen',true);});
   for(let i=0;i<2;i++)item('monitor-'+n+'-'+i,()=>screen(x+.14+i*1.12,1.05,z+.16,.99,.64));
   item('chair-'+n,()=>{const cx=x+1.17,cz=z+1.6;block(cx-.36,.46,cz-.34,.72,.14,.68,'#303f42','chair');block(cx-.36,.59,cz+.24,.72,.82,.13,'#3f5150','chair');rod([cx,.05,cz],[cx,.46,cz],.06,'#6f807b','chair');for(const dx of [-.42,.42]){rod([cx,.1,cz],[cx+dx,.1,cz+.2],.035,'#667875','chair');rod([cx,.1,cz],[cx+dx,.1,cz-.2],.035,'#667875','chair');}});
  }
  function server(x,z,n){item('server-'+n,()=>{
   block(x,0,z,1.15,2.85,.8,'#263b3d','server');block(x+.06,.09,z+.81,1.03,2.64,.055,'#121f29','server');
   for(let i=0;i<10;i++){const y=.2+i*.25;block(x+.12,y,z+.87,.91,.19,.025,'#3d514e','server');for(let j=0;j<4;j++)block(x+.19+j*.12,y+.05,z+.9,.07,.018,.008,'#192c32','server');block(x+.86,y+.07,z+.91,.045,.035,.008,i%3?'#75cfc3':'#ddb371','screen',true);}
   for(const y of [.07,2.76])block(x,.01+y,z+.85,1.15,.05,.09,'#8b927f','server');
  });}
  function filingShelf(x,z,w,id){
   item('filing-shelf-'+id,()=>{
    block(x,0,z,w,.12,.65,'#53615a','cabinet');block(x,.12,z,w,2.58,.06,'#48554f','cabinet');
    for(const dx of [0,w-.06])block(x+dx,.12,z,.06,2.58,.65,'#6e7b6b','cabinet');
    for(const y of [.12,.74,1.36,1.98,2.62])block(x,y,z,w,.065,.65,'#7b8271','cabinet');
   });
   for(let row=0;row<4;row++)for(let col=0;col<Math.floor((w-.16)/.13);col++)item('archive-binder-'+id+'-'+row+'-'+col,()=>{
    const px=x+.09+col*.13,py=.2+row*.62,colors=['#8c8e73','#536d6c','#9e9b86','#6e797b'];
    block(px,py,z+.12,.105,.43+(col%3)*.025,.48,colors[(row+col)%colors.length],'file');block(px+.018,py+.21,z+.605,.065,.09,.008,'#c3bda3','file');
   });
  }
  function sofa(x,z,reverse,n){item('sofa-'+n,()=>{
   block(x,.15,z,3.5,.34,1.35,'#334044','sofa');for(let i=0;i<3;i++){block(x+.24+i*1.02,.5,z+.18,.98,.2,.95,'#737b77','sofa');block(x+.23+i*1.02,.7,z+(reverse?1.07:.03),1,.65,.22,'#626f6d','sofa');}
   for(const dx of [0,3.25])block(x+dx,.45,z,.25,.55,1.35,'#485a58','sofa');for(const dx of [.18,3.14])for(const dz of [.18,1.04])block(x+dx,0,z+dz,.12,.17,.12,'#849187','sofa');
  });}
  if(room==='store1'){
   rack(2.4,-8.9,3.3,0,0);rack(6.05,-8.9,3.3,0,1);rack(12.45,-3.8,3.1,Math.PI/2,2);rack(12.45,-.65,2.9,Math.PI/2,3);rack(2.15,-3.9,2.8,0,4);
   item('inventory-desk',()=>{block(9.7,0,-8.7,1.85,.86,.82,'#52625b','desk');block(9.65,.86,-8.75,1.95,.1,.92,'#94a194','desk');screen(10.05,1.16,-8.53,1.02,.65);block(10.05,.98,-8.05,1.1,.035,.24,'#30464b','keyboard');});
   item('large-parts',()=>{for(const [x,z]of [[6.2,-5],[8,-5.1]]){block(x,0,z,1.25,.12,1.1,'#554e3d','part');rod([x+.6,.56,z+.1],[x+.6,.56,z+.85],.42,'#7f8d82');rod([x+.6,.56,z+.85],[x+.6,.56,z+1.02],.12,'#bca16b');}crate(9.6,0,-2.1,1.2,.9);crate(10.9,0,-2.1,1.2,.9);});
   item('floor-lines',()=>{for(const x of [5.25,11.3])block(x,.025,-7.65,.055,.015,6.6,'#b69d56','stripe');});
   item('lamps',()=>{for(const x of [4,8,11.3]){rod([x,3.35,-7.2],[x,3.1,-7.2],.03,'#7d897e','pipe');block(x-.5,3.05,-7.28,1,.08,.2,'#ecc48b','light',true);}});
  }else if(room==='management'){
   desk(-.65,2.65,0);desk(2.95,2.65,1);desk(-.65,5.7,2);desk(2.95,5.7,3);server(.0,.95,0);server(1.38,.95,1);
   // Rear-wall storage: preserve every existing fixture and the right doorway.
   filingShelf(-1.04,.82,.84,'left');filingShelf(4.46,.82,1.35,'right');
   item('network-cabinet',()=>{block(3,0,1,1.2,1.65,.7,'#53625a','cabinet');for(let i=0;i<5;i++){block(3.1,.2+i*.26,1.71,1,.2,.025,'#263f40','console');rod([3.3,.25+i*.26,1.75],[3.8,.32+i*.26,1.75],.025,'#b29253','cable');}});
   item('cable-tray',()=>{block(2.12,.025,1.2,.12,.03,7.7,'#6d7865','cable');for(const z of [2,5.9,8.5])block(-.5,.025,z,5.8,.03,.075,'#77775d','cable');});
   item('ceiling-lamps',()=>{for(const z of [2.8,6.3])block(1.4,3.25,z,1.8,.08,.18,'#ebc58e','light',true);});
  }else if(room==='reception'){
   sofa(8,-8.65,false,0);sofa(8,-4.65,true,1);
   item('low-table',()=>{block(8.35,.5,-6.6,2.8,.1,1.25,'#a49a7b','table');for(const x of [8.48,10.86])for(const z of [-6.47,-5.6])block(x,.05,z,.13,.45,.13,'#596b62','table');block(8.45,.12,-6.5,2.6,.04,1.05,'#465954','table');});
   item('wall-lamps',()=>{for(const x of [7.25,10,12.7]){block(x,1.6,-9.04,.16,.55,.14,'#53635c','light');block(x+.025,1.68,-8.89,.11,.37,.035,'#edbf7f','light',true);}});
  }
  return faces;
 }
 root.FactoryRoomProps={create};
})(typeof window==='undefined'?globalThis:window);
