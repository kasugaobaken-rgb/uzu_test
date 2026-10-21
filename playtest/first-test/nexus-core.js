(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const definitions={
  'CIVIC GUIDE':['civic-guide','civic','暮らしの手引き','生活と制度を、わかりやすく。','#348a83','CG'],
  'MEDI-LINK JOURNAL':['medilink','medical','医療とテクノロジーの専門誌','MEDICINE × TECHNOLOGY','#168e8a','M+'],
  'TOKYO FLOW':['tokyo-flow','flow','都市の移動を読む','MOBILITY / CITY / FUTURE','#5278dd','TF'],
  'LIFE/TECH 67':['lifetech67','magazine','日常の、少し先へ。','LIFE / DEVICES / CULTURE','#ca6c47','L/T'],
  'NOVA NEWS':['nova-news','news','NOVA NEWS','確かな情報を、いま。','#bf4148','N'],
  'MEDIA HISTORY 2067':['media-history','archive','メディア史アーカイブ','MEDIA HISTORY / DIGITAL ARCHIVES','#947455','MH'],
  'SECURITY STANDARD':['security-standard','security','情報社会の安全を考える','SECURITY STANDARD','#3e7a9c','SS'],
  'URBAN TRACE':['urban-trace','forum','記録の外側をたどる','URBAN TRACE / FIELD NOTES','#b895e2','UT'],
  'LOCAL LOOP TOKYO':['local-loop','local','街の小さな声をつなぐ','LOCAL LOOP TOKYO','#427968','LL'],
  '日報デジタル':['nippo-digital','newspaper','日報デジタル','社会を記録する。','#b93138','日'],
  'BUSINESS ATLAS 2067':['business-atlas','business','企業と社会の未来図','BUSINESS ATLAS 2067','#247e88','BA'],
  'WORK LIFE REPORT':['worklife-report','report','働くことの、これから。','WORK LIFE REPORT','#cf7049','WL'],
  'NEURO ARCHIVE':['neuro-archive','research','神経科学・意識研究アーカイブ','NEURO / RESEARCH ARCHIVE','#72dbd6','NA'],
  'NEURO ARCHIVE / CACHE':['neuro-cache','terminal','研究データキャッシュ','NEURO ARCHIVE / CACHE','#83e0bd','>_'],
  'PUBLIC SAFETY DATA':['public-safety','government','公共安全データポータル','PUBLIC SAFETY / OPEN DATA','#275d91','PS'],
  'CASE FILE MIRROR':['casefile-mirror','dossier','調査記録ミラー','CASE FILE / MIRROR','#a87a66','CF'],
  'OPEN NET LAB':['open-net-lab','lab','開かれたネットワークを研究する','OPEN NET LAB','#83df9b','ON'],
  'PACKET/0 MIRROR':['packet-zero','terminal','ネットワーク解析ノート','PACKET/0 MIRROR','#81d8fa','P/0'],
  'PUBLIC LEDGER REVIEW':['public-ledger','ledger','政策と資金の流れを追う','PUBLIC LEDGER REVIEW','#283c6a','PL'],
  'THE WITNESS / ARCHIVE':['the-witness','dossier','独立調査報道アーカイブ','THE WITNESS','#af483f','W'],
  'POLITICO JP':['politico-jp','news','政治の現在地を伝える','POLITICO JP','#303d77','PJ'],
  'SOCIETY MAP':['society-map','report','社会の変化を地図にする','SOCIETY MAP','#bd7750','SM'],
  'BLACK MARKET WATCH':['blackmarket-watch','underground','裏社会・技術流通レポート','BLACK MARKET WATCH','#f0a167','BW'],
  '施設保安レビュー':['facility-review','technical','施設管理と防災の専門メディア','FACILITY SAFETY REVIEW','#d78e35','FS'],
  '行政の仕組み':['public-service','government','行政の仕組み','PUBLIC SERVICE GUIDE','#416e9e','行'],
  '月刊アンダーライン':['underline','underground','表に出ない社会の輪郭','UNDERLINE / MONTHLY','#e9bc68','_U'],
  '配信インフラ年鑑':['streaming-index','technical','配信基盤の技術資料室','STREAMING INFRASTRUCTURE INDEX','#5d84c4','SI'],
  'メディア技術レビュー':['media-review','medical','映像と記録のテクノロジー','MEDIA TECHNOLOGY REVIEW','#8758a4','MR']
 };
 function profile(article){if(article.kind==='portal'&&article.publication)return article.publication;const [slug,theme,subtitle,tagline,accent,mark]=definitions[article.source]||['publication','report',article.section,article.source,'#537a9a','P'];return {slug,theme,subtitle,tagline,masthead:article.source,accent,mark,name:article.source,host:slug+'.example',url:slug+'.example/'+article.id};}
 function available(data,state){return data.articles.filter(a=>Number(a.phase??1)<=Number(state.phase??1)&&(!a.audience||(state.review?(!state.pc||a.audience.includes(state.pc)):(state.unlocked&&state.pc&&a.audience.includes(state.pc)))));}
 const norm=s=>String(s).toLowerCase().replace(/[\s　・、。！？!?「」『』]/g,'');
 function search(articles,query){const tokens=String(query).trim().split(/[\s　]+/).map(norm).filter(Boolean);if(!tokens.length)return articles;return articles.map(a=>{const fields=[[a.title,12],[a.source,10],[profile(a).host,10],[a.keywords.join(' '),8],[a.summary,6],[a.section,3],[a.body.join(' '),2]].map(([s,w])=>[norm(s),w]);return {a,score:tokens.reduce((n,t)=>n+fields.reduce((sum,[s,w])=>sum+(s.includes(t)?w:0),0),0)+(norm(a.title).includes(norm(query))?16:0)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.a);}
 function image(a,pixel=true){return (pixel?'pixel-images/':'article-images/')+(a.imageId||a.id)+(pixel?'.png':'.jpg');}
 function toHalf(s){return s.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));}
 function correct(q,raw){const v=toHalf(String(raw).trim()),up=v.toUpperCase(),digits=(v.match(/\d+/)||[null])[0],answers=q.answers.includes('第4相')?[...q.answers,'4','四']:q.answers;return answers.some(a=>/^\d+$/.test(a)?digits===a:up.includes(a.toUpperCase()));}
 function siteLink(a,state,query=''){const p=new URLSearchParams({id:a.id,mode:state.pixel?'pixel':'real',phase:String(state.phase),from:state.review?'review':'search',q:query});if(state.pc)p.set('pc',state.pc);if(state.review)p.set('review','1');return (a.kind==='portal'?'portal.html?':'site.html?')+p;}
 root.NexusCore={esc,profile,available,search,image,correct,siteLink,definitions};
})(window);
