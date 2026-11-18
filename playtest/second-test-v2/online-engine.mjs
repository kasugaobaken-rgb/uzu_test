// 自動生成（build-v5.mjs）。元は demo/second-test-v2/engine.mjs。物語データは進行担当が復号して渡す。
export function makeEngine(catalog){
const {pairs, source} = catalog; const publicEvidence = catalog.evidence; const fragments = catalog.fragments || {}; const reveal = catalog.reveal;
const randomBytes = n => { const b = crypto.getRandomValues(new Uint8Array(n)); return {toString: f => f === 'hex' ? [...b].map(v => v.toString(16).padStart(2, '0')).join('') : btoa(String.fromCharCode(...b)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}; };
function randomInt(max) { const limit = Math.floor(4294967296 / max) * max; let n; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= limit); return n % max; }
const Buffer = {from() { throw new GameError('オンライン版では写真の登録はできません。'); }};

// 交換式（2026-10-26）：自分のAは最初から手元、他人の手札にある自分のBを集める。
const VERSION = '20261026-v2-' + source.sha256.slice(0, 8);
// プレイ時間は40分固定。交換も議論もこの中で自由に行い、時間が来たら返却して投票へ移る。
const EXCHANGE_MS = 40 * 60 * 1000;
// 投票は5分。時間が来たら自動で締め切る（進行担当が先に締め切ることもできる）。
const VOTE_MS = 5 * 60 * 1000;
class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = (s, status) => { throw new GameError(s, status); };
const token = () => randomBytes(24).toString('base64url');
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const EFFECTS = {
 steal:   {name: '抜き取り', count: 2, text: '1人を選び、その手札からランダムに1枚を奪う。誰が抜いたかは相手に出ない。'},
 name:    {name: '指名',     count: 1, text: '番号を1つ言う。そのBを持っている人は、必ず使った人に渡す。指名された番号は全員に知らされる。'},
 trace:   {name: '追跡',     count: 2, text: '番号を1つ選ぶと、そのBを今だれが持っているかが、使った人にだけ分かる。'},
 peek:    {name: 'のぞき見', count: 1, text: '1人を選び、その手札の番号を全部見る。本文は見えない。'},
 protect: {name: '保護',     count: 1, text: '自分の手札の1枚を、抜き取り・指名・攪乱から最後まで守る。'},
 shuffle: {name: '攪乱',     count: 1, text: '全員が、手札からランダムに1枚を左隣（PC番号が1つ上、PC5はPC1）へ渡す。使った人は分からない。'},
};

// units：記憶32組。A・Bをつなげた文章が復元後の本文（Word 5〜9章の本文と同じ）。
const units = pairs.map(p => ({key: p.no, owner: p.owner, title: p.title, place: p.place, text: p.a + p.b, a: p.a, b: p.b}));
const cards = new Map();
for (const u of units) {
 cards.set(u.key + '-A', {id: u.key + '-A', kind: 'a', key: u.key, owner: u.owner, title: u.title, place: u.place, text: u.a});
 cards.set(u.key + '-B', {id: u.key + '-B', kind: 'b', key: u.key, owner: u.owner, text: u.b});
}
let e = 0;
for (const [type, def] of Object.entries(EFFECTS)) for (let i = 0; i < def.count; i++) { const id = 'E' + (++e); cards.set(id, {id, kind: 'effect', effect: type, title: def.name, text: def.text}); }
cards.set('J', {id: 'J', kind: 'joker', title: '未読取の記録', text: 'この記録は、現在の状態では読み取れない。'});
const dealtIds = [...cards.values()].filter(c => c.kind !== 'a').map(c => c.id); // 41枚

const evidence = publicEvidence;
const arrivals = catalog.arrivals;
// 最初のハンドアウトの背景（Word 2章「最初のハンドアウト」のPC別の背景）
const backgrounds = catalog.backgrounds;
const left = seat => seat % 5 + 1;

function createRoom() {
 const room = {id: randomBytes(4).toString('hex').toUpperCase(), hostToken: token(), phase: 'lobby', rev: 1, offers: [], announcements: [], returnLog: [], photos: Array.from({length: 6}, (_, i) => ({id: String(i + 1), title: `写真 ${String(i + 1).padStart(2, '0')}`, caption: '', image: null})), players: [], created: Date.now(), started: null, deadline: null, timeline: [], revealStep: 0};
 // self：40分の間に自分で集めて復元した記憶（番号と時刻）。断片の表示と「情報を早く集めたか」の評価に使う。
 for (let seat = 1; seat <= 5; seat++) room.players.push({seat, token: token(), hand: [], protected: [], restored: [], self: [], shared: [], notices: [], tutorial: false, joined: false, vote: null});
 return room;
}
function identify(room, key) { if (key === room.hostToken) return {host: true}; const player = room.players.find(p => p.token === key); if (!player) fail('参加情報が確認できません。招待リンクを開き直してください。', 401); return {host: false, player}; }
function notice(p, text) { p.notices.unshift({id: token().slice(0, 9), text, at: Date.now()}); p.notices = p.notices.slice(0, 30); }
function announce(room, text) { room.announcements.unshift({id: token().slice(0, 9), text, at: Date.now()}); room.announcements = room.announcements.slice(0, 20); }

// 配る：自分のBは自分に配らない。4人が8枚、1人が9枚。1人の手札に3人分以上のBが混ざる。
function deal(rand = randomInt) {
 for (let attempt = 0; attempt < 500; attempt++) {
  const hands = [[], [], [], [], []];
  const bs = shuffle(dealtIds.filter(id => cards.get(id).kind === 'b'));
  const rest = shuffle(dealtIds.filter(id => cards.get(id).kind !== 'b'));
  let ok = true;
  for (const id of bs) {
   const owner = cards.get(id).owner;
   const options = [0, 1, 2, 3, 4].filter(i => i + 1 !== owner);
   const min = Math.min(...options.map(i => hands[i].length));
   const pick = options.filter(i => hands[i].length === min);
   hands[pick[rand(pick.length)]].push(id);
  }
  const big = rand(5);
  for (const id of rest) {
   const target = [0, 1, 2, 3, 4].filter(i => hands[i].length < (i === big ? 9 : 8));
   if (!target.length) { ok = false; break; }
   const min = Math.min(...target.map(i => hands[i].length));
   const pick = target.filter(i => hands[i].length === min);
   hands[pick[rand(pick.length)]].push(id);
  }
  if (!ok) continue;
  const mixed = hands.every(h => new Set(h.filter(id => cards.get(id).kind === 'b').map(id => cards.get(id).owner)).size >= 3);
  const sizes = hands.map(h => h.length).sort().join();
  // 同じ効果カードが1人に2枚入らないようにする
  const spread = hands.every(h => { const effs = h.filter(id => cards.get(id).kind === 'effect').map(id => cards.get(id).effect); return new Set(effs).size === effs.length; });
  if (mixed && spread && sizes === '8,8,8,8,9') return hands;
 }
 throw new Error('配り方が見つかりません。');
}

// 自分のBが手元に来たら、その場で復元する。
function autoRestore(room, now) {
 for (const p of room.players) {
  for (const id of [...p.hand]) {
   const c = cards.get(id);
   if (c.kind === 'b' && c.owner === p.seat && !p.restored.includes(c.key)) {
    p.hand = p.hand.filter(x => x !== id); p.protected = p.protected.filter(x => x !== id);
    p.restored.push(c.key); p.self.push({key: c.key, at: now}); notice(p, `#${c.key}の記憶がそろい、復元しました。「復元した記憶」で読めます。`);
   }
  }
 }
}

// プレイ時間（40分）が終わったら、手元に残ったBを持ち主へ返す。最後に誰が持っていたかを記録し、そのまま投票へ移る。
function forceReturn(room, now, early = false) {
 room.returnLog = [];
 for (const p of room.players) {
  for (const id of [...p.hand]) {
   const c = cards.get(id);
   if (c.kind !== 'b') continue;
   const owner = room.players[c.owner - 1];
   p.hand = p.hand.filter(x => x !== id);
   if (!owner.restored.includes(c.key)) { owner.restored.push(c.key); notice(owner, `#${c.key}の記憶が返却され、復元しました。`); }
   room.returnLog.push({id, holder: p.seat});
  }
  p.protected = [];
 }
 room.returnLog.sort((a, b) => a.id.localeCompare(b.id));
 room.offers = [];
 room.phase = 'vote'; room.deadline = now + VOTE_MS;
 announce(room, `${early ? 'プレイを終了しました' : '40分が経ちました'}。手元に残った記憶は、すべて持ち主へ返されました。投票の時間です。`);
}

// 全員で共有する時系列。誰でも追加・修正・削除でき、書いた人のPC番号が残る。
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function timelineAct(room, who, a, now) {
 if (room.phase === 'finished') fail('終了後は時系列を変更できません。');
 const by = who.host ? '進行' : `PC${who.player.seat}`;
 const clean = () => {
  const time = String(a.time || '').trim();
  if (time && !TIME_RE.test(time)) fail('時刻は 18:05 のように入力してください。');
  const text = String(a.text || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!text) fail('出来事を入力してください。');
  return {time, text};
 };
 if (a.type === 'timelineAdd') {
  if (room.timeline.length >= 100) fail('時系列がいっぱいです。不要なものを消してください。');
  room.timeline.push({id: token().slice(0, 10), ...clean(), by, at: now});
  return;
 }
 const item = room.timeline.find(x => x.id === String(a.id)); if (!item) fail('その出来事は、すでに消されています。');
 if (a.type === 'timelineEdit') Object.assign(item, clean(), {editedBy: by});
 else if (a.type === 'timelineRemove') room.timeline = room.timeline.filter(x => x !== item);
 else fail('操作を確認できません。');
}
// 断片は、自分で復元してから2分の間だけ本人の画面データに載せる（画面では一瞬だけ表示し、あとから読み返せない）。
const FLASH_MS = 2 * 60 * 1000;
const flashFor = (p, now) => p.self.filter(s => now - s.at < FLASH_MS && fragments[s.key]).map(s => ({key: s.key, at: s.at, text: fragments[s.key].text, truth: Boolean(fragments[s.key].truth)}));

// 結果発表：進行担当が1段ずつ開く。票数と評価はここで集計する。
// 「情報を早く集めた」：40分の間に自分で復元した割合が最も高いモデル。同じ割合なら、最後の復元が早かった方（仮の基準）。
function revealView(room) {
 if (!room.revealStep) return null;
 const votes = tally(room), t = reveal.traitor;
 const gather = room.players.map(p => { const need = units.filter(u => u.owner === p.seat).length, own = p.self.length; return {seat: p.seat, own, need, rate: need ? own / need : 0, last: own ? Math.max(...p.self.map(s => s.at)) : Infinity, vote: p.vote}; });
 const ranked = [...gather].filter(g => g.own).sort((a, b) => b.rate - a.rate || a.last - b.last);
 const fastest = ranked.length ? ranked.filter(g => g.rate === ranked[0].rate && g.last === ranked[0].last).map(g => g.seat) : [];
 const traitorVotes = votes.find(v => v.seat === t).votes;
 return {step: room.revealStep, total: reveal.steps.length, steps: reveal.steps.slice(0, room.revealStep), votes, traitor: t,
  evaluation: room.revealStep >= reveal.steps.length ? {identifiers: room.players.filter(p => p.vote === t).map(p => p.seat), traitorVotes, identified: traitorVotes >= reveal.identifiedVotes, identifiedVotes: reveal.identifiedVotes, fastest, gather: gather.map(({last, rate, ...g}) => g)} : null};
}
const sortedTimeline = room => [...room.timeline].sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time.localeCompare(b.time) || a.at - b.at);
function tick(room, now = Date.now()) {
 if (room.phase === 'play' && room.deadline && now >= room.deadline) { forceReturn(room, room.deadline); room.rev++; }
 if (room.phase === 'vote' && room.deadline && now >= room.deadline) { room.phase = 'finished'; announce(room, '投票の時間が終わりました。投票を締め切りました。'); room.rev++; }
}

