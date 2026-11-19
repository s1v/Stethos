// UDS 探索画面（設定画面から開く・上級者向け）
// 読み取り専用。車の DID に問い合わせた結果をログに残し、コピーできるようにする
import { $, el, confirmDialog, toast } from '../ui.js';
import { APP_VERSION } from '../version.js';
import { Uds, TARGETS, STD_DIDS, DEFAULT_DIDS, rxOf, nrcText, hexRef, sleep, isRequest } from '../uds.js';

let app_ = null, running = false, uds = null, lines = [];
const hhmmss = () => new Date().toTimeString().slice(0, 8);

function log(s) {
  lines.push(`${hhmmss()} ${s}`);
  const pre = $('uds-log');
  pre.textContent = lines.slice(-400).join('\n');
  pre.scrollTop = pre.scrollHeight;
}
const progress = (s) => { $('uds-progress').textContent = s || ''; };

function setBusy(b) {
  for (const id of ['uds-auto', 'uds-probe', 'uds-man-go', 'uds-dids-go', 'uds-scan-go']) $(id).disabled = b;
  $('uds-stop').hidden = !b;
}

const selected = () => TARGETS.filter((t) => $('uds-t-' + t.hdr).checked);
const maskVin = () => $('uds-mask').checked;

/** 1 回の要求と結果の記録 */
async function ask(hdr, cmd, quiet31 = false) {
  const r = await uds.req(cmd);
  const did = cmd.startsWith('22') ? cmd.slice(2) : '';
  const tag = `${hdr} ${cmd}`;
  if (r.kind === 'pos') {
    if (did === 'F190' && maskVin()) log(`${tag} → 応答あり（VIN は伏せています：${Math.floor(r.data.length / 2)}バイト）`);
    else log(`${tag} → 応答あり ${cmd.startsWith('22') ? '62' + did : ''} ${r.data}  [${hexRef(r.data)}]`);
  } else if (r.kind === 'neg') {
    if (!(quiet31 && r.nrc === '31')) log(`${tag} → 否定応答 7F ${r.nrc}（${nrcText(r.nrc)}）`);
  } else if (r.kind === 'nodata') log(`${tag} → NO DATA`);
  else if (r.kind === 'timeout') log(`${tag} → 時間切れ（応答なし）`);
  else log(`${tag} → ${r.kind} ${r.raw.slice(0, 120)}`);
  return r;
}

function buildHeader() {
  const e = app_.session.elm, s = app_.session;
  return [
    `Stethos UDS 探索ログ  v${APP_VERSION}${s.debug ? '（お試しモード）' : ''}`,
    `日時: ${new Date().toISOString()}`,
    `アダプター: ${e?.version || '-'} ／ 通信方式(ATDPN): ${e?.protocol || '-'}`,
    `間隔: ${$('uds-interval').value}ms ／ 拡張セッション: ${$('uds-ext').checked ? '使う' : '使わない'} ／ VIN: ${maskVin() ? '伏せる' : '伏せない'}`,
    '※ 値の意味・計算式は未確認。「参考」は読み方の目安にすぎません。',
    '----------------------------------------',
  ].join('\n');
}

/** 実行の共通処理：開始前の設定 → 実行 → 設定を元に戻す */
async function run(fn) {
  if (running || !app_.session.elm) return;
  running = true; setBusy(true);
  uds = new Uds(app_.session.elm);
  uds.interval = Number($('uds-interval').value) || 100;
  uds.ext = $('uds-ext').checked;
  let ok = true;
  try { await fn(); } catch (e) { ok = false; log(`エラー: ${e.message || e}`); }
  await restore();
  log(ok ? (uds.stopped ? '--- 停止しました（設定を元に戻しました）---' : '--- 終了（設定を元に戻しました）---') : '--- エラーで終了（設定を元に戻しました）---');
  progress('');
  running = false; setBusy(false);
}

