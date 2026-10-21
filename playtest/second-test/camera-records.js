// プレイヤー公開用。時刻・行動の正解・作者向け素材名は含めない。
export const cameraRecords = [
  {
    "id": "101",
    "room": "倉庫2",
    "floor": 2,
    "src": "/second-test/camera-images/record-101.webp"
  },
  {
    "id": "105",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-105.webp"
  },
  {
    "id": "110",
    "room": "倉庫1",
    "floor": 2,
    "src": "/second-test/camera-images/record-110.webp"
  },
  {
    "id": "114",
    "room": "組立プログラミング室",
    "floor": 1,
    "src": "/second-test/camera-images/record-114.webp"
  },
  {
    "id": "119",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-119.webp"
  },
  {
    "id": "124",
    "room": "組立プログラミング室",
    "floor": 1,
    "src": "/second-test/camera-images/record-124.webp"
  },
  {
    "id": "128",
    "room": "応接間",
    "floor": 1,
    "src": "/second-test/camera-images/record-128.webp"
  },
  {
    "id": "133",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-133.webp"
  },
  {
    "id": "137",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-137.webp"
  },
  {
    "id": "138",
    "room": "倉庫2",
    "floor": 2,
    "src": "/second-test/camera-images/record-138.webp"
  },
  {
    "id": "142",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-142.webp"
  },
  {
    "id": "147",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-147.webp"
  },
  {
    "id": "151",
    "room": "応接間",
    "floor": 1,
    "src": "/second-test/camera-images/record-151.webp"
  },
  {
    "id": "156",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-156.webp"
  },
  {
    "id": "161",
    "room": "応接間",
    "floor": 1,
    "src": "/second-test/camera-images/record-161.webp"
  },
  {
    "id": "165",
    "room": "倉庫1",
    "floor": 2,
    "src": "/second-test/camera-images/record-165.webp"
  },
  {
    "id": "170",
    "room": "組立プログラミング室",
    "floor": 1,
    "src": "/second-test/camera-images/record-170.webp"
  },
  {
    "id": "174",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-174.webp"
  },
  {
    "id": "175",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-175.webp"
  },
  {
    "id": "179",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-179.webp"
  },
  {
    "id": "184",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-184.webp"
  },
  {
    "id": "188",
    "room": "管理室",
    "floor": 1,
    "src": "/second-test/camera-images/record-188.webp"
  },
  {
    "id": "193",
    "room": "作業場",
    "floor": 1,
    "src": "/second-test/camera-images/record-193.webp"
  }
];
export const cameraRooms = ['管理室','作業場','組立プログラミング室','応接間','倉庫1','倉庫2'];
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderCameraRecords(filter='all'){
 const shown=cameraRecords.filter(r=>filter==='all'||r.room===filter);
 return `<section class="camera-records" aria-label="防犯カメラの静止画像"><p class="camera-note">記録から抽出された静止画像です。時刻情報はなく、表示順は出来事の順番ではありません。廊下の記録はありません。</p><div class="camera-filters" role="group" aria-label="防犯カメラの部屋を選ぶ">${['all',...cameraRooms].map(room=>`<button data-action="cameraFilter" data-room="${escape(room)}" aria-pressed="${room===filter}">${room==='all'?'すべて':escape(room)} <small>${cameraRecords.filter(r=>room==='all'||r.room===room).length}</small></button>`).join('')}</div><p class="camera-count">${shown.length}枚の抽出画像 ／ タップで拡大</p><div class="camera-grid">${shown.map(r=>`<article class="photo camera-record"><button class="camera-thumb" data-action="cameraOpen" data-id="${r.id}" aria-label="${escape(r.room)} 抽出画像 ${r.id}を拡大"><img src="${r.src.replace('.webp','-thumb.webp')}" alt="${escape(r.room)}の防犯カメラ抽出画像 ${r.id}" loading="lazy" decoding="async" width="640" height="360"></button><div class="caption"><span class="eyebrow">${r.floor}F / STILL ${r.id}</span><h2>${escape(r.room)}</h2><small>時刻情報なし</small></div></article>`).join('')}</div></section>`;
}

