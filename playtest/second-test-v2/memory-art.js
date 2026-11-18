import {memoryArtNumbers, caseArtIds} from './art-catalog.mjs';

const available = new Set(memoryArtNumbers);
export function memoryArtHtml(key, side = '') {
 key = String(key);
 if (!available.has(key) || !['', 'A', 'B'].includes(side)) return '';
 const name = 'm' + key + (side ? '-' + side : '') + '.webp';
 const label = side ? side + 'の記憶イメージ' : '復元した記憶のイメージ';
 return '<figure class="memory-art ' + (side ? 'fragment-art' : 'restored-art') + '" data-memory-figure="' + name + '" hidden><button type="button" class="memory-art-open" data-memory-open="' + name + '" aria-label="' + label + 'を拡大"><img data-memory-art="' + name + '" alt="' + label + '" width="' + (side ? 640 : 1280) + '" height="640" decoding="async"></button><figcaption>本文のイメージ · タップで拡大</figcaption></figure>';
}
export function caseArtHtml(id) {
 if (!caseArtIds.includes(id) || !/^[a-z-]+$/.test(id)) return '';
 return '<figure class="case-art"><img src="case-images/' + id + '.webp" alt="事件資料のイメージ" width="1280" height="720" loading="lazy"></figure>';
}

// 認証ヘッダーで取得し、許可されたBlobだけを描画する。鍵を画像URLへ入れない。
export class MemoryArtView {
 constructor() { this.cache = new Map(); this.allowed = new Set(); this.scope = ''; }
 update(state, auth) {
  const scope = auth ? auth.room + ':' + auth.key : '';
  const allowed = new Set();
  const me = state?.me;
  if (me) {
   for (const m of me.memories) if (available.has(m.key)) allowed.add('m' + m.key + '-A.webp');
   for (const c of me.hand) if (c.kind === 'b') {
    const key = c.id.replace(/-B$/, '');
    if (available.has(key)) allowed.add('m' + key + '-B.webp');
   }
   for (const u of [...me.restored, ...me.shared]) if (available.has(u.key)) allowed.add('m' + u.key + '.webp');
  }
  for (const [name, record] of this.cache) if (scope !== this.scope || !allowed.has(name)) {
   if (record.url) URL.revokeObjectURL(record.url);
   this.cache.delete(name);
  }
  this.scope = scope; this.allowed = allowed; this.auth = auth; this.keys = state?.art || {};
  for (const img of document.querySelectorAll('[data-memory-art]')) if (!allowed.has(img.dataset.memoryArt)) {
   img.removeAttribute('src'); img.closest('[data-memory-figure]').hidden = true;
  }
  if (this.dialog?.open && !allowed.has(this.dialog.dataset.artName)) {
   this.dialog.close(); this.dialog.querySelector('img').removeAttribute('src');
  }
 }
 async load(name) {
  if (!this.allowed.has(name) || !this.auth) return null;
  const old = this.cache.get(name);
  if (old) return old.url || old.promise;
  const record = {};
  const scope = this.scope, auth = {...this.auth};
  record.promise = (async () => {
   try {
    // オンライン版：暗号化した画像を取り、見てよい画像の鍵（進行担当から届く）で復号する。
    const id = name.replace(/\.webp$/, ''), k = this.keys?.[id];
    if (!k) throw new Error('unavailable');
    const response = await fetch(new URL('memory-art/' + id + '.bin', import.meta.url));
    if (!response.ok) throw new Error('unavailable');
    const buf = new Uint8Array(await response.arrayBuffer());
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(k), c => c.charCodeAt(0)), 'AES-GCM', false, ['decrypt']);
    const blob = new Blob([await crypto.subtle.decrypt({name: 'AES-GCM', iv: buf.slice(0, 12)}, key, buf.slice(12))], {type: 'image/webp'});
    if (scope !== this.scope || !this.allowed.has(name) || this.cache.get(name) !== record) return null;
    record.url = URL.createObjectURL(blob);
    return record.url;
   } catch {
    if (this.cache.get(name) === record) this.cache.delete(name);
    return null;
   }
  })();
  this.cache.set(name, record);
  return record.promise;
 }
 hydrate(root = document) {
  for (const img of root.querySelectorAll('[data-memory-art]')) {
   const name = img.dataset.memoryArt;
   if (!this.allowed.has(name)) continue;
   this.load(name).then(url => {
    if (!url || !img.isConnected || !this.allowed.has(name) || this.cache.get(name)?.url !== url) return;
    img.src = url; img.closest('[data-memory-figure]').hidden = false;
   });
  }
 }
 async open(name) {
  if (!this.allowed.has(name)) return;
  const url = await this.load(name);
  if (!url || !this.allowed.has(name)) return;
  if (!this.dialog) {
   this.dialog = document.createElement('dialog');
   this.dialog.className = 'memory-art-dialog';
   this.dialog.setAttribute('aria-label', '記憶のイメージ');
   this.dialog.innerHTML = '<form method="dialog"><button class="close" aria-label="閉じる">×</button></form><h2></h2><img alt="記憶のイメージ"><p class="muted">画像は本文を補うイメージです。</p>';
   document.body.append(this.dialog);
  }
  const match = /^m([0-9]+)(?:-([AB]))?/.exec(name);
  this.dialog.dataset.artName = name;
  this.dialog.querySelector('h2').textContent = '#' + match[1] + (match[2] ? ' — ' + match[2] + 'の断片' : ' — 復元した記憶');
  this.dialog.querySelector('img').src = url;
  if (!this.dialog.open) this.dialog.showModal();
 }
}

