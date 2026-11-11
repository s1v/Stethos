// 既知のサービス UUID（キャラクタリスティックは write / notify の性質から自動判別するため、サービスのみ管理）
// 未確認の UUID を宣言しても害はないので、候補は多めに入れておく。
// 動作報告は GitHub の Issue で受け付け、status を更新する（status は管理用で画面には表示しない）。
export const KNOWN_SERVICES = [
  { uuid: 'fff0', products: 'ELM327 互換 BLE アダプターの多く', status: '公開情報ベース' },
  { uuid: 'ffe0', products: 'HM-10 系モジュール', status: '公開情報ベース' },
  { uuid: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', products: 'Vgate iCar Pro BLE、OBDLink CX など', status: '公開情報ベース' },
  { uuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', products: 'Nordic UART Service（BLE シリアル部品で一般的）', status: '公開情報ベース' },
  { uuid: '18f0', products: '一部の ELM327 BLE クローン', status: '公開情報ベース' },
  { uuid: 'ffb0', products: '一部の BLE シリアルモジュール', status: '公開情報ベース' },
  { uuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455', products: 'Microchip（ISSC）Transparent UART', status: '公開情報ベース' },
  { uuid: '0000ffe5-0000-1000-8000-00805f9b34fb', products: '一部の BLE シリアルモジュール', status: '公開情報ベース' },
  // @auto-insert（この行より上に Issue からの自動追加が入ります。消さないでください）
  // TODO: JFIND JF327 の UUID を nRF Connect で確認後に記入（status: '実機確認済み'）
  // { uuid: '????', products: 'JFIND JF327', status: '実機確認済み' },
];
