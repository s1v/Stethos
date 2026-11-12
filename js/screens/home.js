// ホーム画面（サマリーのみ）
import { $, toast, el } from '../ui.js';
import { countDisplayable, findItem, isItemSupported } from '../config/pids.js';
import { resolveTargets, startPolling } from '../poller.js';
import { currentUnit, fmt } from './parts/pid-card.js';
import { createMeter } from './parts/widgets.js';
import { decodeVin, lookupVinOnline } from '../vehicle.js';
import { getVehicleCache, setVehicleCache } from '../storage.js';

let token = 0;
let stop = () => {};

// ミニメーターに出す項目（pids.js の key）
const METERS = ['speed', 'rpm', 'coolant', 'adapterVolt'];
// cold：冷却水温が低い（暖機中）。異常ではないので全体は緑のまま、行の印だけ黄色にする
const LEVEL = { ok: 0, cold: 0, unk: 1, warn: 2, ng: 3 };
const ICON = { ok: '\u2713', warn: '!', ng: '!', unk: '-' };
const ROWS = ['hc-dtc', 'hc-mil', 'hc-batt', 'hc-cool'];

/** 車の状態の 1 行を更新（level: ok / warn / ng / unk） */
function setRow(id, level, text) {
  const r = $(id); r.classList.remove('ok', 'cold', 'warn', 'ng', 'unk'); r.classList.add(level);
  r.dataset.level = level; r.querySelector('.hc-v').textContent = text;
  // 全体：一番悪い状態をカードの色と見出しにする
  const rows = ROWS.map((x) => $(x).dataset.level || 'unk');
  const worst = rows.map((x) => (x === 'cold' ? 'ok' : x)).reduce((a, b) => (LEVEL[b] > LEVEL[a] ? b : a), 'ok');
  const n = rows.filter((x) => x === 'warn' || x === 'ng').length;
  $('hc').className = 'health ' + worst;
  $('hc-icon').textContent = ICON[worst];
  $('hc-title').textContent = worst === 'ok' ? '異常なし' : worst === 'unk' ? '確認中' : worst === 'ng' ? `要確認（${n} 件）` : `おおむね良好（注意 ${n} 件）`;
}

function judgeBattery(v, rpm) {
  if (v == null) return ['unk', '取得不可'];
  const t = `${v.toFixed(1)} V`;
  if (rpm) return v > 15.0 ? ['ng', `${t} 過充電の疑い`] : v >= 13.2 ? ['ok', `${t} 充電中`] : ['warn', `${t} 充電不足`];
  return v >= 12.4 ? ['ok', `${t} 良好`] : v >= 12.0 ? ['warn', `${t} やや低い`] : ['ng', `${t} 充電不足`];
}
function judgeCoolant(c, d) {
  if (c == null) return ['unk', '取得不可'];
  const u = currentUnit(d), t = `${fmt({ ...d, decimals: u.decimals }, u.f(c))}${u.unit}`;
  return c < 60 ? ['cold', `${t} 暖機中`] : c <= 105 ? ['ok', `${t} 正常`] : c <= 115 ? ['warn', `${t} 高め`] : ['ng', `${t} 過熱の疑い`];
}

const LOOKUP_LABEL = '車種を調べる ›';

const onlineText = (r) => [r.make, r.model, r.trim].filter(Boolean).join(' ') + (r.year ? ` ／ ${r.year} 年式` : '');

function renderVehicle(s) {
  const btn = $('h-lookup');
  if (!s.vin) { $('h-vehicle').textContent = '車両情報を取得できませんでした'; $('h-vin').textContent = 'VIN：-'; btn.hidden = true; return; }
  $('h-vin').textContent = `VIN：${s.vin}`;
  const cached = getVehicleCache(s.vin);
  if (cached && (cached.make || cached.model)) { $('h-vehicle').textContent = onlineText(cached); btn.hidden = true; return; }
  const info = decodeVin(s.vin);
  const parts = [];
  if (info?.brand) parts.push(info.brand);
  if (info?.year) parts.push(`${info.year} 年式（推定）`);
  $('h-vehicle').textContent = parts.length ? parts.join(' ／ ') : 'メーカー不明';
  // 一度調べて見つからなかった車はボタンを出さない
  btn.hidden = !!cached || !navigator.onLine;
  btn.textContent = LOOKUP_LABEL; btn.disabled = false;
}

export default {
  id: 'home', title: 'ホーム', connected: true,
  init(app) {
    $('hc-dtc').onclick = () => app.show('dtc');
    $('hc-mil').onclick = () => app.show('dtc');
    $('h-items-tile').onclick = () => app.show('status');
    $('h-lookup').onclick = async () => {
      const vin = app.session.vin; if (!vin) return;
      const btn = $('h-lookup'); btn.disabled = true; btn.textContent = '調べています…';
      try {
        const r = await lookupVinOnline(vin);
        setVehicleCache(vin, r); // 結果を保存（次回からは調べない）
        if (!(r.make || r.model)) toast('車種名は見つかりませんでした（北米向け以外の車は登録がないことがあります）');
      } catch { toast('オンラインで調べられませんでした。ネット接続を確認してください。', { error: true }); }
      renderVehicle(app.session);
    };
  },
  async enter(app) {
    const my = ++token, s = app.session;
    { const d = $('h-device'); if (d) d.textContent = s.deviceName; }
    renderVehicle(s);
    $('h-meters').innerHTML = '';
    for (const id of ROWS) setRow(id, 'unk', '-');
    const c = countDisplayable((pid) => s.obd.isSupported(pid));
    $('h-items').textContent = `${c.supported} / ${c.total} 項目`;
    try {
      const st = await s.obd.readMonitorStatus();
      if (my !== token) return;
      if (st) {
        setRow('hc-dtc', st.count ? 'warn' : 'ok', st.count ? `${st.count} 件` : 'なし');
        setRow('hc-mil', st.mil ? 'ng' : 'ok', st.mil ? '点灯' : '消灯');
      } else { setRow('hc-dtc', 'unk', '取得不可'); setRow('hc-mil', 'unk', '取得不可'); }
    } catch { return; /* 切断時など */ }
    if (my !== token) return;
    // ミニメーターと、バッテリー・水温の判定（ホーム表示中だけこの 4 項目を取得）
    const sup = (pid) => s.obd.isSupported(pid);
    const box = $('h-meters'); box.innerHTML = '';
    const meters = {};
    for (const key of METERS) {
      const d = findItem(key); const m = createMeter(d, isItemSupported(d, sup));
      meters[key] = m; box.append(m.node);
    }
    const coolDef = findItem('coolant');
    if (!sup('05')) setRow('hc-cool', 'unk', '非対応');
    const vals = {};
    stop = startPolling(s, resolveTargets(METERS, s.obd), (k, v) => {
      if (my !== token) return;
      vals[k] = v; meters[k]?.update(v);
      if (k === 'adapterVolt') setRow('hc-batt', ...judgeBattery(v, vals.rpm));
      if (k === 'coolant') setRow('hc-cool', ...judgeCoolant(v, coolDef));
    });
  },
  leave() { token++; stop(); stop = () => {}; },
};
