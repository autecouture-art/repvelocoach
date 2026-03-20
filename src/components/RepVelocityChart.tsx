import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RepData } from '../types/index';
import AICoachService from '../services/AICoachService';

interface Props {
  reps: RepData[];
  setIndex: number;
}

export function RepVelocityChart({ reps, setIndex }: Props) {
  const setReps = reps.filter((rep) => rep.set_index === setIndex && !rep.is_excluded);

  if (setReps.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>まだレップデータがありません</Text>
      </View>
    );
  }

  const maxVelocity = Math.max(...setReps.map((rep) => rep.mean_velocity ?? 0), 0.1);

  return (
    <View style={styles.container}>
      {setReps.map((rep) => {
        const velocity = rep.mean_velocity ?? 0;
        const width = `${Math.max(6, (velocity / maxVelocity) * 100)}%` as `${number}%`;
        const zone = AICoachService.getZone(velocity);
        return (
          <View key={rep.id ?? `${rep.set_index}-${rep.rep_index}`} style={styles.row}>
            <Text style={styles.label}>R{rep.rep_index}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width, backgroundColor: zone.color }]} />
            </View>
            <Text style={[styles.value, { color: zone.color }]}>{velocity.toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 28, color: '#9CA3AF', fontSize: 12 },
  track: { flex: 1, height: 14, backgroundColor: '#1F2937', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, minWidth: 6 },
  value: { width: 48, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  empty: { paddingVertical: 8 },
  emptyText: { color: '#6B7280', fontSize: 12 },
});
