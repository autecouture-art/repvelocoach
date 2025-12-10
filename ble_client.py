"""
BLE クライアントロジック
OVR Velocity デバイスとの通信を担当
"""
import asyncio
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

from parser import parse_velocity_data, format_realtime_display, format_compact_display, VelocityData

# 定数定義
DEVICE_NAME_PREFIX = "OVR_Velocity"
SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
NOTIFY_CHARACTERISTIC_UUID = "14001dc2-5089-47d3-84bc-7c3d418389aa"
SCAN_DURATION = 5  # スキャン時間（秒）
DEFAULT_RECEIVE_DURATION = 30  # デフォルト受信時間（秒）
EXPECTED_DATA_SIZE = 16  # 期待されるデータサイズ（バイト）

# ログフォルダ
LOGS_DIR = Path("logs")

# 表示モード
DISPLAY_MODE_RAW = "raw"           # HEX のみ表示
DISPLAY_MODE_COMPACT = "compact"   # 1行で解析結果を表示
DISPLAY_MODE_REALTIME = "realtime" # リッチなリアルタイム表示
DISPLAY_MODE_GUI = "gui"           # GUI用（コンソール出力を抑制）


class OVRVelocityClient:
    """OVR Velocity BLE クライアント"""

    def __init__(
        self,
        receive_duration: int = DEFAULT_RECEIVE_DURATION,
        display_mode: str = DISPLAY_MODE_REALTIME,
        on_data_received: Optional[Callable[[VelocityData], None]] = None
    ):
        """
        初期化

        Args:
            receive_duration: データ受信時間（秒）
            display_mode: 表示モード
            on_data_received: データ受信時のコールバック関数
        """
        self.receive_duration = receive_duration
        self.display_mode = display_mode
        self.on_data_received = on_data_received
        self.client: Optional[BleakClient] = None
        self.log_file: Optional[Path] = None
        self.log_file_handle = None
        self.data_count = 0
        self._setup_log_directory()

    def _setup_log_directory(self):
        """ログディレクトリを作成"""
        LOGS_DIR.mkdir(exist_ok=True)

    def _generate_log_filename(self) -> Path:
        """ログファイル名を生成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return LOGS_DIR / f"ble_raw_{timestamp}.txt"

    def _clear_screen(self):
        """画面をクリア（リアルタイム表示用）"""
        if self.display_mode != DISPLAY_MODE_GUI:
            os.system('clear' if os.name != 'nt' else 'cls')

    async def scan_device(self) -> Optional[BLEDevice]:
        """
        デバイスをスキャン

        Returns:
            見つかったデバイス、見つからなければ None
        """
        if self.display_mode != DISPLAY_MODE_GUI:
            print(f"[BLE] スキャン開始（{SCAN_DURATION}秒間）...")
        
        devices = await BleakScanner.discover(timeout=SCAN_DURATION)
        
        # デバイス名で検索（優先）
        for device in devices:
            if device.name and DEVICE_NAME_PREFIX in device.name:
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] デバイス発見（名前）: {device.name} ({device.address})")
                return device
        
        # Service UUID で検索
        if self.display_mode != DISPLAY_MODE_GUI:
            print(f"[BLE] 名前での検索に失敗。Service UUID で検索中...")
        for device in devices:
            try:
                async with BleakClient(device.address) as temp_client:
                    services = await temp_client.get_services()
                    for service in services:
                        if str(service.uuid).lower() == SERVICE_UUID.lower():
                            if self.display_mode != DISPLAY_MODE_GUI:
                                print(f"[BLE] デバイス発見（Service UUID）: {device.name or device.address} ({device.address})")
                            return device
            except Exception as e:
                # 接続に失敗した場合は次のデバイスへ
                continue
        
        return None

    async def connect(self, device: BLEDevice) -> bool:
        """
        デバイスに接続

        Args:
            device: 接続するデバイス

        Returns:
            接続成功時 True、失敗時 False
        """
        try:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] 接続中: {device.address}...")
            self.client = BleakClient(device.address)
            await self.client.connect()
            
            if self.client.is_connected:
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] 接続成功")
                return True
            else:
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] 接続失敗: 接続状態が確認できませんでした")
                return False
        except Exception as e:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] 接続失敗: {str(e)}")
            return False

    def _notification_handler(self, sender: int, data: bytearray):
        """
        Notify データ受信ハンドラ

        Args:
            sender: 送信元のハンドル
            data: 受信したバイトデータ
        """
        self.data_count += 1
        
        # データを解析
        parsed_data = parse_velocity_data(bytes(data))
        
        # コールバックを呼び出す（GUI更新など）
        if self.on_data_received and parsed_data:
            self.on_data_received(parsed_data)
            
        # GUIモードの場合はコンソール出力を抑制してリターン
        if self.display_mode == DISPLAY_MODE_GUI:
            # ログ書き込みのみ行う
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            hex_str = "-".join([f"{b:02X}" for b in data])
            log_line = f"{timestamp} {hex_str}\n"
            if self.log_file_handle:
                self.log_file_handle.write(log_line)
                self.log_file_handle.flush()
            return

        # --- 以下はCLIモード用の表示処理 ---

        # データサイズチェック
        if len(data) != EXPECTED_DATA_SIZE:
            print(f"[DATA] 警告: 期待されるサイズ({EXPECTED_DATA_SIZE}バイト)と異なります: {len(data)}バイト")
        
        # HEX文字列に変換
        hex_str = "-".join([f"{b:02X}" for b in data])
        
        # 表示モードに応じた出力
        if self.display_mode == DISPLAY_MODE_RAW:
            # 従来のHEXのみ表示
            print(f"[DATA] {hex_str}")
            
        elif self.display_mode == DISPLAY_MODE_COMPACT:
            # コンパクトな1行表示
            if parsed_data:
                compact = format_compact_display(parsed_data)
                print(f"[DATA] {compact} | HEX: {hex_str}")
            else:
                print(f"[DATA] {hex_str}")
                
        elif self.display_mode == DISPLAY_MODE_REALTIME:
            # リッチなリアルタイム表示（画面クリアして更新）
            self._clear_screen()
            print("=" * 51)
            print("  OVR Velocity - リアルタイムモニター")
            print("=" * 51)
            print(f"  受信データ数: {self.data_count}")
            print(f"  ログファイル: {self.log_file}")
            print()
            
            if parsed_data:
                print(format_realtime_display(parsed_data))
            
            print()
            print(f"  HEX: {hex_str}")
            print()
            print("  Ctrl+C で終了")
        
        # ログファイルに書き込み（timestamp付き）
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_line = f"{timestamp} {hex_str}\n"
        
        if self.log_file_handle:
            self.log_file_handle.write(log_line)
            self.log_file_handle.flush()

    async def start_notify(self) -> bool:
        """
        Notify を開始

        Returns:
            開始成功時 True、失敗時 False
        """
        if not self.client or not self.client.is_connected:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] エラー: デバイスに接続されていません")
            return False
        
        try:
            # ログファイルを開く
            self.log_file = self._generate_log_filename()
            self.log_file_handle = open(self.log_file, "w", encoding="utf-8")
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] ログファイル作成: {self.log_file}")
            
            # Notify を開始
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] Notify 開始: {NOTIFY_CHARACTERISTIC_UUID}")
            
            await self.client.start_notify(
                NOTIFY_CHARACTERISTIC_UUID,
                self._notification_handler
            )
            
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] Notify 購読中... ({self.receive_duration}秒間)")
                if self.display_mode == DISPLAY_MODE_REALTIME:
                    print(f"[BLE] リアルタイム表示モード - データ受信を待機中...")
            
            return True
        except Exception as e:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] Notify 開始失敗: {str(e)}")
            if self.log_file_handle:
                self.log_file_handle.close()
                self.log_file_handle = None
            return False

    async def stop_notify(self):
        """Notify を停止"""
        if not self.client or not self.client.is_connected:
            return
        
        try:
            await self.client.stop_notify(NOTIFY_CHARACTERISTIC_UUID)
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"\n[BLE] Notify 停止")
        except Exception as e:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] Notify 停止エラー: {str(e)}")
        
        # ログファイルを閉じる
        if self.log_file_handle:
            self.log_file_handle.close()
            self.log_file_handle = None
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] ログファイル保存完了: {self.log_file}")
                print(f"[BLE] 受信データ数: {self.data_count}")

    async def disconnect(self):
        """デバイスから切断"""
        if self.client and self.client.is_connected:
            try:
                await self.client.disconnect()
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] 切断完了")
            except Exception as e:
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] 切断エラー: {str(e)}")

    async def run(self):
        """
        メイン実行フロー
        """
        try:
            # デバイススキャン
            device = await self.scan_device()
            if not device:
                if self.display_mode != DISPLAY_MODE_GUI:
                    print(f"[BLE] エラー: OVR Velocity デバイスが見つかりませんでした")
                    print(f"[BLE] 以下を確認してください:")
                    print(f"  - デバイスが電源ONになっているか")
                    print(f"  - デバイス名が '{DEVICE_NAME_PREFIX}' を含むか")
                    print(f"  - Service UUID '{SERVICE_UUID}' が正しいか")
                return
            
            # 接続
            if not await self.connect(device):
                return
            
            # Notify 開始
            if not await self.start_notify():
                await self.disconnect()
                return
            
            # 指定時間受信
            # GUIモードでは無限待機しない（呼び出し側で制御する）
            if self.display_mode != DISPLAY_MODE_GUI:
                await asyncio.sleep(self.receive_duration)
                
                # Notify 停止
                await self.stop_notify()
                
                # 切断
                await self.disconnect()
                
                print(f"[BLE] 処理完了")
            else:
                # GUIモードの場合は接続維持したまま待機（キャンセルされるまで）
                while True:
                    await asyncio.sleep(1)
            
        except KeyboardInterrupt:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"\n[BLE] 中断されました")
            await self.stop_notify()
            await self.disconnect()
        except asyncio.CancelledError:
            # GUIからのキャンセル要求
            await self.stop_notify()
            await self.disconnect()
        except Exception as e:
            if self.display_mode != DISPLAY_MODE_GUI:
                print(f"[BLE] エラー発生: {str(e)}")
            await self.stop_notify()
            await self.disconnect()
            raise
