/**
 * useSessionLogic Integration Test
 * Validates hook state transitions, BLE input guards, and VBT logic integration.
 */

import { renderHook, act } from '@testing-library/react';
import { useSessionLogic } from '../useSessionLogic';
import { useTrainingStore } from '../../store/trainingStore';
import DatabaseService from '../../services/DatabaseService';
import AudioService from '../../services/AudioService';
import * as VBTCalculations from '../../utils/VBTCalculations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { RepVeloData, Exercise, LVPData } from '../../types/index';

// Mock Services
vi.mock('../../services/DatabaseService');
vi.mock('../../services/AudioService');
vi.mock('../../services/BLEService');
vi.mock('../../services/AICoachService');
vi.mock('../../services/HealthService');

describe('useSessionLogic Integration', () => {
    const mockExercise: Exercise = {
        id: 'test-lift',
        name: 'Bench Press',
        category: 'bench',
        mvt: 0.15,
        has_lvp: true,
        min_rom_threshold: 10,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        const store = useTrainingStore.getState();
        store.endSession();
        store.resetSetData();
        store.setCurrentExercise(mockExercise);
        store.startSession('session-123');
    });

    it('should process BLE data and add reps to the store', async () => {
        const { result } = renderHook(() => useSessionLogic());

        const bleData: RepVeloData = {
            mean_velocity: 0.8,
            peak_velocity: 1.0,
            rom_cm: 45,
            rep_duration_ms: 1000,
            timestamp: Date.now(),
        };

        await act(async () => {
            await result.current.handleDataReceived(bleData);
        });

        const store = useTrainingStore.getState();
        expect(store.repHistory.length).toBe(1);
        expect(store.repHistory[0].mean_velocity).toBe(0.8);
    });

    it('should ignore BLE data during finishSet (Multi-Input Guard)', async () => {
        const { result } = renderHook(() => useSessionLogic());

        // Setup: Add one rep first
        const rep1: RepVeloData = {
            mean_velocity: 0.8,
            peak_velocity: 1.0,
            rom_cm: 45,
            rep_duration_ms: 1000,
            timestamp: Date.now(),
        };

        await act(async () => {
            await result.current.handleDataReceived(rep1);
        });

        // Mock DatabaseService.insertSet to be slow
        (DatabaseService.insertSet as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

        // Trigger finishSet
        let finishPromise: Promise<void>;
        await act(async () => {
            finishPromise = result.current.finishSet();
        });

        // While finishSet is running, try to add another rep via BLE
        const rep2: RepVeloData = {
            mean_velocity: 0.7,
            peak_velocity: 0.9,
            rom_cm: 45,
            rep_duration_ms: 1000,
            timestamp: Date.now(),
        };

        await act(async () => {
            await result.current.handleDataReceived(rep2);
        });

        // Wait for finishSet to complete
        await act(async () => {
            await finishPromise;
        });

        const store = useTrainingStore.getState();
        // Rep 2 should have been ignored because isFinishingSet.current was true
        expect(store.setHistory.length).toBe(1);
        expect(store.setHistory[0].reps).toBe(1); // Only rep1 was counted
        expect(store.repHistory.length).toBe(0); // Cleared by completeSet
    });

    it('should properly transition to rest state and back to active', async () => {
        const { result } = renderHook(() => useSessionLogic());

        // 1. Start set
        act(() => {
            useTrainingStore.getState().startSet();
        });

        // 2. Add a rep
        const rep: RepVeloData = {
            mean_velocity: 0.5,
            peak_velocity: 0.7,
            rom_cm: 45,
            rep_duration_ms: 1200,
            timestamp: Date.now(),
        };
        await act(async () => {
            await result.current.handleDataReceived(rep);
        });

        // 3. Finish set (which triggers startRest)
        await act(async () => {
            await result.current.finishSet();
        });

        let store = useTrainingStore.getState();
        expect(store.isPaused).toBe(true);
        expect(store.pauseReason).toBe('rest');
        expect(store.restStartTime).not.toBeNull();

        // 4. Start next set (from rest)
        act(() => {
            useTrainingStore.getState().startSet();
        });

        store = useTrainingStore.getState();
        expect(store.isPaused).toBe(false);
        expect(store.pauseReason).toBeUndefined();
        expect(store.restStartTime).not.toBeNull(); // 保持されるように修正
    });

    it('should transition to rest state even if DB save fails in finishSet', async () => {
        const { result } = renderHook(() => useSessionLogic());

        // Setup: Add one rep
        const rep1: RepVeloData = {
            mean_velocity: 0.8,
            peak_velocity: 1.0,
            rom_cm: 45,
            rep_duration_ms: 1000,
            timestamp: Date.now(),
        };

        await act(async () => {
            await result.current.handleDataReceived(rep1);
        });

        // Mock DB throw error
        vi.mocked(DatabaseService.insertSet).mockRejectedValueOnce(new Error('DB Save Failed'));

        // Trigger finishSet
        await act(async () => {
            await result.current.finishSet();
        });

        const store = useTrainingStore.getState();
        // Even if DB save failed, it should transition to rest
        expect(store.isPaused).toBe(true);
        expect(store.pauseReason).toBe('rest');
        expect(store.repHistory.length).toBe(0); // Reps should be cleared via completeSet
        expect(store.setHistory.length).toBeGreaterThan(0);
    });

    it('should calculate rest_duration_s correctly based on previous restStartTime', async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useSessionLogic());

        const T0 = 1000000000000; // 2001-09-09T01:46:40.000Z
        vi.setSystemTime(new Date(T0));

        // 1. Session is already started in beforeEach, start Set 1
        act(() => {
            useTrainingStore.getState().startSet(); // setStartTimeStamp is T0
        });

        const rep1: RepVeloData = {
            mean_velocity: 0.8, peak_velocity: 1.0, rom_cm: 45, rep_duration_ms: 1000, timestamp: T0 + 1000
        };
        await act(async () => { await result.current.handleDataReceived(rep1); });

        // Finish Set 1 -> restStartTime becomes T0 + 2000
        vi.setSystemTime(new Date(T0 + 2000));
        await act(async () => { await result.current.finishSet(); });

        let store = useTrainingStore.getState();
        expect(store.setHistory[0].rest_duration_s).toBeUndefined(); // First set has no rest
        expect(store.restStartTime).toBe(T0 + 2000);

        // 2. Rest for 60 seconds -> T1
        const T1 = T0 + 2000 + 60000;
        vi.setSystemTime(new Date(T1));

        // Start Set 2
        act(() => {
            useTrainingStore.getState().startSet(); // setStartTimeStamp is T1
        });

        const rep2: RepVeloData = {
            mean_velocity: 0.8, peak_velocity: 1.0, rom_cm: 45, rep_duration_ms: 1000, timestamp: T1 + 1000
        };
        await act(async () => { await result.current.handleDataReceived(rep2); });

        // Finish Set 2
        vi.setSystemTime(new Date(T1 + 2000));
        await act(async () => { await result.current.finishSet(); });

        store = useTrainingStore.getState();
        expect(store.setHistory[1].rest_duration_s).toBe(60); // 60 seconds of rest

        vi.useRealTimers();
    });

    it('should correctly prioritize MVT over v1rm for LVP calculation', async () => {
        const lvpWithMvt: LVPData = {
            lift: 'Bench Press',
            vmax: 1.5,
            v1rm: 0.15,
            mvt: 0.20, // This should be used
            slope: -0.004,
            intercept: 1.4,
            r_squared: 0.9,
            sample_count: 50,
            last_updated: '2024-01-01T00:00:00',
        };

        const velocityAt1RM = VBTCalculations.getVelocityAt1RM(lvpWithMvt);
        expect(velocityAt1RM).toBe(0.20);
    });

    it('should use mvt as v1rm when calculating new LVP', () => {
        const points = [
            { load: 60, velocity: 0.8 },
            { load: 80, velocity: 0.6 },
            { load: 100, velocity: 0.4 },
        ];
        const mvt = 0.18;
        const lvp = VBTCalculations.calculateLVP(points, mvt);
        expect(lvp?.v1rm).toBe(mvt); // Regression fix: v1rm must be mvt, not intercept
    });
});
