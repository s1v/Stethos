// 診断情報画面（DTC の一覧・消去）
import { $, el, confirmDialog, toast, busy } from '../ui.js';

let app_;

function setSummary(state, icon, text) {
  $('d-summary').className = 'summary ' + state;
  $('d-icon').textContent = icon;
  $('d-state').textContent = text;
}

async function load() {
  const { obd } = app_.session; if (!obd) return;
  const list = $('d-list'); list.innerHTML = ''; list.append(el('p', { class: 'muted' }, '読み込み中…'));
  setSummary('unk', '…', '読み込み中');
  $('d-count').textContent = '-'; $('d-mil').textContent = '-';
  try {
    const st = await obd.readMonitorStatus();
    $('d-mil').innerHTML = st ? (st.mil ? '<span class="ng">点灯</span>' : '<span class="ok">消灯</span>') : '取得不可';
    const codes = await obd.readDtcs('03');
    // 保留中（Mode 07）・永久（Mode 0A）は、対応していない車もあるので失敗しても続ける
    const pending = await obd.readDtcs('07').catch(() => []);
    const permanent = await obd.readDtcs('0A').catch(() => []);
    $('d-count').textContent = `${codes.length} 件`;
    if (st?.mil) setSummary('ng', '!', `要点検：故障コード ${codes.length} 件`);
    else if (codes.length) setSummary('warn', '!', `故障コード ${codes.length} 件`);
    else if (pending.length) setSummary('warn', '!', `保留中の故障コード ${pending.length} 件`);
    else setSummary('ok', '✓', '異常なし');
    list.innerHTML = '';
    const section = (title, note, items, empty) => {
      list.append(el('h3', { class: 'dtc-h' }, `${title}（${items.length} 件）`), el('p', { class: 'muted small dtc-note' }, note));
      if (!items.length) { list.append(el('div', { class: 'empty' }, empty)); return; }
      for (const c of items) {
        list.append(el('div', { class: 'dtc' },
          el('div', {}, el('span', { class: 'c' }, c.code), el('span', { class: 'tag' + (c.generic ? '' : ' m') }, c.generic ? '共通' : 'メーカー独自')),
          el('div', { class: 'muted' }, c.generic ? c.description : 'メーカー独自コードのため説明文はありません')));
      }
    };
    section('記録された故障コード', '車が故障と判断して記録したコードです。チェックランプが点く原因になります。', codes, '故障コードは記録されていません。');
    section('保留中の故障コード', '異常を 1 回検出したものの、まだ故障と確定していないコードです。同じ異常が続くと「記録された故障コード」になります。', pending, '保留中の故障コードはありません。');
    section('永久故障コード', '消去の操作では消えない記録です。原因が直り、車が自己診断で問題なしと確認すると、自動で消えます。', permanent, '永久故障コードはありません。');
  } catch (e) {
    setSummary('unk', '?', '読み込みに失敗しました');
    list.innerHTML = ''; list.append(el('p', { class: 'err' }, '読み込みに失敗しました：' + e.message));
  }
}

export default {
  id: 'dtc', title: '診断情報', connected: true,
  init(app) {
    app_ = app;
    $('d-reload').onclick = load;
    $('d-clear').onclick = async () => {
      const ok = await confirmDialog('・チェックランプが消え、記録された情報（保留中の故障コード・フリーズフレーム等）も消えます\n・永久故障コードは消えません\n・原因が直っていなければ再び記録されます\n・エンジン停止（イグニッション ON）の状態で行ってください', { title: '故障コード（DTC）を消去しますか？', ok: '消去する', danger: true });
      if (!ok) return;
      busy('消去中…');
      try { const r = await app.session.obd.clearDtcs(); busy(null); toast(r ? 'DTC を消去しました' : '消去の応答を確認できませんでした', { error: !r }); }
      catch (e) { busy(null); toast('消去に失敗しました：' + e.message, { error: true }); }
      load();
    };
  },
  enter() { load(); },
};