function viewCard(id, p) {
 const c = cards.get(id);
 return {id: c.id, kind: c.kind, title: c.title || '', text: c.text, effect: c.effect || null, protected: p.protected.includes(id), owned: c.kind === 'b' && c.owner === p.seat};
}
function snapshot(room, who, now = Date.now()) {
 tick(room, now);
 const common = {id: room.id, phase: room.phase, rev: room.rev, started: room.started, deadline: room.deadline, now, evidence, timeline: sortedTimeline(room), announcements: room.announcements, returnLog: room.phase === 'lobby' || room.phase === 'play' ? [] : room.returnLog, photos: room.photos.map(({image, ...p}) => ({...p, ready: Boolean(image)})), players: room.players.map(p => ({seat: p.seat, joined: p.joined})), version: VERSION, effects: EFFECTS, reveal: revealView(room), revealTotal: reveal.steps.length};
 if (who.host) return {...common, host: true, invites: room.players.map(p => ({seat: p.seat, token: p.token})), progress: room.players.map(p => ({seat: p.seat, tutorial: p.tutorial, hand: p.hand.length, restored: p.restored.length, needed: units.filter(u => u.owner === p.seat).length, vote: p.vote})), pairCount: units.length, cardCount: dealtIds.length, photoCandidates: Array(6).fill('追加の現場画像'), results: room.phase === 'finished' ? tally(room) : null};
 const p = who.player;
 const mine = units.filter(u => u.owner === p.seat);
 return {...common, host: false,
  me: {seat: p.seat, tutorial: p.tutorial, arrival: arrivals[p.seat], background: backgrounds[p.seat], vote: p.vote, notices: p.notices,
   hand: p.hand.map(id => viewCard(id, p)),
   memories: mine.map(u => ({key: u.key, title: u.title, place: u.place, a: u.a, done: p.restored.includes(u.key)})),
   restored: mine.filter(u => p.restored.includes(u.key)).map(u => ({key: u.key, title: u.title, text: u.text})),
   shared: p.shared, flash: flashFor(p, now)},
  offers: room.offers.filter(o => o.from === p.seat || o.to === p.seat).map(o => ({id: o.id, from: o.from, to: o.to, cardId: o.cardId, request: o.request})),
  results: room.phase === 'finished' ? tally(room) : null};
}
const tally = room => Array.from({length: 5}, (_, i) => ({seat: i + 1, votes: room.players.filter(p => p.vote === i + 1).length}));

