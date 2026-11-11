// Mode 01 の PID 定義（データとして管理。ステータス画面・将来のカスタム画面で共通利用）
// pid: 16進2桁 / bytes: データバイト数 / calc: (A,B,C,D) => 値 / min,max: 表示範囲 / decimals: 小数桁 / desc: 説明（? ボタンで表示）
export const PID_GROUPS = [
  { id: 'drive', label: '走行' },
  { id: 'temp', label: '温度' },
  { id: 'air', label: '吸気・過給' },
  { id: 'fuel', label: '燃料' },
  { id: 'elec', label: '電気' },
  { id: 'other', label: 'その他' },
];

export const PIDS = [
  { pid: '0D', key: 'speed', name: '車速', unit: 'km/h', bytes: 1, calc: (A) => A, min: 0, max: 200, decimals: 0, group: 'drive',
    desc: 'エンジン制御コンピューター（ECU）が認識している車の速度です。メーターの表示と少しずれることがあります。' },
  { pid: '0C', key: 'rpm', name: 'エンジン回転数', unit: 'rpm', bytes: 2, calc: (A, B) => (A * 256 + B) / 4, min: 0, max: 7000, decimals: 0, group: 'drive',
    desc: 'エンジンが 1 分間に何回転しているかです。アイドリング中はおおむね 600〜900 rpm 前後です。ハイブリッド車ではエンジン停止中は 0 になります。' },
  { pid: '04', key: 'load', name: 'エンジン負荷', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'エンジンが出せる力のうち、今どのくらいを使っているかの目安です。加速や登り坂で高くなります。' },
  { pid: '11', key: 'throttle', name: 'スロットル開度', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'エンジンに空気を取り込む弁（スロットル）の開き具合です。アクセルを踏むほど大きくなります。全閉でも 0% にならない車もあります。' },

  { pid: '05', key: 'coolant', name: '冷却水温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 130, decimals: 0, group: 'temp',
    desc: 'エンジンを冷やす冷却水の温度です。暖機後はおおむね 80〜100°C 前後で安定します。大きく超える場合はオーバーヒートに注意してください。' },
  { pid: '0F', key: 'iat', name: '吸気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 80, decimals: 0, group: 'temp',
    desc: 'エンジンが吸い込む空気の温度です。外気温より少し高めになるのが普通で、渋滞中などは上がりやすくなります。' },
  { pid: '46', key: 'ambient', name: '外気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 60, decimals: 0, group: 'temp',
    desc: '車の外の気温です。停車中は路面やエンジンの熱で高めに出ることがあります。' },
  { pid: '3C', key: 'cat11', name: '触媒温度 B1S1', unit: '°C', bytes: 2, calc: (A, B) => (A * 256 + B) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp',
    desc: '排気ガスをきれいにする触媒の温度（推定値の車もあります）。数百°C になるのが普通です。B1S1 はバンク 1・センサー 1 の意味です。' },
  { pid: '5C', key: 'oil', name: 'エンジンオイル温度', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 150, decimals: 0, group: 'temp',
    desc: 'エンジンオイルの温度です。冷却水より遅れて上がります。対応している車は多くありません。' },

  { pid: '10', key: 'maf', name: '吸入空気量（MAF）', unit: 'g/s', bytes: 2, calc: (A, B) => (A * 256 + B) / 100, min: 0, max: 200, decimals: 1, group: 'air',
    desc: 'エンジンが 1 秒間に吸い込んでいる空気の重さです。アクセルを踏むほど増えます。燃費の計算にも使われます。' },
  { pid: '0B', key: 'map', name: '吸気圧（MAP）', unit: 'kPa', bytes: 1, calc: (A) => A, min: 0, max: 255, decimals: 0, group: 'air',
    desc: 'エンジンの吸気管の中の圧力（絶対圧）です。ターボ車では過給がかかると大気圧（約 101 kPa）より高くなります。' },
  { pid: '33', key: 'baro', name: '大気圧', unit: 'kPa', bytes: 1, calc: (A) => A, min: 70, max: 110, decimals: 0, group: 'air',
    desc: '車が測っている周りの気圧です。平地でおよそ 101 kPa、標高が高いほど低くなります。' },

  { pid: '06', key: 'stft1', name: '短期燃料補正 B1', unit: '%', bytes: 1, calc: (A) => A * 100 / 128 - 100, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: 'ECU が今この瞬間に燃料の量をどれだけ増減しているかです。0% を中心に細かく揺れるのが正常です。' },
  { pid: '07', key: 'ltft1', name: '長期燃料補正 B1', unit: '%', bytes: 1, calc: (A) => A * 100 / 128 - 100, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: 'ECU が学習した燃料の量の補正です。おおむね ±10% 以内が目安で、大きくずれている場合は吸気漏れなどの可能性があります。' },
  { pid: '14', key: 'o2b1s1', name: 'O2 センサー B1S1', unit: 'V', bytes: 2, calc: (A) => A / 200, min: 0, max: 1.275, decimals: 3, group: 'fuel',
    desc: '排気ガス中の酸素を測るセンサー（触媒の前）の電圧です。正常なら 0.1〜0.9 V の間で素早く上下します。' },
  { pid: '15', key: 'o2b1s2', name: 'O2 センサー B1S2', unit: 'V', bytes: 2, calc: (A) => A / 200, min: 0, max: 1.275, decimals: 3, group: 'fuel',
    desc: '触媒の後ろにある酸素センサーの電圧です。触媒が正常なら、あまり大きく揺れずに安定します。' },
  { pid: '2F', key: 'fuel', name: '燃料残量', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'fuel',
    desc: '燃料タンクの残量の割合です。対応していない車も多くあります。' },

  { pid: '42', key: 'volt', name: 'ECU 電圧', unit: 'V', bytes: 2, calc: (A, B) => (A * 256 + B) / 1000, min: 10, max: 16, decimals: 2, group: 'elec',
    desc: 'エンジン制御コンピューターに届いている電圧（ほぼバッテリー電圧）です。エンジン作動中はおおむね 13.5〜14.7 V、停止中は 12.4 V 前後が目安です。' },

  { pid: '1F', key: 'runtime', name: 'エンジン稼働時間', unit: 's', bytes: 2, calc: (A, B) => A * 256 + B, min: 0, max: 65535, decimals: 0, group: 'other', format: 'duration',
    desc: '今回エンジンを始動してからの経過時間（時:分:秒）です。' },
];

// 他の PID から計算する項目
export const DERIVED = [
  { key: 'boost', name: 'ブースト圧', unit: 'kPa', needs: ['map', 'baro'], calc: (v) => v.map - v.baro, min: -100, max: 150, decimals: 0, group: 'air', fallbackBaro: 101,
    desc: '吸気圧（MAP）から大気圧を引いた値で、ターボがどれだけ空気を押し込んでいるかを表します。マイナスは負圧（アクセルを戻しているとき）です。大気圧が取れない車は 101 kPa として計算します。' },
];

/** 車が対応している表示項目の数（ホーム画面用） */
export function countDisplayable(isSupported) {
  const pidOk = PIDS.filter((p) => isSupported(p.pid));
  const keys = new Set(pidOk.map((p) => p.key));
  const derivedOk = DERIVED.filter((d) => d.needs.every((k) => keys.has(k) || (k === 'baro' && keys.has('map'))));
  return { supported: pidOk.length + derivedOk.length, total: PIDS.length + DERIVED.length };
}