/** アダプターの設定を、探索の前の状態に戻す */
async function restore() {
  if (!uds || !app_.session.elm) return;
  try {
    await uds.raw('ATH0'); await uds.raw('ATCRA');
    if (uds.customProto) {
      await uds.raw('ATSP0');
      try { await app_.session.elm.query('0100', 12000); } catch { /* noop */ }
    } else await uds.raw('ATSH7DF');
  } catch { /* 切断時など */ }
}

async function eachTarget(targets, fn) {
  for (const t of targets) {
    if (uds.stopped) break;
    log(`== ${t.hdr}（${t.name}）→ 受信 ${rxOf(t.hdr)} ==`);
    if (!(await uds.setTarget(t.hdr))) { log('宛先の設定に失敗しました'); continue; }
    const s = await uds.startSession();
    if (s) log(`${t.hdr} 1003 → ${s.kind === 'pos' ? '拡張セッション開始' : s.kind === 'neg' ? '否定応答 7F ' + s.nrc + '（' + nrcText(s.nrc) + '）' : s.kind}`);
    try { await fn(t); } finally { await uds.endSession(); }
  }
}

// 1. 宛先の判定
async function probe() {
  const ts = selected();
  if (!ts.length) { toast('宛先を選んでください', { error: true }); return; }
  const reqs = STD_DIDS.map((d) => '22' + d);
  if ($('uds-dtc').checked) reqs.push('1902FF');
  await run(async () => {
    await uds.raw('ATH1'); // どの ID から返ったかが分かるよう、ヘッダーを表示
    const found = [];
    let n = 0;
    await eachTarget(ts, async (t) => {
      let any = false;
      for (const c of reqs) {
        if (uds.stopped) break;
        progress(`${t.hdr}（${++n}/${ts.length * reqs.length}）`);
        const r = await ask(t.hdr, c);
        if (r.kind === 'pos' || r.kind === 'neg') any = true;
      }
      log(`→ ${t.hdr}: ${any ? '応答あり' : '応答なし'}`);
      if (any) found.push(t.hdr);
    });
    log(`まとめ: 応答のあった宛先 = ${found.length ? found.join(', ') : 'なし'}`);
  });
}

// 手動で 1 件送る（29bit など）
async function manual() {
  const proto = $('uds-man-proto').value, hdr = $('uds-man-hdr').value.trim().toUpperCase();
  const cp = $('uds-man-cp').value.trim().toUpperCase(), cra = $('uds-man-cra').value.trim().toUpperCase();
  const req = $('uds-man-req').value.replace(/\s+/g, '').toUpperCase();
  if (!/^([0-9A-F]{3}|[0-9A-F]{6})$/.test(hdr)) { toast('ヘッダーは 16 進の 3 桁または 6 桁です', { error: true }); return; }
  if (cp && !/^[0-9A-F]{2}$/.test(cp)) { toast('優先度は 16 進 2 桁です', { error: true }); return; }
  if (cra && !/^([0-9A-F]{3}|[0-9A-F]{8})$/.test(cra)) { toast('受信 ID は 16 進の 3 桁または 8 桁です', { error: true }); return; }
  if (!isRequest(req)) { toast('送れる要求は 22xxxx / 1902xx / 1001 / 1003 / 3E00 だけです', { error: true }); return; }
  await run(async () => {
    await uds.raw('ATH1');
    if (proto) { await uds.raw('ATSP' + proto); uds.customProto = true; log(`プロトコルを ${proto} に変更（終了時に自動へ戻します）`); }
    await uds.raw('ATSH' + hdr);
    if (cp) await uds.raw('ATCP' + cp);
    await uds.raw('ATCRA' + (cra || ''));
    log(`手動: プロトコル=${proto || '現状'} ヘッダー=${hdr} 優先度=${cp || '-'} 受信ID=${cra || '指定なし'}`);
    await ask(hdr, req);
  });
}

