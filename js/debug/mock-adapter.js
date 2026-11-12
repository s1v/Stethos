// ============================================================
// デバッグモード用の疑似アダプター（後に削除予定）
// 本体との接点：app.js 末尾の DEBUG ブロック、index.html の DEBUG ブロックのみ
// ============================================================
import { ConnError } from '../ble.js';
import { normalizeUuid } from '../storage.js';
import { $ } from '../ui.js';
import { PIDS } from '../config/pids.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const h2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
const h4 = (n) => h2(Math.floor(n / 256)) + h2(n % 256);

const MOCK_UUID_KNOWN = normalizeUuid('fff0');
const MOCK_UUID_UNKNOWN = normalizeUuid('abcd');
// デバッグでは全ステータス項目に対応している車として振る舞う
const SUPPORTED = [...new Set(['01', '03', '13', '20', '40', '60', '80', 'A0', ...PIDS.filter((p) => p.pid).map((p) => p.pid)])];
const ENUM_MOCK = { '51': 1, '1C': 11 }; // ガソリン / JOBD・OBD-II

/** 定義の計算式から逆算して、表示範囲内のそれらしい値になるバイト列を作る */
function encodeGeneric(def, target, t) {
  if (def.format === 'enum') return h2(ENUM_MOCK[def.pid] ?? 1);
  if (def.format === 'hex') return ['3A', '0F', 'C2', '01'].join(''); // 16 進表示の項目は固定の疑似データ
  if (def.format === 'text') return { '13': '33', '1D': '11', '4F': '0280FA10', '64': 'A0C8B4AA96' }[def.pid] || '00000000';
  const bytes = def.bytes || 1;
  if (def.key === 'runtimeTotal') return '01' + h2(0) + h2(0x12) + h2(0x34) + h2(0x56) + '00'.repeat(8);
  if (def.key === 'gearRatio') return '0000' + h4(1650 + Math.round(Math.sin(t / 5) * 600));
  if (def.key === 'odometer') { const n = Math.round((45678.9 + t * 0.02) * 10); return [24, 16, 8, 0].map((s) => h2((n >>> s) & 255)).join(''); }
  const offs = def.mask ? 1 : 0, nvar = Math.min(2, bytes - offs), N = nvar === 1 ? 256 : 65536;
  const arr = new Array(bytes).fill(0); if (def.mask) arr[0] = 0x01;
  let best = 0, bd = Infinity;
  for (let x = 0; x < N; x++) {
    if (nvar === 1) arr[offs] = x; else { arr[offs] = x >> 8; arr[offs + 1] = x & 255; }
    const d = Math.abs(def.calc(...arr) - target);
    if (d < bd) { bd = d; best = x; }
  }
  if (nvar === 1) arr[offs] = best; else { arr[offs] = best >> 8; arr[offs + 1] = best & 255; }
  return arr.map(h2).join('');
}
const VIN = 'YV1DEBUG0K1234567'; // WMI=YV1（ボルボ）、10桁目 K=2019年式
const DTCS = ['P0301', 'P0420', 'P1234', 'U0100'];

function bitmap(base) {
  let bits = [0, 0, 0, 0];
  for (const p of SUPPORTED) {
    const n = parseInt(p, 16) - base - 1;
    if (n >= 0 && n < 32) bits[n >> 3] |= 0x80 >> (n & 7);
  }
  return bits.map(h2).join('');
}

function encodeDtc(c) {
  const t = 'PCBU'.indexOf(c[0]);
  const a = (t << 6) | (Number(c[1]) << 4) | parseInt(c[2], 16);
  return h2(a) + c.slice(3);
}

export class MockTransport {
  constructor(scenario) {
    this.scenario = scenario; this._dataCb = () => {}; this._discCb = () => {};
    this.closed = false; this.timers = []; this.t0 = Date.now(); this.cleared = scenario === 'nodtc';
  }
  get deviceName() { return this.scenario === 'unknown' ? 'OBDII-X (Mock 未登録)' : 'OBDII (Mock)'; }
  onData(cb) { this._dataCb = cb; }
  onDisconnect(cb) { this._discCb = cb; }

  async requestDevice() {
    await sleep(500);
    if (this.scenario === 'connect-error') throw new ConnError('connect-failed', '機器に接続できませんでした。');
    return { name: this.deviceName };
  }

  async connect(device, services) {
    await sleep(500);
    const uuid = this.scenario === 'unknown' ? MOCK_UUID_UNKNOWN : MOCK_UUID_KNOWN;
    if (!services.includes(uuid)) return { ok: false, reason: 'no-service' };
    if (this.scenario === 'disconnect') this.timers.push(setTimeout(() => { if (!this.closed) { this.closed = true; this._discCb(); } }, 20000));
    return { ok: true, serviceUuid: uuid };
  }

