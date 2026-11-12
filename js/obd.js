// PID の取得・計算、DTC の解析（表示とは分離）
import { PIDS, DERIVED } from './config/pids.js';
import { DTC_DESCRIPTIONS, isGenericCode } from './config/dtc-codes.js';

const hexToBytes = (h) => (h.match(/../g) || []).map((x) => parseInt(x, 16));

/** CAN のマルチフレーム（"014" "0:..." "1:..."）を 1 本につなげる */
export function joinFrames(lines) {
  if (!lines.some((l) => /^[0-9A-F]:/.test(l))) return lines;
  return [lines.filter((l) => !/^[0-9A-F]{3}$/.test(l)).map((l) => l.replace(/^[0-9A-F]:/, '')).join('')];
}

export class Obd {
  constructor(elm) { this.elm = elm; this.supported = new Set(); }

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
    const b = await this.mode01Raw(def.pid);
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
