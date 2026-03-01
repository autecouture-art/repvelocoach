import { SessionData, SetData, RepData } from '../types';

/**
 * トレーニングセッションのデータをAI相談用にフォーマットする
 */
export const formatSessionForAI = (session: SessionData, sets: SetData[], reps: RepData[]): string => {
    let text = `# RepVelo VBT トレーニングログ: ${session.date}\n`;

    if (session.notes) {
        text += `全体のメモ: ${session.notes}\n`;
    }

    text += `総ボリューム: ${Math.round(session.total_volume).toLocaleString()} kg\n`;
    text += `総セット数: ${session.total_sets}\n`;

    if (session.duration_seconds) {
        const min = Math.floor(session.duration_seconds / 60);
        const sec = session.duration_seconds % 60;
        text += `総経過時間: ${min}分${sec}秒\n`;
    } else if (session.duration_minutes) {
        text += `実施時間: ${session.duration_minutes} 分\n`;
    }

    if (session.avg_hr) {
        text += `平均心拍数: ${Math.round(session.avg_hr)} bpm\n`;
    }

    text += `\n---\n`;

    // 種目ごとにまとめる
    const lifts = Array.from(new Set(sets.map(s => s.lift)));

    lifts.forEach(lift => {
        text += `\n## 種目: ${lift}\n`;
        const liftSets = sets.filter(s => s.lift === lift);

        liftSets.forEach((set, idx) => {
            text += `\n### セット ${set.set_index}\n`;
            text += `- 負荷: ${set.load_kg} kg\n`;
            text += `- レップ数: ${set.reps}\n`;
            text += `- 平均速度: ${set.avg_velocity?.toFixed(2) || '-'} m/s\n`;

            if (set.velocity_loss != null) {
                text += `- 速度損失 (VL): ${set.velocity_loss.toFixed(1)}%\n`;
            }

            if (set.rpe) {
                text += `- RPE: ${set.rpe}\n`;
            }

            if (set.e1rm) {
                text += `- 推定1RM (e1RM): ${set.e1rm.toFixed(1)} kg\n`;
            }

            if (set.avg_hr) {
                text += `- 平均/最大心拍数: ${Math.round(set.avg_hr)} / ${Math.round(set.peak_hr || 0)} bpm\n`;
            }

            if (set.rest_duration_s) {
                const rMin = Math.floor(set.rest_duration_s / 60);
                const rSec = Math.round(set.rest_duration_s % 60);
                text += `- 休憩時間: ${rMin}分${rSec}秒\n`;
            }

            if (set.notes) {
                text += `- メモ: ${set.notes}\n`;
            }

            // レップごとの詳細
            const setReps = reps.filter(r => r.lift === lift && r.set_index === set.set_index);
            if (setReps.length > 0) {
                const repVels = setReps.map(r => r.mean_velocity?.toFixed(2) || '-').join(', ');
                text += `- 各レップ速度: [${repVels}] m/s\n`;
            }
        });
    });

    text += `\n---\n`;
    text += `【AIへの相談内容】\n`;
    text += `このデータを元に、今日のトレーニング内容の分析、次回へのアドバイス（重量設定や休憩時間、疲労度の評価など）をお願いします。特に出力速度の低下具合や心拍数の回復状況から、今日のコンディションをどう判断できますか？\n`;

    return text;
};
