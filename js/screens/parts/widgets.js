// 表示の種類（ウィジェット）。マイページ・ホームで共通
// 項目 1 つを、数値・大きな数値・縦バー・グラフ・メーターのいずれかで表示する
import { el } from '../../ui.js';
import { createCard, currentUnit, fmt, rememberValue } from './pid-card.js';

/** 表示の種類。w × h はマスの数（横 × 縦） */
export const STYLES = [
  { id: 'card', label: '数値', w: 1, h: 1, any: true },
  { id: 'big', label: '大きな数値', w: 2, h: 1, any: true },
  { id: 'tall', label: '縦バー', w: 1, h: 2 },
  { id: 'graph', label: 'グラフ', w: 2, h: 1 },
  { id: 'meter', label: 'メーター', w: 2, h: 2 },
  { id: 'graph2', label: '大きなグラフ', w: 2, h: 2 },
];
export const findStyle = (id) => STYLES.find((s) => s.id === id) || STYLES[0];
/** 数値の項目だけがバー・グラフ・メーターを使える（文字の項目は数値・大きな数値のみ） */
export const stylesFor = (d) => STYLES.filter((s) => s.any || (!d.format && d.min != null));

const HOT = 0.85, SHIFT_N = 7;
/** メーターの弧のグラデーション（文書に 1 つだけ置き、色は CSS 変数 --mg0〜--mg2 で各テーマが決める） */
function ensureMeterGradient() {
  if (document.getElementById('stethos-mtr-grad')) return;
  const box = document.createElement('div');
  box.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="stethos-mtr-grad" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="88" y2="0"><stop offset="0" class="mg0"/><stop offset=".55" class="mg1"/><stop offset="1" class="mg2"/></linearGradient></defs></svg>';
  document.body.append(box.firstChild);
}

/** 針式のミニメーター（SVG）。270 度の弧に針を描く */
export function createMeter(d, ok, { tag = 'div', onClick = null, cls = '' } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 80'); svg.setAttribute('class', 'mtr-svg');
  const R = 38, CX = 50, CY = 46, A0 = 135, SPAN = 270;
  const pt = (deg) => { const r = (deg * Math.PI) / 180; return [CX + R * Math.cos(r), CY + R * Math.sin(r)]; };
  const arc = (from, to) => { const [x1, y1] = pt(from), [x2, y2] = pt(to); return `M${x1} ${y1} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  ensureMeterGradient();
  // 上限付近（85% 以上）はレッドゾーンとして弧を色分けする
  svg.innerHTML = `<path d="${arc(A0, A0 + SPAN)}" class="mtr-track"/><path d="${arc(A0 + SPAN * HOT, A0 + SPAN)}" class="mtr-red"/><path class="mtr-fill" d=""/><line class="mtr-peak" x1="${CX}" y1="${CY - R - 5}" x2="${CX}" y2="${CY - R + 5}"/><line class="mtr-needle" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 8}"/><circle cx="${CX}" cy="${CY}" r="3.5" class="mtr-hub"/>`;
  const fill = svg.querySelector('.mtr-fill'), needle = svg.querySelector('.mtr-needle'), peakEl = svg.querySelector('.mtr-peak');
  let peak = 0;
  // シフトランプ（回転数のメーターだけ）。60% から順に点き、上限付近で全灯・点滅
  const shift = d.key === 'rpm' ? el('div', { class: 'shift' }, ...Array.from({ length: SHIFT_N }, (_, i) => el('i', { class: 'sl' + (i < 2 ? ' g' : i < 4 ? ' y' : ' r') }))) : null;
  const v = el('div', { class: 'mtr-v' }, ok ? '--' : '非対応'), u = el('div', { class: 'mtr-u' }, '');
  const node = el(tag, { class: 'mtr' + (ok ? '' : ' na') + (cls ? ' ' + cls : ''), ...(tag === 'button' ? { type: 'button', onclick: onClick } : {}) }, shift, svg, el('div', { class: 'mtr-read' }, v, u), el('div', { class: 'mtr-n' }, d.name));
  const update = (x) => {
    if (!ok) return;
    const cu = currentUnit(d); u.textContent = cu.unit;
    v.textContent = x == null ? '--' : fmt({ ...d, decimals: cu.decimals }, cu.f(x));
    const p = x == null ? 0 : Math.max(0, Math.min(1, (x - d.min) / (d.max - d.min)));
    // 針は初期状態で真上（270 度）を向いているので、目標の角度との差だけ回す
    needle.setAttribute('transform', `rotate(${A0 + SPAN * p - 270} ${CX} ${CY})`);
    fill.setAttribute('d', p > 0.002 ? arc(A0, A0 + SPAN * p) : '');
    // 上限付近の演出：hot（85% 以上）・max（95% 以上）、ピークホールド、シフトランプ
    node.classList.toggle('hot', p >= HOT); node.classList.toggle('max', p >= 0.95);
    node.style.setProperty('--heat', Math.max(0, (p - 0.6) / 0.4).toFixed(3));
    if (x != null && p > peak) { peak = p; peakEl.setAttribute('transform', `rotate(${A0 + SPAN * p - 270} ${CX} ${CY})`); peakEl.classList.add('on'); }
    if (shift) [...shift.children].forEach((s, i) => s.classList.toggle('on', p >= 0.6 + (0.33 * i) / SHIFT_N));
  };
  update(null);
  return { node, update };
}

