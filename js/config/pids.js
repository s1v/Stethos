// Mode 01 の PID 定義（データとして管理。ステータス画面・将来のカスタム画面で共通利用）
// pid: 16進2桁 / bytes: データバイト数 / calc: (A,B,C,D) => 値 / min,max: 表示範囲 / decimals: 小数桁
export const PID_GROUPS = [
  { id: 'drive', label: '走行' },
  { id: 'temp', label: '温度' },
  { id: 'air', label: '吸気・過給' },
  { id: 'fuel', label: '燃料' },
  { id: 'elec', label: '電気' },
  { id: 'other', label: 'その他' },
];

export const PIDS = [
  { pid: '0D', key: 'speed', name: '車速', unit: 'km/h', bytes: 1, calc: (A) => A, min: 0, max: 200, decimals: 0, group: 'drive' },
  { pid: '0C', key: 'rpm', name: 'エンジン回転数', unit: 'rpm', bytes: 2, calc: (A, B) => (A * 256 + B) / 4, min: 0, max: 7000, decimals: 0, group: 'drive' },
  { pid: '04', key: 'load', name: 'エンジン負荷', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'drive' },
  { pid: '11', key: 'throttle', name: 'スロットル開度', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'drive' },

  { pid: '05', key: 'coolant', name: '冷却水温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 130, decimals: 0, group: 'temp' },
  { pid: '0F', key: 'iat', name: '吸気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 80, decimals: 0, group: 'temp' },
  { pid: '46', key: 'ambient', name: '外気温', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 60, decimals: 0, group: 'temp' },
  { pid: '3C', key: 'cat11', name: '触媒温度 B1S1', unit: '°C', bytes: 2, calc: (A, B) => (A * 256 + B) / 10 - 40, min: 0, max: 1000, decimals: 0, group: 'temp' },
  { pid: '5C', key: 'oil', name: 'エンジンオイル温度', unit: '°C', bytes: 1, calc: (A) => A - 40, min: -40, max: 150, decimals: 0, group: 'temp' },

  { pid: '10', key: 'maf', name: '吸入空気量（MAF）', unit: 'g/s', bytes: 2, calc: (A, B) => (A * 256 + B) / 100, min: 0, max: 200, decimals: 1, group: 'air' },
  { pid: '0B', key: 'map', name: '吸気圧（MAP）', unit: 'kPa', bytes: 1, calc: (A) => A, min: 0, max: 255, decimals: 0, group: 'air' },
  { pid: '33', key: 'baro', name: '大気圧', unit: 'kPa', bytes: 1, calc: (A) => A, min: 70, max: 110, decimals: 0, group: 'air' },

  { pid: '06', key: 'stft1', name: '短期燃料補正 B1', unit: '%', bytes: 1, calc: (A) => A * 100 / 128 - 100, min: -25, max: 25, decimals: 1, group: 'fuel' },
  { pid: '07', key: 'ltft1', name: '長期燃料補正 B1', unit: '%', bytes: 1, calc: (A) => A * 100 / 128 - 100, min: -25, max: 25, decimals: 1, group: 'fuel' },
  { pid: '14', key: 'o2b1s1', name: 'O2 センサー B1S1', unit: 'V', bytes: 2, calc: (A) => A / 200, min: 0, max: 1.275, decimals: 3, group: 'fuel' },
  { pid: '15', key: 'o2b1s2', name: 'O2 センサー B1S2', unit: 'V', bytes: 2, calc: (A) => A / 200, min: 0, max: 1.275, decimals: 3, group: 'fuel' },
  { pid: '2F', key: 'fuel', name: '燃料残量', unit: '%', bytes: 1, calc: (A) => A * 100 / 255, min: 0, max: 100, decimals: 0, group: 'fuel' },

  { pid: '42', key: 'volt', name: 'ECU 電圧', unit: 'V', bytes: 2, calc: (A, B) => (A * 256 + B) / 1000, min: 10, max: 16, decimals: 2, group: 'elec' },

  { pid: '1F', key: 'runtime', name: 'エンジン稼働時間', unit: 's', bytes: 2, calc: (A, B) => A * 256 + B, min: 0, max: 65535, decimals: 0, group: 'other', format: 'duration' },
];

// 他の PID から計算する項目
export const DERIVED = [
  { key: 'boost', name: 'ブースト圧', unit: 'kPa', needs: ['map', 'baro'], calc: (v) => v.map - v.baro, min: -100, max: 150, decimals: 0, group: 'air', fallbackBaro: 101 },
];
