// ELM327 のコマンド送受信・初期化
export class ElmError extends Error { constructor(code, message) { super(message); this.code = code; } }

export class Elm327 {
  constructor(transport) {
    this.t = transport; this.buf = ''; this.pending = null; this.timer = null; this.queue = Promise.resolve();
    this.version = ''; this.protocol = '';
    transport.onData((text) => this._onData(text));
  }

  _onData(text) {
    this.buf += text;
    const i = this.buf.indexOf('>');
    if (i >= 0 && this.pending) {
      const raw = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1);
      clearTimeout(this.timer);
      const p = this.pending; this.pending = null; p.resolve(raw);
    }
  }

  /** 生の応答（行の配列）を返す。直列化して 1 コマンドずつ送る */
  send(cmd, timeout = 2500) {
    const run = () => new Promise((resolve, reject) => {
      this.buf = '';
      this.pending = { resolve, reject };
      this.timer = setTimeout(() => { this.pending = null; reject(new ElmError('timeout', `応答なし: ${cmd}`)); }, timeout);
      this.t.write(cmd + '\r').catch((e) => { clearTimeout(this.timer); this.pending = null; reject(e); });
    }).then((raw) => raw.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l && l !== cmd && !/^SEARCHING/i.test(l)));
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** OBD 要求：16進の行配列（空白除去）。データなし・エラーは null */
  async query(cmd, timeout = 2500) {
    const lines = await this.send(cmd, timeout);
    const hex = lines.map((l) => l.replace(/\s+/g, '').toUpperCase())
      .filter((l) => !/^(BUSINIT|OK)/.test(l));
    if (!hex.length || hex.some((l) => /NODATA|ERROR|UNABLE|STOPPED|\?|BUFFERFULL|CANERROR/.test(l))) return null;
    return hex;
  }

  async init() {
    let ok = false;
    for (let i = 0; i < 2 && !ok; i++) {
      try { const r = await this.send('ATZ', 4000); this.version = r.find((l) => /ELM/i.test(l)) || r.join(' '); ok = true; } catch { /* retry */ }
    }
    if (!ok) throw new ElmError('no-response', 'ELM327 の応答がありません。');
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) {
      try { await this.send(c, 2000); } catch { /* 一部未対応でも続行 */ }
    }
    // プロトコル自動検出（初回は時間がかかる）
    let vehicleOk = true;
    try { vehicleOk = !!(await this.query('0100', 12000)); } catch { vehicleOk = false; }
    try { this.protocol = (await this.send('ATDPN', 2000)).join(''); } catch { /* noop */ }
    return { vehicleOk };
  }

  async readVoltage() {
    try { const r = await this.send('ATRV', 2000); const m = /([\d.]+)\s*V/i.exec(r.join(' ')); return m ? Number(m[1]) : null; } catch { return null; }
  }
}
