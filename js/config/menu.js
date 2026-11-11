// 接続後メニューの定義（将来のカスタム画面はここに追加する想定）
// type: 'screen' → 画面遷移 / 'action' → app 側のアクションを実行
export const MENU_ITEMS = [
  { type: 'screen', screen: 'home', label: 'ホーム' },
  { type: 'screen', screen: 'status', label: 'ステータス' },
  { type: 'screen', screen: 'dtc', label: '診断情報' },
  { type: 'action', action: 'disconnect', label: '切断', danger: true },
];
