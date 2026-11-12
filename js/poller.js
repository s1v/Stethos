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
  // 同じ PID の項目を並べて取得する（obd.js で応答を使い回せるように）
  // 同じ PID の項目を並べ、まとめて送れる PID を前に集める（obd.js で応答を使い回し、マルチ PID でまとめて取れるように）
  const batch = (p) => (obd.canBatch?.(p.pid) ? 0 : 1);
  return PIDS.filter((p) => need.has(p.key) && isDefSupported(p, sup)).sort((a, b) => batch(a) - batch(b) || (a.pid || '').localeCompare(b.pid || ''));
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
      // 1 周ごとに応答キャッシュを捨てる（前の周の値を使い回さず、毎周新しい値を取る）
      session.obd.cache.clear();
      const cycleStart = performance.now();
      for (let i = 0; i < targets.length; i++) {
        const def = targets[i];
        if (!running) return;
        const obd = session.obd; if (!obd) return;
        // マルチ PID 通信：これから取得する PID をまとめて先に取る（往復の回数を減らす）
        if (obd.canBatch(def.pid) && !obd.hasFresh(def.pid)) {
          const next = [];
          for (let j = i; j < targets.length && next.length < 6; j++) {
            const p = targets[j].pid;
            if (obd.canBatch(p) && !obd.hasFresh(p) && !next.includes(p)) next.push(p);
          }
          try { await obd.prefetch(next); } catch { if (!session.obd) return; }
          if (!running) return;
        }
        try { values[def.key] = await obd.readPid(def); } catch { if (!session.obd) return; values[def.key] = null; }
        if (!running) return;
        onValue(def.key, values[def.key]); n++;
        const d = obd.calcDerived(values); for (const k in d) onValue(k, d[k]);
        const dt = (performance.now() - t0) / 1000;
        if (dt > 2) { onRate(n / dt); n = 0; t0 = performance.now(); }
      }
      // 1 周が一瞬で終わったとき（全部取得できなかったなど）は少し待つ（空回りして端末に負担をかけないように）
      const spent = performance.now() - cycleStart;
      if (spent < 50) await new Promise((r) => setTimeout(r, 50 - spent));
    }
  })();
  return () => { running = false; };
}
