/**
 * Integration Tests for Training Store
 * Tests state transitions including rest flow, e1RM calculation, and MVT priority
 */

import { useTrainingStore } from '../src/store/trainingStore';
import { VBTLogic } from '../src/services/VBTLogic';
import { getVelocityAt1RM, calculateE1RM } from '../src/utils/VBTCalculations';
import type { LVPData } from '../src/types/index';

describe('TrainingStore Integration Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTrainingStore.getState().endSession();
  });

  describe('休憩開始/再開フロー (Rest Flow)', () => {
    it('should preserve rep history when resuming from rest', () => {
      const store = useTrainingStore.getState();

      // 1. Start session
      store.startSession('test-session');

      // 2. Start set and add reps
      store.startSet();

      const testRep = {
        id: 'test-rep-1',
        session_id: 'test-session',
        lift: 'Bench Press',
        set_index: 1,
        rep_index: 1,
        load_kg: 100,
        device_type: 'OVR Velocity' as const,
        mean_velocity: 0.5,
        peak_velocity: 0.6,
        rom_cm: 40,
        rep_duration_ms: 2000,
        mean_power_w: 500,
        is_valid_rep: true,
        set_type: 'normal' as const,
        timestamp: new Date().toISOString(),
      };

      store.addRep(testRep);

      expect(useTrainingStore.getState().repHistory).toHaveLength(1);

      // 3. Start rest (休憩開始)
      store.startRest();

      expect(useTrainingStore.getState().isPaused).toBe(true);
      expect(useTrainingStore.getState().pauseReason).toBe('rest');
      expect(useTrainingStore.getState().repHistory).toHaveLength(1); // History preserved

      // 4. Resume set (休憩再開)
      store.resumeSet();

      expect(useTrainingStore.getState().isPaused).toBe(false);
      expect(useTrainingStore.getState().pauseReason).toBeUndefined();
      expect(useTrainingStore.getState().repHistory).toHaveLength(1); // History still preserved
    });

    it('should clear rep history when starting a new set', () => {
      const store = useTrainingStore.getState();

      // 1. Start session and add reps
      store.startSession('test-session');
      store.startSet();

      const testRep = {
        id: 'test-rep-1',
        session_id: 'test-session',
        lift: 'Bench Press',
        set_index: 1,
        rep_index: 1,
        load_kg: 100,
        device_type: 'OVR Velocity' as const,
        mean_velocity: 0.5,
        peak_velocity: 0.6,
        rom_cm: 40,
        rep_duration_ms: 2000,
        mean_power_w: 500,
        is_valid_rep: true,
        set_type: 'normal' as const,
        timestamp: new Date().toISOString(),
      };

      store.addRep(testRep);

      expect(useTrainingStore.getState().repHistory).toHaveLength(1);

      // 2. Start new set (should clear history)
      store.startSet();

      expect(useTrainingStore.getState().repHistory).toHaveLength(0);
    });

    it('should NOT clear proposedMVT when ending session', () => {
      const store = useTrainingStore.getState();

      // 1. Set a proposed MVT
      store.setProposedMVT(0.18);
      expect(store.proposedMVT).toBe(0.18);

      // 2. End session
      store.endSession();

      // 3. proposedMVT should still be there (persisted for UI banner)
      expect(useTrainingStore.getState().proposedMVT).toBe(0.18);

      // 4. Starting a new session should clear it
      store.startSession('new-session');
      expect(useTrainingStore.getState().proposedMVT).toBeNull();
    });
  });

  describe('1RM計算の mvt/v1rm 優先 (MVT Priority)', () => {
    it('should prioritize mvt over v1rm when mvt is set', () => {
      const lvpWithMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15, // 理論値
        mvt: 0.18,  // 実測値 (これを優先)
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      const velocityAt1RM = getVelocityAt1RM(lvpWithMVT);
      expect(velocityAt1RM).toBe(0.18); // mvt should be used
    });

    it('should use v1rm when mvt is not set', () => {
      const lvpWithoutMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15, // 理論値 (これを使用)
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      const velocityAt1RM = getVelocityAt1RM(lvpWithoutMVT);
      expect(velocityAt1RM).toBe(0.15); // v1rm should be used
    });

    it('should use v1rm when mvt is 0', () => {
      const lvpWithZeroMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15,
        mvt: 0, // 無効値
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      const velocityAt1RM = getVelocityAt1RM(lvpWithZeroMVT);
      expect(velocityAt1RM).toBe(0.15); // v1rm should be used
    });
  });

  describe('e1RM計算の0レップ時のNaN化 (Zero Rep Guard)', () => {
    it('should return null when reps is 0', () => {
      const e1rm = calculateE1RM(100, 0);
      expect(e1rm).toBeNull();
    });

    it('should return null when reps is negative', () => {
      const e1rm = calculateE1RM(100, -1);
      expect(e1rm).toBeNull();
    });

    it('should return null when load is 0', () => {
      const e1rm = calculateE1RM(0, 5);
      expect(e1rm).toBeNull();
    });

    it('should return null when load is negative', () => {
      const e1rm = calculateE1RM(-10, 5);
      expect(e1rm).toBeNull();
    });

    it('should return correct e1RM for valid input', () => {
      const e1rm = calculateE1RM(100, 5);
      expect(e1rm).toBeCloseTo(116.7, 1);
    });

    it('should return load when reps is 1', () => {
      const e1rm = calculateE1RM(100, 1);
      expect(e1rm).toBe(100);
    });
  });

  describe('全レップ除外時の挙動 (All Reps Excluded)', () => {
    it('should handle all reps being excluded', () => {
      const store = useTrainingStore.getState();

      store.startSession('test-session');

      // Add reps
      const testRep1 = {
        id: 'test-rep-1',
        session_id: 'test-session',
        lift: 'Bench Press',
        set_index: 1,
        rep_index: 1,
        load_kg: 100,
        device_type: 'OVR Velocity' as const,
        mean_velocity: 0.5,
        peak_velocity: 0.6,
        rom_cm: 40,
        rep_duration_ms: 2000,
        mean_power_w: 500,
        is_valid_rep: true,
        set_type: 'normal' as const,
        timestamp: new Date().toISOString(),
      };

      const testRep2 = {
        ...testRep1,
        id: 'test-rep-2',
        rep_index: 2,
      };

      store.addRep(testRep1);
      store.addRep(testRep2);

      expect(useTrainingStore.getState().repHistory).toHaveLength(2);

      // Exclude all reps
      store.removeRepFromHistory('test-rep-1');
      store.removeRepFromHistory('test-rep-2');

      // All reps should be marked as excluded
      const allExcluded = useTrainingStore.getState().repHistory.every(rep => rep.is_excluded);
      expect(allExcluded).toBe(true);

      // e1RM calculation with zero valid reps should return null
      const validReps = useTrainingStore.getState().repHistory.filter(r => !r.is_excluded && !r.is_failed);
      const e1rm = VBTLogic.calculateE1RM(100, validReps.length);
      expect(e1rm).toBeNull();
    });
  });

  describe('休憩中の状態管理 (Pause State Management)', () => {
    it('should correctly toggle pause state', () => {
      const store = useTrainingStore.getState();

      store.startSession('test-session');

      expect(useTrainingStore.getState().isPaused).toBe(false);

      // Manual pause
      store.setPaused(true, 'manual');

      expect(useTrainingStore.getState().isPaused).toBe(true);
      expect(useTrainingStore.getState().pauseReason).toBe('manual');

      // Resume
      store.setPaused(false);

      expect(useTrainingStore.getState().isPaused).toBe(false);
      expect(useTrainingStore.getState().pauseReason).toBeUndefined();
    });

    it('should set rest reason when startRest is called', () => {
      const store = useTrainingStore.getState();

      store.startSession('test-session');
      store.startRest();

      expect(useTrainingStore.getState().isPaused).toBe(true);
      expect(useTrainingStore.getState().pauseReason).toBe('rest');
      expect(useTrainingStore.getState().restStartTime).not.toBeNull();
    });
  });
});