// 2. 候補 DID の読み取り
function parseDids() {
  const out = [], bad = [];
  for (const l of $('uds-dids').value.split(/\r?\n/)) {
    const t = l.trim(); if (!t) continue;
    const m = /^(?:0x)?([0-9A-Fa-f]{4})(?:\s|$)/.exec(t);
    if (m) { const d = m[1].toUpperCase(); if (!out.includes(d)) out.push(d); } else bad.push(t);
  }
  return { dids: out, bad };
}
async function readDids() {
  const ts = selected(), { dids, bad } = parseDids();
  if (!ts.length) { toast('宛先を選んでください', { error: true }); return; }
  if (!dids.length) { toast('DID がありません', { error: true }); return; }
  if (dids.length > 60) { toast('一度に試せるのは 60 件までです', { error: true }); return; }
  const total = ts.length * dids.length, est = Math.ceil(total * (Number($('uds-interval').value) + 250) / 1000);
  if (!(await confirmDialog(`${ts.map((t) => t.hdr).join('・')} に、DID ${dids.length} 件を読み取ります（合計 ${total} 回、約 ${est} 秒）。\n読み取りだけで、車の設定は変更しません。`, { title: '候補 DID を読み取ります', ok: '開始' }))) return;
  await run(async () => {
    if (bad.length) log(`読み取れない行を無視: ${bad.join(' / ')}`);
    await uds.raw('ATH0');
    let n = 0;
    await eachTarget(ts, async (t) => {
      for (const d of dids) {
        if (uds.stopped) break;
        progress(`${t.hdr} ${d}（${++n}/${total}）`);
        await ask(t.hdr, '22' + d);
      }
    });
  });
}

// 3. 範囲スキャン
async function scan() {
  const hdr = $('uds-scan-target').value;
  const from = parseInt($('uds-scan-from').value, 16), to = parseInt($('uds-scan-to').value, 16);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 0xFFFF || to < from) { toast('範囲は 16 進（0000〜FFFF）で、開始 ≦ 終了にしてください', { error: true }); return; }
  const count = to - from + 1;
  if (count > 4096) { toast('一度にスキャンできるのは 4096 件までです', { error: true }); return; }
  const est = Math.ceil(count * (Number($('uds-interval').value) + 250) / 60000);
  if (!(await confirmDialog(`${hdr} に、${from.toString(16).toUpperCase().padStart(4, '0')}〜${to.toString(16).toUpperCase().padStart(4, '0')} の ${count} 件を順に読み取ります（約 ${est} 分）。\n\n・停車して、エンジンを止めたまま（または READY のまま動かさずに）行ってください\n・読み取りだけで、車の設定は変更しません\n・途中で「停止」できます\n・応答が 10 回続けてないときは自動で止めます`, { title: '範囲スキャンを始めます', ok: '開始' }))) return;
  await run(async () => {
    await uds.raw('ATH0');
    let hit = 0, neg31 = 0, other = 0, silent = 0, n = 0;
    await eachTarget([{ hdr, name: '範囲スキャン' }], async () => {
      for (let d = from; d <= to; d++) {
        if (uds.stopped) break;
        const did = d.toString(16).toUpperCase().padStart(4, '0');
        if (++n % 16 === 0) progress(`${did}（${n}/${count}） 見つかった ${hit} 件`);
        const r = await uds.req('22' + did);
        if (r.kind === 'pos') { hit++; silent = 0; log(`${hdr} 22${did} → 応答あり 62${did} ${r.data}  [${hexRef(r.data)}]`); }
        else if (r.kind === 'neg') {
          silent = 0;
          if (r.nrc === '31') neg31++; else { other++; log(`${hdr} 22${did} → 否定応答 7F ${r.nrc}（${nrcText(r.nrc)}）`); }
        } else if (r.kind === 'timeout' || r.kind === 'nodata' || r.kind === 'none') {
          if (++silent >= 10) { log('応答が 10 回続けてないため、スキャンを中断します'); break; }
        } else { silent = 0; log(`${hdr} 22${did} → ${r.kind} ${r.raw.slice(0, 80)}`); }
      }
    });
    log(`まとめ: 応答あり ${hit} 件 ／ 範囲外(31) ${neg31} 件 ／ その他の否定 ${other} 件 ／ 送信 ${uds.sent} 回`);
  });
}


