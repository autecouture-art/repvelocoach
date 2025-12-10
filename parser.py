"""
OVR Velocity データ解析モジュール
16バイトのバイナリデータを解析して各パラメータを抽出

データ構造（実機照合・確定版 v2）:
┌─────────┬────────────────────────────────────────────────────────────┐
│ Field   │ パラメータ名 (単位) = 計算式                                │
├─────────┼────────────────────────────────────────────────────────────┤
│ Field 0 │ 不明 (Avgより小さい値が入るためPeakではない)                │
│ Field 1 │ ROM (cm)            = Field 1 / 10 * 2.54 (inch→cm変換)    │
│ Field 2 │ Avg Velocity (m/s)  = Field 2 / 100  ★★確定                │
│ Field 3 │ 不明                                                       │
│ Field 4 │ Avg Power (W)       = Field 4        ★★確定                │
│ Field 5 │ Peak Power (W)      = Field 5        (推測・Avgより大きい)  │
│ Field 6 │ Time To Peak (s)    = Field 6 / 100  (推測)                │
│ Field 7 │ 不明                                                       │
└─────────┴────────────────────────────────────────────────────────────┘
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class VelocityData:
    """
    OVR Velocity の計測データ
    """
    # 生データ（16バイト）
    raw_bytes: bytes
    
    # 8つの16ビット整数値（リトルエンディアン）
    field0: int  # 不明
    field1: int  # ROM (inch * 10)
    field2: int  # Avg Velocity (m/s) ★★確定
    field3: int  # 不明
    field4: int  # Avg Power (W)      ★★確定
    field5: int  # Peak Power (W)?
    field6: int  # Time To Peak (cs)
    field7: int  # 不明
    
    # === 確定パラメータ ===
    
    @property
    def avg_velocity_ms(self) -> float:
        """平均速度 (m/s)"""
        return self.field2 / 100.0
    
    @property
    def avg_power_w(self) -> int:
        """平均パワー (W)"""
        return self.field4
    
    @property
    def rom_cm(self) -> float:
        """可動域 ROM (cm) - インチ(x10)から変換"""
        # Field 1 は inch * 10
        inches = self.field1 / 10.0
        return inches * 2.54
    
    # === 推測パラメータ ===
    
    @property
    def peak_velocity_ms(self) -> float:
        """ピーク速度 (m/s) - 現在不明のため Avg を返すか 0 を返す"""
        # Field 0 は Peak ではないことが判明
        return 0.0
    
    @property
    def peak_power_w(self) -> int:
        """ピークパワー (W) - 推測"""
        return self.field5
    
    @property
    def time_to_peak_s(self) -> float:
        """ピークまでの時間 (s)"""
        return self.field6 / 100.0
    
    def to_dict(self) -> dict:
        """辞書形式で返す"""
        return {
            "avg_velocity_ms": self.avg_velocity_ms,
            "peak_velocity_ms": self.peak_velocity_ms,
            "avg_power_w": self.avg_power_w,
            "peak_power_w": self.peak_power_w,
            "rom_cm": self.rom_cm,
            "time_to_peak_s": self.time_to_peak_s,
            "raw_fields": [
                self.field0, self.field1, self.field2, self.field3,
                self.field4, self.field5, self.field6, self.field7
            ],
        }


def parse_velocity_data(data: bytes) -> Optional[VelocityData]:
    """
    16バイトのバイナリデータを解析
    
    Args:
        data: 16バイトのバイナリデータ
        
    Returns:
        VelocityData オブジェクト、または解析失敗時は None
    """
    if len(data) != 16:
        return None
    
    # 8つの16ビット整数を抽出（リトルエンディアン）
    fields = []
    for i in range(0, 16, 2):
        value = int.from_bytes(data[i:i+2], byteorder='little')
        fields.append(value)
    
    return VelocityData(
        raw_bytes=data,
        field0=fields[0],
        field1=fields[1],
        field2=fields[2],
        field3=fields[3],
        field4=fields[4],
        field5=fields[5],
        field6=fields[6],
        field7=fields[7],
    )


def parse_hex_string(hex_str: str) -> Optional[VelocityData]:
    """
    HEX文字列を解析（ログファイルから読み込む用）
    
    Args:
        hex_str: "42-00-19-01-6B-00-AD-00-77-02-FC-03-1C-00-5A-02" 形式
        
    Returns:
        VelocityData オブジェクト
    """
    try:
        data = bytes.fromhex(hex_str.replace("-", ""))
        return parse_velocity_data(data)
    except ValueError:
        return None


def format_realtime_display(data: VelocityData) -> str:
    """
    リアルタイム表示用のフォーマット済み文字列を生成
    """
    lines = [
        "┌─────────────────────────────────────────────────┐",
        f"│  Avg Velocity:  {data.avg_velocity_ms:>5.2f} m/s              │",
        f"│     Avg Power:   {data.avg_power_w:>5} W                  │",
        f"│    Peak Power:   {data.peak_power_w:>5} W                  │",
        f"│           ROM:    {data.rom_cm:>5.1f} cm                 │",
        f"│  Time to Peak:    {data.time_to_peak_s:>4.2f} s                  │",
        "├─────────────────────────────────────────────────┤",
        f"│  F0:{data.field0:>4} F1:{data.field1:>4} F2:{data.field2:>4} F3:{data.field3:>4}    │",
        f"│  F4:{data.field4:>4} F5:{data.field5:>4} F6:{data.field6:>4} F7:{data.field7:>4}    │",
        "└─────────────────────────────────────────────────┘",
    ]
    return "\n".join(lines)


def format_compact_display(data: VelocityData) -> str:
    """
    コンパクトな1行表示用フォーマット
    """
    return (
        f"Avg:{data.avg_velocity_ms:>4.2f}m/s | "
        f"Pwr:{data.avg_power_w:>3}/{data.peak_power_w:>3}W | "
        f"ROM:{data.rom_cm:>4.1f}cm"
    )
