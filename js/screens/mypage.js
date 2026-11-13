// マイページ（利用者が選んだ項目を好きな位置に並べるカスタム画面）
// 枠（slots）の中身：null（空）／ 'key'（旧形式＝数値 1×1）／ { key, style }（表示の種類つき）
import { $, el, keepAwake, sheet, setRate } from '../ui.js';
import { PID_GROUPS, ALL_ITEMS, findItem, isItemSupported } from '../config/pids.js';
import { getPreset, updatePreset, setLastPreset } from '../storage.js';
import { resolveTargets, startPolling } from '../poller.js';
import { showHelp, unitChoices } from './parts/pid-card.js';
import { setCurrentPresetId } from './parts/presets.js';
import { createWidget, stylesFor, findStyle } from './parts/widgets.js';

let stop = () => {};
let app_ = null;
let slots = [];
let presetId = null;
let ro = null;

const slotOf = (x) => (!x ? null : typeof x === 'string' ? { key: x, style: 'card' } : x);

/** 項目を選ぶシート（車が対応していない項目は選べない） */
function pickItem(title) {
  const sup = (pid) => app_.session.obd.isSupported(pid);
  const used = new Set(slots.map(slotOf).filter(Boolean).map((s) => s.key));
  return sheet(title, (body, done) => {
    // カテゴリごとに折りたたむ（初期状態はすべて閉じる）
    for (const g of PID_GROUPS) {
      const items = ALL_ITEMS.filter((d) => d.group === g.id);
      if (!items.length) continue;
      const okCount = items.filter((d) => isItemSupported(d, sup)).length;
      const list = el('div', { class: 'pick-list' });
      for (const d of items) {
        const ok = isItemSupported(d, sup);
        list.append(el('button', { class: 'pick-item' + (ok ? '' : ' na'), type: 'button', disabled: ok ? null : '', onclick: () => done(d.key) },
          el('span', {}, d.name), el('span', { class: 'pick-note' }, !ok ? '非対応' : used.has(d.key) ? '配置済み' : d.unit && !d.format ? d.unit : '')));
      }
      body.append(el('details', { class: 'pick-cat' }, el('summary', {}, el('span', {}, g.label), el('span', { class: 'pick-note' }, `${okCount} / ${items.length}`)), list));
    }
  });
}

/** 表示の種類を選ぶシート（マス数の目安を図で表示） */
function pickStyle(d, current) {
  return sheet(`表示の種類：${d.name}`, (body, done) => {
    for (const s of stylesFor(d)) {
      const cells = el('span', { class: 'sz', style: `grid-template-columns:repeat(${s.w},10px)`, 'aria-hidden': 'true' }, ...Array.from({ length: s.w * s.h }, () => el('i')));
      body.append(el('button', { class: 'pick-item style-item' + (s.id === current ? ' current' : ''), type: 'button', onclick: () => done(s.id) },
        cells, el('span', {}, s.label), el('span', { class: 'pick-note' }, `${s.w}×${s.h} マス`)));
    }
  });
}

/** 配置済みの枠をタップしたときの操作 */
function slotMenu(d) {
  // 単位を切り替えられる項目は、詳細画面で単位も変えられることを示す
  const helpLabel = unitChoices(d).length > 1 ? '説明を見る・単位変更' : '説明を見る';
  return sheet(d.name, (body, done) => {
    for (const [id, label, cls] of [['help', helpLabel, ''], ['style', '表示の種類を変更', ''], ['change', '別の項目に変更', ''], ['remove', 'この枠から外す', ' danger']]) {
      body.append(el('button', { class: 'pick-item' + cls, type: 'button', onclick: () => done(id) }, label));
    }
  });
}

function save() { updatePreset(presetId, { slots }); }

/** 項目を選んでから表示の種類を選ぶ。キャンセルなら null */
async function choose(title) {
  const k = await pickItem(title); if (!k) return null;
  const d = findItem(k);
  const opts = stylesFor(d);
  const style = opts.length > 1 ? await pickStyle(d, 'card') : 'card';
  return style ? { key: k, style } : null;
}

/** 列の数とマスの大きさを画面幅から決める（正方形のマスにそろえるため） */
function layout() {
  const grid = $('mp-grid'); if (!grid.isConnected || !grid.clientWidth) return;
  const pz = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pz')) || 1;
  const gap = 6, min = 104 * pz, W = grid.clientWidth;
  const cols = Math.max(2, Math.floor((W + gap) / (min + gap)));
  const cell = (W - gap * (cols - 1)) / cols;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridAutoRows = `${cell}px`;
}

function render() {
  stop();
  const { obd } = app_.session;
  const sup = (pid) => obd.isSupported(pid);
  const grid = $('mp-grid'); grid.innerHTML = '';
  const cards = {};
  slots.forEach((raw, i) => {
    const s = slotOf(raw);
    const d = s && findItem(s.key);
    if (!d) {
      grid.append(el('button', { class: 'pid slot-empty', type: 'button', 'aria-label': '項目を追加', onclick: async () => {
        const r = await choose('配置する項目を選ぶ'); if (!r) return;
        slots[i] = r; save(); render();
      } }, el('span', { class: 'plus' }, '+'), el('span', { class: 'small muted' }, '項目を追加')));
      return;
    }
    const ok = isItemSupported(d, sup);
    // 文字の項目に後から使えない種類が残っていたら数値に戻す
    const style = stylesFor(d).some((x) => x.id === s.style) ? s.style : 'card';
    const c = createWidget(d, ok, style, async () => {
      const act = await slotMenu(d);
      if (act === 'help') showHelp(d, ok);
      else if (act === 'style') { const st = await pickStyle(d, style); if (st) { slots[i] = { key: d.key, style: st }; save(); render(); } }
      else if (act === 'change') { const r = await choose('別の項目を選ぶ'); if (r) { slots[i] = r; save(); render(); } }
      else if (act === 'remove') { slots[i] = null; save(); render(); }
    });
    (cards[d.key] ||= []).push(c);
    grid.append(c.node);
  });
  layout();
  const targets = resolveTargets(Object.keys(cards), obd);
  setRate(null);
  stop = startPolling(app_.session, targets, (k, v) => cards[k]?.forEach((c) => c.update(v)), setRate);
}

export default {
  id: 'mypage', title: 'マイページ', connected: true,
  // ヘッダーの「?」で表示する説明
  help: {
    title: 'マイページの使い方',
    text: '好きな項目を並べられる自分専用の画面です。\n\n・空の枠（＋）：項目を配置\n・配置した項目：説明・単位／表示の種類／別の項目に変更／外す\n・右上の切り替えボタン：プリセットの切り替え・追加・名前変更・削除\n・「枠を追加」：3 枠ずつ増やす\n\n配置は端末に保存されます。リセットは「設定」から。',
  },
  init(app) {
    app_ = app;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(() => layout()); ro.observe($('mp-grid')); }
    $('mp-add').onclick = () => { slots.push(null, null, null); save(); render(); };
  },
  enter(app, params = {}) {
    const p = getPreset(params.presetId);
    presetId = p.id; slots = [...p.slots];
    setLastPreset(p.id); setCurrentPresetId(p.id);
    $('hdr-title').textContent = p.name; // ヘッダーにプリセット名を表示
    render();
    keepAwake(true);
  },
  leave() { stop(); keepAwake(false); setCurrentPresetId(null); },
};
