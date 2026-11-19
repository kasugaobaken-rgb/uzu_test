// V5（第二テスト 交換式 v2 のオンライン版）。進行担当のブラウザで、部屋の状態・依頼・受領・PC別画面を1回のDBトランザクションで処理する。
import {makeEngine} from './online-engine.mjs';
const list = x => Array.isArray(x) ? x.filter(v => v != null) : Object.values(x || {});
const plain = v => JSON.parse(JSON.stringify(v));

// Firebaseは空の配列とnullを保存しないため、読み戻した状態を元の形に戻す。
export function normalizeRoom(raw) {
 const r = structuredClone(raw);
 for (const k of ['offers', 'announcements', 'returnLog', 'photos', 'timeline']) r[k] = list(r[k]);
 r.started ??= null; r.deadline ??= null; r.revealStep ??= 0; r.timeUp ??= false;
 for (const ph of r.photos) { ph.image ??= null; ph.caption ??= ''; }
 r.players = list(r.players).sort((a, b) => a.seat - b.seat);
 for (const p of r.players) { for (const k of ['hand', 'protected', 'restored', 'self', 'shared', 'viewed', 'notices']) p[k] = list(p[k]); p.vote ??= null; }
 return r;
}
export function normalizeCatalog(c) {
 const reveal = c.reveal ? {...c.reveal, steps: list(c.reveal.steps).map(s => ({...s, lines: list(s.lines), points: s.points ? list(s.points).map(p => ({...p, refs: list(p.refs)})) : undefined}))} : c.reveal;
 return {...c, pairs: list(c.pairs), evidence: list(c.evidence), art: c.art || {}, fragments: Array.isArray(c.fragments) ? Object.fromEntries(c.fragments.map((f, i) => [String(i), f]).filter(([, f]) => f)) : c.fragments || {}, reveal};
}

// 記憶画像の鍵は、見てよい画像の分だけ渡す（ローカル版 art.mjs と同じ判定）。
function artFor(game, catalog, room, p) {
 const out = {}, give = name => { if (catalog.art[name]) out[name] = catalog.art[name]; };
 for (const u of game.units) {
  if (u.owner === p.seat) give('m' + u.key + '-A');
  if (p.hand.includes(u.key + '-B')) give('m' + u.key + '-B');
  if ((u.owner === p.seat && p.restored.includes(u.key)) || p.shared.some(s => s.key === u.key) || p.viewed.some(v => v.key === u.key)) give('m' + u.key);
 }
 return out;
}

export function populateViews(data, now = Date.now()) {
 const catalog = normalizeCatalog(data.private.catalog), game = makeEngine(catalog), room = normalizeRoom(data.private.state);
 game.tick(room, now);
 for (const [token, box] of Object.entries(data.mailboxes)) {
  const who = game.identify(room, token);
  const view = game.snapshot(room, who, now);
  if (!who.host) view.art = artFor(game, catalog, room, who.player);
  box.view = plain({...view, _readyUid: box.uid || null});
 }
 data.private.state = plain(room); return data;
}

// 40分（play）は「時間です」のお知らせを1回出すだけ（投票へは進行担当が移す）。投票（vote）の5分は自動で締め切る。
const due = (data, now) => { const s = data?.private?.state; return Boolean(s && s.deadline && now >= s.deadline && (s.phase === 'vote' || (s.phase === 'play' && !s.timeUp))); };
export function hasWork(data, now = Date.now()) {
 return due(data, now) || Object.values(data?.mailboxes || {}).some(b => b.uid && (!data.members?.[b.uid] || b.view?._readyUid !== b.uid) || Object.keys(b.requests || {}).length);
}

export function settleRoom(raw, now = Date.now()) {
 const data = structuredClone(raw), game = makeEngine(normalizeCatalog(data.private.catalog));
 data.members ||= {};
 let room = normalizeRoom(data.private.state);
 game.tick(room, now);
 const pending = [];
 for (const [token, b] of Object.entries(data.mailboxes)) {
  if (b.uid) data.members[b.uid] = true;
  for (const [nonce, q] of Object.entries(b.requests || {})) pending.push({token, nonce, q});
 }
 pending.sort((a, b) => (a.q.at || 0) - (b.q.at || 0) || a.nonce.localeCompare(b.nonce));
 for (const {token, nonce, q} of pending) {
  const box = data.mailboxes[token]; box.receipts ||= {};
  if (!box.receipts[nonce]) {
   try {
    const candidate = normalizeRoom(room);
    const a = JSON.parse(q.payload);
    if (a?.type === 'photo' || a?.type === 'removePhoto') throw new game.GameError('オンライン版では写真の登録はできません。');
    game.act(candidate, game.identify(candidate, token), a, now);
    room = candidate; box.receipts[nonce] = {ok: true, rev: room.rev, at: now};
   } catch (e) { box.receipts[nonce] = {ok: false, error: e.status ? e.message : '操作を処理できませんでした。', at: now}; }
  }
  delete box.requests[nonce];
  const old = Object.entries(box.receipts).sort((a, b) => b[1].at - a[1].at);
  for (const [id] of old.slice(30)) delete box.receipts[id];
 }
 data.private.state = room; return populateViews(data, now);
}