  async write(text) {
    if (this.closed) throw new ConnError('disconnected', '切断されています');
    if (this.scenario === 'no-elm') return; // 応答しない
    const cmd = text.replace(/\s/g, '').toUpperCase();
    const resp = this.respond(cmd);
    const full = resp + '\r\r>';
    // 分割して返す（受信バッファ処理の確認用）
    const mid = Math.floor(full.length / 2);
    const d1 = 25 + Math.random() * 40; // 2 つ目は必ず 1 つ目の後に届くようにする
    this.timers.push(setTimeout(() => !this.closed && this._dataCb(full.slice(0, mid)), d1));
    this.timers.push(setTimeout(() => !this.closed && this._dataCb(full.slice(mid)), d1 + 15 + Math.random() * 20));
  }

  respond(cmd) {
    const t = (Date.now() - this.t0) / 1000;
    const wave = (p, ph = 0) => (Math.sin((t + ph) * 2 * Math.PI / p) + 1) / 2;
    if (cmd === 'ATZ') return 'ELM327 v1.5';
    if (cmd === 'ATI') return 'ELM327 v1.5';
    if (cmd === 'ATRV') return this.volt().toFixed(1) + 'V';
    if (cmd === 'ATDPN') return 'A6';
    if (cmd.startsWith('AT')) return 'OK';
    if (cmd === '03') {
      const list = this.cleared ? [] : DTCS;
      return '43' + h2(list.length) + list.map(encodeDtc).join('');
    }
    if (cmd === '04') { this.cleared = true; return '44'; }
    if (cmd === '0902') {
      const payload = '490201' + [...VIN].map((c) => h2(c.charCodeAt(0))).join('');
      const lines = ['014', '0:' + payload.slice(0, 12)];
      for (let i = 12, n = 1; i < payload.length; i += 14, n++) lines.push(`${n}:` + payload.slice(i, i + 14).padEnd(14, '0'));
      return lines.join('\r');
    }
    if (!cmd.startsWith('01')) return '?';
    const pid = cmd.slice(2, 4);
    const base = parseInt(pid, 16);
    if (base % 0x20 === 0 && (base === 0 || SUPPORTED.includes(pid))) return '41' + pid + bitmap(base);
    if (!SUPPORTED.includes(pid)) return 'NO DATA';
    // 60 秒周期で「エンジン停止 15 秒 → 作動 45 秒」を繰り返す（バッテリー項目の確認用）
    const on = this.engineOn();
    const speed = on ? wave(40) * 110 : 0, rpm = on ? 750 + wave(12) * 3800 : 0, load = on ? 15 + wave(12) * 70 : 0;
    const map = on ? 35 + wave(12) * 140 : 101;
    const data = {
      '01': h2((this.cleared ? 0 : 0x80 | DTCS.length)) + '076500',
      '04': h2(load * 2.55), '05': h2(Math.min(90, 40 + t * 0.5) + 40), '06': h2(128 + (wave(3) - 0.5) * 12), '07': h2(130),
      '0B': h2(map), '0C': h4(Math.round(rpm * 4)), '0D': h2(speed), '0E': h2(140), '0F': h2(25 + wave(30) * 10 + 40),
      '10': h4(Math.round((on ? 2 + wave(12) * 60 : 0) * 100)), '11': h2((on ? 10 + wave(12) * 70 : 8) * 2.55), '13': '03',
      '14': h2(wave(1.3) * 180) + 'FF', '15': h2(130 + wave(7) * 20) + 'FF', '1F': h4(Math.floor(t) % 65536),
      '21': '0000', '2F': h2(62 * 2.55), '33': h2(101), '3C': h4(Math.round((400 + wave(20) * 300 + 40) * 10)),
      '42': h4(Math.round(this.volt() * 1000)), '46': h2(18 + 40), '5C': h2(Math.min(105, 30 + t * 0.4) + 40),
      '5B': h2(68 * 2.55), '74': '01' + h4(on ? Math.round((20000 + wave(12) * 150000) / 10) : 0) + '0000',
    };
    if (data[pid]) return '41' + pid + data[pid];
    const def = PIDS.find((p) => p.pid === pid);
    if (!def) return '41' + pid + '00';
    const ph = parseInt(pid, 16);
    const target = def.min + (def.max - def.min) * (0.25 + 0.4 * wave(15 + (ph % 9), ph));
    return '41' + pid + encodeGeneric(def, target, t);
  }

  engineOn() { return ((Date.now() - this.t0) / 1000) % 60 > 15; }
  volt() { const w = Math.sin((Date.now() - this.t0) / 1000 / 9 * 2 * Math.PI); return this.engineOn() ? 14.1 + w * 0.3 : 12.45 + w * 0.05; }

  disconnect() { this.closed = true; this.timers.forEach(clearTimeout); this.timers = []; }
}

/** app.js から呼ばれる：デバッグ入口のボタンと ?debug=1 を設定 */
export function installDebug(app) {
  const start = (scenario) => app.connect({ transportFactory: () => new MockTransport(scenario), debug: true });
  const btn = $('btn-debug');
  if (btn) btn.onclick = () => start($('debug-scenario').value);
  const q = new URLSearchParams(location.search);
  if (q.get('debug') === '1') {
    const sc = q.get('scenario') || 'normal';
    if ($('debug-scenario')) $('debug-scenario').value = sc;
    start(sc);
  }
}
