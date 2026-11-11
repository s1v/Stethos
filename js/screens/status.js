// ステータス画面（リアルタイムの車両データ）
import { $, el, keepAwake } from '../ui.js';
import { PIDS, DERIVED, PID_GROUPS } from '../config/pids.js';

let token = 0;
const cells = {};

function fmt(def, v) {
  if (v == null || Number.isNaN(v)) return '--';
  if (def.format === 'duration') { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.floor(v % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  return v.toFixed(def.decimals ?? 0);
}

function build(obd) {
  const root = $('st-groups'); root.innerHTML = '';
  for (const g of PID_GROUPS) {
    const defs = [...PIDS.filter((p) => p.group === g.id), ...DERIVED.filter((d) => d.group === g.id)];
    if (!defs.length) continue;
    const box = el('div', { class: 'pids' });
    for (const d of defs) {
      const ok = d.pid ? obd.isSupported(d.pid) : d.needs.every((k) => { const p = PIDS.find((x) => x.key === k); return k === 'baro' || obd.isSupported(p.pid); });
      const v = el('span', { class: 'v' }, ok ? '--' : '非対応'), bar = el('i');
      box.append(el('div', { class: 'pid' + (ok ? '' : ' na') }, el('div', { class: 'n' }, d.name), el('div', {}, v, ok && d.format !== 'duration' ? el('span', { class: 'u' }, d.unit) : null), el('div', { class: 'bar' }, bar)));
      cells[d.key] = { v, bar, def: d, ok };
    }
    root.append(el('div', { class: 'group' }, el('h2', {}, g.label), box));
  }
}

function update(key, val) {
  const c = cells[key]; if (!c || !c.ok) return;
  c.v.textContent = fmt(c.def, val);
  if (val != null) c.bar.style.width = `${Math.max(0, Math.min(100, ((val - c.def.min) / (c.def.max - c.def.min)) * 100))}%`;
}

export default {
  id: 'status', title: 'ステータス', connected: true,
  async enter(app) {
    const my = ++token, { obd } = app.session;
    build(obd);
    keepAwake(true).then((on) => { $('st-wake').textContent = on ? '／画面を点けたままにしています' : ''; });
    const targets = PIDS.filter((p) => obd.isSupported(p.pid));
    if (!targets.length) { $('st-rate').textContent = '表示できる項目がありません'; return; }
    const values = {};
    let n = 0, t0 = performance.now();
    while (my === token && app.session.obd) {
      for (const def of targets) {
        if (my !== token) return;
        try { values[def.key] = await obd.readPid(def); } catch (e) { if (!app.session.obd) return; values[def.key] = null; }
        if (my !== token) return;
        update(def.key, values[def.key]); n++;
        const d = obd.calcDerived(values); for (const k in d) update(k, d[k]);
        const dt = (performance.now() - t0) / 1000;
        if (dt > 2) { $('st-rate').textContent = `${(n / dt).toFixed(1)} 項目/秒`; n = 0; t0 = performance.now(); }
      }
    }
  },
  leave() { token++; keepAwake(false); },
};
