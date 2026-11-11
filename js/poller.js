// 表示項目の定期取得（表示とは分離。ステータス画面・マイページで共通）
import { PIDS, findItem, isDefSupported } from './config/pids.js';

/** 表示したい項目 key から、実際に取得する基本項目（PIDS）の一覧を作る */
export function resolveTargets(keys, obd) {
  const sup = (pid) => obd.isSupported(pid);
  const need = new Set();
  for (const key of keys) {
    const d = findItem(key); if (!d) continue;
    if (d.needs) [...d.needs, ...(d.optional || [])].forEach((k) => need.add(k));
    else need.add(key);
  }
  return PIDS.filter((p) => need.has(p.key) && isDefSupported(p, sup));
}

/**
 * 順番に取得し続ける。onValue(key, value) は基本項目と計算項目の両方で呼ばれる
 * @returns {() => void} 停止する関数
 */
export function startPolling(session, targets, onValue, onRate = () => {}) {
  let running = true;
  (async () => {
    const values = {};
    let n = 0, t0 = performance.now();
    while (running && session.obd && targets.length) {
      for (const def of targets) {
        if (!running) return;
        const obd = session.obd; if (!obd) return;
        try { values[def.key] = await obd.readPid(def); } catch { if (!session.obd) return; values[def.key] = null; }
        if (!running) return;
        onValue(def.key, values[def.key]); n++;
        const d = obd.calcDerived(values); for (const k in d) onValue(k, d[k]);
        const dt = (performance.now() - t0) / 1000;
        if (dt > 2) { onRate(n / dt); n = 0; t0 = performance.now(); }
      }
    }
  })();
  return () => { running = false; };
}
