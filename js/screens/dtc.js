// 診断情報画面（DTC の一覧・消去）
import { $, el, confirmDialog, toast, busy } from '../ui.js';

let app_;
async function load() {
  const { obd } = app_.session; if (!obd) return;
  const list = $('d-list'); list.innerHTML = ''; list.append(el('p', { class: 'muted' }, '読み込み中…'));
  try {
    const st = await obd.readMonitorStatus();
    $('d-mil').innerHTML = st ? (st.mil ? '<span class="ng">点灯</span>' : '<span class="ok">消灯</span>') : '取得不可';
    const codes = await obd.readDtcs();
    $('d-count').textContent = `${codes.length} 件`;
    list.innerHTML = '';
    if (!codes.length) list.append(el('div', { class: 'card ok' }, '故障コードはありません（異常なし）'));
    for (const c of codes) {
      list.append(el('div', { class: 'dtc' },
        el('div', {}, el('span', { class: 'c' }, c.code), el('span', { class: 'tag' + (c.generic ? '' : ' m') }, c.generic ? '共通' : 'メーカー独自')),
        el('div', { class: 'muted' }, c.generic ? c.description : 'メーカー独自コードのため説明文はありません')));
    }
  } catch (e) {
    list.innerHTML = ''; list.append(el('p', { class: 'err' }, '読み込みに失敗しました：' + e.message));
  }
}

export default {
  id: 'dtc', title: '診断情報', connected: true,
  init(app) {
    app_ = app;
    $('d-reload').onclick = load;
    $('d-clear').onclick = async () => {
      const ok = await confirmDialog('故障コード（DTC）を消去しますか？\n\n・チェックランプが消え、記録された情報（フリーズフレーム等）も消えます\n・原因が直っていなければ再び記録されます\n・エンジン停止（イグニッション ON）の状態で行ってください', { ok: '消去する', danger: true });
      if (!ok) return;
      busy('消去中…');
      try { const r = await app.session.obd.clearDtcs(); busy(null); toast(r ? 'DTC を消去しました' : '消去の応答を確認できませんでした', { error: !r }); }
      catch (e) { busy(null); toast('消去に失敗しました：' + e.message, { error: true }); }
      load();
    };
  },
  enter() { load(); },
};
