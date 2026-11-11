// 表示項目の定義（データとして管理。ステータス画面・将来のカスタム画面で共通利用）
// pid: Mode 01 の PID（16進2桁） / cmd: PID 以外のコマンド（ATRV など）
// bytes: データバイト数 / calc: (A,B,C,D) => 値 / min,max: 表示範囲 / decimals: 小数桁
// format: 'duration'（秒→時:分:秒） / 'enum'（enum の対応表で文字表示）
// mask: 先頭 1 バイトが「どのセンサーの値があるか」のビット（値は B 以降）
// desc: 説明（ステータス画面でタップすると表示）
// min,max はインジケーター（バー）の両端。規格上の範囲ではなく、一般的な車で実際に取りうる範囲を目安に設定している
// DERIVED の needs は必須の項目、optional は取れれば使う項目
export const PID_GROUPS = [
  { id: 'drive', label: '走行' },
  { id: 'engine', label: 'エンジン' },
  { id: 'battery', label: 'バッテリー・電気' },
  { id: 'temp', label: '温度' },
  { id: 'air', label: '吸気・過給' },
  { id: 'fuel', label: '燃料' },
  { id: 'exhaust', label: '排ガス・O2 センサー' },
  { id: 'history', label: '距離・時間' },
  { id: 'info', label: '車両情報' },
];

const pct = (A) => A * 100 / 255;
const ab = (A, B) => A * 256 + B;
const s16 = (A, B) => (((A << 8) | B) << 16) >> 16;
const trim = (A) => A * 100 / 128 - 100;
const BANK = ['B1S1', 'B1S2', 'B1S3', 'B1S4', 'B2S1', 'B2S2', 'B2S3', 'B2S4'];
const BANK_NOTE = 'B はバンク（V 型エンジンの左右の列。直列エンジンはバンク 1 のみ）、S はセンサーの位置（1 が触媒の前、2 が触媒の後ろ）です。';

