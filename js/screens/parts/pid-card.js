// 表示項目 1 つ分のブロック（ステータス画面・マイページで共通）
import { el, alertDialog } from '../../ui.js';

export function fmt(def, v) {
  if (v == null || Number.isNaN(v)) return '--';
  if (def.format === 'enum') return def.enum?.[v] ?? `不明（${v}）`;
  if (def.format === 'duration') { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.floor(v % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  return v.toFixed(def.decimals ?? 0);
}

export function showHelp(d, ok = true) {
  return alertDialog(`${d.desc || ''}${ok ? '' : '\n\nこの車は、この項目に対応していません。'}`, d.name);
}

/**
 * @param {object} d 項目の定義
 * @param {boolean} ok 車が対応しているか
 * @param {{onClick?: Function}} [o] 省略時はタップで説明を表示
 * @returns {{node: HTMLElement, update: (v:number|null) => void}}
 */
export function createCard(d, ok, { onClick } = {}) {
  const isText = d.format === 'enum';
  const v = el('span', { class: 'v' + (isText ? ' txt' : '') }, ok ? '--' : '非対応');
  // 「°」は数値と同じ大きさで数値の直後に付ける（小さい文字にすると位置がずれて見えるため）
  const unit = ok && d.unit && d.format !== 'duration' && !isText ? d.unit : '';
  const deg = unit.startsWith('°') ? el('span', { class: 'deg' }, '°') : null;
  const rest = deg ? unit.slice(1) : unit;
  const bar = el('i');
  const hasBar = !isText && d.min != null;
  const node = el('button', { class: 'pid' + (ok ? '' : ' na'), type: 'button', 'aria-label': d.name, onclick: onClick || (() => showHelp(d, ok)) },
    el('span', { class: 'q', 'aria-hidden': 'true' }, '?'),
    el('div', { class: 'n' }, d.name),
    el('div', { class: 'val' }, v, deg, rest ? el('span', { class: 'u' }, rest) : null),
    // バーがない項目も同じ高さを確保して、位置をそろえる
    el('div', { class: 'bar' + (hasBar ? '' : ' none') }, bar));
  const update = (val) => {
    v.textContent = fmt(d, val);
    if (hasBar && val != null) bar.style.width = `${Math.max(0, Math.min(100, ((val - d.min) / (d.max - d.min)) * 100))}%`;
  };
  return { node, update };
}
