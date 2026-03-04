/**
 * AICoachService
 * VBTデータをもとにAIコーチングアドバイスを生成するサービス
 * 将来的にはLLM APIを呼び出す基盤として設計
 */

import type { SetData, AppSettings } from '../types/index';

// 速度ゾーンの定義
const VELOCITY_ZONES = {
    power: { min: 1.0, name: 'パワー', emoji: '🔥', color: '#FFD700' },
    strengthSpeed: { min: 0.75, name: 'スピード・ストレングス', emoji: '⚡', color: '#FF8C00' },
    hypertrophy: { min: 0.5, name: '筋肥大', emoji: '💪', color: '#32CD32' },
    strength: { min: 0, name: '筋力', emoji: '🏋️', color: '#DC143C' },
} as const;

export interface CoachingAdvice {
    message: string;           // メインアドバイス（日本語）
    emoji: string;             // アドバイスの感情を表すアイコン
    severity: 'info' | 'warning' | 'success' | 'alert';
    suggestedAction?: string;  // 具体的な行動提案
}

export interface LoadSuggestion {
    suggestedLoad: number;     // 推奨重量 (kg)
    reason: string;            // 理由
    percentChange: number;     // 変化率 (正=増加、負=減少)
}

export class AICoachService {
    /**
     * 速度ゾーンを返す
     */
    static getZone(velocity: number): typeof VELOCITY_ZONES[keyof typeof VELOCITY_ZONES] {
        if (velocity >= VELOCITY_ZONES.power.min) return VELOCITY_ZONES.power;
        if (velocity >= VELOCITY_ZONES.strengthSpeed.min) return VELOCITY_ZONES.strengthSpeed;
        if (velocity >= VELOCITY_ZONES.hypertrophy.min) return VELOCITY_ZONES.hypertrophy;
        return VELOCITY_ZONES.strength;
    }

    /**
     * 種目別の最新VL閾値を取得（2024-2025論文に基づく）
     */
    static getVlThresholdByExercise(category: string): number {
        switch (category?.toLowerCase()) {
            case 'squat': return 20;
            case 'bench': return 10;
            case 'deadlift': return 5;
            default: return 20; // 補助種目等はデフォルト20%
        }
    }

    /**
     * セット履歴をもとにコーチングアドバイスを生成
     * @param setHistory  今セッションの全セット履歴
     * @param currentSet  現在のセット番号
     * @param exercise    現在の種目
     * @param settings    アプリ設定（閾値など）
     */
    static getCoachingAdvice(
        setHistory: SetData[],
        currentSet: number,
        exercise?: any,
        settings?: Partial<AppSettings>
    ): CoachingAdvice {
        // 最新論文に基づく種目別閾値を優先、設定があればそちらを使用
        const paperThreshold = this.getVlThresholdByExercise(exercise?.category);
        const vlThreshold = settings?.velocity_loss_threshold ?? paperThreshold;

        // セットが少ない場合
        if (setHistory.length < 2) {
            return {
                message: 'ウォームアップ完了！本セットを頑張りましょう。',
                emoji: '💪',
                severity: 'info',
            };
        }

        const recentSets = setHistory.slice(-3); // 直近3セット
        const avgVelocities = recentSets
            .map((s) => s.avg_velocity)
            .filter((v): v is number => v !== null && v !== undefined);

        if (avgVelocities.length < 2) {
            return {
                message: 'データを記録中です。次のセットも続けましょう！',
                emoji: '📊',
                severity: 'info',
            };
        }

        // 速度トレンドを計算（最初と最後）
        const firstVel = avgVelocities[0];
        const lastVel = avgVelocities[avgVelocities.length - 1];
        const velocityDrop = ((firstVel - lastVel) / firstVel) * 100;

        // 最後のセットのVelocity Loss
        const lastSet = setHistory[setHistory.length - 1];
        const lastVL = lastSet.velocity_loss ?? 0;

        // 急激な疲労
        if (velocityDrop > 20 || lastVL > vlThreshold * 1.5) {
            return {
                message: `疲労が蓄積しています。速度が${velocityDrop.toFixed(1)}%低下しました。`,
                emoji: '⚠️',
                severity: 'alert',
                suggestedAction: '10〜15分の休憩を取るか、重量を10%下げることをお勧めします。',
            };
        }

        // Velocity Loss超過
        if (lastVL > vlThreshold) {
            return {
                message: `${exercise?.name || '種目'}のVL閾値(${vlThreshold}%)を超過しました。`,
                emoji: '🛑',
                severity: 'warning',
                suggestedAction: '休憩時間を延ばすか、次のセットの重量を5%下げてみてください。',
            };
        }

        // 速度が安定している場合
        if (Math.abs(velocityDrop) < 5) {
            return {
                message: `速度が安定しています（平均${lastVel.toFixed(2)} m/s）。`,
                emoji: '✅',
                severity: 'success',
                suggestedAction: '次のセットは少し重量を上げることができます！',
            };
        }

        // 通常の疲労
        return {
            message: `セット${currentSet}完了。速度は${velocityDrop.toFixed(1)}%低下しています。`,
            emoji: '📉',
            severity: 'info',
            suggestedAction: '適切な休憩（2〜3分）を取って次のセットに備えましょう。',
        };
    }