// 自動調査：ボタン 1 つで、宛先の判定 → 候補 DID の読み取り → 範囲スキャンまで行う
const SCAN_RANGES = { '7E0': [['4000', '40FF'], ['DA00', 'DBFF']], '7E1': [['D900', 'D9FF'], ['4000', '40FF']] };

async function scanRange(hdr, fromH, toH) {
  const from = parseInt(fromH, 16), to = parseInt(toH, 16), count = to - from + 1;
  let hit = 0, silent = 0, n = 0;
  log(`-- 範囲 ${fromH}〜${toH}（${count} 件）--`);
  for (let d = from; d <= to; d++) {
    if (uds.stopped) break;
    const did = d.toString(16).toUpperCase().padStart(4, '0');
    if (++n % 8 === 0) progress(`${hdr} 範囲スキャン ${did}（${n}/${count}） 見つかった ${hit} 件`);
    const r = await uds.req('22' + did);
    if (r.kind === 'pos') { hit++; silent = 0; log(`${hdr} 22${did} → 応答あり 62${did} ${r.data}  [${hexRef(r.data)}]`); }
    else if (r.kind === 'neg') { silent = 0; if (r.nrc !== '31') log(`${hdr} 22${did} → 否定応答 7F ${r.nrc}（${nrcText(r.nrc)}）`); }
    else if (r.kind === 'timeout' || r.kind === 'nodata' || r.kind === 'none') { if (++silent >= 10) { log('応答が 10 回続けてないため、この範囲を中断します'); break; } }
    else { silent = 0; log(`${hdr} 22${did} → ${r.kind} ${r.raw.slice(0, 80)}`); }
  }
  log(`範囲 ${fromH}〜${toH}: 応答あり ${hit} 件`);
}

async function autoRun() {
  const doScan = $('uds-auto-scan').checked;
  const { dids } = parseDids();
  const min = Math.ceil((TARGETS.length * 4 + 2 * dids.length + (doScan ? 1024 : 0)) * (Number($('uds-interval').value) + 250) / 60000);
  if (!(await confirmDialog(`車の ECU に読み取り専用の問い合わせを送り、使えるデータを自動で調べます。\n\n1. どの ECU が応答するか\n2. 応答した ECU で、候補のデータが読めるか${doScan ? '\n3. エンジン・変速機の周辺のデータ番号を順に探す' : ''}\n\n所要時間：最大で約 ${min} 分。途中で停止できます。\n終わったら「ログをコピー」で結果をコピーしてください。`, { title: '調査を開始します', ok: '開始' }))) return;
  await run(async () => {
    const stdReqs = [...STD_DIDS.map((d) => '22' + d), '1902FF'];
    // 1. 宛先の判定
    log('【1/3】どの ECU が応答するかを調べます');
    await uds.raw('ATH1');
    const alive = [];
    let n = 0;
    await eachTarget(TARGETS, async (t) => {
      let any = false;
      for (const c of stdReqs) {
        if (uds.stopped) break;
        progress(`1/3 ECU の判定 ${t.hdr}（${++n}/${TARGETS.length * stdReqs.length}）`);
        const r = await ask(t.hdr, c);
        if (r.kind === 'pos' || r.kind === 'neg') any = true;
      }
      log(`→ ${t.hdr}: ${any ? '応答あり' : '応答なし'}`);
      if (any) alive.push(t);
    });
    log(`応答のあった ECU: ${alive.length ? alive.map((t) => t.hdr).join(', ') : 'なし'}`);
    if (!alive.length || uds.stopped) { if (!alive.length) log('どの ECU からも応答がありませんでした。エンジンがかかっているか、アダプターの挿さりを確認してください。この結果もそのまま共有してください。'); return; }

    // 2. 候補 DID
    log('【2/3】候補のデータ番号（DID）を読みます');
    await uds.raw('ATH0');
    const retry = new Map(); // セッションの問題で読めなかった DID
    n = 0;
    await eachTarget(alive, async (t) => {
      for (const d of dids) {
        if (uds.stopped) break;
        progress(`2/3 候補 DID ${t.hdr} ${d}（${++n}/${alive.length * dids.length}）`);
        const r = await ask(t.hdr, '22' + d);
        if (r.kind === 'neg' && (r.nrc === '7E' || r.nrc === '7F')) { if (!retry.has(t.hdr)) retry.set(t.hdr, []); retry.get(t.hdr).push(d); }
      }
    });
    if (retry.size && !uds.stopped) {
      log('標準のセッションでは読めないデータがあったため、拡張セッションで再度試します');
      uds.ext = true;
      await eachTarget(alive.filter((t) => retry.has(t.hdr)), async (t) => {
        for (const d of retry.get(t.hdr)) { if (uds.stopped) break; progress(`2/3 再試行 ${t.hdr} ${d}`); await ask(t.hdr, '22' + d); }
      });
      uds.ext = $('uds-ext').checked;
    }
    if (!doScan || uds.stopped) return;

    // 3. 範囲スキャン（エンジン・変速機の周辺だけ）
    log('【3/3】データ番号の周辺を順に探します');
    const scanTargets = alive.filter((t) => SCAN_RANGES[t.hdr]);
    if (!scanTargets.length) log('スキャン対象の ECU（7E0・7E1）が応答しなかったため、省略します');
    await eachTarget(scanTargets, async (t) => {
      for (const [a, b] of SCAN_RANGES[t.hdr]) { if (uds.stopped) break; await scanRange(t.hdr, a, b); }
    });
  });
  // 終了後：コピーを試みる（ブラウザによっては拒否されるので、その場合はボタンを押してもらう）
  try { await navigator.clipboard.writeText(buildHeader() + '\n' + lines.join('\n')); toast('調査が終わりました。ログをコピーしました'); }
  catch { toast('調査が終わりました。「ログをコピー」を押してください', { ms: 8000 }); }
  $('uds-log').scrollIntoView({ block: 'center' });
}

