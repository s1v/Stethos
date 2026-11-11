// ホーム画面（サマリーのみ）
import { $, toast } from '../ui.js';
import { countDisplayable } from '../config/pids.js';
import { decodeVin, lookupVinOnline } from '../vehicle.js';

let token = 0;

function renderVehicle(s) {
  const info = decodeVin(s.vin);
  if (!s.vin) { $('h-vehicle').textContent = '車両情報を取得できませんでした'; $('h-vin').textContent = 'VIN：-'; $('h-lookup').hidden = true; return; }
  const parts = [];
  if (info?.brand) parts.push(info.brand);
  if (info?.year) parts.push(`${info.year} 年式（推定）`);
  $('h-vehicle').textContent = parts.length ? parts.join(' ／ ') : 'メーカー不明';
  $('h-vin').textContent = `VIN：${s.vin}`;
  $('h-lookup').hidden = !navigator.onLine;
}

export default {
  id: 'home', title: 'ホーム', connected: true,
  init(app) {
    $('h-dtc-tile').onclick = () => app.show('dtc');
    $('h-items-tile').onclick = () => app.show('status');
    $('h-lookup').onclick = async () => {
      const vin = app.session.vin; if (!vin) return;
      const btn = $('h-lookup'); btn.disabled = true; btn.textContent = '調べています…';
      try {
        const r = await lookupVinOnline(vin);
        if (r.make || r.model) {
          $('h-vehicle').textContent = [r.make, r.model, r.trim].filter(Boolean).join(' ') + (r.year ? ` ／ ${r.year} 年式` : '');
          btn.hidden = true;
        } else toast('車種名は見つかりませんでした（北米向け以外の車は登録がないことがあります）');
      } catch { toast('オンラインで調べられませんでした。ネット接続を確認してください。', { error: true }); }
      btn.disabled = false; if (!btn.hidden) btn.textContent = '車種をオンラインで調べる ›';
    };
  },
  async enter(app) {
    const my = ++token, s = app.session;
    $('h-device').textContent = s.deviceName;
    renderVehicle(s);
    const c = countDisplayable((pid) => s.obd.isSupported(pid));
    $('h-items').textContent = `${c.supported} / ${c.total} 項目`;
    try {
      const st = await s.obd.readMonitorStatus();
      if (my !== token) return;
      if (st) {
        $('h-dtc').innerHTML = st.count ? `<span class="wn">${st.count} 件</span>` : '<span class="ok">異常なし</span>';
        $('h-mil').innerHTML = st.mil ? '<span class="ng">点灯</span>' : '<span class="ok">消灯</span>';
      } else { $('h-dtc').textContent = '取得不可'; $('h-mil').textContent = '取得不可'; }
    } catch { /* 切断時など */ }
  },
  leave() { token++; },
};
