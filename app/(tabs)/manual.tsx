import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import ExerciseService from '@/src/services/ExerciseService';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import type { SetData, Exercise } from '@/src/types/index';

interface ManualSet {
  exercise: string;
  loadKg: string;
  reps: string;
  rpe: string;
}

export default function ManualInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exercise, setExercise] = useState('ベンチプレス');
  const [saving, setSaving] = useState(false);
  const [masterExercises, setMasterExercises] = useState<Exercise[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [sets, setSets] = useState<ManualSet[]>([{
    exercise: 'ベンチプレス',
    loadKg: '',
    reps: '',
    rpe: '',
  }]);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    const all = await ExerciseService.getAllExercises();
    setMasterExercises(all);
    // デフォルトの種目がマスタにあるか確認
    if (all.length > 0 && !all.find(e => e.name === exercise)) {
      setExercise(all[0].name);
      setSets([{ exercise: all[0].name, loadKg: '', reps: '', rpe: '' }]);
    }
  };

  // クイック選択用の主要種目（Big 3 + α）
  const quickExercises = masterExercises.filter(e =>
    ['squat', 'bench', 'deadlift', 'press', 'pull'].includes(e.category)
  ).slice(0, 8);

  const addSet = () => {
    setSets([...sets, { exercise, loadKg: '', reps: '', rpe: '' }]);
  };

  const updateSet = (index: number, field: keyof ManualSet, value: string) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    setSets(newSets);
  };

  const removeSet = (index: number) => {
    if (sets.length <= 1) {
      Alert.alert('エラー', '最低1セットは必要です');
      return;
    }
    setSets(sets.filter((_, i) => i !== index));
  };

  const saveSession = async () => {
    for (let i = 0; i < sets.length; i++) {
      if (!sets[i].loadKg || !sets[i].reps) {
        Alert.alert('エラー', `${i + 1}セット目: 負荷と回数を入力してください`);
        return;
      }
    }

    setSaving(true);
    try {
      // UUID風のセッションID
      const sessionId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const today = new Date().toISOString().split('T')[0];

      // セットデータを構築
      const setDataList: SetData[] = sets.map((s, idx) => ({
        session_id: sessionId,
        lift: s.exercise,
        set_index: idx + 1,
        load_kg: parseFloat(s.loadKg) || 0,
        reps: parseInt(s.reps) || 0,
        device_type: 'manual',
        set_type: 'normal',
        avg_velocity: null,
        velocity_loss: null,
        rpe: s.rpe ? parseFloat(s.rpe) : undefined,
        timestamp: new Date().toISOString(),
      }));

      const totalVolume = setDataList.reduce((sum, s) => sum + s.load_kg * s.reps, 0);

      // DBにセッションを保存
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: today,
        total_volume: totalVolume,
        total_sets: setDataList.length,
        lifts: [...new Set(setDataList.map(s => s.lift))],
      });

      // 各セットを保存
      for (const setData of setDataList) {
        await DatabaseService.insertSet(setData);
      }

      // AIサマリーを生成して表示
      const summary = AICoachService.generateSessionSummary(setDataList);
      Alert.alert(
        '✅ 手動入力完了',
        `${sets.length}セットを記録しました。\n\n${summary}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('手動入力の保存失敗:', error);
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>手動入力</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 種目選択 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>種目</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
          {quickExercises.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={[styles.exerciseButton, exercise === ex.name && styles.exerciseButtonActive]}
              onPress={() => {
                setExercise(ex.name);
                setSets(sets.map(s => ({ ...s, exercise: ex.name })));
              }}
            >
              <Text style={[styles.exerciseButtonText, exercise === ex.name && styles.exerciseButtonTextActive]}>
                {ex.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.exerciseButton, styles.moreButton]}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.moreButtonText}>すべて見る...</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ExerciseSelectModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={(ex) => {
          setExercise(ex.name);
          setSets(sets.map(s => ({ ...s, exercise: ex.name })));
          setIsModalVisible(false);
        }}
      />

      {/* セット入力 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>セット</Text>
          <TouchableOpacity onPress={addSet} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ セット追加</Text>
          </TouchableOpacity>
        </View>

        {sets.map((set, index) => {
          // 速度が入力されている場合はゾーンを表示
          const vel = NaN; // 平均速度項目は削除済み
          const zone = null;

          return (
            <View key={index} style={styles.setCard}>
              <View style={styles.setCardHeader}>
                <Text style={styles.setNumber}>セット {index + 1}</Text>
                {sets.length > 1 && (
                  <TouchableOpacity onPress={() => removeSet(index)}>
                    <Text style={styles.removeButton}>削除</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGrid}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>負荷 (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={set.loadKg}
                    onChangeText={(value) => updateSet(index, 'loadKg', value)}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>回数</Text>
                  <TextInput
                    style={styles.input}
                    value={set.reps}
                    onChangeText={(value) => updateSet(index, 'reps', value)}
                    placeholder="5"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>RPE (1-10)</Text>
                  <TextInput
                    style={styles.input}
                    value={set.rpe}
                    onChangeText={(value) => updateSet(index, 'rpe', value)}
                    placeholder="8"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 入力済みの場合は概算ボリュームを表示 */}
              {set.loadKg && set.reps && (
                <Text style={styles.volumeText}>
                  ボリューム: {(parseFloat(set.loadKg) * parseInt(set.reps)).toFixed(0)} kg
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* 保存ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={saveSession} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>💾 保存して終了</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#333',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: { padding: 8 },
  backButtonText: { color: '#2196F3', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  placeholder: { width: 50 },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  addButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2196F3', borderRadius: 6 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  exerciseScroll: { flexDirection: 'row' },
  exerciseButton: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#2a2a2a', borderRadius: 20, marginRight: 8,
  },
  exerciseButtonActive: { backgroundColor: '#FF9800' },
  exerciseButtonText: { color: '#999', fontSize: 14 },
  exerciseButtonTextActive: { color: '#fff', fontWeight: '600' },
  moreButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
  },
  moreButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  setCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, marginBottom: 12 },
  setCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  setNumber: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  zoneTag: { fontSize: 14, fontWeight: '600' },
  removeButton: { color: '#F44336', fontSize: 14 },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  inputWrapper: { width: '48%', marginHorizontal: '1%', marginBottom: 12 },
  inputLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  input: {
    backgroundColor: '#3a3a3a', borderRadius: 8,
    padding: 12, color: '#fff', fontSize: 16, borderColor: 'transparent',
  },
  volumeText: { fontSize: 13, color: '#4CAF50', textAlign: 'right', marginTop: 4 },
  buttonContainer: { padding: 16, paddingBottom: 40 },
  saveButton: {
    backgroundColor: '#4CAF50', padding: 16, borderRadius: 12,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
