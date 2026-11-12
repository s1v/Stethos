// Issue（アダプターの動作報告フォーム）の本文から UUID と製品名を取り出し、
// js/config/known-uuids.js に追記する。sw.js の BUILD も 1 増やす（利用者のキャッシュ更新のため）。
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const out = (k, v) => appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, ' ')}\n`);
const body = process.env.ISSUE_BODY || '';
const issue = process.env.ISSUE_NUMBER || '?';

// Issue フォームは「### 見出し\n\n値」の形式
function field(label) {
  const m = new RegExp(`###\\s*${label}\\s*\\n+([\\s\\S]*?)(?=\\n###|$)`).exec(body);
  const v = m ? m[1].trim() : '';
  return v === '_No response_' ? '' : v;
}

// js/storage.js の normalizeUuid と同じ規則
function normalizeUuid(input) {
  let s = String(input).trim().toLowerCase().replace(/^0x/, '').replace(/[{}\s]/g, '');
  const BASE = '-0000-1000-8000-00805f9b34fb';
  if (/^[0-9a-f]{4}$/.test(s)) return `0000${s}${BASE}`;
  if (/^[0-9a-f]{8}$/.test(s)) return `${s}${BASE}`;
  if (/^[0-9a-f]{32}$/.test(s)) s = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
}

const uuid = normalizeUuid(field('サービス UUID'));
// 製品名はコードに埋め込むので、記号を除去して長さを制限する
const product = field('製品名（任意）').replace(/[\\'"`$<>{}\r\n]/g, '').slice(0, 60).trim();
const result = field('動作結果');

if (!uuid) { out('changed', 'false'); out('reason', 'サービス UUID の形式が正しくありません。'); process.exit(0); }

const path = 'js/config/known-uuids.js';
let src = readFileSync(path, 'utf8');
const short = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/.exec(uuid)?.[1];
const existing = [...src.matchAll(/uuid:\s*'([^']+)'/g)].map((m) => normalizeUuid(m[1]));
if (existing.includes(uuid)) { out('changed', 'false'); out('reason', `UUID ${short || uuid} はすでに登録されています。`); process.exit(0); }

const status = result === '問題なく使えた' ? `動作報告あり（#${issue}）` : `接続のみ確認（データ取得不可の報告あり #${issue}）`;
const line = `  { uuid: '${short || uuid}', products: '${product || '利用者の報告'}', status: '${status}' },\n`;
const marker = '  // @auto-insert';
if (!src.includes(marker)) { out('changed', 'false'); out('reason', 'known-uuids.js に @auto-insert の目印が見つかりません。'); process.exit(0); }
src = src.replace(marker, line + marker);
writeFileSync(path, src);

// sw.js の BUILD を増やす
const sw = readFileSync('sw.js', 'utf8').replace(/const BUILD = (\d+);/, (_, n) => `const BUILD = ${Number(n) + 1};`);
writeFileSync('sw.js', sw);

out('changed', 'true'); out('uuid', short ? short.toUpperCase() : uuid); out('product', product || '（製品名なし）');
console.log('added', uuid, product);