function act(room, who, a, now = Date.now()) {
 tick(room, now);
 if (!a || typeof a.type !== 'string') fail('操作が指定されていません。');
 if (!who.host && ['begin', 'endExchange', 'votePhase', 'finish', 'reveal', 'photo', 'removePhoto'].includes(a.type)) fail('進行担当のみ操作できます。', 403);
 const p = who.player;
 if (a.type.startsWith('timeline')) { timelineAct(room, who, a, now); room.rev++; return; }
 if (a.type === 'tutorial' && !who.host) { p.tutorial = true; p.joined = true; room.rev++; return; }
 if (a.type === 'join' && !who.host) { p.joined = true; room.rev++; return; }
 if (who.host) {
  if (a.type === 'begin') {
   if (room.phase !== 'lobby') fail('すでに開始しています。');
   const hands = deal();
   room.players.forEach((pl, i) => { pl.hand = hands[i]; pl.protected = []; pl.restored = []; pl.self = []; pl.shared = []; pl.vote = null; pl.notices = []; });
   room.phase = 'play'; room.started = now; room.deadline = now + EXCHANGE_MS; room.offers = []; room.announcements = []; room.returnLog = []; room.revealStep = 0;
   announce(room, 'プレイを始めます。時間は40分です。交換も話し合いも、この時間の中で自由に行ってください。');
  } else if (a.type === 'endExchange') { if (room.phase !== 'play') fail('プレイ中のみ操作できます。'); forceReturn(room, now, true);
  } else if (a.type === 'votePhase') { if (room.phase !== 'discuss') fail('返却のあと、照合と議論から投票へ進めてください。'); room.phase = 'vote'; room.deadline = now + VOTE_MS; announce(room, '投票の時間です。');
  } else if (a.type === 'finish') { if (room.phase !== 'vote') fail('投票中に終了できます。'); room.phase = 'finished'; announce(room, '投票を締め切りました。');
  } else if (a.type === 'reveal') { if (room.phase !== 'finished') fail('投票を締め切ってから発表できます。'); if (room.revealStep >= reveal.steps.length) fail('発表はすべて表示しました。'); room.revealStep++;
  } else if (a.type === 'photo') {
   const ph = room.photos.find(p => p.id === String(a.id)); if (!ph) fail('写真枠がありません。');
   if (typeof a.image !== 'string' || a.image.length > 2200000) fail('写真は約1.5MB以下にしてください。');
   const match = a.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/); if (!match) fail('PNG・JPEG・WebPを選んでください。');
   const bytes = Buffer.from(match[2], 'base64');
   const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
   if (!valid) fail('画像ファイルを確認できません。');
   ph.image = {bytes, type: 'image/' + match[1]}; ph.title = String(a.title || ph.title).slice(0, 100); ph.caption = String(a.caption || '').slice(0, 1500);
  } else if (a.type === 'removePhoto') { const ph = room.photos.find(p => p.id === String(a.id)); if (!ph) fail('写真枠がありません。'); ph.image = null;
  } else fail('進行担当向けの操作ではありません。', 403);
  room.rev++; return;
 }
 if (a.type === 'vote') { if (room.phase !== 'vote') fail('まだ投票時間ではありません。'); const seat = Number(a.seat); if (!room.players.some(p => p.seat === seat)) fail('投票先を選んでください。'); p.vote = seat; room.rev++; return; }
 if (a.type === 'share') {
  if (!['play', 'discuss', 'vote'].includes(room.phase)) fail('今は共有できません。');
  const u = units.find(u => u.key === String(a.key) && u.owner === p.seat && p.restored.includes(u.key)); if (!u) fail('復元した自分の記憶を選んでください。');
  const ts = a.to === 'all' ? room.players.filter(x => x !== p) : [target(room, p, a.to)];
  for (const t of ts) { if (!t.shared.some(s => s.key === u.key && s.from === p.seat)) t.shared.push({key: u.key, from: p.seat, title: u.title, text: u.text}); notice(t, `PC${p.seat}から記憶が共有されました。`); }
  room.rev++; return;
 }
 if (room.phase !== 'play') fail('カードの操作は交換の時間中に行えます。');
 const has = (pl, id) => pl.hand.includes(String(id));
 const move = (from, to, id) => { id = String(id); if (!has(from, id)) fail('カードが移動しています。手札を確認してください。'); from.hand.splice(from.hand.indexOf(id), 1); from.protected = from.protected.filter(x => x !== id); to.hand.push(id); };
 if (a.type === 'give') {
  const t = target(room, p, a.to); move(p, t, a.cardId); notice(t, `PC${p.seat}から #${a.cardId} を受け取りました。`);
 } else if (a.type === 'offer') {
  const t = target(room, p, a.to); if (!has(p, a.cardId)) fail('そのカードは手元にありません。'); if (room.offers.some(o => o.from === p.seat && o.cardId === String(a.cardId))) fail('このカードは交換提案中です。'); if (room.offers.length >= 20) fail('未処理の提案を先に確認してください。');
  const request = String(a.request || '').trim().replace(/^#/, '').toUpperCase();
  if (request && !cards.has(request)) fail('そのカード番号はありません。12-B のように入力してください。');
  room.offers.push({id: token().slice(0, 12), from: p.seat, to: t.seat, cardId: String(a.cardId), request}); notice(t, `PC${p.seat}から交換の提案が届きました。`);
 } else if (a.type === 'accept') {
  const o = room.offers.find(o => o.id === a.offerId && o.to === p.seat); if (!o) fail('交換提案が見つかりません。'); const from = room.players[o.from - 1];
  if (!has(from, o.cardId) || !has(p, a.cardId)) fail('カードが移動しています。提案を取り消して確認してください。'); if (o.request && o.request !== String(a.cardId)) fail(`指定されたカード #${o.request} を選んでください。`);
  move(from, p, o.cardId); move(p, from, a.cardId); room.offers = room.offers.filter(x => x.id !== o.id); notice(from, `PC${p.seat}との交換が成立しました。`); notice(p, `PC${from.seat}との交換が成立しました。`);
 } else if (a.type === 'decline') {
  const o = room.offers.find(o => o.id === a.offerId && (o.to === p.seat || o.from === p.seat)); if (!o) fail('交換提案がありません。'); room.offers = room.offers.filter(x => x.id !== o.id);
 } else if (a.type === 'effect') {
  useEffect(room, p, a, move);
 } else fail('操作を確認できません。');
 room.offers = room.offers.filter(o => has(room.players[o.from - 1], o.cardId));
 autoRestore(room, now);
 room.rev++;
}
function target(room, p, to) { const t = room.players.find(x => x.seat === Number(to)); if (!t || t === p) fail('相手を選んでください。'); return t; }
const movable = (pl, id) => !pl.protected.includes(id) && cards.get(id).kind !== 'joker';
function bNumber(raw) { const n = String(raw || '').trim().replace(/^#/, '').replace(/-?B$/i, ''); const id = n + '-B'; if (!cards.has(id)) fail('その番号のBはありません。番号だけを入力してください（例：24）。'); return id; }

function useEffect(room, p, a, move) {
 const id = String(a.cardId); if (!p.hand.includes(id)) fail('その効果カードは手元にありません。');
 const c = cards.get(id); if (c.kind !== 'effect') fail('効果カードを選んでください。');
 const discard = () => { p.hand = p.hand.filter(x => x !== id); p.protected = p.protected.filter(x => x !== id); };
 if (c.effect === 'steal') {
  const t = target(room, p, a.to); const pool = t.hand.filter(x => movable(t, x)); if (!pool.length) fail(`PC${t.seat}の手札には、抜き取れるカードがありません。`);
  discard(); const got = pool[randomInt(pool.length)]; move(t, p, got);
  notice(t, `手札から #${got} が1枚抜き取られました。誰が抜いたかは分かりません。`); notice(p, `抜き取り：PC${t.seat}から #${got} を取りました。`);
 } else if (c.effect === 'name') {
  const want = bNumber(a.number); const holder = room.players.find(x => x.hand.includes(want));
  if (!holder) fail(`#${want} は今、誰の手札にもありません。`); if (holder === p) fail(`#${want} はすでに手元にあります。`); if (holder.protected.includes(want)) fail(`#${want} は保護されていて、指名できません。この効果カードは使われていません。`);
  discard(); move(holder, p, want);
  announce(room, `指名：誰かが #${want} を指名しました。持っていた人は、そのカードを渡しました。`);
  notice(holder, `指名により、#${want} を渡しました。誰が指名したかは分かりません。`); notice(p, `指名：#${want} を受け取りました（PC${holder.seat}が持っていました）。`);
 } else if (c.effect === 'trace') {
  const want = bNumber(a.number); const holder = room.players.find(x => x.hand.includes(want));
  discard(); notice(p, holder ? `追跡：#${want} は今、PC${holder.seat}が持っています。` : `追跡：#${want} は今、誰の手札にもありません（すでに復元されています）。`);
 } else if (c.effect === 'peek') {
  const t = target(room, p, a.to); discard();
  const list = t.hand.map(x => { const k = cards.get(x).kind; return k === 'b' ? '#' + x : k === 'effect' ? '効果カード' : 'ジョーカー'; });
  notice(p, `のぞき見：PC${t.seat}の手札（${list.length}枚）… ${list.join('、') || 'なし'}`);
 } else if (c.effect === 'protect') {
  const keep = String(a.keep || ''); if (!p.hand.includes(keep) || keep === id) fail('守るカードを手札から選んでください。'); if (cards.get(keep).kind === 'joker') fail('ジョーカーは効果カードの対象になりません。');
  discard(); p.protected.push(keep); notice(p, `保護：#${keep} を最後まで守ります。`);
 } else if (c.effect === 'shuffle') {
  discard();
  const passes = room.players.map(pl => { const pool = pl.hand.filter(x => movable(pl, x)); return pool.length ? [pl, pool[randomInt(pool.length)]] : null; }).filter(Boolean);
  for (const [pl, x] of passes) { const to = room.players[left(pl.seat) - 1]; move(pl, to, x); notice(to, `攪乱：PC${pl.seat}から #${x} が回ってきました。`); }
  announce(room, '攪乱：全員の手札から1枚ずつ、左隣へ回りました。');
 } else fail('効果を確認できません。');
}

return {VERSION, EXCHANGE_MS, VOTE_MS, GameError, EFFECTS, units, cards, dealtIds, createRoom, identify, deal, tick, snapshot, act};
}
