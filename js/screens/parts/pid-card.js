// 表示項目 1 つ分のブロック（ステータス画面・マイページで共通）
import { el, confirmDialog } from '../../ui.js';
import { UNIT_OPTIONS } from '../../config/units.js';
import { getUnitPrefs, setUnitPref } from '../../storage.js';

export function fmt(def, v) {
  if (v == null || Number.isNaN(v)) return '--';
  if (def.format === 'hex' || def.format === 'text') return String(v);
  if (def.format === 'enum') return def.enum?.[v] ?? `不明（${v}）`;
  if (def.format === 'duration') { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.floor(v % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  return v.toFixed(def.decimals ?? 0);
}

/** 項目で選べる単位（切り替えできない項目は空配列） */
export const unitChoices = (d) => (d.format ? [] : UNIT_OPTIONS[d.unit] || []);

/** 項目の現在の表示単位 { unit, f, decimals } */
export function currentUnit(d) {
  const opts = unitChoices(d);
  const sel = opts.find((o) => o.unit === getUnitPrefs()[d.key]) || opts[0];
  return sel ? { unit: sel.unit, f: sel.f, decimals: sel.decimals ?? d.decimals } : { unit: d.unit, f: (x) => x, decimals: d.decimals };
}

// 表示中のブロック（単位を変えたら同じ項目のブロックをすべて描き直す）
const live = new Set();
function refreshKey(key) {
  for (const c of live) { if (!c.node.isConnected) live.delete(c); else if (c.key === key) c.refresh(); }
}

/** 説明（ヒント）ダイアログ。単位を切り替えられる項目は、ここで単位を選べる */
export function showHelp(d, ok = true) {
  const opts = unitChoices(d);
  let extra = null;
  if (opts.length > 1 && ok) {
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': '表示単位' });
    const mark = () => { const cur = currentUnit(d).unit; [...seg.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.u === cur))); };
    for (const o of opts) {
      const b = el('button', { type: 'button', role: 'radio', onclick: () => { setUnitPref(d.key, o.unit === opts[0].unit ? null : o.unit); mark(); refreshKey(d.key); } }, o.unit);
      b.dataset.u = o.unit; seg.append(b);
    }
    mark();
    extra = el('div', { class: 'unit-pick' }, el('div', { class: 'lbl' }, '表示単位'), seg);
  }
  return confirmDialog(`${d.desc || ''}${ok ? '' : '\n\nこの車は、この項目に対応していません。'}`, { alertOnly: true, title: d.name, extra });
}

/**
 * @param {object} d 項目の定義
 * @param {boolean} ok 車が対応しているか
 * @param {{onClick?: Function}} [o] 省略時はタップで説明を表示
 * @returns {{node: HTMLElement, update: (v:number|null) => void}}
 */
export function createCard(d, ok, { onClick } = {}) {
  const isText = ['enum', 'text', 'hex'].includes(d.format);
  const v = el('span', { class: 'v' + (isText ? ' txt' : '') }, ok ? '--' : '非対応');
  const val = el('div', { class: 'val' });
  const bar = el('i');
  const hasBar = !isText && d.min != null;
  const node = el('button', { class: 'pid' + (ok ? '' : ' na'), type: 'button', 'aria-label': d.name, onclick: onClick || (() => showHelp(d, ok)) },
    el('div', { class: 'n' }, d.name),
    val,
    // バーがない項目も同じ高さを確保して、位置をそろえる
    el('div', { class: 'bar' + (hasBar ? '' : ' none') }, bar));
  let last = null;
  const draw = () => {
    const u = currentUnit(d);
    const unit = ok && u.unit && d.format !== 'duration' && !isText ? u.unit : '';
    // 「°」は数値と同じ大きさで数値の直後に付ける（小さい文字にすると位置がずれて見えるため）
    const deg = unit.startsWith('°') ? el('span', { class: 'deg' }, '°') : null;
    const rest = deg ? unit.slice(1) : unit;
    val.replaceChildren(v, ...(deg ? [deg] : []), ...(rest ? [el('span', { class: 'u' }, rest)] : []));
    if (ok) v.textContent = last == null ? '--' : fmt({ ...d, decimals: u.decimals }, isText || d.format === 'duration' ? last : u.f(last));
    if (d.format === 'hex') v.classList.add('hex');
  };
  const update = (x) => {
    last = x;
    draw();
    if (hasBar && x != null) bar.style.width = `${Math.max(0, Math.min(100, ((x - d.min) / (d.max - d.min)) * 100))}%`;
  };
  draw();
  const card = { node, update, key: d.key, refresh: draw };
  live.add(card);
  return card;
}
