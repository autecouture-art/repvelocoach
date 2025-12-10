"""
BLE クライアント エントリポイント
OVR Velocity デバイスからリアルタイムデータを取得
"""
import argparse
import asyncio
import sys

from ble_client import (
    OVRVelocityClient,
    DEFAULT_RECEIVE_DURATION,
    DISPLAY_MODE_RAW,
    DISPLAY_MODE_COMPACT,
    DISPLAY_MODE_REALTIME,
)


def main():
    """メイン関数"""
    # コマンドライン引数のパーサー
    parser = argparse.ArgumentParser(
        description="OVR Velocity BLE クライアント",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python ble_main.py                    # デフォルト（30秒、リアルタイム表示）
  python ble_main.py -t 60              # 60秒間受信
  python ble_main.py -m raw             # HEX のみ表示
  python ble_main.py -m compact         # コンパクト表示
  python ble_main.py -m realtime        # リアルタイム表示（デフォルト）
  python ble_main.py -t 120 -m compact  # 120秒、コンパクト表示
"""
    )
    
    parser.add_argument(
        "-t", "--time",
        type=int,
        default=DEFAULT_RECEIVE_DURATION,
        help=f"受信時間（秒）。デフォルト: {DEFAULT_RECEIVE_DURATION}秒"
    )
    
    parser.add_argument(
        "-m", "--mode",
        type=str,
        choices=["raw", "compact", "realtime"],
        default="realtime",
        help="表示モード: raw=HEXのみ, compact=1行表示, realtime=リッチ表示（デフォルト）"
    )
    
    args = parser.parse_args()
    
    # 受信時間のバリデーション
    if args.time <= 0:
        print(f"[MAIN] エラー: 受信時間は正の整数である必要があります")
        sys.exit(1)
    
    # 表示モードのマッピング
    mode_map = {
        "raw": DISPLAY_MODE_RAW,
        "compact": DISPLAY_MODE_COMPACT,
        "realtime": DISPLAY_MODE_REALTIME,
    }
    display_mode = mode_map[args.mode]
    
    print(f"[MAIN] OVR Velocity BLE クライアント起動")
    print(f"[MAIN] 受信時間: {args.time}秒")
    print(f"[MAIN] 表示モード: {args.mode}")
    print(f"[MAIN] ---")
    
    # クライアント作成と実行
    client = OVRVelocityClient(
        receive_duration=args.time,
        display_mode=display_mode
    )
    asyncio.run(client.run())


if __name__ == "__main__":
    main()