/** 縦バー（1×2） */
function createTall(d, ok, onClick) {
  const v = el('span', { class: 'v' }, ok ? '--' : '非対応'), u = el('span', { class: 'u' }, '');
  const fill = el('i');
  const node = el('button', { class: 'pid w-tall' + (ok ? '' : ' na'), type: 'button', onclick: onClick },
    el('div', { class: 'n' }, d.name), el('div', { class: 'vbar' }, fill), el('div', { class: 'val' }, v, u));
  const update = (x) => {
    if (!ok) return;
    const cu = currentUnit(d); u.textContent = cu.unit;
    v.textContent = x == null ? '--' : fmt({ ...d, decimals: cu.decimals }, cu.f(x));
    if (x != null) { const pct = Math.max(0, Math.min(100, ((x - d.min) / (d.max - d.min)) * 100)); fill.style.height = `${pct}%`; fill.style.setProperty('--pct', pct); }
  };
  update(null);
  return { node, update };
}

/** グラフ（直近の値の推移。2×1 / 2×2） */
function createGraph(d, ok, onClick, big) {
  const N = big ? 120 : 60; // 保持する点の数
  const hist = [];
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 40'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'gr-svg');
  svg.innerHTML = '<path class="gr-area" d=""/><polyline class="gr-line" points=""/>';
  const line = svg.querySelector('.gr-line'), area = svg.querySelector('.gr-area');
  const v = el('span', { class: 'v' }, ok ? '--' : '非対応'), u = el('span', { class: 'u' }, '');
  const range = el('div', { class: 'gr-range' });
  const node = el('button', { class: 'pid w-graph' + (big ? ' w-graph2' : '') + (ok ? '' : ' na'), type: 'button', onclick: onClick },
    el('div', { class: 'gr-head' }, el('div', { class: 'n' }, d.name), el('div', { class: 'val' }, v, u)), svg, range);
  const update = (x) => {
    if (!ok) return;
    const cu = currentUnit(d); u.textContent = cu.unit;
    v.textContent = x == null ? '--' : fmt({ ...d, decimals: cu.decimals }, cu.f(x));
    if (x == null) return;
    hist.push(x); if (hist.length > N) hist.shift();
    const y = (val) => 40 - Math.max(0, Math.min(1, (val - d.min) / (d.max - d.min))) * 38 - 1;
    const pts = hist.map((val, i) => `${(i / (N - 1)) * 100},${y(val)}`).join(' ');
    line.setAttribute('points', pts);
    area.setAttribute('d', hist.length > 1 ? `M0,40 L${pts.split(' ').join(' L')} L${((hist.length - 1) / (N - 1)) * 100},40 Z` : '');
    const lo = Math.min(...hist), hi = Math.max(...hist);
    const f = (val) => fmt({ ...d, decimals: cu.decimals }, cu.f(val));
    range.textContent = `最小 ${f(lo)} ／ 最大 ${f(hi)}`;
  };
  update(null);
  return { node, update };
}

/**
 * 表示の種類に合わせてブロックを作る
 * @returns {{node: HTMLElement, update: (v:number|null) => void}}
 */
export function createWidget(d, ok, styleId, onClick) {
  const st = findStyle(styleId);
  let w;
  if (st.id === 'meter') w = createMeter(d, ok, { tag: 'button', onClick, cls: 'w-meter' });
  else if (st.id === 'tall') w = createTall(d, ok, onClick);
  else if (st.id === 'graph' || st.id === 'graph2') w = createGraph(d, ok, onClick, st.id === 'graph2');
  else { w = createCard(d, ok, { onClick }); if (st.id === 'big') w.node.classList.add('w-big'); }
  const up = w.update; w.update = (x) => { rememberValue(d.key, x); up(x); };
  w.node.style.gridColumn = `span ${st.w}`; w.node.style.gridRow = `span ${st.h}`;
  w.node.dataset.w = st.w;
  return w;
}
