// ステータス画面（リアルタイムの車両データ）
import { $, el, keepAwake, alertDialog } from '../ui.js';
import { PIDS, DERIVED, PID_GROUPS, isDefSupported, isDerivedSupported } from '../config/pids.js';

let token = 0;
let cells = {};

function fmt(def, v) {
  if (v == null || Number.isNaN(v)) return '--';
  if (def.format === 'enum') return def.enum?.[v] ?? `不明（${v}）`;
  if (def.format === 'duration') { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.floor(v % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  return v.toFixed(def.decimals ?? 0);
}

const unitLabel = (d) => (d.format === 'duration' ? '時:分:秒' : d.unit || 'なし');

function card(d, ok) {
  const v = el('span', { class: 'v' + (d.format === 'enum' ? ' txt' : '') }, ok ? '--' : '非対応'), bar = el('i');
  const help = () => alertDialog(`${d.desc || ''}\n\n単位：${unitLabel(d)}${ok ? '' : '\n\nこの車は、この項目に対応していません。'}`, d.name);
  const showUnit = ok && d.unit && d.format !== 'duration' && d.format !== 'enum';
  const hasBar = d.format !== 'enum' && d.min != null;
  // ブロック全体をタップ領域にする（? アイコンは目印）
  const node = el('button', { class: 'pid' + (ok ? '' : ' na'), type: 'button', 'aria-label': `${d.name}の説明`, onclick: help },
    el('span', { class: 'q', 'aria-hidden': 'true' }, '?'),
    el('div', { class: 'n' }, d.name), el('div', {}, v, showUnit ? el('span', { class: 'u' }, d.unit) : null),
    hasBar ? el('div', { class: 'bar' }, bar) : null);
  if (ok) cells[d.key] = { v, bar, def: d };
  return node;
}

function build(obd) {
  cells = {};
  const sup = (pid) => obd.isSupported(pid);
  const root = $('st-groups'); root.innerHTML = '';
  const naBox = el('div', { class: 'pids' });
  let naCount = 0;
  for (const g of PID_GROUPS) {
    const defs = [...PIDS.filter((p) => p.group === g.id).map((d) => [d, isDefSupported(d, sup)]),
      ...DERIVED.filter((d) => d.group === g.id).map((d) => [d, isDerivedSupported(d, sup)])];
    const okDefs = defs.filter(([, ok]) => ok);
    for (const [d, ok] of defs) if (!ok) { naBox.append(card(d, false)); naCount++; }
    if (!okDefs.length) continue;
    root.append(el('div', { class: 'group' }, el('h2', {}, g.label), el('div', { class: 'pids' }, okDefs.map(([d]) => card(d, true)))));
  }
  // 非対応の項目はまとめて畳んでおく
  if (naCount) {
    root.append(el('details', { class: 'fold' }, el('summary', {}, `この車が対応していない項目（${naCount}）`), el('div', { class: 'fold-body' }, naBox)));
  }
}

function update(key, val) {
  const c = cells[key]; if (!c) return;
  c.v.textContent = fmt(c.def, val);
  if (val != null && c.def.min != null) c.bar.style.width = `${Math.max(0, Math.min(100, ((val - c.def.min) / (c.def.max - c.def.min)) * 100))}%`;
}

export default {
  id: 'status', title: 'ステータス', connected: true,
  async enter(app) {
    const my = ++token, { obd } = app.session;
    build(obd);
    keepAwake(true); // 表示中は画面を消さない
    const targets = PIDS.filter((p) => isDefSupported(p, (pid) => obd.isSupported(pid)));
    if (!targets.length) { $('st-rate').textContent = '（この車で表示できる項目がありません）'; return; }
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
        if (dt > 2) { $('st-rate').textContent = `（更新 ${(n / dt).toFixed(1)} 項目/秒・全 ${targets.length} 項目を順に更新）`; n = 0; t0 = performance.now(); }
      }
    }
  },
  leave() { token++; keepAwake(false); },
};
