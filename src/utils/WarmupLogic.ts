/**
 * Warmup Logic for Big 3 Exercises
 */

export interface WarmupStep {
    load_kg: number;
    reps: number;
    percentage: number;
    label: string;
}

/**
 * 目標重量（Top Set）からアップセットの配列を生成する
 * @param targetWeight 
 * @returns 
 */
export const calculateWarmupSteps = (targetWeight: number): WarmupStep[] => {
    const steps: WarmupStep[] = [];

    // 1. 空バー (20kg)
    steps.push({
        load_kg: 20,
        reps: 10,
        percentage: 0,
        label: '空バー',
    });

    if (targetWeight <= 20) return steps;

    // 2. 40%
    const w40 = roundTo2_5(targetWeight * 0.4);
    if (w40 > 20) {
        steps.push({
            load_kg: w40,
            reps: 8,
            percentage: 40,
            label: '40%',
        });
    }

    // 3. 60%
    const w60 = roundTo2_5(targetWeight * 0.6);
    if (w60 > w40) {
        steps.push({
            load_kg: w60,
            reps: 5,
            percentage: 60,
            label: '60%',
        });
    }

    // 4. 75%
    const w75 = roundTo2_5(targetWeight * 0.75);
    if (w75 > w60) {
        steps.push({
            load_kg: w75,
            reps: 3,
            percentage: 75,
            label: '75%',
        });
    }

    // 5. 85%
    const w85 = roundTo2_5(targetWeight * 0.85);
    if (w85 > w75) {
        steps.push({
            load_kg: w85,
            reps: 2,
            percentage: 85,
            label: '85%',
        });
    }

    // 6. 93% (非常に重い場合のみ)
    if (targetWeight >= 100) {
        const w93 = roundTo2_5(targetWeight * 0.93);
        if (w93 > w85) {
            steps.push({
                load_kg: w93,
                reps: 1,
                percentage: 93,
                label: '93%',
            });
        }
    }

    // 7. メイン
    steps.push({
        load_kg: targetWeight,
        reps: 0, // ユーザーが決める
        percentage: 100,
        label: 'メイン',
    });

    return steps;
};

/**
 * 重量を2.5kg刻みで丸める
 */
const roundTo2_5 = (weight: number): number => {
    return Math.round(weight / 2.5) * 2.5;
};

/**
 * ビッグ3かどうかを判定する
 */
export const isBig3 = (category: string | undefined): boolean => {
    if (!category) return false;
    const big3 = ['squat', 'bench', 'deadlift'];
    return big3.includes(category.toLowerCase());
};
