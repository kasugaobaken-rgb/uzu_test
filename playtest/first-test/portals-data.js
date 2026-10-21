// 第一テストから読める公開サービスのみ。非公開記録や第三テストの解答は格納しない。
window.NEXUS_PORTALS = {
 sites:[
  {id:'home-akasha',kind:'portal',title:'AKASHA 公式サイト',source:'AKASHA',section:'企業公式',date:'公式ホーム',imageId:'akasha-overview',summary:'決済、行政、医療、情報配信。暮らしの基盤を支えるAKASHAの企業情報とサービス案内。',body:['事業紹介、研究倫理、企業情報、研究機関向けサービスを案内する。'],keywords:['AKASHA','アカシャ','あかしゃ','企業','公式','ホームページ','HP','研究','医療','社会基盤'],publication:{slug:'akasha',theme:'corporate',name:'AKASHA',masthead:'AKASHA',subtitle:'TECHNOLOGY FOR EVERYDAY LIFE',accent:'#4fd7ce',mark:'A',host:'akasha.example',url:'akasha.example/'}},
  {id:'home-relay',kind:'portal',title:'RELAY 動画とライブ配信',source:'RELAY',section:'動画配信',date:'サービスホーム',imageId:'streaming-era',summary:'ニュース、暮らし、テクノロジーの番組を探す動画プラットフォーム。チャンネル情報と配信ガイドも掲載。',body:['公開番組の概要と字幕、チャンネル、ライブ配信の利用案内、配信管理への入口。'],keywords:['RELAY','リレー','動画','配信','動画サイト','配信プラットフォーム','ライブ','チャンネル','YouTube','ユーチューブ','生配信'],publication:{slug:'relay',theme:'video',name:'RELAY',masthead:'RELAY',subtitle:'WATCH THE WORLD',accent:'#ff746e',mark:'▶',host:'relay.example',url:'relay.example/'}},
  {id:'home-machilog',kind:'portal',title:'MACHI LOG 街の掲示板',source:'MACHI LOG',section:'掲示板 SNS',date:'コミュニティホーム',imageId:'lens-device',summary:'街で見かけたこと、日々の疑問、暮らしの話題を共有する地域コミュニティ。',body:['地域、生活、端末の話題を読む。スレッド検索、保存、利用案内。'],keywords:['MACHI LOG','マチログ','掲示板','SNS','口コミ','噂','うわさ','投稿','コミュニティ','地域','低い音','倉庫街'],publication:{slug:'machilog',theme:'community',name:'MACHI LOG',masthead:'MACHI LOG',subtitle:'街の話を ここで',accent:'#b4a0ee',mark:'#',host:'machilog.example',url:'machilog.example/'}},
  {id:'home-civic',kind:'portal',title:'東京都市行政ネット 行政と警察の案内',source:'東京都市行政ネット',section:'行政 警察',date:'公共サービスホーム',imageId:'digital-administration',summary:'オンライン手続き、行政サービス、警察の公開情報。生活に必要な窓口を案内します。',body:['行政手続き、証明書、社会保障、警察からのお知らせ、関係機関向け照会の案内。'],keywords:['行政','行政HP','政府','自治体','東京都','警察','警察HP','警視庁','手続き','証明書','相談','公共サービス','照会'],publication:{slug:'tokyo-civic',theme:'public',name:'東京都市行政ネット',masthead:'東京都市行政ネット',subtitle:'TOKYO PUBLIC SERVICE NETWORK',accent:'#4074ae',mark:'都',host:'tokyo-civic.example',url:'tokyo-civic.example/'}}
 ],
 videos:[
  {id:'city-standard',article:'life-2067',channel:'CIVIC GUIDE',category:'暮らし',title:'2067年の暮らしを支えるもの',tag:'生活ガイド'},
  {id:'new-body',article:'body-augmentation',channel:'MEDI-LINK JOURNAL',category:'テクノロジー',title:'義体のある日常',tag:'医療と技術'},
  {id:'city-flow',article:'mobility',channel:'TOKYO FLOW',category:'街',title:'自動運転で変わった都市の移動',tag:'都市交通'},
  {id:'media-shift',article:'streaming-era',channel:'MEDIA HISTORY 2067',category:'ニュース',title:'テレビのあとに来たもの',tag:'メディア史'}
 ],
 threads:[
  {id:'hum',category:'地域',title:'倉庫街の低い音、聞いたことある人いる？',author:'湾岸を歩く人',tag:'街の話',imageId:'low-hum',posts:[['湾岸を歩く人','以前、倉庫の近くで大きなブーンという音を聞いた。普通の機械音より身体に響く感じ。最近は聞いていない。'],['夜勤明け','市のセンサーには異常がなかったって地域記事に出ていた。設備の音なのかな。'],['湾岸を歩く人','そう、それを見て気になった。同じように聞いた人の話があれば知りたい。']],related:'low-hum'},
  {id:'lens',category:'端末',title:'コンタクト端末なしで出かけたら不便だった',author:'裸眼モード',tag:'日常',imageId:'lens-device',posts:[['裸眼モード','端末を外して出かけたら、道案内も支払いもいつもの調子で使えなくて戸惑った。いつの間にこんなに頼っていたんだろう。'],['レンズ初心者','翻訳も視界に出るものだと思ってしまう。昔は別々の機器だったって聞くと不思議。']],related:'lens-device'},
  {id:'work',category:'暮らし',title:'仕事以外で、人と話すきっかけって何がある？',author:'午後の散歩',tag:'生活',imageId:'work-and-unemployment',posts:[['午後の散歩','生活はできているけど、人と会う理由が減った。みんな何をきっかけに外へ出ている？'],['路地のコーヒー','個人店に通っている。店主と話せるのがよくて、つい足が向く。'],['午後の散歩','そういう場所もいいな。探してみる。']],related:'robot-service'},
  {id:'record',category:'街の噂',title:'保存したはずの記事が見つからない',author:'履歴をたどる',tag:'未確認',imageId:'unrecorded-rumor',posts:[['履歴をたどる','前に読んだ記事を探したけど見つからなかった。タイトルの記憶が違うのか、削除されたのかも分からない。'],['通りすがり','検索の履歴は残ってる？　噂だけなら断定しない方がいいと思う。']],related:'unrecorded-rumor'},
  {id:'removed',category:'街の噂',title:'このスレッドは現在表示できません',author:'',tag:'表示制限',imageId:'cybercrime',removed:true,posts:[]}
 ],
 gateways:{
  'research-portal':{title:'研究機関向けサービス',text:'研究資料の照会、審査に関する手続き、研究機器の管理を行うサービスです。所属機関と担当者の権限に応じて利用できる範囲が異なります。',requirement:'機関認証済みの端末から接続してください。'},
  'relay-studio':{title:'RELAY STUDIO',text:'チャンネル情報の編集と配信の管理を行います。チャンネルの所有者、または管理権限を付与された利用者がアクセスできます。',requirement:'チャンネルの管理アカウントでの認証が必要です。'},
  'community-account':{title:'投稿アカウント',text:'投稿、返信、共有を行うにはアカウントの認証が必要です。閲覧とスレッドの保存は、公開範囲内で利用できます。',requirement:'現在の接続では公開スレッドを閲覧できます。'},
  'agency-records':{title:'関係機関向け照会',text:'一般向けの公開情報とは別に、業務上の権限を持つ関係機関向けの照会窓口を設けています。照会先と対象資料によって必要な手続きが異なります。',requirement:'所属機関の認証と照会権限の確認が必要です。'}
 }
};
