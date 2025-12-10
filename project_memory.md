# OVR Velocity プロジェクト備忘録

## プロジェクト概要
OVR Velocity デバイス（BLE）からデータを取得し、Python で解析・表示するクライアントを作成。
公式ドキュメントが存在しないため、実機ログと公式アプリ画面、Excelエクスポートデータの照合により仕様を特定した。

## 1. BLE 通信仕様（解析結果）

- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Characteristic UUID**: `14001dc2-5089-47d3-84bc-7c3d418389aa`
- **通信方式**: Notify
- **データ送信タイミング**: レップ完了時（リザルト送信のみ）
    - リアルタイム波形（100Hz等）は送信されていない。
    - 公式アプリも同様の仕様（動作中は画面更新なし、終了後に結果表示）。

## 2. データ構造（16バイト） - 確定版

16バイトのデータは、8つの16ビット整数（リトルエンディアン）で構成される。

| Field | バイト位置 | パラメータ | 計算式 | 単位 | 確度 |
|-------|-----------|------------|--------|------|------|
| **Field 2** | 4-5 | **Avg Velocity** | `値 / 100` | m/s | ★★確定 |
| **Field 4** | 8-9 | **Avg Power** | `値` (そのまま) | W | ★★確定 |
| **Field 1** | 2-3 | **ROM** | `値 / 10 * 2.54` | cm | ★★確定 (inch x10) |
| **Field 6** | 12-13 | **Time To Peak** | `値 / 100` | s | ★ほぼ確定 |
| Field 0 | 0-1 | Peak Velocity? | - | - | × (Avgより小さい値が入るため不明) |
| Field 5 | 10-11 | Peak Power? | - | - | △ (Avgより大きい値だが未確定) |

※ Field 1 (ROM) はインチ単位×10 で送信されていることが判明。

## 3. 開発したツール

### `vbt_app.py` (OVR VBT Coach)
- **GUIアプリ**: CustomTkinter製のメインアプリ。
- **BIG MODE**: 巨大な速度表示。
- **Audio Coach**: 速度読み上げ、Velocity Loss 警告（システム音）。
- **履歴機能**: 「Today's Log」「History」タブでデータを閲覧可能。
- **1RM推定**: 当日のデータから回帰分析で1RMをリアルタイム推定。

### `ble_client.py`
- BLE通信ロジック。GUIモード対応。

### `parser.py`
- データ解析ロジック。確定したデータ構造を実装済み。

### `vbt_core.py`
- データベース管理 (SQLite)、1RM計算、音声ロジック。

## 4. 起動方法

ショートカット `Launch_OVR_VBT.command` をダブルクリック、または：

```bash
source ~/venv_ovr/bin/activate
python vbt_app.py
```

## 5. 今後の課題
- Peak Velocity のフィールド特定（Field 0 ではない）。
- 1RM推定の精度向上（過去データの活用）。
- グラフ表示機能の実装。
