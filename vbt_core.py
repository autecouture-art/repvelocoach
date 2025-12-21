"""
OVR VBT Coach - コアロジック (v2.1)
データベース管理、1RM計算、音声フィードバック、V-Loss管理、AIコーチを担当
"""
import sqlite3
import pyttsx3
import numpy as np
import threading
from datetime import datetime, timedelta
import platform
import subprocess
from typing import List, Optional, Tuple, Dict, Any

DB_FILE = "training_v2.db"

class TrainingDatabase:
    """トレーニングデータのデータベース管理 (v2.1 Schema)"""
    
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        self._init_db()
        
        self.current_session_id = None
        self.current_set_id = None
        self.current_exercise_id = None
        self.current_rep_index = 1  # Rep counter for current set
    
    def _init_db(self):
        """テーブル作成"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            category TEXT,
            current_e1rm REAL,
            lvp_slope REAL,
            lvp_intercept REAL,
            vmax REAL,
            one_vrm REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            body_weight REAL,
            readiness_score INTEGER,
            notes TEXT,
            status TEXT DEFAULT 'in_progress'
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            exercise_id INTEGER NOT NULL,
            set_index INTEGER NOT NULL,
            weight_kg REAL NOT NULL,
            target_reps INTEGER,
            actual_reps INTEGER DEFAULT 0,
            rpe REAL,
            set_type TEXT DEFAULT 'normal',
            target_velocity_zone TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id),
            FOREIGN KEY (exercise_id) REFERENCES exercises(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id INTEGER NOT NULL,
            rep_index INTEGER NOT NULL,
            mean_velocity REAL,
            peak_velocity REAL,
            mean_power REAL,
            peak_power REAL,
            rom REAL,
            time_to_peak REAL,
            rep_duration REAL,
            is_valid BOOLEAN DEFAULT 1,
            data_source TEXT DEFAULT 'vbt',
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (set_id) REFERENCES sets(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS personal_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise_id INTEGER NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            weight_kg REAL,
            achieved_at TEXT NOT NULL,
            set_id INTEGER,
            FOREIGN KEY (exercise_id) REFERENCES exercises(id),
            FOREIGN KEY (set_id) REFERENCES sets(id)
        )
        ''')
        
        default_exercises = ["Squat", "Bench Press", "Deadlift", "Overhead Press"]
        for ex in default_exercises:
            cursor.execute("INSERT OR IGNORE INTO exercises (name) VALUES (?)", (ex,))
            
        conn.commit()
        conn.close()

    # --- Session Management ---
    
    def start_session(self, body_weight: float = None, readiness: int = None, notes: str = "") -> int:
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        start_time = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO sessions (start_time, body_weight, readiness_score, notes)
            VALUES (?, ?, ?, ?)
        ''', (start_time, body_weight, readiness, notes))
        
        self.current_session_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return self.current_session_id

    def end_session(self, notes: str = None):
        if not self.current_session_id:
            return
            
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        end_time = datetime.now().isoformat()
        if notes:
            cursor.execute('UPDATE sessions SET end_time = ?, status = ?, notes = ? WHERE id = ?',
                           (end_time, 'completed', notes, self.current_session_id))
        else:
            cursor.execute('UPDATE sessions SET end_time = ?, status = ? WHERE id = ?',
                           (end_time, 'completed', self.current_session_id))
            
        conn.commit()
        conn.close()
        self.current_session_id = None
        self.current_set_id = None

    # --- Set Management ---

    def get_exercise_id(self, name: str) -> int:
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM exercises WHERE name = ?", (name,))
        row = cursor.fetchone()
        
        if row:
            ex_id = row[0]
        else:
            cursor.execute("INSERT INTO exercises (name) VALUES (?)", (name,))
            ex_id = cursor.lastrowid
            conn.commit()
            
        conn.close()
        return ex_id

    def start_set(self, exercise_name: str, weight: float, set_type: str = "normal", target_reps: int = None) -> int:
        if not self.current_session_id:
            self.start_session()
            
        ex_id = self.get_exercise_id(exercise_name)
        self.current_exercise_id = ex_id
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM sets WHERE session_id = ?", (self.current_session_id,))
        set_count = cursor.fetchone()[0]
        set_index = set_count + 1
        
        cursor.execute('''
            INSERT INTO sets (session_id, exercise_id, set_index, weight_kg, target_reps, set_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (self.current_session_id, ex_id, set_index, weight, target_reps, set_type))
        
        self.current_set_id = cursor.lastrowid
        self.current_rep_index = 1  # Reset rep counter for new set
        conn.commit()
        conn.close()
        return self.current_set_id

    def update_set_info(self, actual_reps: int = None, rpe: float = None):
        if not self.current_set_id:
            return
            
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        if actual_reps is not None and rpe is not None:
            cursor.execute("UPDATE sets SET actual_reps = ?, rpe = ? WHERE id = ?", (actual_reps, rpe, self.current_set_id))
        elif actual_reps is not None:
             cursor.execute("UPDATE sets SET actual_reps = ? WHERE id = ?", (actual_reps, self.current_set_id))
        elif rpe is not None:
             cursor.execute("UPDATE sets SET rpe = ? WHERE id = ?", (rpe, self.current_set_id))
        
        conn.commit()
        conn.close()

    # --- Rep Management ---
    
    def add_rep(self, velocity: float, power: float, peak_power: float, rom: float, time_to_peak: float, 
                rep_duration: float = None, data_source: str = 'vbt'):
        """レップデータを追加"""
        if not self.current_set_id:
            raise ValueError("No active set. Call start_set() first.")
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO reps (
                set_id, rep_index, 
                mean_velocity, mean_power, peak_power, 
                rom, time_to_peak, rep_duration,
                data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            self.current_set_id, 
            self.current_rep_index,
            velocity, power, peak_power,
            rom, time_to_peak, rep_duration,
            data_source
        ))
        
        # Update actual_reps in the sets table
        cursor.execute("UPDATE sets SET actual_reps = ? WHERE id = ?", (self.current_rep_index, self.current_set_id))
        
        conn.commit()
        conn.close()
        self.current_rep_index += 1

    # --- Data Retrieval ---

    def get_today_volume(self) -> float:
        if not self.current_session_id:
            return 0.0
            
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT SUM(s.weight_kg * (SELECT COUNT(*) FROM reps r WHERE r.set_id = s.id))
            FROM sets s
            WHERE s.session_id = ?
        ''', (self.current_session_id,))
        
        result = cursor.fetchone()[0]
        conn.close()
        return result if result else 0.0

    def get_today_sets(self, exercise_name: str = None) -> List[Dict]:
        if not self.current_session_id:
            return []
            
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        query = '''
            SELECT s.id, s.set_index, e.name, s.weight_kg, s.actual_reps, s.rpe, s.set_type,
                   AVG(r.mean_velocity) as avg_vel, MAX(r.mean_velocity) as max_vel,
                   s.created_at
            FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            LEFT JOIN reps r ON s.id = r.set_id
            WHERE s.session_id = ?
        '''
        params = [self.current_session_id]
        
        if exercise_name:
            query += " AND e.name = ?"
            params.append(exercise_name)
            
        query += " GROUP BY s.id ORDER BY s.set_index DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            time_str = ""
            if row[9]:
                try:
                    dt = datetime.fromisoformat(row[9])
                    time_str = dt.strftime("%H:%M")
                except:
                    time_str = row[9][:5] if len(row[9]) >= 5 else ""
                    
            result.append({
                "id": row[0],
                "set_index": row[1],
                "exercise": row[2],
                "weight": row[3],
                "reps": row[4],
                "rpe": row[5],
                "type": row[6],
                "avg_vel": row[7] if row[7] else 0.0,
                "max_vel": row[8] if row[8] else 0.0,
                "time": time_str
            })
        return result

    def get_session_data_for_1rm(self, exercise_name: str) -> List[Tuple[float, float]]:
        if not self.current_session_id:
            return []
            
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.weight_kg, MAX(r.mean_velocity)
            FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            JOIN reps r ON s.id = r.set_id
            WHERE s.session_id = ? AND e.name = ? AND r.mean_velocity > 0
            GROUP BY s.weight_kg
            ORDER BY s.weight_kg ASC
        ''', (self.current_session_id, exercise_name))
        
        rows = cursor.fetchall()
        conn.close()
        return rows
        
    # --- LVP ---
    
    def update_exercise_lvp(self, exercise_name: str, slope: float, intercept: float, e1rm: float = None):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        if e1rm:
            cursor.execute('''
                UPDATE exercises SET lvp_slope = ?, lvp_intercept = ?, current_e1rm = ?
                WHERE name = ?
            ''', (slope, intercept, e1rm, exercise_name))
        else:
            cursor.execute('''
                UPDATE exercises SET lvp_slope = ?, lvp_intercept = ?
                WHERE name = ?
            ''', (slope, intercept, exercise_name))
        
        conn.commit()
        conn.close()
        
    def get_exercise_lvp(self, exercise_name: str) -> Dict:
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT lvp_slope, lvp_intercept, current_e1rm, vmax, one_vrm
            FROM exercises WHERE name = ?
        ''', (exercise_name,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "slope": row[0],
                "intercept": row[1],
                "e1rm": row[2],
                "vmax": row[3],
                "one_vrm": row[4]
            }
        return {}

    # --- History & Analytics ---

    def get_all_sessions(self, limit: int = 30) -> List[Dict]:
        """過去のセッション一覧を取得"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.id, s.start_time, s.end_time, s.body_weight, s.readiness_score, s.status,
                   COUNT(DISTINCT st.id) as set_count,
                   SUM(st.weight_kg * st.actual_reps) as total_volume
            FROM sessions s
            LEFT JOIN sets st ON s.id = st.session_id
            GROUP BY s.id
            ORDER BY s.start_time DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            date_str = ""
            if row[1]:
                try:
                    dt = datetime.fromisoformat(row[1])
                    date_str = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    date_str = row[1][:16]
                    
            result.append({
                "id": row[0],
                "date": date_str,
                "end_time": row[2],
                "body_weight": row[3],
                "readiness": row[4],
                "status": row[5],
                "set_count": row[6] if row[6] else 0,
                "volume": row[7] if row[7] else 0
            })
        return result

    def get_session_sets(self, session_id: int) -> List[Dict]:
        """特定セッションのセット一覧"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.set_index, e.name, s.weight_kg, s.actual_reps, s.rpe, s.set_type,
                   AVG(r.mean_velocity) as avg_vel
            FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            LEFT JOIN reps r ON s.id = r.set_id
            WHERE s.session_id = ?
            GROUP BY s.id
            ORDER BY s.set_index ASC
        ''', (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            result.append({
                "set_index": row[0],
                "exercise": row[1],
                "weight": row[2],
                "reps": row[3],
                "rpe": row[4],
                "type": row[5],
                "avg_vel": row[6] if row[6] else 0.0
            })
        return result

    def get_weekly_volume(self, weeks_ago: int = 0) -> Dict:
        """週単位のボリュームを取得"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # 週の開始日と終了日を計算
        today = datetime.now().date()
        start_of_week = today - timedelta(days=today.weekday() + 7 * weeks_ago)
        end_of_week = start_of_week + timedelta(days=6)
        
        cursor.execute('''
            SELECT 
                SUM(st.weight_kg * st.actual_reps) as total_volume,
                COUNT(DISTINCT s.id) as session_count,
                COUNT(st.id) as set_count
            FROM sessions s
            JOIN sets st ON s.id = st.session_id
            WHERE date(s.start_time) >= ? AND date(s.start_time) <= ?
        ''', (start_of_week.isoformat(), end_of_week.isoformat()))
        
        row = cursor.fetchone()
        conn.close()
        
        return {
            "week_start": start_of_week.isoformat(),
            "week_end": end_of_week.isoformat(),
            "total_volume": row[0] if row[0] else 0,
            "session_count": row[1] if row[1] else 0,
            "set_count": row[2] if row[2] else 0
        }

    def get_recent_prs(self, days: int = 7) -> List[Dict]:
        """直近のPR一覧"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        cursor.execute('''
            SELECT pr.metric_type, pr.value, pr.weight_kg, pr.achieved_at, e.name
            FROM personal_records pr
            JOIN exercises e ON pr.exercise_id = e.id
            WHERE pr.achieved_at >= ?
            ORDER BY pr.achieved_at DESC
        ''', (cutoff_date,))
        
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            date_str = ""
            if row[3]:
                try:
                    dt = datetime.fromisoformat(row[3])
                    date_str = dt.strftime("%m/%d %H:%M")
                except:
                    date_str = row[3][:10]
                    
            result.append({
                "type": row[0],
                "value": row[1],
                "weight": row[2],
                "date": date_str,
                "exercise": row[4]
            })
        return result
        
    # --- PR Checks ---
    
    def get_personal_best(self, exercise_id: int, metric: str, weight: float = None) -> Optional[float]:
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        query = "SELECT MAX(value) FROM personal_records WHERE exercise_id = ? AND metric_type = ?"
        params = [exercise_id, metric]
        
        if metric == 'max_velocity' and weight is not None:
            query += " AND weight_kg = ?"
            params.append(weight)
            
        cursor.execute(query, params)
        result = cursor.fetchone()[0]
        conn.close()
        return result
        
    def save_pr(self, exercise_id: int, metric: str, value: float, weight: float = None):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        achieved_at = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO personal_records (exercise_id, metric_type, value, weight_kg, achieved_at, set_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (exercise_id, metric, value, weight, achieved_at, self.current_set_id))
        
        conn.commit()
        conn.close()


class PersonalRecordManager:
    """PR（自己ベスト）の管理と判定"""
    
    def __init__(self, db: TrainingDatabase):
        self.db = db
        
    def check_for_pr(self, exercise_id: int, weight: float, velocity: float, e1rm: float = None) -> List[str]:
        pr_messages = []
        
        current_best_speed = self.db.get_personal_best(exercise_id, 'max_velocity', weight)
        
        if current_best_speed is None or velocity > current_best_speed:
            self.db.save_pr(exercise_id, 'max_velocity', velocity, weight)
            if current_best_speed is not None:
                diff = velocity - current_best_speed
                pr_messages.append(f"Speed PR! {weight}kg @ {velocity:.2f}m/s (+{diff:.2f})")
        
        if e1rm:
            current_best_e1rm = self.db.get_personal_best(exercise_id, 'e1rm')
            if current_best_e1rm is None or e1rm > current_best_e1rm:
                self.db.save_pr(exercise_id, 'e1rm', e1rm)
                if current_best_e1rm is not None:
                    diff = e1rm - current_best_e1rm
                    pr_messages.append(f"e1RM PR! {int(e1rm)}kg (+{int(diff)})")
                    
        return pr_messages


class AICoach:
    """AIコーチング機能"""
    
    def __init__(self, db: TrainingDatabase):
        self.db = db
        
    def get_recommended_weight(self, exercise_name: str, readiness: int, target_intensity: float = 0.8) -> Optional[float]:
        """
        過去のLVPと今日の調子から推奨重量を計算
        target_intensity: 1RMに対する目標強度（例: 0.8 = 80%）
        """
        lvp = self.db.get_exercise_lvp(exercise_name)
        
        if not lvp or not lvp.get('e1rm'):
            return None
            
        base_e1rm = lvp['e1rm']
        
        # 調子による調整 (-10% ～ +5%)
        if readiness >= 8:
            adjustment = 1.05  # 調子良い日は+5%
        elif readiness >= 6:
            adjustment = 1.0   # 普通
        elif readiness >= 4:
            adjustment = 0.95  # 調子悪い日は-5%
        else:
            adjustment = 0.90  # かなり悪い日は-10%
            
        adjusted_1rm = base_e1rm * adjustment
        
        # 目標強度に基づく重量
        recommended = adjusted_1rm * target_intensity
        
        # 2.5kg刻みに丸める
        return round(recommended / 2.5) * 2.5
        
    def get_session_advice(self, readiness: int, this_week_volume: float, last_week_volume: float) -> str:
        """セッション開始時のアドバイス"""
        messages = []
        
        # 調子に基づくアドバイス
        if readiness >= 8:
            messages.append("🔥 Great condition! Push hard today!")
        elif readiness >= 6:
            messages.append("💪 Normal day. Stick to the plan.")
        elif readiness >= 4:
            messages.append("⚠️ Take it easy. Focus on technique.")
        else:
            messages.append("🛑 Consider a light session or rest.")
            
        # ボリュームに基づくアドバイス
        if last_week_volume > 0:
            ratio = this_week_volume / last_week_volume
            if ratio > 0.9:
                messages.append(f"📊 Volume at {int(ratio*100)}% of last week. Manage fatigue!")
            elif ratio < 0.5:
                messages.append(f"📈 Room to grow! Only {int(ratio*100)}% of last week's volume.")
                
        return " ".join(messages)


class OneRMCalculator:
    """1RM 推定ロジック"""
    
    MVT_TABLE = {
        "Squat": 0.30,
        "Bench Press": 0.15,
        "Deadlift": 0.15,
        "Overhead Press": 0.20,
        "Other": 0.25
    }
    
    @staticmethod
    def estimate_1rm(data_points: List[Tuple[float, float]], exercise: str) -> Optional[float]:
        if len(data_points) < 2:
            return None
        
        weights = np.array([d[0] for d in data_points])
        velocities = np.array([d[1] for d in data_points])
        
        if np.min(weights) == np.max(weights):
            return None
            
        try:
            slope, intercept = np.polyfit(weights, velocities, 1)
        except:
            return None
        
        if slope >= 0:
            return None
            
        mvt = OneRMCalculator.MVT_TABLE.get(exercise, 0.25)
        estimated_1rm = (mvt - intercept) / slope
        return float(estimated_1rm)
    
    @staticmethod
    def calculate_lvp(data_points: List[Tuple[float, float]]) -> Optional[Tuple[float, float]]:
        if len(data_points) < 2:
            return None
        
        weights = np.array([d[0] for d in data_points])
        velocities = np.array([d[1] for d in data_points])
        
        if np.min(weights) == np.max(weights):
            return None
            
        try:
            slope, intercept = np.polyfit(weights, velocities, 1)
            return (float(slope), float(intercept))
        except:
            return None


class AudioCoach:
    """音声フィードバック"""
    
    def __init__(self):
        self.engine = pyttsx3.init()
        self.lock = threading.Lock()
        self.enabled = True
        
    def speak(self, text: str):
        if not self.enabled: return
        def _run():
            with self.lock:
                try:
                    engine = pyttsx3.init()
                    engine.setProperty('rate', 160)
                    engine.say(text)
                    engine.runAndWait()
                except Exception as e:
                    print(f"[Audio] Error: {e}")
        threading.Thread(target=_run, daemon=True).start()

    def speak_velocity(self, velocity: float):
        if not self.enabled: return
        self.speak(f"{velocity:.2f}")
    
    def alert_stop(self):
        if not self.enabled: return
        if platform.system() == 'Darwin':
            def _play_sound():
                try:
                    subprocess.run(['afplay', '/System/Library/Sounds/Glass.aiff'])
                    self.speak("ストップ！")
                except: pass
            threading.Thread(target=_play_sound, daemon=True).start()
        else:
            self.speak("ストップ！終了です！")


class VelocityLossManager:
    """Velocity Loss 管理"""
    
    def __init__(self, cutoff_percent: int = 20):
        self.cutoff_percent = cutoff_percent
        self.best_velocity = 0.0
        self.current_set_reps = 0
    
    def start_new_set(self):
        self.best_velocity = 0.0
        self.current_set_reps = 0
    
    def process_rep(self, velocity: float) -> Tuple[bool, float]:
        self.current_set_reps += 1
        if velocity > self.best_velocity:
            self.best_velocity = velocity
            return False, 0.0
        
        if self.best_velocity > 0:
            loss_percent = (1.0 - (velocity / self.best_velocity)) * 100
            is_cutoff = loss_percent >= self.cutoff_percent
            return is_cutoff, loss_percent
        
        return False, 0.0
