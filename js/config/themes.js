// テーマ（スキン）の一覧。CSS は css/themes/<id>.css（standard は css/style.css のみ）
// 追加するときは、ここに 1 行足して css/themes/ にファイルを置き、index.html と sw.js に読み込みを足す
export const THEMES = [
  { id: 'standard', label: 'スタンダード', sample: '88°', themeColor: '#0b1120' },
  { id: 'retro', label: 'レトロデジタル', sample: '88.8', themeColor: '#050605' },
  { id: 'terminal', label: 'ターミナル', sample: '> 88_', themeColor: '#000000' },
];
