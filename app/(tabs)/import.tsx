import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import DatabaseService from '@/src/services/DatabaseService';
import ExerciseService from '@/src/services/ExerciseService';
import { GarageTheme } from '@/src/constants/garageTheme';
import type { SessionData } from '@/src/types/index';
import { formatSessionLabel } from '@/src/utils/session';

type ImportSummary = {
  sessionCount: number;
  setCount: number;
  repCount: number;
  lastSession: SessionData | null;
};

export default function ImportTab() {
  const isFocused = useIsFocused();
  const [summary, setSummary] = useState<ImportSummary>({
    sessionCount: 0,
    setCount: 0,
    repCount: 0,
    lastSession: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [inferringRom, setInferringRom] = useState(false);

  const loadSummary = async () => {
    await DatabaseService.initialize();
    const sessions = await DatabaseService.getSessions();

    let setCount = 0;
    let repCount = 0;
    for (const session of sessions) {
      const sets = await DatabaseService.getSetsForSession(session.session_id);
      setCount += sets.length;

      for (const set of sets) {
        const reps = await DatabaseService.getRepsForSet(session.session_id, set.lift, set.set_index);
        repCount += reps.length;
      }
    }

    setSummary({
      sessionCount: sessions.length,
      setCount,
      repCount,
      lastSession: sessions[0] ?? null,
    });
  };

  useEffect(() => {
    if (isFocused) {
      void loadSummary();
    }
  }, [isFocused]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSummary();
    } finally {
      setRefreshing(false);
    }
  };

  const handleInferRom = async () => {
    setInferringRom(true);
    try {
      const exercises = await ExerciseService.getAllExercises();
      for (const exercise of exercises) {
        await ExerciseService.inferRomRangeForLift(exercise.name);
      }
      await loadSummary();
      Alert.alert('ROM再推測完了', `${exercises.length}種目のROM範囲をデータから再計算しました。`);
    } catch (error) {
      console.error('Failed to infer ROM ranges:', error);
      Alert.alert('エラー', 'ROM範囲の再推測に失敗しました。');
    } finally {
      setInferringRom(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GarageTheme.accent} />}
    >
      <Text style={styles.eyebrow}>DATA BAY / ROM LAB</Text>
      <Text style={styles.title}>データ管理</Text>
      <Text style={styles.subtitle}>ローカルDBの状態確認とROM再推測をここで行います。</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>現在のローカルDB</Text>
        <View style={styles.heroStats}>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{summary.sessionCount}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>SETS</Text>
            <Text style={styles.statValue}>{summary.setCount}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>REPS</Text>
            <Text style={styles.statValue}>{summary.repCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>LATEST SESSION</Text>
        {summary.lastSession ? (
          <>
            <Text style={styles.cardMain}>{formatSessionLabel(summary.lastSession.session_id, summary.lastSession.date)}</Text>
            <Text style={styles.cardSub}>総セット {summary.lastSession.total_sets ?? 0} / 総ボリューム {Math.round(summary.lastSession.total_volume ?? 0)} kg</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>まだセッション記録がありません</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>SYSTEM STATUS</Text>
        <Text style={styles.cardBody}>この復元版には CSV / 外部ファイル import 実装は含まれていません。ここでは現在の端末内データの確認に寄せています。</Text>
      </View>

      <View style={styles.buttonStack}>
        <TouchableOpacity style={styles.refreshButton} onPress={() => void handleRefresh()}>
          <Text style={styles.refreshButtonText}>DATA REFRESH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleInferRom()} disabled={inferringRom}>
          <Text style={styles.secondaryButtonText}>{inferringRom ? 'ROM INFERENCE RUNNING...' : 'ROM RANGE INFERENCE'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 8,
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.4,
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: {
    color: GarageTheme.textStrong,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 1.8,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  statLabel: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  statValue: {
    color: GarageTheme.textStrong,
    fontSize: 24,
    fontWeight: '800',
  },
  card: {
    borderRadius: 18,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 1.8,
  },
  cardMain: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSub: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardBody: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: GarageTheme.textSubtle,
    fontSize: 14,
  },
  buttonStack: {
    gap: 12,
  },
  refreshButton: {
    borderRadius: 16,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondaryButton: {
    borderRadius: 16,
    backgroundColor: GarageTheme.surfaceAlt,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
