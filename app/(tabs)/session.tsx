/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTrainingStore } from '@/src/store/trainingStore';
import { useSessionLogic } from '@/src/hooks/useSessionLogic';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import PRNotification from '@/src/components/PRNotification';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import { RepDetailModal } from '@/src/components/RepDetailModal';
import { RepVelocityChart } from '@/src/components/RepVelocityChart';
import { calculateWarmupSteps, isBig3 } from '@/src/utils/WarmupLogic';
import type { Exercise, PRRecord, SetData } from '@/src/types/index';

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // PR検知時のモーダル状態
  const [prRecord, setPRRecord] = useState<PRRecord | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  // Custom Hook for Logic（PR検知コールバックを渡す）
  const {
    finishSet,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT
  } = useSessionLogic((pr: PRRecord) => {
    setPRRecord(pr);
    setShowPRModal(true);
  });

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    setHistory,
    currentSession,
    isSessionActive,
    sessionStartTime,
    currentLift,
    updateLoad,
    targetWeight,
    setTargetWeight,
    currentHeartRate,
    restStartTime,
    sessionHRPoints,
    repHistory,
    setCurrentExercise,
    startSession,
    endSession,
    isPaused,
    setPaused,
    pauseReason,

    // VBT Intelligence
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,
    setProposedMVT,
  } = useTrainingStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // レップ詳細モーダルの状態
  const [repDetailVisible, setRepDetailVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(1);

  // Fetch all reps on mount or when returning
  const [sessionAllReps, setSessionAllReps] = useState<any[]>([]);

  useEffect(() => {
    if (currentSession?.session_id) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(setSessionAllReps);
    }
  }, [currentSession?.session_id, setHistory]);

  const [inputTargetWeight, setInputTargetWeight] = useState('');
  const [inputLoad, setInputLoad] = useState('');

  // Sync input with store
  useEffect(() => {
    setInputLoad(currentLoad.toString());
  }, [currentLoad]);

  useEffect(() => {
    if (targetWeight !== null) {
      setInputTargetWeight(targetWeight.toString());
    } else {
      setInputTargetWeight('');
    }
  }, [targetWeight]);

  const handleTargetWeightChange = (text: string) => {
    setInputTargetWeight(text);
    const val = parseFloat(text);
    if (!isNaN(val)) setTargetWeight(val);
    else setTargetWeight(null);
  };

  const adjustLoad = (amount: number) => {
    const newLoad = Math.max(0, currentLoad + amount);
    updateLoad(newLoad);
  };

  const openRepDetail = (setIndex: number) => {
    setSelectedSetIndex(setIndex);
    setRepDetailVisible(true);
  };

  const handleLoadChange = (text: string) => {
    setInputLoad(text);
    const val = parseFloat(text);
    if (!isNaN(val)) updateLoad(val);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setShowExerciseModal(false);
  };

  const handleExclude = async (repId: string, reason: string) => {
    await handleExcludeRep(repId, reason);
    // Reload reps
    if (currentSession?.session_id) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(setSessionAllReps);
    }
  };

  // セッション開始処理
  const handleStartSession = async () => {
    if (!isConnected) {
      Alert.alert('センサー未接続', 'BLEセンサーを接続してからセッションを開始してください。');
      return;
    }
    // UUID風のセッションIDを生成
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startSession(sessionId);
    // DBにセッションレコードを作成
    try {
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: new Date().toISOString().split('T')[0],
        total_volume: 0,
        total_sets: 0,
        lifts: [],
      });
    } catch (e) {
      console.error('セッション作成失敗:', e);
    }
  };

  const handleFinishSet = () => {
    if (!isSessionActive) {
      Alert.alert('セッション未開始', 'まずセッションを開始してください。');
      return;
    }
    finishSet();
  };

  // セッション終了 & DBへの集計保存
  const handleFinishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert('セッション終了', 'セットが記録されていません。終了しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了', style: 'destructive', onPress: () => {
            endSession();
            router.back();
          }
        },
      ]);
      return;
    }

    // MVTの計算と提案（セッション終了時に行う）
    try {
      await calculateAndProposeMVT();
    } catch (e) {
      console.error('MVT提案計算に失敗（セッション終了は継続します）:', e);
    }

    // セッション集計をDBに更新
    if (currentSession?.session_id) {
      try {
        const totalVolume = setHistory.reduce((sum, s) => sum + (s.load_kg * s.reps), 0);
        const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const avgHr = sessionHRPoints.length > 0 ? sessionHRPoints.reduce((s, x) => s + x, 0) / sessionHRPoints.length : undefined;

        await DatabaseService.updateSession({
          session_id: currentSession.session_id,
          date: currentSession.date || new Date().toISOString().split('T')[0],
          total_volume: totalVolume,
          total_sets: setHistory.length,
          duration_minutes: durationMin,
          duration_seconds: Math.round(durationMs / 1000),
          start_timestamp: currentSession.start_timestamp,
          end_timestamp: new Date().toISOString(),
          avg_hr: avgHr,
          notes: currentSession.notes,
        });
      } catch (e) {
        console.error('セッション集計の保存に失敗:', e);
      }
    }

    endSession();
    Alert.alert('セッション完了', `${setHistory.length}セットを保存しました。`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleAcceptMVT = async () => {
    if (!currentLift || proposedMVT === null) return;
    try {
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      if (existingLvp) {
        await DatabaseService.saveLVPProfile({
          ...existingLvp,
          mvt: proposedMVT,
          last_updated: new Date().toISOString()
        });
        Alert.alert('MVT更新', `${currentLift}の限界速度を ${proposedMVT}m/s に更新しました。`);
        setProposedMVT(null); // バナーを閉じる
      }
    } catch (e) {
      console.error('MVT更新失敗:', e);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>セッション</Text>
        {/* AIコーチボタン */}
        <TouchableOpacity
          style={styles.coachNavButton}
          onPress={() => router.push('/coach-chat' as any)}
        >
          <Text style={styles.coachNavButtonText}>🤖 AI</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'センサー接続中' : 'センサー未接続'}
          </Text>
        </View>
        {currentHeartRate && (
          <View style={styles.hrBadge}>
            <Text style={styles.hrEmoji}>❤️</Text>
            <Text style={styles.hrValue}>{Math.round(currentHeartRate)}</Text>
            <Text style={styles.hrUnit}>bpm</Text>
          </View>
        )}
      </View>

      {/* セッション開始バナー */}
      {!isSessionActive ? (
        <View style={styles.sessionStartBanner}>
          <Text style={styles.sessionStartText}>セッションを開始してください</Text>
          <TouchableOpacity
            style={[styles.button, styles.startSessionButton]}
            onPress={handleStartSession}
          >
            <Text style={styles.buttonText}>🏋️ セッション開始</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sessionActiveBanner}>
          <Text style={styles.sessionActiveText}>
            ✅ セット {currentSetIndex} 記録中
          </Text>
          <TouchableOpacity
            style={[styles.pauseBtn, isPaused && styles.pausedBtnActive]}
            onPress={() => {
              if (isPaused) {
                // 再開時：履歴を保持するため resumeSet を使用
                resumeSet();
              } else {
                // 一時停止時はsetPausedを使用
                setPaused(true, 'manual');
              }
            }}
          >
            <View style={styles.pauseBtnContent}>
              <Text style={styles.pauseBtnIcon}>{isPaused ? '▶' : '⏸'}</Text>
              <Text style={styles.pauseBtnText}>{isPaused ? '再開' : '一時停止'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* CNS Battery & VBT Intelligence Summary */}
      {isSessionActive && (
        <View style={styles.intelligenceRow}>
          <View style={styles.cnsBatteryContainer}>
            <Text style={styles.cnsLabel}>CNS BATTERY™</Text>
            <View style={styles.batteryGageBg}>
              <View style={[styles.batteryGageFill, { width: `${cnsBattery}%`, backgroundColor: cnsBattery > 70 ? '#4CAF50' : cnsBattery > 40 ? '#FF9800' : '#F44336' }]} />
            </View>
            <Text style={styles.cnsValue}>{cnsBattery}%</Text>
          </View>

          {estimated1RM !== null && (
            <View style={styles.intelligenceBadge}>
              <Text style={styles.intelligenceLabel}>本日予想 1RM</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.intelligenceValue}>{estimated1RM}</Text>
                <Text style={styles.unitSmall}>kg</Text>
              </View>
              {estimated1RM_confidence && (
                <View style={[
                  styles.confidenceIndicator,
                  { backgroundColor: estimated1RM_confidence === 'high' ? '#4CAF50' : estimated1RM_confidence === 'medium' ? '#FF9800' : '#F44336' }
                ]}>
                  <Text style={styles.confidenceText}>
                    {estimated1RM_confidence === 'high' ? 'High' : estimated1RM_confidence === 'medium' ? 'Med' : 'Low'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Adaptive Load Suggestion */}
      {isSessionActive && suggestedLoad !== null && suggestedLoad !== currentLoad && (
        <TouchableOpacity
          style={styles.suggestionBanner}
          onPress={() => handleLoadChange(suggestedLoad.toString())}
        >
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionEmoji}>💡</Text>
            <Text style={styles.suggestionText}>
              推奨重量: <Text style={styles.suggestionWeight}>{suggestedLoad}kg</Text> に変更しますか？
            </Text>
          </View>
          <Text style={styles.applyText}>適用する</Text>
        </TouchableOpacity>
      )}

      {/* MVT Proposal Banner */}
      {!isSessionActive && proposedMVT !== null && currentLift && (
        <View style={[styles.suggestionBanner, { backgroundColor: '#4C1D95', borderLeftColor: '#8B5CF6' }]}>
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionEmoji}>🎯</Text>
            <View>
              <Text style={styles.suggestionText}>
                {currentLift}の新しい限界速度(MVT)候補:
              </Text>
              <Text style={[styles.suggestionWeight, { color: '#C4B5FD', fontSize: 16 }]}>{proposedMVT} m/s</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setProposedMVT(null)}>
              <Text style={[styles.applyText, { color: '#9CA3AF' }]}>無視</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAcceptMVT}>
              <Text style={[styles.applyText, { color: '#C4B5FD', fontSize: 14 }]}>更新する</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rest Timer Banner */}
      {isSessionActive && isPaused && pauseReason === 'rest' && (
        <View style={styles.restBanner}>
          <View style={styles.restHeader}>
            <Text style={styles.restLabel}>RESTING...</Text>
            <RestTimer startTime={restStartTime || 0} hr={currentHeartRate} peakHr={setHistory.length > 0 ? setHistory[setHistory.length - 1].peak_hr : null} />
          </View>
          <TouchableOpacity
            style={styles.startNextSetButton}
            onPress={startSet}
          >
            <Text style={styles.startNextSetText}>次のセットを開始</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise Selection */}
      <View style={styles.exerciseCard}>
        <Text style={styles.exerciseLabel}>種目</Text>
        {currentExercise ? (
          <TouchableOpacity
            style={styles.exerciseSelector}
            onPress={() => setShowExerciseModal(true)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseCategory}>
                {currentExercise.category}
              </Text>
            </View>
            <Text style={styles.exerciseChange}>変更</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.exerciseSelectButton}
            onPress={() => setShowExerciseModal(true)}
          >
            <Text style={styles.exerciseSelectButtonText}>種目を選択</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Target Weight Input (Big 3 Only) */}
      {isBig3(currentExercise?.category) && isSessionActive && (
        <View style={styles.targetWeightCard}>
          <Text style={styles.targetWeightLabel}>今日の目標重量 (Top Set)</Text>
          <View style={styles.targetInputRow}>
            <TextInput
              style={styles.targetInput}
              value={inputTargetWeight}
              onChangeText={handleTargetWeightChange}
              placeholder="最高重量を入力"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            <Text style={styles.unitText}>kg</Text>
          </View>
        </View>
      )}

      {/* Warmup Guide */}
      {isBig3(currentExercise?.category) && targetWeight && isSessionActive && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ウォームアップガイド</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.warmupScroll}>
            {calculateWarmupSteps(targetWeight).map((step, idx) => {
              const isCurrent = currentLoad === step.load_kg;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.warmupStep, isCurrent && styles.warmupStepActive]}
                  onPress={() => handleLoadChange(step.load_kg.toString())}
                >
                  <Text style={[styles.warmupStepLabel, isCurrent && styles.warmupStepLabelActive]}>
                    {step.label}
                  </Text>
                  <Text style={[styles.warmupWeight, isCurrent && styles.warmupWeightActive]}>
                    {step.load_kg}kg
                  </Text>
                  <Text style={[styles.warmupReps, isCurrent && styles.warmupRepsActive]}>
                    {step.reps > 0 ? `${step.reps} reps` : 'メイン'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Set Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>セット設定</Text>
        <View style={styles.loadControlContainer}>
          <Text style={styles.loadControlLabel}>負荷 (kg)</Text>
          <View style={styles.loadControlWrapper}>
            <View style={styles.loadAdjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(-5)}>
                <Text style={styles.adjustBtnText}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(-1)}>
                <Text style={styles.adjustBtnText}>-1</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.loadDisplayValue}>
              <Text style={styles.loadDisplayValueText}>{currentLoad}</Text>
            </View>
            <View style={styles.loadAdjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(1)}>
                <Text style={styles.adjustBtnText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(5)}>
                <Text style={styles.adjustBtnText}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Live データ表示 */}
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>ライブデータ</Text>
        {liveData ? (
          <>
            {/* 速度ゾーンバッジ */}
            {(() => {
              const zone = AICoachService.getZone(liveData.mean_velocity);
              return (
                <View style={[styles.zoneBadge, { borderColor: zone.color }]}>
                  <Text style={styles.zoneEmoji}>{zone.emoji}</Text>
                  <Text style={[styles.zoneName, { color: zone.color }]}>{zone.name}ゾーン</Text>
                </View>
              );
            })()}
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>平均速度</Text>
              <Text style={[styles.dataValue, {
                color: AICoachService.getZone(liveData.mean_velocity).color
              }]}>
                {liveData.mean_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>ピーク速度</Text>
              <Text style={styles.dataValue}>
                {liveData.peak_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>可動域</Text>
              <Text style={styles.dataValue}>{liveData.rom_cm.toFixed(0)} cm</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>レップ待機中...</Text>
        )}
      </View>

      {/* レップ毎の平均速度推移グラフ */}
      {isSessionActive && repHistory && repHistory.length > 0 && (
        <RepVelocityChart reps={repHistory} setIndex={currentSetIndex} />
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.recordButton]}
          onPress={handleFinishSet}
        >
          <Text style={styles.buttonText}>セット完了</Text>
        </TouchableOpacity>
      </View>

      {/* AIコーチアドバイスカード */}
      {setHistory.length > 0 && (() => {
        const advice = AICoachService.getCoachingAdvice(
          setHistory, currentSetIndex, currentExercise
        );
        const colorMap = {
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FF9800',
          alert: '#F44336',
        };
        return (
          <View style={[styles.coachCard, { borderColor: colorMap[advice.severity] }]}>
            <Text style={styles.coachEmoji}>{advice.emoji}</Text>
            <View style={styles.coachContent}>
              <Text style={[styles.coachMessage, { color: colorMap[advice.severity] }]}>
                {advice.message}
              </Text>
              {advice.suggestedAction && (
                <Text style={styles.coachAction}>{advice.suggestedAction}</Text>
              )}
            </View>
          </View>
        );
      })()}

      {/* セッション履歴 */}
      {setHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>セッション履歴</Text>
          {setHistory.map((set, idx) => {
            const zone = set.avg_velocity ? AICoachService.getZone(set.avg_velocity) : null;
            return (
              <TouchableOpacity key={idx} style={styles.setCard} onPress={() => openRepDetail(set.set_index)}>
                <View style={styles.setHeader}>
                  <Text style={styles.setNumberText}>セット {set.set_index}</Text>
                  <Text style={styles.setLoad}>{set.load_kg} kg × {set.reps}</Text>
                  {zone && <Text style={{ color: zone.color, fontSize: 14 }}>{zone.emoji}</Text>}
                </View>
                <View style={styles.setRowDetail}>
                  <Text style={[styles.setVelocity, zone ? { color: zone.color } : {}]}>
                    平均速度: {set.avg_velocity?.toFixed(2)} m/s
                  </Text>
                  {set.velocity_loss !== undefined && set.velocity_loss !== null && (
                    <Text style={styles.setVelocityLoss}>
                      速度低下: {set.velocity_loss.toFixed(1)}%
                    </Text>
                  )}
                  {set.avg_hr !== undefined && (
                    <Text style={styles.setHR}>
                      ❤️ {Math.round(set.avg_hr)} bpm
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* End Session */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={handleFinishSession}
        >
          <Text style={styles.buttonText}>セッション終了</Text>
        </TouchableOpacity>
      </View>

      {/* エクササイズ選択モーダル */}
      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelect}
        currentExerciseId={currentExercise?.id}
      />

      {/* PR達成通知モーダル */}
      <PRNotification
        visible={showPRModal}
        prRecord={prRecord}
        onClose={() => setShowPRModal(false)}
      />
      {/* レップ詳細モーダル */}
      <RepDetailModal
        visible={repDetailVisible}
        reps={sessionAllReps}
        setIndex={selectedSetIndex}
        onClose={() => setRepDetailVisible(false)}
        onExcludeRep={handleExclude}
        onMarkFailedRep={handleMarkFailedRep}
      />

    </ScrollView>
  );
}

/**
 * レストタイマーコンポーネント
 */
function RestTimer({ startTime, hr, peakHr }: { startTime: number, hr: number | null, peakHr: number | null | undefined }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isReady = hr && peakHr ? (hr < 120 || hr < peakHr * 0.8) : false;

  return (
    <View style={styles.timerRow}>
      <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      {isReady && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>READY 🔥</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  setNumber: {
    fontSize: 16,
    color: '#999',
  },
  statusCard: {
    margin: 16,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  hrEmoji: { fontSize: 14 },
  hrValue: { fontSize: 16, fontWeight: 'bold', color: '#ff4444' },
  hrUnit: { fontSize: 10, color: '#999' },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  exerciseLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  exerciseCategory: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  exerciseChange: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  exerciseSelectButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
  },
  loadControlContainer: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  loadControlLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadControlWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadAdjustRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: '#333',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  adjustBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadDisplayValue: {
    minWidth: 80,
    alignItems: 'center',
  },
  loadDisplayValueText: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: 'bold',
  },
  dataCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    minHeight: 120,
    justifyContent: 'center',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dataLabel: {
    fontSize: 16,
    color: '#999',
  },
  dataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  noDataText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  finishButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  setLoad: {
    fontSize: 14,
    color: '#2196F3',
  },
  setRowDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  setVelocity: {
    fontSize: 14,
    color: '#4CAF50',
  },
  setVelocityLoss: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '500',
  },
  // セッション開始/アクティブバナー
  sessionStartBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
    alignItems: 'center',
  },
  sessionStartText: {
    fontSize: 16,
    color: '#FF9800',
    marginBottom: 12,
    fontWeight: '600',
  },
  startSessionButton: {
    backgroundColor: '#FF9800',
    width: '100%',
  },
  sessionActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#1a2a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  sessionActiveText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  pauseBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#555',
  },
  pausedBtnActive: {
    backgroundColor: '#FF9800',
    borderColor: '#F57C00',
  },
  pauseBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pauseBtnIcon: {
    color: '#fff',
    fontSize: 14,
  },
  pauseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // レストバナー
  restBanner: {
    marginHorizontal: 16, marginBottom: 16, padding: 16,
    backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#3f51b5',
  },
  restHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  restLabel: { fontSize: 12, color: '#3f51b5', fontWeight: 'bold' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerText: { fontSize: 24, fontWeight: 'bold', color: '#fff', fontVariant: ['tabular-nums'] },
  readyBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  readyText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  startNextSetButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  startNextSetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 速度ゾーンバッジ
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  zoneEmoji: { fontSize: 22 },
  zoneName: { fontSize: 16, fontWeight: 'bold' },
  // AIコーチカード
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  coachEmoji: { fontSize: 28, lineHeight: 32 },
  coachContent: { flex: 1 },
  coachMessage: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  coachAction: { fontSize: 13, color: '#bbb', lineHeight: 18 },
  // AIコーチボタン（ヘッダー）
  coachNavButton: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#1565C0', borderRadius: 16,
    borderWidth: 1, borderColor: '#2196F3',
  },
  coachNavButtonText: { color: '#2196F3', fontSize: 14, fontWeight: '600' },
  // Target Weight & Warmup UI
  targetWeightCard: {
    marginHorizontal: 16, marginBottom: 16, padding: 16,
    backgroundColor: '#2a2a2a', borderRadius: 12, borderWidth: 1, borderColor: '#444',
  },
  targetWeightLabel: { fontSize: 13, color: '#2196F3', fontWeight: 'bold', marginBottom: 10 },
  targetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetInput: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12,
    color: '#fff', fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#333'
  },
  unitText: { color: '#999', fontSize: 16 },
  warmupScroll: { marginTop: 4, paddingBottom: 8 },
  warmupStep: {
    backgroundColor: '#2a2a2a', borderRadius: 10, padding: 12,
    marginRight: 10, minWidth: 85, alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  warmupStepActive: { backgroundColor: '#1a1a1a', borderColor: '#2196F3', borderWidth: 2 },
  warmupStepLabel: { fontSize: 10, color: '#999', marginBottom: 4 },
  warmupStepLabelActive: { color: '#2196F3', fontWeight: 'bold' },
  warmupWeight: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  warmupWeightActive: { color: '#2196F3' },
  warmupReps: { fontSize: 10, color: '#666', marginTop: 2 },
  warmupRepsActive: { color: '#999' },
  // VBT Intelligence & CNS Battery UI
  intelligenceRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  cnsBatteryContainer: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cnsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 6,
  },
  batteryGageBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  batteryGageFill: {
    height: '100%',
    borderRadius: 4,
  },
  cnsValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  intelligenceBadge: {
    width: 100,
    backgroundColor: '#2a2a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  intelligenceLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
    textAlign: 'center',
  },
  intelligenceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  unitSmall: {
    fontSize: 10,
    color: '#999',
  },
  confidenceIndicator: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Adaptive Load Suggestion
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { color: '#fff', fontSize: 14 },
  suggestionWeight: { fontWeight: 'bold', color: '#60A5FA' },
  applyText: { color: '#60A5FA', fontSize: 12, fontWeight: 'bold' },
  setHR: { fontSize: 13, color: '#F44336', marginTop: 2, fontWeight: 'bold' },
});



