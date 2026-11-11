// ホーム画面（サマリーのみ）
import { $ } from '../ui.js';
import { PIDS } from '../config/pids.js';

let token = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readVolt(s) {
  let v = await s.elm.readVoltage();
  if (v == null && s.obd.isSupported('42')) v = await s.obd.readPid(PIDS.find((p) => p.pid === '42')).catch(() => null);
  return v;
}

export default {
  id: 'home', title: 'ホーム', connected: true,
  init(app) { $('h-dtc-tile').onclick = () => app.show('dtc'); },
  async enter(app) {
    const my = ++token, s = app.session;
    $('h-device').textContent = s.deviceName;
    $('h-vin').textContent = s.vin || '取得できませんでした';
    $('h-pids').textContent = s.obd.supportedCount ? `${s.obd.supportedCount} 項目` : '-';
    try {
      const st = await s.obd.readMonitorStatus();
      if (my !== token) return;
      if (st) {
        $('h-dtc').innerHTML = st.count ? `<span class="wn">${st.count} 件</span>` : '<span class="ok">異常なし</span>';
        $('h-mil').innerHTML = st.mil ? '<span class="ng">点灯</span>' : '<span class="ok">消灯</span>';
      } else { $('h-dtc').textContent = '取得不可'; $('h-mil').textContent = '取得不可'; }
    } catch { /* 切断時など */ }
    while (my === token && s.elm) {
      try { const v = await readVolt(s); if (my === token) $('h-volt').textContent = v != null ? `${v.toFixed(1)} V` : '取得不可'; } catch { break; }
      await sleep(5000);
    }
  },
  leave() { token++; },
};
