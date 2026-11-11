// Web Bluetooth の接続処理（トランスポート）
// トランスポートの共通インターフェース（疑似アダプターも同じ形）:
//   requestDevice(services) → device / connect(device, services) → {ok, reason, serviceUuid}
//   write(text) / onData(cb) / onDisconnect(cb) / disconnect() / deviceName

export class ConnError extends Error {
  constructor(code, message, cause) { super(message); this.code = code; this.cause = cause; }
}

export const isBluetoothSupported = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;

const withTimeout = (p, ms, code, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new ConnError(code, msg)), ms))]);

export class BleTransport {
  constructor() {
    this.device = null; this.server = null; this.tx = null; this.rx = null;
    this._dataCb = () => {}; this._discCb = () => {};
    this._decoder = new TextDecoder();
    this._onNotify = (e) => this._dataCb(this._decoder.decode(e.target.value));
    this._onDisc = () => this._discCb();
  }
  get deviceName() { return this.device?.name || '(名前なし)'; }
  onData(cb) { this._dataCb = cb; }
  onDisconnect(cb) { this._discCb = cb; }

  async requestDevice(services) {
    if (!isBluetoothSupported()) throw new ConnError('unsupported', 'このブラウザは Web Bluetooth に対応していません。');
    try {
      if (navigator.bluetooth.getAvailability && !(await navigator.bluetooth.getAvailability())) {
        throw new ConnError('bt-off', 'Bluetooth がオフになっています。端末の Bluetooth をオンにしてください。');
      }
    } catch (e) { if (e instanceof ConnError) throw e; }
    try {
      // 全ての BLE 機器を表示（絞り込まない）、使うサービスはまとめて宣言
      this.device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: services });
      return this.device;
    } catch (e) { throw classifyRequestError(e); }
  }

  async connect(device, services) {
    this.device = device;
    device.removeEventListener('gattserverdisconnected', this._onDisc);
    try {
      this.server = await withTimeout(device.gatt.connect(), 15000, 'connect-failed', '');
    } catch (e) {
      throw new ConnError('connect-failed', '機器に接続できませんでした。', e);
    }
    let foundService = null;
    for (const uuid of services) {
      let service;
      try { service = await this.server.getPrimaryService(uuid); } catch { continue; }
      foundService = foundService || uuid;
      let chars = [];
      try { chars = await service.getCharacteristics(); } catch { continue; }
      // 性質から write / notify を自動判別
      const tx = chars.find((c) => c.properties.writeWithoutResponse) || chars.find((c) => c.properties.write);
      const rx = chars.find((c) => c.properties.notify) || chars.find((c) => c.properties.indicate);
      if (!tx || !rx) continue;
      try { await rx.startNotifications(); } catch { continue; }
      rx.addEventListener('characteristicvaluechanged', this._onNotify);
      this.tx = tx; this.rx = rx;
      device.addEventListener('gattserverdisconnected', this._onDisc);
      return { ok: true, serviceUuid: uuid };
    }
    try { this.server.disconnect(); } catch { /* noop */ }
    return { ok: false, reason: foundService ? 'no-char' : 'no-service' };
  }

  async write(text) {
    if (!this.tx || !this.device?.gatt?.connected) throw new ConnError('disconnected', '切断されています');
    const bytes = new TextEncoder().encode(text);
    const noResp = this.tx.properties.writeWithoutResponse;
    for (let i = 0; i < bytes.length; i += 20) {
      const chunk = bytes.slice(i, i + 20);
      if (noResp && this.tx.writeValueWithoutResponse) await this.tx.writeValueWithoutResponse(chunk);
      else if (this.tx.writeValueWithResponse) await this.tx.writeValueWithResponse(chunk);
      else await this.tx.writeValue(chunk);
    }
  }

  disconnect() {
    try { this.rx?.removeEventListener('characteristicvaluechanged', this._onNotify); } catch { /* noop */ }
    try { this.device?.removeEventListener('gattserverdisconnected', this._onDisc); } catch { /* noop */ }
    try { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); } catch { /* noop */ }
    this.tx = this.rx = null;
  }
}

function classifyRequestError(e) {
  const msg = String(e?.message || '');
  if (e?.name === 'NotFoundError') {
    if (/cancel/i.test(msg)) return new ConnError('cancelled', '');
    if (/adapter|bluetooth.*(off|not available|unavailable)|powered/i.test(msg)) return new ConnError('bt-off', 'Bluetooth がオフになっています。端末の Bluetooth をオンにしてください。', e);
    return new ConnError('cancelled', '', e);
  }
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return new ConnError('not-allowed', 'Bluetooth の利用が許可されていません。ブラウザ・端末の設定（位置情報・付近のデバイス）を確認してください。', e);
  if (e?.name === 'NotSupportedError') return new ConnError('unsupported', 'このブラウザ/端末は Web Bluetooth に対応していません。', e);
  return new ConnError('connect-failed', '機器に接続できませんでした。', e);
}
