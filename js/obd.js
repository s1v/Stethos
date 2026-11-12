// PID の取得・計算、DTC の解析（表示とは分離）
import { PIDS, DERIVED } from './config/pids.js';
import { DTC_DESCRIPTIONS, isGenericCode } from './config/dtc-codes.js';

const hexToBytes = (h) => (h.match(/../g) || []).map((x) => parseInt(x, 16));

/** CAN のマルチフレーム（"014" "0:..." "1:..."）を 1 本につなげる */
export function joinFrames(lines) {
  if (!lines.some((l) => /^[0-9A-F]:/.test(l))) return lines;
  return [lines.filter((l) => !/^[0-9A-F]{3}$/.test(l)).map((l) => l.replace(/^[0-9A-F]:/, '')).join('')];
}

// 応答キャッシュの有効時間（同じ PID を続けて問い合わせないため）
const CACHE_MS = 500;
// 1 回の問い合わせに入れられる PID の数（規格上の上限）
const MULTI_MAX = 6;

/**
 * マルチ PID 通信で使う、各 PID のデータ長（バイト）。応答を区切るのに正確な長さが必要なので、
 * 長さが確実なものだけを載せる（載っていない PID は 1 個ずつ問い合わせる）
 */
const PID_LEN = (() => {
  const t = {};
  const set = (n, ...pids) => pids.forEach((p) => { t[p] = n; });
  set(1, '04', '05', '0A', '0B', '0D', '0E', '0F', '11', '1C', '2C', '2D', '2E', '2F', '30', '33', '45', '46', '47', '48', '49', '4A', '4B', '4C', '51', '52', '5A', '5B', '5C', '61', '62');
  set(2, '0C', '10', '1F', '21', '22', '23', '31', '3C', '3D', '3E', '3F', '42', '43', '44', '4D', '4E', '59', '5D', '5E', '63',
    '14', '15', '16', '17', '18', '19', '1A', '1B');
  set(4, '24', '25', '26', '27', '28', '29', '2A', '2B', '34', '35', '36', '37', '38', '39', '3A', '3B');
  return t;
})();

/** マルチ PID の応答（41 PID データ PID データ…）を PID ごとに分ける。読み取れなければ null */
export function parseMulti(lines, pids) {
  if (!lines) return null;
  const want = new Set(pids), out = new Map();
  for (const l of joinFrames(lines)) {
    if (!l.startsWith('41')) continue;
    const b = hexToBytes(l.slice(2));
    let i = 0;
    while (i < b.length) {
      const pid = b[i].toString(16).padStart(2, '0').toUpperCase();
      const n = PID_LEN[pid];
      if (n == null || !want.has(pid)) {
        // CAN の詰め物（00 / 55 / AA）なら終わり、それ以外は読み取り失敗
        if (b.slice(i).every((x) => x === 0 || x === 0x55 || x === 0xAA)) break;
        return null;
      }
      if (i + 1 + n > b.length) return null;
      if (!out.has(pid)) out.set(pid, b.slice(i + 1, i + 1 + n)); // ECU が複数答えたときは最初の応答を使う
      i += 1 + n;
    }
  }
  return out.size ? out : null;
}

export class Obd {
  constructor(elm) {
    this.elm = elm; this.supported = new Set();
    this.cache = new Map(); // PID → { t: 取得時刻, b: データバイト }
    this.multi = false;     // マルチ PID 通信を使うか（detectMulti で決める）
    this.multiState = 'off'; // 'on' / 'off'（設定でオフ）/ 'unsupported'（CAN 以外・アダプター非対応）
    this.multiFails = 0;
  }

  /** 新しい応答がキャッシュにあるか */
  hasFresh(pid) { const c = this.cache.get(pid); return !!c && performance.now() - c.t < CACHE_MS; }

  /** まとめて送れる PID か（データ長が決まっていて、車が対応している） */
  canBatch(pid) { return this.multi && !!pid && PID_LEN[pid] != null && this.supported.has(pid); }

  /**
   * マルチ PID 通信：最大 6 個の PID を 1 回の問い合わせで取得し、キャッシュに入れる
   * @returns {boolean} 1 つ以上取れたら true
   */
  async prefetch(pids) {
    pids = [...new Set(pids)].filter((p) => this.canBatch(p)).slice(0, MULTI_MAX);
    if (pids.length < 2) return false;
    let got = null;
    try { got = parseMulti(await this.elm.query('01' + pids.join(''), 4000), pids); } catch (e) { if (e?.code === 'disconnected') throw e; got = null; }
    const now = performance.now();
    if (!got) {
      // 応答を読み取れない：続けて失敗したら 1 個ずつの方式に戻す
      if (++this.multiFails >= 3) { this.multi = false; this.multiState = 'unsupported'; }
      return false;
    }
    this.multiFails = 0;
    for (const [pid, b] of got) this.cache.set(pid, { t: now, b });
    return got.size > 0;
  }

