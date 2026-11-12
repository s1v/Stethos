// マイページのプリセット一覧（マイページのヘッダーの切り替えボタンから開く）
import { el, sheet, promptDialog, confirmDialog, toast } from '../../ui.js';
import { getPresets, addPreset, updatePreset, removePreset } from '../../storage.js';

/** プリセットの操作（名前の変更・削除） */
async function editPreset(p) {
  const act = await sheet(p.name, (body, done) => {
    body.append(el('button', { class: 'pick-item', type: 'button', onclick: () => done('rename') }, '名前を変更'));
    body.append(el('button', { class: 'pick-item danger', type: 'button', onclick: () => done('remove') }, 'このプリセットを削除'));
  });
  if (act === 'rename') await renamePreset(p);
  else if (act === 'remove') {
    if (await confirmDialog(`「${p.name}」を削除しますか？`, { ok: '削除', danger: true })) { removePreset(p.id); toast('プリセットを削除しました'); }
  }
}

/** プリセットの名前を変更する。変更したら新しい名前、キャンセルなら null */
export async function renamePreset(p) {
  const name = await promptDialog('プリセットの名前', p.name, { ok: '変更' });
  if (!name || name === p.name) return null;
  updatePreset(p.id, { name });
  // 表示中のマイページのプリセットなら、ヘッダーの名前も変える
  if (!document.getElementById('screen-mypage').hidden && currentId === p.id) document.getElementById('hdr-title').textContent = name;
  return name;
}

// 表示中のマイページのプリセット ID（mypage.js が設定）
let currentId = null;
export const setCurrentPresetId = (id) => { currentId = id; };

/** メニューの「マイページ」：一覧の一番上のプリセットをそのまま開く */
export function openFirstPreset(app) {
  app.show('mypage', { presetId: getPresets().presets[0].id });
}

/** 一覧を表示し、選んだプリセットでマイページを開く */
export async function openPresetList(app) {
  for (;;) {
    const { presets } = getPresets();
    const last = document.getElementById('screen-mypage').hidden ? null : currentId; // 表示中のプリセットに印を付ける
    const r = await sheet('マイページ（プリセット）', (body, done) => {
      for (const p of presets) {
        const used = p.slots.filter(Boolean).length;
        body.append(el('div', { class: 'preset-row' + (p.id === last ? ' current' : '') },
          el('button', { class: 'pick-item preset-open', type: 'button', onclick: () => done({ open: p.id }) },
            el('span', {}, p.name), el('span', { class: 'pick-note' }, `${used} 項目`)),
          el('button', { class: 'preset-edit', type: 'button', 'aria-label': `${p.name}を編集`, onclick: () => done({ edit: p }) }, '…')));
      }
      body.append(el('button', { class: 'pick-item preset-add', type: 'button', onclick: () => done({ add: true }) }, '＋ プリセットを追加'));
    });
    if (!r) return;
    if (r.open) { app.show('mypage', { presetId: r.open }); return; }
    if (r.edit) {
      await editPreset(r.edit);
      // 表示中のプリセットを削除したときは、一番上のプリセットに切り替える
      if (!document.getElementById('screen-mypage').hidden && !getPresets().presets.some((x) => x.id === currentId)) openFirstPreset(app);
      continue; // 編集後は一覧に戻る
    }
    if (r.add) {
      const name = await promptDialog('新しいプリセットの名前', `マイページ ${presets.length + 1}`, { ok: '追加' });
      if (name === null) continue;
      const p = addPreset(name || `マイページ ${presets.length + 1}`);
      app.show('mypage', { presetId: p.id });
      return;
    }
  }
}