    /**
     * 次のセットの推奨重量を計算
     * @param avgVelocity  直前セットの平均速度
     * @param targetZone   目標速度ゾーン
     * @param currentLoad  現在の重量 (kg)
     */
    static suggestNextLoad(
        avgVelocity: number,
        targetZone: keyof typeof VELOCITY_ZONES,
        currentLoad: number,
    ): LoadSuggestion {
        const target = VELOCITY_ZONES[targetZone];
        const targetVel = target.min + 0.1; // ゾーン下限より少し余裕を持つ

        if (avgVelocity < target.min) {
            // 遅すぎる（重量が重すぎる） → 重量を減らす
            const velocityDiff = target.min - avgVelocity;
            // 速度差に応じて1〜10%の範囲で減量を提案
            const percentChange = Math.max(
                Math.round((velocityDiff / target.min) * -50),
                -10
            );
            const newLoad = Math.round((currentLoad * (1 + percentChange / 100)) / 2.5) * 2.5;
            return {
                suggestedLoad: Math.max(newLoad, 0),
                reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンの最小値(${target.min.toFixed(2)} m/s)を下回っています。重量を少し下げて速度を維持しましょう。`,
                percentChange,
            };
        } else if (avgVelocity > targetVel + 0.05) {
            // 速すぎる（重量が軽すぎる） → 重量を増やす
            const velocityDiff = avgVelocity - targetVel;
            // 速度差に応じて1〜10%の範囲で増量を提案
            const percentChange = Math.min(
                Math.round((velocityDiff / targetVel) * 50),
                10
            );
            const newLoad = Math.round((currentLoad * (1 + percentChange / 100)) / 2.5) * 2.5;
            return {
                suggestedLoad: newLoad,
                reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンで非常にスムーズです。出力を高めるために重量を少し増やしてみましょう。`,
                percentChange,
            };
        }

        // ゾーン内 → 維持
        return {
            suggestedLoad: currentLoad,
            reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーン内です`,
            percentChange: 0,
        };
    }

    /**
     * セッション全体のサマリーを生成
     */
    static generateSessionSummary(setHistory: SetData[]): string {
        if (setHistory.length === 0) return 'セッションデータがありません。';

        const totalVolume = setHistory.reduce((sum, s) => sum + s.load_kg * s.reps, 0);
        const avgVel = setHistory
            .filter((s) => s.avg_velocity != null)
            .reduce((sum, s) => sum + (s.avg_velocity ?? 0), 0) / setHistory.length;
        const maxLoad = Math.max(...setHistory.map((s) => s.load_kg));
        const zone = this.getZone(avgVel);

        return `${zone.emoji} ${setHistory.length}セット完了！\n` +
            `平均速度: ${avgVel.toFixed(2)} m/s (${zone.name}ゾーン)\n` +
            `最大重量: ${maxLoad} kg | 総ボリューム: ${Math.round(totalVolume).toLocaleString()} kg`;
    }
}

export default AICoachService;
