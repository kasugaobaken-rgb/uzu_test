/* 工場外観の独立した形状。既存の内装・開口を変更せず、屋根と設備は仮設定。 */
(function(root){
 'use strict';
 function create(C){
  const faces=[],height=C.floorHeight+3.9,box=C.box;let prop='';
  function face(points,color,kind='exterior',emissive=false,shade=1){faces.push({points,color,kind,emissive,shade,room:null,level:0,prop});}
  function block(x,y,z,w,h,d,color='#687273',kind='exterior',emissive=false){for(const f of box(x,y,z,w,h,d,color,kind))face(f.points,color,kind,emissive,emissive?1:f.shade);}
  function item(id,fn){prop='exterior-'+id;fn();prop='';}
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  function rod(a,b,r,color='#707f7d',kind='exterior',sides=6){
   const axis=unit(a.map((v,i)=>b[i]-v)),u=unit(cross(axis,Math.abs(axis[1])>.85?[1,0,0]:[0,1,0])),v=cross(axis,u),rings=[a,b].map(center=>Array.from({length:sides},(_,i)=>center.map((n,k)=>n+r*(u[k]*Math.cos(i*2*Math.PI/sides)+v[k]*Math.sin(i*2*Math.PI/sides)))));
   for(let i=0;i<sides;i++){const j=(i+1)%sides;face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],color,kind,false,.7+(i%3)*.13);}
  }
  const openingHeight=id=>id==='shutter'?3.4:2.65;
  const openings=C.openings.map(o=>({...o,height:openingHeight(o.id)}));
  const sample=(x,y)=>Math.abs(Math.sin(x*13.91+y*73.21)*43758.5453)%1;
  // 長方形パネルから扉とシャッターの開口を切り抜く。
  function cut(rect,door){
   const[a,b,y,t]=rect,[l,r]=door.range,h=door.height;if(a>=r||b<=l||y>=h)return[rect];
   const out=[];if(a<l)out.push([a,l,y,t]);if(b>r)out.push([r,b,y,t]);if(t>h)out.push([Math.max(a,l),Math.min(b,r),h,t]);return out;
  }
  function facade(axis,fixed,min,max,doors,side){
   const p=(a,y,offset=0)=>axis==='x'?[fixed+offset,y,a]:[a,y,fixed+offset];
   const palettes=['#666d68','#73776c','#606a68','#7a7c6b','#596765','#777265'];
   for(let y=.18;y<height-.05;y+=1.3)for(let a=min;a<max;a+=1.75){
    let rects=[[a,Math.min(a+1.73,max),y,Math.min(y+1.28,height-.05)]];for(const door of doors)rects=rects.flatMap(r=>cut(r,door));
    for(const[l,r,b,t]of rects){if(r-l<.005||t-b<.005)continue;
     const seed=sample(a,y),color=palettes[Math.floor(seed*palettes.length)];face([p(l,b),p(r,b),p(r,t),p(l,t)],color,'cladding',false,side<0?.92:.75);
     // 狭い錆筋を面形状として加える。画像テクスチャや乱数には依存しない。
     if(seed>.36&&r-l>.3&&t-b>.2){const x=l+(r-l)*.27,w=Math.min(.07,(r-l)*.1),h=(t-b)*(.25+seed*.5);face([p(x,t,side*.012),p(x+w,t,side*.012),p(x+w*.7,t-h,side*.012),p(x,t-h*.8,side*.012)],'#806143','weathering',false,.85);}
    }
   }
   // 外壁の補強リブ。開口内へは伸ばさない。
   for(let a=min;a<=max+.01;a+=3.5){const start=Math.max(.08,...doors.filter(d=>a>=d.range[0]-.1&&a<=d.range[1]+.1).map(d=>d.height));rod(p(a,start,side*.06),p(a,height,side*.06),.05,'#454f50');}
   for(const y of [height*.5,height-.06]){
    let spans=[[min,max]];for(const d of doors.filter(d=>y<d.height))spans=spans.flatMap(([a,b])=>b<=d.range[0]||a>=d.range[1]?[[a,b]]:[[a,Math.max(a,d.range[0])],[Math.min(b,d.range[1]),b]].filter(([l,r])=>r>l));
    for(const[a,b]of spans)rod(p(a,y,side*.06),p(b,y,side*.06),.05,'#a28d65');
   }
  }
  item('yard',()=>{
   block(-20,-.45,-15,40,.16,30,'#344449','base');block(-14.3,-.29,-9.8,28.6,.29,19.6,'#626b63','base');
   for(const x of [-18.5,-16.8])block(x,-.27,-11,.06,.015,22,'#b39b5d','marking');
   for(const z of [-12.2,12.2])for(let x=-15;x<16;x+=3)block(x,-.27,z,1.4,.015,.075,'#9c915f','marking');
   for(const z of [-10.6,10.5]){block(-15,-.26,z,30,.018,.1,'#26383d','marking');for(let x=-14.5;x<15;x+=1)block(x,-.24,z-.05,.065,.02,.22,'#7e8780','marking');}
  });
  item('facade',()=>{
   facade('x',-14,-9.5,9.5,openings.filter(o=>o.id==='shutter'),-1);facade('x',14,-9.5,9.5,openings.filter(o=>o.id==='right-entry'),1);
   facade('z',-9.5,-14,14,openings.filter(o=>o.id==='top-entry'),-1);facade('z',9.5,-14,14,[],1);
   for(const x of [-14,14])for(const z of [-9.5,9.5])block(x-.09,0,z-.09,.18,height,.18,'#434f50');
  });
  for(const o of openings)item(o.id,()=>{
   const[a,b]=o.range,h=o.height;
   if(o.axis==='x'){
    const x=o.id==='shutter'?-14.08:14.04;
    block(x,0,a,.06,h,b-a,o.id==='shutter'?'#3c4e51':'#536464','exterior-door');
    for(const z of [a-.13,b])block(x-.06,0,z,.18,h+.18,.13,'#364549');block(x-.1,h,a-.13,.23,.2,b-a+.26,'#364549');
    if(o.id==='shutter')for(let y=.12;y<h;y+=.19)block(x-.035,y,a,.035,.035,b-a,'#9a9d87','shutter');
    else{block(x+.07,1.15,a+.2,.04,.09,.28,'#b6b7a0','exterior-door');block(x+.07,1.6,a+.45,.02,.55,.65,'#203e48','exterior-door');}
    const center=(a+b)/2;block(x+(o.id==='shutter'?-.2:.08),h+.35,center-.85,.25,.25,1.7,'#777868');block(x+(o.id==='shutter'?-.26:.3),h+.29,center-.75,.03,.22,1.5,'#ffc97f','light',true);
   }else{
    block(a,0,-9.57,b-a,h,.06,'#4b6062','exterior-door');for(const x of [a-.12,b])block(x,0,-9.62,.12,h+.16,.16,'#374b4f');block(a-.12,h,-9.62,b-a+.24,.16,.16,'#374b4f');
    block(a+.2,1.15,-9.65,.25,.08,.03,'#b3bba7','exterior-door');block(a+.65,1.6,-9.65,.72,.5,.03,'#24434c','exterior-door');block(a+.65,h+.35,-9.72,1,.15,.22,'#ffd19b','light',true);
   }
  });
  item('roof',()=>{
   // 大きな屋根面は小分けにし、屋上設備が面の重なりで隠れるのを抑える。
   for(let x=-14.22;x<14.22;x+=2.1)for(let z=-9.72;z<9.72;z+=2.1){const r=Math.min(x+2.1,14.22),b=Math.min(z+2.1,9.72);face([[x,height+.2,z],[r,height+.2,z],[r,height+.2,b],[x,height+.2,b]],'#536662','roof');}
   for(const z of [-9.72,9.5])block(-14.22,height,z,28.44,.2,.22,'#4b6060','roof');for(const x of [-14.22,14])block(x,height,-9.5,.22,.2,19,'#4b6060','roof');
   for(let x=-13.6;x<14;x+=2.1)block(x,height+.21,-9.45,.045,.025,18.9,'#8b9584','roof');
   for(const z of [-9.48,9.48]){for(let x=-14;x<=14;x+=2)rod([x,height+.2,z],[x,height+1.3,z],.045,'#475d5b');for(const y of [height+.75,height+1.3])rod([-14,y,z],[14,y,z],.045,'#7e8d79');}
   for(const x of [-14,14]){for(let z=-9.5;z<=9.5;z+=1.9)rod([x,height+.2,z],[x,height+1.3,z],.045,'#475d5b');for(const y of [height+.75,height+1.3])rod([x,y,-9.5],[x,y,9.5],.045,'#7e8d79');}
  });
  item('roof-plant',()=>{
   for(const[x,z]of [[2,-3],[7,3]]){block(x,height+.2,z,3.1,1.15,2.2,'#718176');for(let y=height+.35;y<height+1.2;y+=.15)block(x-.025,y,z+.1,.035,.045,1.95,'#3b5457');}
   rod([3.5,height+1.5,-1.8],[3.5,height+2.2,-1.8],.46,'#97a08b');rod([3.5,height+2.2,-1.8],[8,height+2.2,-1.8],.46,'#879a90');rod([8,height+2.2,-1.8],[8,height+.25,2.8],.46,'#6c8582');
   for(const x of [-8,-4]){rod([x,height+.2,2],[x,height+1.8,2],.35,'#9da58e');block(x-.5,height+1.8,1.5,1,.12,1,'#4c6666');}
  });
  item('wall-pipes',()=>{
   for(const z of [-8.7,8.7]){rod([-14.28,.3,z],[-14.28,height+.2,z],.09,'#91a491');rod([-14.48,.3,z],[-14.48,height-.2,z],.06,'#6e8587');}
   for(const y of [1.1,3.7])rod([-13.5,y,9.64],[13.5,y,9.64],.09,'#8b9b88');
   for(const x of [-10,-3,4,11]){block(x,3.1,9.55,.9,.4,.3,'#596c65');block(x+.08,3.12,9.86,.74,.22,.03,'#ffd095','light',true);}
  });
  item('bollards',()=>{for(const z of [-6.4,6.8]){block(-15.35,0,z,.32,1.12,.32,'#263b40');for(let i=0;i<4;i++)block(-15.36,.1+i*.26,z-.01,.34,.13,.34,'#c2a15b');}});
  item('fence',()=>{for(const[a,b]of [[-11,-7],[7.2,11.2]]){
   for(let z=a;z<=b;z+=1)rod([-18.9,0,z],[-18.9,2.25,z],.045,'#788c83');for(const y of [.35,1.2,2.05])rod([-18.9,y,a],[-18.9,y,b],.025,'#667b76');
   for(let z=a;z<b;z+=.5){rod([-18.9,.35,z],[-18.9,2.05,Math.min(z+1,b)],.012,'#687f78');rod([-18.9,2.05,z],[-18.9,.35,Math.min(z+1,b)],.012,'#687f78');}
  }});
  return {faces,openings,height,footprint:[-14,-9.5,28,19]};
 }
 root.FactoryExterior={create};
})(typeof window==='undefined'?globalThis:window);