export const PIDS = [
  // ---- 走行 ----
  { pid: '0D', key: 'speed', name: '車速', unit: 'km/h', bytes: 1, calc: (A) => A, min: 0, max: 200, decimals: 0, group: 'drive',
    desc: 'エンジン制御コンピューター（ECU）が認識している車の速度です。メーターの表示と少しずれることがあります。' },
  { pid: '0C', key: 'rpm', name: 'エンジン回転数', unit: 'rpm', bytes: 2, calc: (A, B) => ab(A, B) / 4, min: 0, max: 7000, decimals: 0, group: 'drive',
    desc: 'エンジンが 1 分間に何回転しているかです。アイドリング中はおおむね 600〜900 rpm です。ハイブリッド車はエンジン停止中 0 になります。' },
  { pid: '11', key: 'throttle', name: 'スロットル開度', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'エンジンに空気を取り込む弁（スロットル）の開き具合です。アクセルを踏むほど大きくなります。全閉でも 0% にならない車もあります。' },
  { pid: '49', key: 'pedalD', name: 'アクセルペダル位置 D', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'アクセルペダルの踏み込み量を測るセンサー（D）の値です。安全のため複数のセンサーで測っており、離した状態でも 0% にならないのが普通です。' },
  { pid: '4A', key: 'pedalE', name: 'アクセルペダル位置 E', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'アクセルペダルの 2 つ目のセンサー（E）の値です。D と比べて異常がないか確認するために使われます。' },
  { pid: '4B', key: 'pedalF', name: 'アクセルペダル位置 F', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'アクセルペダルの 3 つ目のセンサー（F）の値です。' },
  { pid: '5A', key: 'pedalRel', name: 'アクセル踏み込み量（相対）', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'アクセルペダルを離した位置を 0% としたときの踏み込み量です。' },
  { pid: '45', key: 'throttleRel', name: 'スロットル開度（相対）', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'スロットルの全閉位置を基準にした開き具合です。' },
  { pid: '47', key: 'throttleB', name: 'スロットル位置 B', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'スロットル位置を測る 2 つ目のセンサー（B）の値です。' },
  { pid: '48', key: 'throttleC', name: 'スロットル位置 C', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'スロットル位置を測る 3 つ目のセンサー（C）の値です。' },
  { pid: '8D', key: 'throttleG', name: 'スロットル位置 G', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'スロットル位置を測るセンサー（G）の値です。' },
  { pid: '4C', key: 'throttleCmd', name: 'スロットル指令値', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'drive',
    desc: 'ECU がスロットルを「このくらい開けて」と指示している値です。電子制御スロットルの車で使われます。' },

  // ---- エンジン ----
  { pid: '04', key: 'load', name: 'エンジン負荷', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'engine',
    desc: 'エンジンが出せる力のうち、今どのくらいを使っているかの目安です。加速や登り坂で高くなります。' },
  { pid: '43', key: 'loadAbs', name: 'エンジン負荷（絶対値）', unit: '%', bytes: 2, calc: (A, B) => ab(A, B) * 100 / 255, min: 0, max: 400, decimals: 0, group: 'engine',
    desc: '1 回の吸気で取り込んだ空気の量から計算した負荷です。ターボ車では 100% を超えることがあります。' },
  { pid: '0E', key: 'timing', name: '点火時期', unit: '°', bytes: 1, calc: (A) => A / 2 - 64, min: -20, max: 50, decimals: 1, group: 'engine',
    desc: 'ピストンが一番上に来る前の、何度の位置で点火しているか（進角）です。ノッキングを検知すると小さくなります。' },
  { pid: '61', key: 'torqueDemand', name: '要求トルク', unit: '%', bytes: 1, calc: (A) => A - 125, min: -125, max: 130, decimals: 0, group: 'engine',
    desc: 'ドライバーのアクセル操作から ECU が決めた「出してほしい力」の割合です。' },
  { pid: '62', key: 'torqueActual', name: '実トルク', unit: '%', bytes: 1, calc: (A) => A - 125, min: -125, max: 130, decimals: 0, group: 'engine',
    desc: 'エンジンが実際に出している力の割合（基準トルクに対する %）です。' },
  { pid: '63', key: 'torqueRef', name: '基準トルク', unit: 'Nm', bytes: 2, calc: ab, min: 0, max: 1000, decimals: 0, group: 'engine',
    desc: '要求トルク・実トルクの % の基準になるトルクの値です。車ごとに固定です。' },
  { pid: '8E', key: 'torqueFriction', name: 'フリクショントルク', unit: '%', bytes: 1, calc: (A) => A - 125, min: -125, max: 130, decimals: 0, group: 'engine',
    desc: 'エンジン内部の摩擦などで失われている力の割合です。' },
  { pid: '5D', key: 'injTiming', name: '燃料噴射時期', unit: '°', bytes: 2, calc: (A, B) => ab(A, B) / 128 - 210, min: -210, max: 302, decimals: 1, group: 'engine',
    desc: '燃料を噴射するタイミング（クランク角度）です。主にディーゼル車で使われます。' },
  { pid: 'A2', key: 'cylFuelRate', name: 'シリンダー燃料量', unit: 'mg/st', bytes: 2, calc: (A, B) => ab(A, B) / 32, min: 0, max: 100, decimals: 1, group: 'engine',
    desc: '1 回の燃焼（1 ストローク）あたりに噴射している燃料の量です。' },

  // ---- バッテリー・電気 ----
  { cmd: 'ATRV', key: 'adapterVolt', name: 'バッテリー電圧（アダプター測定）', unit: 'V', calc: (v) => v, min: 10, max: 16, decimals: 1, group: 'battery',
    desc: 'アダプターが OBD ポートで測った電圧で、ほぼ 12V バッテリーの電圧です。全ての車で表示できます。\n\n目安：\n・エンジン停止中：12.6 V 以上で満充電、12.2 V 以下は充電不足\n・エンジン作動中：13.5〜14.7 V なら充電されています\n・始動の瞬間に 9.6 V を下回る場合はバッテリーの弱りが疑われます' },
  { pid: '42', key: 'volt', name: 'ECU 電圧', unit: 'V', bytes: 2, calc: (A, B) => ab(A, B) / 1000, min: 10, max: 16, decimals: 2, group: 'battery',
    desc: 'エンジン制御コンピューターに届いている電圧（ほぼバッテリー電圧）です。エンジン作動中はおおむね 13.5〜14.7 V、停止中は 12.4 V 前後が目安です。' },
  { pid: '5B', key: 'hvBattery', name: 'ハイブリッドバッテリー残量', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'battery',
    desc: 'ハイブリッド車・PHEV の駆動用バッテリーの残量です。対応している車は限られます（メーカー独自の方法でしか読めない車も多くあります）。' },

  // ---- 温度 ----
  { pid: '05', key: 'coolant', name: '冷却水温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 130, decimals: 0, group: 'temp',
    desc: 'エンジンを冷やす冷却水の温度です。暖機後はおおむね 80〜100°C で安定します。大きく超える場合はオーバーヒートに注意してください。' },
  { pid: '67', key: 'coolant2', name: '冷却水温（センサー A）', unit: '°C', bytes: 3, mask: true, calc: (A, B) => B - 40, min: -40, max: 130, decimals: 0, group: 'temp',
    desc: '冷却水温センサーが複数ある車での、センサー A の値です。' },
  { pid: '5C', key: 'oil', name: 'エンジンオイル温度', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 150, decimals: 0, group: 'temp',
    desc: 'エンジンオイルの温度です。冷却水より遅れて上がります。対応している車は多くありません。' },
  { pid: '0F', key: 'iat', name: '吸気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 80, decimals: 0, group: 'temp',
    desc: 'エンジンが吸い込む空気の温度です。外気温より少し高めになるのが普通で、渋滞中などは上がりやすくなります。' },
  { pid: '68', key: 'iat2', name: '吸気温（センサー A）', unit: '°C', bytes: 3, mask: true, calc: (A, B) => B - 40, min: -40, max: 80, decimals: 0, group: 'temp',
    desc: '吸気温センサーが複数ある車での、センサー A の値です。' },
  { pid: '46', key: 'ambient', name: '外気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 60, decimals: 0, group: 'temp',
    desc: '車の外の気温です。停車中は路面やエンジンの熱で高めに出ることがあります。' },
  ...['3C', '3D', '3E', '3F'].map((pid, i) => ({
    pid, key: `cat${i}`, name: `触媒温度 ${['B1S1', 'B2S1', 'B1S2', 'B2S2'][i]}`, unit: '°C', bytes: 2, calc: (A, B) => ab(A, B) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp',
    desc: `排気ガスをきれいにする触媒の温度（推定値の車もあります）。数百°C になるのが普通です。${BANK_NOTE}`,
  })),
  { pid: '78', key: 'egt1', name: '排気温度 バンク1', unit: '°C', bytes: 9, mask: true, calc: (A, B, C) => ab(B, C) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp',
    desc: '排気ガスの温度（バンク 1 の 1 つ目のセンサー）です。主にディーゼル車・ターボ車で使われます。' },
  { pid: '79', key: 'egt2', name: '排気温度 バンク2', unit: '°C', bytes: 9, mask: true, calc: (A, B, C) => ab(B, C) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp',
    desc: '排気ガスの温度（バンク 2 の 1 つ目のセンサー）です。' },
  { pid: '7C', key: 'dpfTemp', name: 'DPF 温度', unit: '°C', bytes: 2, calc: (A, B) => ab(A, B) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp',
    desc: 'ディーゼル車のすす除去フィルター（DPF）の温度です。再生（すすを焼き切る処理）中は高くなります。' },

  // ---- 吸気・過給 ----
  { pid: '10', key: 'maf', name: '吸入空気量（MAF）', unit: 'g/s', bytes: 2, calc: (A, B) => ab(A, B) / 100, min: 0, max: 200, decimals: 1, group: 'air',
    desc: 'エンジンが 1 秒間に吸い込んでいる空気の重さです。アクセルを踏むほど増えます。燃費の計算にも使われます。' },
  { pid: '66', key: 'maf2', name: '吸入空気量（センサー A）', unit: 'g/s', bytes: 5, mask: true, calc: (A, B, C) => ab(B, C) / 32, min: 0, max: 200, decimals: 1, group: 'air',
    desc: '吸入空気量センサーが複数ある車での、センサー A の値です。' },
  { pid: '0B', key: 'map', name: '吸気圧（MAP）', unit: 'kPa', bytes: 1, calc: (A) => A, min: 0, max: 255, decimals: 0, group: 'air',
    desc: 'エンジンの吸気管の中の圧力（絶対圧）です。ターボ車では過給がかかると大気圧（約 101 kPa）より高くなります。' },
  { pid: '33', key: 'baro', name: '大気圧', unit: 'kPa', bytes: 1, calc: (A) => A, min: 70, max: 110, decimals: 0, group: 'air',
    desc: '車が測っている周りの気圧です。平地でおよそ 101 kPa、標高が高いほど低くなります。' },
  { pid: '74', key: 'turboRpm', name: 'ターボ回転数', unit: 'rpm', bytes: 5, mask: true, calc: (A, B, C) => ab(B, C) * 10, min: 0, max: 250000, decimals: 0, group: 'air',
    desc: 'ターボチャージャーのタービンの回転数です。数万〜20 万 rpm 以上で回ります。対応している車は少数です。' },
  { pid: '73', key: 'exhPress', name: '排気圧力', unit: 'kPa', bytes: 5, mask: true, calc: (A, B, C) => ab(B, C) / 100, min: 0, max: 400, decimals: 1, group: 'air',
    desc: '排気管の中の圧力（バンク 1）です。' },
  { pid: '2C', key: 'egrCmd', name: 'EGR 指令値', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'air',
    desc: '排気ガスの一部を吸気に戻す装置（EGR）のバルブを、ECU がどのくらい開けるよう指示しているかです。' },
  { pid: '2D', key: 'egrErr', name: 'EGR 誤差', unit: '%', bytes: 1, calc: trim, min: -100, max: 100, decimals: 1, group: 'air',
    desc: 'EGR バルブの実際の開度と指令値とのずれです。0% に近いほど正常です。' },

  // ---- 燃料 ----
  { pid: '2F', key: 'fuel', name: '燃料残量', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'fuel',
    desc: '燃料タンクの残量の割合です。対応していない車も多くあります。' },
  { pid: '5E', key: 'fuelRate', name: '燃料消費量', unit: 'L/h', bytes: 2, calc: (A, B) => ab(A, B) / 20, min: 0, max: 30, decimals: 2, group: 'fuel',
    desc: '1 時間あたりに消費している燃料の量です。アイドリング中は 1 L/h 前後のことが多いです。' },
  { pid: '06', key: 'stft1', name: '短期燃料補正 B1', unit: '%', bytes: 1, calc: trim, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: 'ECU が今この瞬間に燃料の量をどれだけ増減しているかです（バンク 1）。0% を中心に細かく揺れるのが正常です。' },
  { pid: '07', key: 'ltft1', name: '長期燃料補正 B1', unit: '%', bytes: 1, calc: trim, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: 'ECU が学習した燃料の量の補正です（バンク 1）。おおむね ±10% 以内が目安で、大きくずれている場合は吸気漏れなどの可能性があります。' },
  { pid: '08', key: 'stft2', name: '短期燃料補正 B2', unit: '%', bytes: 1, calc: trim, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: '短期燃料補正のバンク 2（V 型エンジンのもう一方の列）の値です。' },
  { pid: '09', key: 'ltft2', name: '長期燃料補正 B2', unit: '%', bytes: 1, calc: trim, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: '長期燃料補正のバンク 2 の値です。' },
  ...['55', '56', '57', '58'].map((pid, i) => ({
    pid, key: `o2trim${i}`, name: `第2 O2 燃料補正 ${['短期 B1', '長期 B1', '短期 B2', '長期 B2'][i]}`, unit: '%', bytes: 2, calc: trim, min: -25, max: 25, decimals: 1, group: 'fuel',
    desc: '触媒の後ろの O2 センサーの値を使った燃料の補正です。0% に近いほど正常です。',
  })),
  { pid: '44', key: 'lambdaCmd', name: '目標空燃比（λ）', unit: 'λ', bytes: 2, calc: (A, B) => ab(A, B) * 2 / 65536, min: 0.5, max: 1.5, decimals: 3, group: 'fuel',
    desc: 'ECU が狙っている空気と燃料の比率です。1.000 が理想的な比率（ガソリン 1 に対して空気約 14.7）で、1 より小さいと燃料が濃い状態です。' },
  { pid: '0A', key: 'fuelPress', name: '燃料圧力', unit: 'kPa', bytes: 1, calc: (A) => A * 3, min: 0, max: 765, decimals: 0, group: 'fuel',
    desc: '燃料ポンプから送られる燃料の圧力（ゲージ圧）です。' },
  { pid: '22', key: 'railPressRel', name: '燃料レール圧力（相対）', unit: 'kPa', bytes: 2, calc: (A, B) => ab(A, B) * 0.079, min: 0, max: 5177, decimals: 0, group: 'fuel',
    desc: 'インジェクター（噴射装置）に燃料を配る管の圧力を、吸気管の圧力との差で表したものです。' },
  { pid: '23', key: 'railPress', name: '燃料レール圧力', unit: 'kPa', bytes: 2, calc: (A, B) => ab(A, B) * 10, min: 0, max: 30000, decimals: 0, group: 'fuel',
    desc: '直噴エンジン・ディーゼルエンジンの燃料レールの圧力です。数千〜数万 kPa の高圧になります。' },
  { pid: '59', key: 'railPressAbs', name: '燃料レール圧力（絶対）', unit: 'kPa', bytes: 2, calc: (A, B) => ab(A, B) * 10, min: 0, max: 30000, decimals: 0, group: 'fuel',
    desc: '燃料レールの圧力を絶対圧で表したものです。' },
  { pid: '52', key: 'ethanol', name: 'エタノール濃度', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'fuel',
    desc: '燃料に含まれるエタノールの割合です。フレックス燃料車などで使われます。' },
  { pid: '2E', key: 'evapPurge', name: 'エバポパージ指令値', unit: '%', bytes: 1, calc: pct, min: 0, max: 100, decimals: 0, group: 'fuel',
    desc: '燃料タンクで発生したガソリンの蒸気をエンジンで燃やす量の指令値です。' },
  { pid: '32', key: 'evapPress', name: 'エバポ系 蒸気圧', unit: 'Pa', bytes: 2, calc: (A, B) => s16(A, B) / 4, min: -2000, max: 2000, decimals: 0, group: 'fuel',
    desc: '燃料タンクまわりの蒸気の圧力です。給油口のキャップの閉め忘れなどの検出に使われます。' },
  { pid: '53', key: 'evapPressAbs', name: 'エバポ系 蒸気圧（絶対）', unit: 'kPa', bytes: 2, calc: (A, B) => ab(A, B) / 200, min: 0, max: 330, decimals: 1, group: 'fuel',
    desc: '燃料タンクまわりの蒸気の圧力（絶対圧）です。' },
  { pid: '54', key: 'evapPress2', name: 'エバポ系 蒸気圧（広範囲）', unit: 'Pa', bytes: 2, calc: s16, min: -5000, max: 5000, decimals: 0, group: 'fuel',
    desc: '燃料タンクまわりの蒸気の圧力（測定範囲の広いセンサー）です。' },

  // ---- 排ガス・O2 センサー ----
  ...['14', '15', '16', '17', '18', '19', '1A', '1B'].map((pid, i) => ({
    pid, key: `o2v${i}`, name: `O2 センサー電圧 ${BANK[i]}`, unit: 'V', bytes: 2, calc: (A) => A / 200, min: 0, max: 1.275, decimals: 3, group: 'exhaust',
    desc: `排気ガス中の酸素を測るセンサーの電圧です。触媒の前（S1）は 0.1〜0.9 V の間で素早く上下し、触媒の後ろ（S2）は安定しているのが正常です。${BANK_NOTE}`,
  })),
  ...['24', '25', '26', '27', '28', '29', '2A', '2B'].map((pid, i) => ({
    pid, key: `lambda${i}`, name: `空燃比センサー λ ${BANK[i]}`, unit: 'λ', bytes: 4, calc: (A, B) => ab(A, B) * 2 / 65536, min: 0.5, max: 1.5, decimals: 3, group: 'exhaust',
    desc: `空燃比（A/F）センサーが測った、空気と燃料の比率です。1.000 が理想的な比率で、1 より小さいと燃料が濃い状態です。${BANK_NOTE}`,
  })),
  { pid: '7A', key: 'dpfDiff', name: 'DPF 差圧', unit: 'kPa', bytes: 7, mask: true, calc: (A, B, C) => s16(B, C) / 100, min: 0, max: 50, decimals: 2, group: 'exhaust',
    desc: 'ディーゼル車のすす除去フィルター（DPF）の前後の圧力差です。すすが溜まるほど大きくなります。' },

  // ---- 距離・時間 ----
  { pid: 'A6', key: 'odometer', name: '走行距離（オドメーター）', unit: 'km', bytes: 4, calc: (A, B, C, D) => ((A * 2 ** 24) + (B << 16) + (C << 8) + D) / 10, min: 0, max: 500000, decimals: 1, group: 'history',
    desc: '車の総走行距離です。比較的新しい車（おおむね 2019 年以降）でのみ対応しています。' },
  { pid: '1F', key: 'runtime', name: 'エンジン稼働時間', unit: 's', bytes: 2, calc: ab, min: 0, max: 65535, decimals: 0, group: 'history', format: 'duration',
    desc: '今回エンジンを始動してからの経過時間（時:分:秒）です。' },
  { pid: '31', key: 'distCleared', name: '故障コード消去後の走行距離', unit: 'km', bytes: 2, calc: ab, min: 0, max: 65535, decimals: 0, group: 'history',
    desc: '最後に故障コードを消去してから（またはバッテリーを外してから）走った距離です。中古車購入時に、直前に消去されていないかの目安になります。' },
  { pid: '30', key: 'warmups', name: '故障コード消去後の暖機回数', unit: '回', bytes: 1, calc: (A) => A, min: 0, max: 255, decimals: 0, group: 'history',
    desc: '最後に故障コードを消去してから、エンジンが十分に暖まった回数です。' },
  { pid: '4E', key: 'timeCleared', name: '故障コード消去後の経過時間', unit: '分', bytes: 2, calc: ab, min: 0, max: 65535, decimals: 0, group: 'history',
    desc: '最後に故障コードを消去してからのエンジン稼働時間（分）です。' },
  { pid: '21', key: 'distMil', name: 'チェックランプ点灯中の走行距離', unit: 'km', bytes: 2, calc: ab, min: 0, max: 65535, decimals: 0, group: 'history',
    desc: 'チェックランプ（MIL）が点灯してから走った距離です。0 なら点灯していません。' },
  { pid: '4D', key: 'timeMil', name: 'チェックランプ点灯中の経過時間', unit: '分', bytes: 2, calc: ab, min: 0, max: 65535, decimals: 0, group: 'history',
    desc: 'チェックランプ（MIL）が点灯してからのエンジン稼働時間（分）です。' },

  // ---- 車両情報 ----
  { pid: '51', key: 'fuelType', name: '燃料の種類', unit: '', bytes: 1, calc: (A) => A, format: 'enum', group: 'info',
    enum: { 1: 'ガソリン', 2: 'メタノール', 3: 'エタノール', 4: 'ディーゼル', 5: 'LPG', 6: 'CNG', 7: 'プロパン', 8: '電気', 9: 'バイフューエル（ガソリン）', 17: 'ハイブリッド（ガソリン）', 18: 'ハイブリッド（エタノール）', 19: 'ハイブリッド（ディーゼル）', 20: 'ハイブリッド（電気）', 21: 'ハイブリッド（混合）', 22: 'ハイブリッド（回生）' },
    desc: 'ECU が登録している、この車の燃料の種類です。' },
  { pid: '1C', key: 'obdStd', name: '対応している OBD 規格', unit: '', bytes: 1, calc: (A) => A, format: 'enum', group: 'info',
    enum: { 1: 'OBD-II（米国 CARB）', 2: 'OBD（米国 EPA）', 3: 'OBD / OBD-II', 4: 'OBD-I', 6: 'EOBD（欧州）', 7: 'EOBD / OBD-II', 8: 'EOBD / OBD', 9: 'EOBD / OBD / OBD-II', 10: 'JOBD（日本）', 11: 'JOBD / OBD-II', 12: 'JOBD / EOBD', 13: 'JOBD / EOBD / OBD-II' },
    desc: 'この車の診断機能がどの国の規格に沿っているかです。日本向けの車は JOBD を含むことが多いです。' },
];