async function copyLog() {
  const text = buildHeader() + '\n' + lines.join('\n');
  try { await navigator.clipboard.writeText(text); toast('ログをコピーしました'); return; } catch { /* フォールバック */ }
  const ta = el('textarea', { style: 'position:fixed;left:-999px;top:0' }); ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* noop */ }
  ta.remove(); toast(ok ? 'ログをコピーしました' : 'コピーできませんでした', { error: !ok });
}

export default {
  id: 'uds', title: 'UDS 探索', connected: true,
  init(app) {
    app_ = app;
    const tg = $('uds-targets'), sel = $('uds-scan-target');
    for (const t of TARGETS) {
      tg.append(el('label', { class: 'chk' }, el('input', { type: 'checkbox', id: 'uds-t-' + t.hdr, ...(t.on ? { checked: '' } : {}) }), `${t.hdr}　${t.name}`));
      sel.append(el('option', { value: t.hdr }, `${t.hdr}　${t.name}`));
    }
    $('uds-dids').value = DEFAULT_DIDS;
    $('uds-auto').onclick = autoRun;
    $('uds-probe').onclick = probe; $('uds-man-go').onclick = manual;
    $('uds-dids-go').onclick = readDids; $('uds-scan-go').onclick = scan;
    $('uds-stop').onclick = () => { if (uds) uds.stopped = true; };
    $('uds-copy').onclick = copyLog;
    $('uds-clear').onclick = () => { lines = []; $('uds-log').textContent = ''; };
  },
  async enter() {
    const ok = await confirmDialog('車のコンピューター（ECU）に、読み取り専用の問い合わせを送ります。\n\n・書き込み・消去・設定変更の命令は、このアプリには入っていません\n・停車した安全な場所で、エンジンをかけた状態（READY）で行ってください\n・他の OBD アプリは閉じてください\n・ごくまれに、ECU が一時的なエラーを記録することがあります\n・値の意味や計算式は確認できていないため、結果は参考です', { title: 'UDS 探索（上級者向け）', ok: '理解して開く' });
    if (!ok) app_.show('settings');
  },
  leave() { if (uds) uds.stopped = true; },
};