  /** 接続時に、マルチ PID 通信が使えるか試す */
  async detectMulti(enabled = true) {
    this.multi = false; this.multiFails = 0;
    if (!enabled) { this.multiState = 'off'; return false; }
    // CAN（ATDPN が 6〜9、A〜C。先頭の A は自動検出の印）のときだけ使える
    const proto = String(this.elm.protocol || '').trim().toUpperCase().replace(/^A(?=[0-9A-C]$)/, '');
    if (!/^[6-9A-C]$/.test(proto)) { this.multiState = 'unsupported'; return false; }
    const test = ['0C', '0D', '05', '04', '0B', '0F', '11', '10'].filter((p) => PID_LEN[p] != null && this.supported.has(p)).slice(0, 3);
    if (test.length < 2) { this.multiState = 'unsupported'; return false; }
    let got = null;
    try { got = parseMulti(await this.elm.query('01' + test.join(''), 4000), test); } catch { got = null; }
    this.multi = !!got && test.every((p) => got.has(p));
    this.multiState = this.multi ? 'on' : 'unsupported';
    return this.multi;
  }

  /** Mode 01 の生データ（バイト配列）。非対応・NO DATA は null */
  async mode01Raw(pid, timeout) {
    const lines = await this.elm.query('01' + pid, timeout);
    if (!lines) return null;
    const line = joinFrames(lines).find((l) => l.startsWith('41' + pid));
    return line ? hexToBytes(line.slice(4)) : null;
  }

  async loadSupported() {
    this.supported.clear();
    for (let base = 0; base <= 0xC0; base += 0x20) {
      const b = base.toString(16).padStart(2, '0').toUpperCase();
      let bytes = null;
      try { bytes = await this.mode01Raw(b, 5000); } catch { bytes = null; }
      if (!bytes || bytes.length < 4) break;
      for (let i = 0; i < 32; i++) {
        if (bytes[i >> 3] & (0x80 >> (i & 7))) this.supported.add((base + i + 1).toString(16).padStart(2, '0').toUpperCase());
      }
      if (!this.supported.has((base + 0x20).toString(16).padStart(2, '0').toUpperCase())) break;
    }
    return this.supported;
  }

  /** 表示対象（PID 定義にある項目）のうち対応している数ではなく、車の対応 PID 総数（範囲指示用 PID を除く） */
  get supportedCount() {
    return [...this.supported].filter((p) => parseInt(p, 16) % 0x20 !== 0).length;
  }

  isSupported(pid) { return this.supported.has(pid); }

  async readPid(def) {
    if (def.cmd === 'ATRV') return this.elm.readVoltage();
    // 同じ PID から複数の項目を取り出すとき、続けて問い合わせないよう直前の応答を使い回す（ECU の負荷を減らす）
    // マルチ PID でまとめて取得した応答もここで使う
    const c = this.cache.get(def.pid);
    let b;
    if (c && performance.now() - c.t < CACHE_MS) b = c.b && [...c.b];
    else { b = await this.mode01Raw(def.pid); this.cache.set(def.pid, { t: performance.now(), b: b && [...b] }); }
    if (!b || b.length < 1) return null;
    if (def.mask && b.length < 2) return null;
    if (def.format === 'hex') return def.calc(...b); // 受け取ったまま表示
    while (b.length < (def.bytes || 1)) b.push(0); // 短い応答は 0 で補う
    return def.calc(...b);
  }

  calcDerived(values) {
    const out = {};
    for (const d of DERIVED) {
      if (d.needs.every((k) => values[k] != null)) out[d.key] = d.calc(values);
    }
    return out;
  }

  /** MIL と DTC 件数（Mode 01 PID 01） */
  async readMonitorStatus() {
    const b = await this.mode01Raw('01');
    if (!b) return null;
    return { mil: !!(b[0] & 0x80), count: b[0] & 0x7f };
  }

  async readVin() {
    const lines = await this.elm.query('0902', 5000).catch(() => null);
    if (!lines) return null;
    let s = joinFrames(lines).join('');
    s = s.replace(/4902[0-9A-F]{2}/g, '');
    const txt = hexToBytes(s).map((c) => String.fromCharCode(c)).join('').replace(/[^A-Z0-9]/g, '');
    return txt.length >= 17 ? txt.slice(-17) : (txt || null);
  }

  /** Mode 03：DTC 一覧 */
  async readDtcs() {
    const lines = await this.elm.query('03', 6000);
    if (!lines) return [];
    const codes = [];
    for (const l of joinFrames(lines)) {
      if (!l.startsWith('43')) continue;
      let bytes = hexToBytes(l.slice(2));
      if (bytes.length % 2 === 1) bytes = bytes.slice(1); // CAN：先頭は件数
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) continue;
        codes.push(decodeDtc(bytes[i], bytes[i + 1]));
      }
    }
    return [...new Set(codes)].map((code) => {
      const generic = isGenericCode(code);
      return { code, generic, description: generic ? (DTC_DESCRIPTIONS[code] || '（説明文未登録の共通コード）') : null };
    });
  }

  /** Mode 04：DTC 消去 */
  async clearDtcs() {
    const lines = await this.elm.query('04', 6000);
    return !!lines && lines.some((l) => l.startsWith('44'));
  }
}

export function decodeDtc(a, b) {
  const type = 'PCBU'[a >> 6];
  return type + ((a >> 4) & 3) + (a & 0x0f).toString(16).toUpperCase() + b.toString(16).padStart(2, '0').toUpperCase();
}

export { PIDS, DERIVED };
