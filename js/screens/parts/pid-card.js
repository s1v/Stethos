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

// 各項目の最新の値（詳細画面で数値を表示するため。基本単位の値）
const latest = new Map();

/** 時間（秒）を「時間・分・秒」に分ける */
const hms = (v) => [Math.floor(v / 3600), Math.floor((v % 3600) / 60), Math.floor(v % 60)];

/** 表示用の文字列（数値＋単位）。詳細画面で使う */
export function displayText(d, x) {
  if (x == null || Number.isNaN(x)) return '--';
  if (d.format === 'duration') { const [h, m, s] = hms(x); return `${h} 時間 ${m} 分 ${s} 秒`; }
  if (d.format) return fmt(d, x);
  const u = currentUnit(d);
  return `${fmt({ ...d, decimals: u.decimals }, u.f(x))} ${u.unit || ''}`.trim();
}

export const rememberValue = (key, x) => latest.set(key, x);

// 表示中のブロック（単位を変えたら同じ項目のブロックをすべて描き直す）
const live = new Set();
function refreshKey(key) {
  for (const c of live) { if (!c.node.isConnected) live.delete(c); else if (c.key === key) c.refresh(); }
}

/**
 * 詳細画面（ブロックをタップしたとき）。並びは「タイトル・数値・説明・表示単位」
 * 数値はブロックに収まりきらないときのため、ここでも表示する（開いている間も更新する）
 */
export function showHelp(d, ok = true) {
  const opts = unitChoices(d);
  const valEl = el('div', { class: 'detail-val' + (d.format === 'hex' ? ' hex' : '') }, ok ? displayText(d, latest.get(d.key)) : '非対応');
  const parts = [valEl, el('p', { class: 'detail-desc' }, `${d.desc || ''}${ok ? '' : '\n\nこの車は、この項目に対応していません。'}`)];
  if (opts.length > 1 && ok) {
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': '表示単位' });
    const mark = () => { const cur = currentUnit(d).unit; [...seg.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.u === cur))); };
    for (const o of opts) {
      const b = el('button', { type: 'button', role: 'radio', onclick: () => { setUnitPref(d.key, o.unit === opts[0].unit ? null : o.unit); mark(); refreshKey(d.key); valEl.textContent = displayText(d, latest.get(d.key)); } }, o.unit);
      b.dataset.u = o.unit; seg.append(b);
    }
    mark();
    parts.push(el('div', { class: 'unit-pick' }, el('div', { class: 'lbl' }, '表示単位'), seg));
  }
  const timer = ok ? setInterval(() => { valEl.textContent = displayText(d, latest.get(d.key)); }, 500) : null;
  return confirmDialog('', { alertOnly: true, title: d.name, extra: el('div', { class: 'detail' }, ...parts) }).finally(() => clearInterval(timer));
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
  let last = null, drawnOnce = false;
  const draw = () => {
    const u = currentUnit(d);
    const unit = ok && u.unit && d.format !== 'duration' && !isText ? u.unit : '';
    // 「°」は数値と同じ大きさで数値の直後に付ける（小さい文字にすると位置がずれて見えるため）
    const deg = unit.startsWith('°') ? el('span', { class: 'deg' }, '°') : null;
    const rest = deg ? unit.slice(1) : unit;
    val.replaceChildren(v, ...(deg ? [deg] : []), ...(rest ? [el('span', { class: 'u' }, rest)] : []));
    if (ok && d.format === 'duration' && last != null) {
      // 時間は「時間・分・秒」に分けて、収まらないときは折り返す
      const [h, m, s] = hms(last);
      v.classList.add('dur');
      v.replaceChildren(...[[h, '時間'], [m, '分'], [s, '秒']].map(([n, l]) => el('span', { class: 'dur-p' }, String(n), el('span', { class: 'u' }, l))));
      return;
    }
    if (ok) v.textContent = last == null ? '--' : fmt({ ...d, decimals: u.decimals }, isText || d.format === 'duration' ? last : u.f(last));
    if (d.format === 'hex') v.classList.add('hex');
  };
  const update = (x) => {
    latest.set(d.key, x);
    // 値が変わらないときは描き直さない（中身を作り直し続けると、押している途中の要素が消えてタップが効かなくなるため）
    if (x === last && drawnOnce) return;
    last = x; drawnOnce = true;
    draw();
    if (hasBar && x != null) { const pct = Math.max(0, Math.min(100, ((x - d.min) / (d.max - d.min)) * 100)); bar.style.width = `${pct}%`; bar.style.setProperty('--pct', pct); }
  };
  draw();
  const card = { node, update, key: d.key, refresh: draw };
  live.add(card);
  return card;
}
