export interface WarmupStep {
  label: string;
  load_kg: number;
  reps: number;
}

export function isBig3(category?: string | null): boolean {
  if (!category) return false;
  return ['squat', 'bench', 'deadlift'].includes(category);
}

function roundToHalf(load: number): number {
  return Math.max(0, Math.round(load * 2) / 2);
}

export function calculateWarmupSteps(targetWeight: number): WarmupStep[] {
  if (!targetWeight || targetWeight <= 0) return [];

  const template = [
    { label: 'BAR', ratio: 0.2, reps: 10 },
    { label: 'WU1', ratio: 0.4, reps: 8 },
    { label: 'WU2', ratio: 0.55, reps: 5 },
    { label: 'WU3', ratio: 0.7, reps: 3 },
    { label: 'WU4', ratio: 0.82, reps: 1 },
    { label: 'TOP', ratio: 1, reps: 0 },
  ];

  return template.map((step) => ({
    label: step.label,
    load_kg: step.label === 'BAR' ? Math.min(20, roundToHalf(targetWeight * step.ratio)) : roundToHalf(targetWeight * step.ratio),
    reps: step.reps,
  }));
}
