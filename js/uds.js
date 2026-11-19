// UDS（ISO 14229）の読み取り専用の通信部品（UDS 探索画面用）
// 安全のため、送れるコマンドをここで固定する（書き込み・消去・セキュリティアクセス・リセット系は送れない）
import { joinFrames } from './obd.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ELM327 の設定コマンド（宛先・受信フィルター・プロトコル・ヘッダー表示だけ）
const AT_OK = [/^ATSH(?:[0-9A-F]{3}|[0-9A-F]{6})$/, /^ATCRA(?:[0-9A-F]{3}|[0-9A-F]{8})?$/, /^ATCP[0-9A-F]{2}$/, /^ATSP[067]$/, /^ATH[01]$/];
// 車への要求：DID の読み取り(22)・故障コードの読み取り(19 02)・診断セッション(10 01 / 10 03)・接続維持(3E 00)
const REQ_OK = [/^22[0-9A-F]{4}$/, /^1902[0-9A-F]{2}$/, /^10(?:01|03)$/, /^3E00$/];

export const isAllowed = (cmd) => AT_OK.some((r) => r.test(cmd)) || REQ_OK.some((r) => r.test(cmd));
export const isRequest = (cmd) => REQ_OK.some((r) => r.test(cmd));

// 宛先の候補。0x7E0 / 0x7E1 以外は裏付けのない候補（実車で確かめる）
export const TARGETS = [
  { hdr: '7E0', name: 'ECM（エンジン）', on: true },
  { hdr: '7E1', name: 'TCM（変速機）', on: true },
  { hdr: '7E2', name: '7E2（候補）', on: false },
  { hdr: '7E4', name: 'BECM（候補）', on: false },
  { hdr: '726', name: 'CEM（候補）', on: false },
  { hdr: '760', name: 'ブレーキ（候補）', on: false },
  { hdr: '746', name: '空調（候補）', on: false },
];
export const rxOf = (hdr) => (parseInt(hdr, 16) + 8).toString(16).toUpperCase();

export const STD_DIDS = ['F190', 'F187', 'F197'];

// 試す DID の初期値。F1xx は ISO 標準。それ以外は公開情報（フォーラム投稿）にあった「候補」で、SPA で正しいかは未確認
export const DEFAULT_DIDS = `F190  VIN（ISO 標準）
F187  部品番号（ISO 標準）
F188  ソフトウェア番号（ISO 標準）
F18A  サプライヤー（ISO 標準）
F191  ハードウェア番号（ISO 標準）
F197  システム名・エンジン型式（ISO 標準）
DADF  DPF 差圧（フォーラム候補）
DADC  DPF 温度（フォーラム候補）
DBE6  前回の DPF 再生からの距離（フォーラム候補）
DBE7  DPF の灰の量（フォーラム候補）
DBE8  灰の計算に使う距離（フォーラム候補）
DA62  エンジン油温（フォーラム候補）
DA57  エンジン油温 別案（フォーラム候補）
DA63  オイルレベル（フォーラム候補）
DA60  オイル圧（フォーラム候補）
D9A1  変速機油温（フォーラム候補）
1E3F  変速機油温（P3 世代の候補）
`;

const NRC = { '10': '一般的な拒否', '11': 'サービス非対応', '12': 'サブ機能非対応', '13': '長さ・形式が不正', '14': '応答が長すぎる', '21': 'ビジー', '22': '条件が合わない', '24': '手順の誤り', '31': '範囲外（その DID は非対応）', '33': 'セキュリティアクセスが必要', '35': '鍵が不正', '37': '待ち時間が必要', '78': '応答保留中', '7E': '今のセッションでは非対応', '7F': '今のセッションではそのサービスが非対応' };
export const nrcText = (c) => NRC[c] || '不明';

/** 応答の行を解析する（req は送った要求の 16 進） */
export function parseReply(lines, req) {
  const compact = lines.map((l) => l.replace(/\s+/g, '').toUpperCase()).filter(Boolean);
  if (!compact.length) return { kind: 'none', raw: '' };
  const flat = joinFrames(compact).join('');
  if (/NODATA/.test(flat)) return { kind: 'nodata', raw: flat };
  if (/CANERROR|BUFFERFULL|UNABLETOCONNECT|STOPPED|BUSERROR|BUSBUSY|FBERROR|DATAERROR|\?/.test(flat)) return { kind: 'error', raw: flat };
  const sid = req.slice(0, 2);
  const pos = (parseInt(sid, 16) + 0x40).toString(16).toUpperCase() + req.slice(2, sid === '22' ? 6 : 4);
  const i = flat.indexOf(pos);
  if (i >= 0) return { kind: 'pos', data: flat.slice(i + pos.length), raw: flat };
  const m = new RegExp('7F' + sid + '([0-9A-F]{2})').exec(flat);
  if (m) return { kind: 'neg', nrc: m[1], raw: flat };
  return { kind: 'other', raw: flat };
}

/** 値の意味は断定せず、読み方の参考だけを返す（計算式は不明のため） */
export function hexRef(data) {
  const n = Math.floor(data.length / 2);
  if (!n) return '';
  const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = parseInt(data.substr(i * 2, 2), 16);
  const dv = new DataView(b.buffer);
  const out = [`${n}バイト`];
  if (n === 1) out.push(`u8=${b[0]}`);
  else if (n === 2) out.push(`u16=${dv.getUint16(0)}`);
  else if (n >= 4) {
    const f = dv.getFloat32(0);
    out.push(`先頭4バイト: u32=${dv.getUint32(0)}`);
    if (Number.isFinite(f) && Math.abs(f) < 1e9) out.push(`f32=${Number(f.toPrecision(6))}`);
  }
  return out.join(' ');
}

/** アダプターへの送受信（許可されたコマンドだけ） */
export class Uds {
  constructor(elm) { this.elm = elm; this.stopped = false; this.ext = false; this.lastTP = Date.now(); this.interval = 100; this.customProto = false; this.sent = 0; }
  async raw(cmd, timeout = 2000) {
    if (!isAllowed(cmd)) throw new Error('許可されていないコマンドです: ' + cmd);
    try { return { lines: await this.elm.send(cmd, timeout) }; } catch (e) {
      if (e.code === 'timeout') return { lines: [], timeout: true };
      throw e;
    }
  }
  async req(cmd, timeout = 2500) {
    if (!isRequest(cmd)) throw new Error('許可されていない要求です: ' + cmd);
    await this.keepAlive();
    this.sent++;
    const r = await this.raw(cmd, timeout);
    const p = r.timeout ? { kind: 'timeout', raw: '' } : parseReply(r.lines, cmd);
    await sleep(this.interval);
    return p;
  }
  async keepAlive() {
    if (this.ext && Date.now() - this.lastTP > 2000) { this.lastTP = Date.now(); await this.raw('3E00', 1000); }
  }
  async setTarget(hdr) {
    const a = await this.raw('ATSH' + hdr), b = await this.raw('ATCRA' + rxOf(hdr));
    return !a.timeout && !b.timeout;
  }
  async startSession() { if (!this.ext) return null; const r = await this.req('1003'); this.lastTP = Date.now(); return r; }
  async endSession() { if (this.ext) { try { await this.req('1001'); } catch { /* noop */ } } }
}