// 他の項目から計算する項目
const socFromVolt = (v) => Math.max(0, Math.min(100, (v - 11.8) / (12.7 - 11.8) * 100));
export const DERIVED = [
  { key: 'boost', name: 'ブースト圧', unit: 'kPa', needs: ['map'], optional: ['baro'], calc: (v) => v.map - (v.baro ?? 101), min: -100, max: 150, decimals: 0, group: 'air',
    desc: '吸気圧（MAP）から大気圧を引いた値で、ターボがどれだけ空気を押し込んでいるかを表します。マイナスは負圧（アクセルを戻しているとき）です。大気圧が取れない車は 101 kPa として計算します。' },
  { key: 'battSoc', name: '12V バッテリー充電量（推定）', unit: '%', needs: ['adapterVolt'], optional: ['rpm'], calc: (v) => (v.rpm ? null : socFromVolt(v.adapterVolt)), min: 0, max: 100, decimals: 0, group: 'battery',
    desc: 'エンジン停止中（イグニッション ON）のバッテリー電圧から推定した充電量です（12.7 V ≒ 100%、11.8 V ≒ 0%）。\n\nエンジン作動中は発電の電圧が乗るため推定できず「--」になります。正確な値は、エンジン停止後しばらく置いてから確認してください。\n\n※劣化具合（寿命）は OBD では測れません。' },
  { key: 'charging', name: '充電状態', unit: '', needs: ['adapterVolt'], optional: ['rpm'], format: 'enum', enum: { 0: '停止中', 1: '充電中', 2: '充電不足', 3: '過充電の疑い' },
    calc: (v) => (!v.rpm ? 0 : v.adapterVolt > 15.0 ? 3 : v.adapterVolt >= 13.2 ? 1 : 2), group: 'battery',
    desc: 'エンジン作動中のバッテリー電圧から、発電機（オルタネーター）で充電できているかを判定します。\n\n・充電中：13.2〜15.0 V\n・充電不足：13.2 V 未満（発電機の不調や電装品の使いすぎ）\n・過充電の疑い：15.0 V 超\n\n※充電制御（アイドリングストップ車など）のある車では、正常でも 12 V 台になることがあります。' },
];

/** 項目が車で使えるか（PID は対応表で判定、ATRV などはアダプターの機能なので常に可） */
export function isDefSupported(def, isSupported) {
  return def.pid ? isSupported(def.pid) : !!def.cmd;
}

/** 計算項目が使えるか */
export function isDerivedSupported(d, isSupported) {
  return d.needs.every((k) => { const p = PIDS.find((x) => x.key === k); return p && isDefSupported(p, isSupported); });
}

/** 車が対応している表示項目の数（ホーム画面用） */
export function countDisplayable(isSupported) {
  const a = PIDS.filter((p) => isDefSupported(p, isSupported)).length;
  const b = DERIVED.filter((d) => isDerivedSupported(d, isSupported)).length;
  return { supported: a + b, total: PIDS.length + DERIVED.length };
}

/** key → 定義（PIDS / DERIVED 共通） */
export const ALL_ITEMS = [...PIDS, ...DERIVED];
export const findItem = (key) => ALL_ITEMS.find((d) => d.key === key);
export const isItemSupported = (d, isSupported) => (d.needs ? isDerivedSupported(d, isSupported) : isDefSupported(d, isSupported));
