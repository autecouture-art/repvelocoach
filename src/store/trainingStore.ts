/**
 * Training Store - Zustand State Management
 * Manages VBT training session state, ensuring data persistence across screens.
 */

import { create } from 'zustand';
import type {
  TrainingSession,
  SessionData,
  SetData,
  RepData,
  Exercise,
  LVPData,
  PRRecord,
  AppSettings,
  RepVeloData,
} from '../types/index';

interface TrainingState {
  // Session State
  currentSession: TrainingSession | null;
  isSessionActive: boolean;
  sessionStartTime: number | null; // ms
  sessionStartTimeStamp: string | null; // ISO

  // Current Set State
  currentSetIndex: number; // 1-based
  currentLift: string | null;
  currentLoad: number;
  currentReps: number;
  targetWeight: number | null; // 今日の目標（トップセット）重量
  setHistory: SetData[];
  setStartTimeStamp: string | null; // セット開始時の ISO
  restStartTime: number | null; // 休憩開始時の ms

  // Live Data State
  isConnected: boolean;
  liveData: RepVeloData | null;
  repHistory: RepData[]; // Current set reps
  currentHeartRate: number | null;
  sessionHRPoints: number[]; // セッション中の心拍数データポイント
  setHRPoints: number[]; // 各セット中の心拍数データポイント

  // Settings & Metadata
  currentExercise: Exercise | null;
  settings: AppSettings;

  // Actions
  startSession: (sessionId: string) => void;
  endSession: () => void;
  setConnectionStatus: (status: boolean) => void;
  setLiveData: (data: RepVeloData | null) => void;
  addRep: (rep: RepData) => void;
  completeSet: (setData: SetData) => void;
  updateLoad: (load: number) => void;
  setTargetWeight: (weight: number | null) => void;
  setCurrentExercise: (exercise: Exercise) => void;
  resetSetData: () => void;

  // New Actions for HR & Timer
  updateHeartRate: (bpm: number | null) => void;
  startSet: () => void;
  startRest: () => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  // Initial State
  currentSession: null,
  isSessionActive: false,
  sessionStartTime: null,
  sessionStartTimeStamp: null,

  currentSetIndex: 1,
  currentLift: null,
  currentLoad: 0,
  currentReps: 5,
  targetWeight: null,
  setHistory: [],
  setStartTimeStamp: null,
  restStartTime: null,

  isConnected: false,
  liveData: null,
  repHistory: [],
  currentHeartRate: null,
  sessionHRPoints: [],
  setHRPoints: [],

  currentExercise: null,
  settings: {
    use_metric: true,
    velocity_loss_threshold: 20, // Default 20%
    enable_audio_feedback: true,
    enable_voice_commands: false,
    enable_video_recording: false,
    target_training_phase: 'strength',
  },

  // Actions
  startSession: (sessionId: string) => {
    set({
      currentSession: {
        session_id: sessionId,
        id: sessionId,
        date: new Date().toISOString(),
        exercises: [],
        sets: [],
        total_volume: 0,
        start_timestamp: new Date().toISOString(),
      },
      isSessionActive: true,
      sessionStartTime: Date.now(),
      sessionStartTimeStamp: new Date().toISOString(),
      setHistory: [],
      currentSetIndex: 1,
      repHistory: [],
      targetWeight: null,
      sessionHRPoints: [],
      setStartTimeStamp: new Date().toISOString(),
      restStartTime: null,
    });
  },

  endSession: () => {
    set({
      isSessionActive: false,
      currentSession: null,
      sessionStartTime: null,
      sessionStartTimeStamp: null,
      liveData: null,
      currentHeartRate: null,
      restStartTime: null,
    });
  },

  setConnectionStatus: (status: boolean) => {
    set({ isConnected: status });
  },

  setLiveData: (data: RepVeloData | null) => {
    set({ liveData: data });
  },

  addRep: (rep: RepData) => {
    set((state) => ({
      repHistory: [...state.repHistory, rep],
      // 心拍数があれば記録ポイントに追加
      setHRPoints: state.currentHeartRate ? [...state.setHRPoints, state.currentHeartRate] : state.setHRPoints,
    }));
  },

  completeSet: (setData: SetData) => {
    set((state) => ({
      setHistory: [...state.setHistory, setData],
      currentSetIndex: state.currentSetIndex + 1,
      repHistory: [], // Clear reps for next set
      liveData: null,
    }));
  },

  updateLoad: (load: number) => {
    set({ currentLoad: load });
  },

  setTargetWeight: (weight: number | null) => {
    set({ targetWeight: weight });
  },

  setCurrentExercise: (exercise: Exercise) => {
    set({
      currentExercise: exercise,
      currentLift: exercise.name,
      // Reset set counter if switching exercises? Maybe optional.
      // For now, keep session flow simple.
      setStartTimeStamp: new Date().toISOString(),
    });
  },

  updateHeartRate: (bpm: number | null) => {
    if (bpm) {
      set((state) => ({
        currentHeartRate: bpm,
        sessionHRPoints: [...state.sessionHRPoints, bpm],
      }));
    } else {
      set({ currentHeartRate: null });
    }
  },

  startSet: () => {
    set({
      setStartTimeStamp: new Date().toISOString(),
      restStartTime: null,
      setHRPoints: [],
    });
  },

  startRest: () => {
    set({
      restStartTime: Date.now(),
    });
  },

  resetSetData: () => {
    set({
      repHistory: [],
      liveData: null,
    });
  }
}));
