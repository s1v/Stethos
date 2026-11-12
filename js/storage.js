// localStorage（保存済み UUID）と UUID の正規化
const KEY = 'stethos.savedUuids.v1';
const BASE = '-0000-1000-8000-00805f9b34fb';

/** 入力を正規化した 128bit UUID（小文字）にする。不正なら null */
export function normalizeUuid(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase().replace(/^0x/, '').replace(/[{}\s]/g, '');
  if (/^[0-9a-f]{4}$/.test(s)) return `0000${s}${BASE}`;
  if (/^[0-9a-f]{8}$/.test(s)) return `${s}${BASE}`;
  if (/^[0-9a-f]{32}$/.test(s)) s = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) return s;
  return null;
}

/** 表示用：標準ベースなら短い形式 */
export function shortUuid(uuid) {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/.exec(uuid);
  return m ? m[1].toUpperCase() : uuid;
}

export function getSavedUuids() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveUuid(uuid, deviceName) {
  const list = getSavedUuids().filter((x) => x.uuid !== uuid);
  list.push({ uuid, deviceName: deviceName || '(名前なし)', savedAt: new Date().toISOString() });
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 保存できない環境では無視 */ }
}

export function removeUuid(uuid) {
  try { localStorage.setItem(KEY, JSON.stringify(getSavedUuids().filter((x) => x.uuid !== uuid))); } catch { /* noop */ }
}

// 車両情報（オンラインで調べた結果）を VIN ごとに保存
const VKEY = 'stethos.vehicles.v1';
export function getVehicleCache(vin) {
  try { return (JSON.parse(localStorage.getItem(VKEY)) || {})[vin] || null; } catch { return null; }
}
export function setVehicleCache(vin, info) {
  try {
    const m = JSON.parse(localStorage.getItem(VKEY)) || {};
    m[vin] = { ...info, savedAt: new Date().toISOString() };
    localStorage.setItem(VKEY, JSON.stringify(m));
  } catch { /* noop */ }
}

// マイページの配置（枠ごとの項目 key。空の枠は null）
const MKEY = 'stethos.mypage.v1';
export const MYPAGE_DEFAULT_SLOTS = 12;
export function getMyPage() {
  try { const v = JSON.parse(localStorage.getItem(MKEY)); if (Array.isArray(v?.slots)) return v.slots; } catch { /* noop */ }
  return new Array(MYPAGE_DEFAULT_SLOTS).fill(null);
}
export function setMyPage(slots) {
  try { localStorage.setItem(MKEY, JSON.stringify({ slots })); } catch { /* noop */ }
}

// 設定
const SKEY = 'stethos.settings.v1';
const SETTINGS_DEFAULT = { pidSize: 's', multiPid: true, theme: 'standard' }; // pidSize: s（小）/ m（中）/ l（大）
export function getSettings() {
  try { return { ...SETTINGS_DEFAULT, ...(JSON.parse(localStorage.getItem(SKEY)) || {}) }; } catch { return { ...SETTINGS_DEFAULT }; }
}
export function setSetting(key, value) {
  try { localStorage.setItem(SKEY, JSON.stringify({ ...getSettings(), [key]: value })); } catch { /* noop */ }
}
export function resetMyPage() { setMyPage(new Array(MYPAGE_DEFAULT_SLOTS).fill(null)); try { localStorage.removeItem('stethos.mypage.v2'); } catch { /* noop */ } }

// マイページのプリセット（複数のマイページ）。{ presets: [{ id, name, slots }], last: id }
const PKEY = 'stethos.mypage.v2';
const newPreset = (name, slots) => ({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, slots: slots || new Array(MYPAGE_DEFAULT_SLOTS).fill(null) });
export function getPresets() {
  try { const v = JSON.parse(localStorage.getItem(PKEY)); if (Array.isArray(v?.presets) && v.presets.length) return v; } catch { /* noop */ }
  // 旧形式（プリセットなし）からの引き継ぎ
  const p = newPreset('マイページ 1', getMyPage());
  return { presets: [p], last: p.id };
}
export function savePresets(data) { try { localStorage.setItem(PKEY, JSON.stringify(data)); } catch { /* noop */ } }
export function getPreset(id) { const d = getPresets(); return d.presets.find((p) => p.id === id) || d.presets.find((p) => p.id === d.last) || d.presets[0]; }
export function updatePreset(id, patch) {
  const d = getPresets(); const p = d.presets.find((x) => x.id === id); if (!p) return;
  Object.assign(p, patch); savePresets(d);
}
export function addPreset(name) { const d = getPresets(); const p = newPreset(name); d.presets.push(p); d.last = p.id; savePresets(d); return p; }
export function removePreset(id) { const d = getPresets(); d.presets = d.presets.filter((p) => p.id !== id); if (!d.presets.length) d.presets.push(newPreset('マイページ 1')); if (d.last === id) d.last = d.presets[0].id; savePresets(d); }
export function setLastPreset(id) { const d = getPresets(); d.last = id; savePresets(d); }

// 項目ごとの表示単位（key → 単位）
const UKEY = 'stethos.units.v1';
export function getUnitPrefs() { try { return JSON.parse(localStorage.getItem(UKEY)) || {}; } catch { return {}; } }
export function setUnitPref(key, unit) {
  const p = getUnitPrefs(); if (unit) p[key] = unit; else delete p[key];
  try { localStorage.setItem(UKEY, JSON.stringify(p)); } catch { /* noop */ }
}

// 旧版（v0.0.25）で保存していた VIN を消す（VIN は毎回車から読む）
try { localStorage.removeItem('stethos.lastVehicle.v1'); } catch { /* noop */ }
