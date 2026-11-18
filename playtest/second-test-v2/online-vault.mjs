// 進行担当URLの#operator=（V4と同じ鍵）でだけ記憶データを復号する。公開ファイルは暗号文のみ。
// 部屋作成の許可（onlineAccessV4）はV4登録済みのハッシュをそのまま使うため、Firebase側の設定変更は不要。
const encode = new TextEncoder(), decode = new TextDecoder();
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = b => Array.from(new Uint8Array(b), v => v.toString(16).padStart(2, '0')).join('');
export async function accessHash(secret) {
 if (!/^[A-Za-z0-9_-]{43}$/.test(secret || '')) throw Error('担当者専用URLを確認してください。');
 return hex(await crypto.subtle.digest('SHA-256', encode.encode('UZU-V4-ACCESS:' + secret)));
}
export async function decryptCatalog(vault, secret) {
 await accessHash(secret);
 if (vault.format !== 'uzu-vault-v5') throw Error('公開データの版を確認してください。');
 const raw = await crypto.subtle.digest('SHA-256', encode.encode('UZU-V5-CATALOG:' + secret));
 const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
 let plaintext;
 try { plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(vault.iv), additionalData: encode.encode('UZU-V5-CATALOG')}, key, bytes(vault.ciphertext)); }
 catch { throw Error('担当者専用URLの鍵が、この公開版と一致しません。最新版の専用URLを使ってください。'); }
 const c = JSON.parse(decode.decode(plaintext));
 if (c.pairs?.length !== 32 || !c.evidence?.length || !c.source?.sha256 || !c.backgrounds || !c.arrivals || !c.art) throw Error('記憶データの形式を確認してください。');
 return c;
}
