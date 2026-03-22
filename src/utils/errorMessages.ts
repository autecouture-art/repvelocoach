/**
 * User-Friendly Error Messages
 * ユーザーフレンドリーなエラーメッセージ管理
 */

export interface FriendlyError {
  title: string;
  message: string;
  actions?: string[];
}

export const getFriendlyErrorMessage = (errorCode: string): FriendlyError => {
  const errorMap: Record<string, FriendlyError> = {
    BLE_SCAN_FAILED: {
      title: 'センサーが見つかりません',
      message: '以下の対処法を試してください',
      actions: [
        '1. センサーの電源を入れてください',
        '2. iPhoneのBluetoothをオンにしてください',
        '3. センサーをiPhoneの近く（1m以内）に移動してください',
        '4. センサーのボタンを長押ししてリセットしてください',
      ],
    },
    BLE_CONNECTION_FAILED: {
      title: 'センサーに接続できません',
      message: 'もう一度試してください',
      actions: [
        '1. センサーの電源を確認してください',
        '2. iPhoneのBluetoothをオンにしてください',
        '3. センサーを再起動してください',
      ],
    },
    BLE_NOT_READY: {
      title: 'Bluetoothが使えません',
      message: 'Bluetoothをオンにしてください',
      actions: [
        '1. iPhoneの設定アプリを開いてください',
        '2. Bluetoothをオンにしてください',
        '3. アプリに戻ってもう一度試してください',
      ],
    },
    NO_RECORDING_DATA: {
      title: 'まだ記録されていません',
      message: '「記録開始」をタップしてください',
      actions: [
        '1. 種目を選択してください',
        '2. 「記録開始」をタップしてください',
        '3. セットを開始してください',
      ],
    },
    SESSION_NOT_STARTED: {
      title: 'セッションが開始されていません',
      message: '「セッション開始」をタップしてください',
    },
    NO_EXERCISE_SELECTED: {
      title: '種目が選択されていません',
      message: 'トレーニングする種目を選択してください',
    },
  };

  return errorMap[errorCode] || {
    title: 'エラーが発生しました',
    message: 'もう一度お試しください。問題が続く場合はサポートにお問い合わせください',
  };
};

export const formatErrorMessage = (errorCode: string, context?: string): string => {
  const error = getFriendlyErrorMessage(errorCode);
  let message = `${error.title}\n\n${error.message}`;

  if (error.actions && error.actions.length > 0) {
    message += '\n\n' + error.actions.join('\n');
  }

  if (context) {
    message = `【${context}】\n\n${message}`;
  }

  return message;
};
