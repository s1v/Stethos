// ============================================================
// デバッグモード用の疑似アダプター（後に削除予定）
// 本体との接点：app.js 末尾の DEBUG ブロック、index.html の DEBUG ブロックのみ
// ============================================================
import { ConnError } from '../ble.js';
import { normalizeUuid } from '../storage.js';
import { $ } from '../ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const h2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
const h4 = (n) => h2(Math.floor(n / 256)) + h2(n % 256);

const MOCK_UUID_KNOWN = normalizeUuid('fff0');
const MOCK_UUID_UNKNOWN = normalizeUuid('abcd');
const SUPPORTED = ['01', '03', '04', '05', '06', '07', '0B', '0C', '0D', '0E', '0F', '10', '11', '13', '14', '15', '1C', '1F', '20', '21', '2F', '33', '3C', '40', '42', '46', '5C'];
const VIN = 'JDEBUGVIN12345678';
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
    this.timers.push(setTimeout(() => !this.closed && this._dataCb(full.slice(0, mid)), 25 + Math.random() * 40));
    this.timers.push(setTimeout(() => !this.closed && this._dataCb(full.slice(mid)), 60 + Math.random() * 40));
  }

  respond(cmd) {
    const t = (Date.now() - this.t0) / 1000;
    const wave = (p, ph = 0) => (Math.sin((t + ph) * 2 * Math.PI / p) + 1) / 2;
    if (cmd === 'ATZ') return 'ELM327 v1.5';
    if (cmd === 'ATI') return 'ELM327 v1.5';
    if (cmd === 'ATRV') return (13.8 + wave(9) * 0.6).toFixed(1) + 'V';
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
    const speed = wave(40) * 110, rpm = 750 + wave(12) * 3800, load = 15 + wave(12) * 70;
    const map = 35 + wave(12) * 140;
    const data = {
      '01': h2((this.cleared ? 0 : 0x80 | DTCS.length)) + '076500',
      '04': h2(load * 2.55), '05': h2(Math.min(90, 40 + t * 0.5) + 40), '06': h2(128 + (wave(3) - 0.5) * 12), '07': h2(130),
      '0B': h2(map), '0C': h4(Math.round(rpm * 4)), '0D': h2(speed), '0E': h2(140), '0F': h2(25 + wave(30) * 10 + 40),
      '10': h4(Math.round((2 + wave(12) * 60) * 100)), '11': h2((10 + wave(12) * 70) * 2.55), '13': '03', '1C': '06',
      '14': h2(wave(1.3) * 180) + 'FF', '15': h2(130 + wave(7) * 20) + 'FF', '1F': h4(Math.floor(t) % 65536),
      '21': '0000', '2F': h2(62 * 2.55), '33': h2(101), '3C': h4(Math.round((400 + wave(20) * 300 + 40) * 10)),
      '42': h4(Math.round((13.8 + wave(9) * 0.6) * 1000)), '46': h2(18 + 40), '5C': h2(Math.min(105, 30 + t * 0.4) + 40),
    };
    return '41' + pid + (data[pid] || '00');
  }

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
