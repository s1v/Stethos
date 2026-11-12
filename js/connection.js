// 接続の流れ（仕様 5 章）とセッション管理
import { BleTransport, ConnError } from './ble.js';
import { Elm327 } from './elm327.js';
import { Obd } from './obd.js';
import { KNOWN_SERVICES } from './config/known-uuids.js';
import { getSavedUuids, saveUuid, normalizeUuid, getSettings } from './storage.js';
import { saveLastConnection } from './report.js';

export const knownUuids = () => KNOWN_SERVICES.map((k) => normalizeUuid(k.uuid)).filter(Boolean);


export const session = { transport: null, elm: null, obd: null, deviceName: '', debug: false, vin: null, userClosing: false };

/**
 * @param {object} o
 * @param {string[]} o.extraUuids  詳細設定で入力した UUID（今回のみ宣言）
 * @param {string|null} o.requireUuid  UUID 入力画面で入力した UUID（この UUID で確認し、成功したら保存）
 * @param {()=>object} [o.transportFactory]  トランスポートの差し替え（デバッグモード用）
 * @param {boolean} [o.debug]
 * @param {(msg:string)=>void} o.progress
 * @returns {Promise<{status:'ok'|'need-uuid'|'cancelled', deviceName?:string, warning?:string}>}
 */
export async function connect({ extraUuids = [], requireUuid = null, progress = () => {}, transportFactory = null, debug = false }) {
  const transport = transportFactory ? transportFactory() : new BleTransport();
  const services = [...new Set([...knownUuids(), ...getSavedUuids().map((s) => s.uuid), ...extraUuids, ...(requireUuid ? [requireUuid] : [])])];

  let device;
  try { device = await transport.requestDevice(services); } catch (e) {
    if (e.code === 'cancelled') return { status: 'cancelled' };
    throw e;
  }
  const deviceName = transport.deviceName;
  progress(`${deviceName} に接続中…`);
  const res = await transport.connect(device, requireUuid ? [requireUuid] : services);
  if (!res.ok) {
    if (res.reason === 'no-char') throw new ConnError('no-char', 'サービスは見つかりましたが、送信（WRITE）と受信（NOTIFY）に対応した項目がありません。別のサービスの UUID を試してください。');
    if (requireUuid) throw new ConnError('uuid-not-found', `入力した UUID のサービスが「${deviceName}」に見つかりませんでした。UUID と、選んだ機器が正しいか確認してください。`);
    return { status: 'need-uuid', deviceName };
  }

  progress('ELM327 を初期化中…');
  const elm = new Elm327(transport);
  let init;
  try { init = await elm.init(); } catch (e) {
    transport.disconnect();
    throw new ConnError('no-elm', 'ELM327 の応答がありません。この機器は ELM327 互換ではない可能性があります。');
  }
  if (requireUuid) saveUuid(requireUuid, deviceName);
  else if (extraUuids.includes(res.serviceUuid)) saveUuid(res.serviceUuid, deviceName);

  progress('車両情報を取得中…');
  const obd = new Obd(elm);
  try { await obd.loadSupported(); } catch { /* noop */ }
  try { await obd.detectMulti(getSettings().multiPid); } catch { /* 使えなければ 1 個ずつ */ }
  let vin = null;
  try { vin = await obd.readVin(); } catch { /* noop */ }

  // 動作報告用に保存（Issue に入れるのはアダプターの情報だけ）
  try {
    saveLastConnection({ deviceName, serviceUuid: res.serviceUuid, multiState: obd.multiState, debug });
  } catch { /* noop */ }
  Object.assign(session, { transport, elm, obd, deviceName, vin, debug, userClosing: false });
  return { status: 'ok', deviceName, warning: init.vehicleOk ? null : '車両から応答がありません。イグニッションが ON か確認してください。' };
}

export function disconnect() {
  session.userClosing = true;
  try { session.transport?.disconnect(); } catch { /* noop */ }
  Object.assign(session, { transport: null, elm: null, obd: null, vin: null });
}

