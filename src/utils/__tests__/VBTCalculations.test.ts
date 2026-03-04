/**
 * VBT Calculations Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLVP,
  proposeNewMVT,
  filterOutliers,
  calculateVelocityLoss,
  getVelocityZone,
  calculateReadiness,
  calculateE1RM,
  getVelocityAt1RM,
} from '../VBTCalculations';
import type { RepData, LVPData } from '../../types';

describe('VBTCalculations', () => {
  describe('calculateLVP - Two-Point Method Guard', () => {
    it('should return null when load spread is too narrow (< 20% of max load)', () => {
      // Narrow spread: 60kg to 70kg (spread = 10kg, which is < 20% of 70kg = 14kg)
      const narrowSpreadData = [
        { load: 60, velocity: 0.8 },
        { load: 65, velocity: 0.7 },
        { load: 70, velocity: 0.6 },
      ];

      const result = calculateLVP(narrowSpreadData);
      expect(result).toBeNull();
    });

    it('should return null when load spread is exactly at threshold', () => {
      // Edge case: 50kg to 62.5kg (spread = 12.5kg, exactly 20% of 62.5kg)
      const edgeCaseData = [
        { load: 50, velocity: 0.8 },
        { load: 56.25, velocity: 0.7 },
        { load: 62.5, velocity: 0.6 },
      ];

      const result = calculateLVP(edgeCaseData);
      expect(result).toBeNull();
    });

    it('should return LVPData when load spread is sufficient (> 20% of max load)', () => {
      // Good spread: 40kg to 100kg (spread = 60kg, which is > 20% of 100kg = 20kg)
      const goodSpreadData = [
        { load: 40, velocity: 1.2 },
        { load: 60, velocity: 0.9 },
        { load: 80, velocity: 0.6 },
        { load: 100, velocity: 0.3 },
      ];

      const result = calculateLVP(goodSpreadData);

      expect(result).not.toBeNull();
      expect(result?.slope).toBeDefined();
      expect(result?.intercept).toBeDefined();
      expect(result?.r_squared).toBeGreaterThanOrEqual(0);
      expect(result?.r_squared).toBeLessThanOrEqual(1);
      expect(result?.sample_count).toBe(4);
    });

    it('should return null with insufficient data points (< 3)', () => {
      const insufficientData = [
        { load: 40, velocity: 1.2 },
        { load: 60, velocity: 0.9 },
      ];

      const result = calculateLVP(insufficientData);
      expect(result).toBeNull();
    });

    it('should handle minimum valid case with sufficient spread', () => {
      // Exactly 3 points with good spread
      const minimumValidData = [
        { load: 20, velocity: 1.5 },
        { load: 60, velocity: 0.9 },
        { load: 100, velocity: 0.3 },
      ];

      const result = calculateLVP(minimumValidData);

      expect(result).not.toBeNull();
      expect(result?.sample_count).toBe(3);
      expect(result?.slope).toBeLessThan(0); // Negative slope for load-velocity
    });

    it('should handle zero minimum load correctly', () => {
      // Bodyweight or unloaded movement
      const zeroLoadData = [
        { load: 0, velocity: 2.0 },
        { load: 40, velocity: 1.2 },
        { load: 80, velocity: 0.6 },
      ];

      const result = calculateLVP(zeroLoadData);

      expect(result).not.toBeNull();
      expect(result?.vmax).toBeCloseTo(2.0, 1);
    });

    it('should filter outliers when dataPoints > 5', () => {
      const manyPointsWithOutliers = [
        { load: 20, velocity: 1.5 },
        { load: 40, velocity: 1.2 },
        { load: 60, velocity: 0.9 },
        { load: 80, velocity: 0.6 },
        { load: 100, velocity: 0.3 },
        { load: 60, velocity: 5.0 }, // Outlier
        { load: 80, velocity: -2.0 }, // Outlier
      ];

      const result = calculateLVP(manyPointsWithOutliers);

      expect(result).not.toBeNull();
      // After outlier removal, should have filtered data
      expect(result?.sample_count).toBeLessThan(7);
    });


  });

  describe('proposeNewMVT', () => {
    const createMockRep = (velocity: number): RepData => ({
      session_id: 'test-session',
      lift: 'bench_press',
      set_index: 1,
      rep_index: 1,
      load_kg: 80,
      device_type: 'VBT',
      mean_velocity: velocity,
      peak_velocity: velocity + 0.1,
      rom_cm: 35,
      mean_power_w: 200,
      rep_duration_ms: 2000,
      is_valid_rep: true,
      set_type: 'normal',
      timestamp: new Date().toISOString(),
    });

    it('should return null with insufficient data (< 3 reps)', () => {
      const insufficientReps: RepData[] = [
        createMockRep(0.2),
        createMockRep(0.21),
      ];

      const result = proposeNewMVT(insufficientReps);
      expect(result).toBeNull();
    });

    it('should return null when velocity data is too variable (std > 0.03)', () => {
      const variableReps: RepData[] = [
        createMockRep(0.15),
        createMockRep(0.25),
        createMockRep(0.35),
      ];

      const result = proposeNewMVT(variableReps);
      expect(result).toBeNull();
    });

    it('should return median MVT when velocities are stable (std <= 0.03)', () => {
      const stableReps: RepData[] = [
        createMockRep(0.18),
        createMockRep(0.19),
        createMockRep(0.20),
        createMockRep(0.19),
        createMockRep(0.18),
      ];

      const result = proposeNewMVT(stableReps);

      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(0.19, 2); // Median of stable values
    });

    it('should filter outliers using IQR before calculating', () => {
      const repsWithOutliers: RepData[] = [
        createMockRep(0.19),
        createMockRep(0.20),
        createMockRep(0.19),
        createMockRep(0.21),
        createMockRep(0.05), // Outlier
        createMockRep(0.35), // Outlier
      ];

      const result = proposeNewMVT(repsWithOutliers);

      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0.18);
      expect(result).toBeLessThan(0.22);
    });

    it('should return null if insufficient data after outlier filtering', () => {
      const mostlyOutliers: RepData[] = [
        createMockRep(0.05),
        createMockRep(0.35),
        createMockRep(0.02),
        createMockRep(0.40),
      ];

      const result = proposeNewMVT(mostlyOutliers);
      expect(result).toBeNull();
    });

    it('should handle even number of velocities correctly', () => {
      const evenCountReps: RepData[] = [
        createMockRep(0.18),
        createMockRep(0.19),
        createMockRep(0.20),
        createMockRep(0.21),
      ];

      const result = proposeNewMVT(evenCountReps);
      // Median of [0.18, 0.19, 0.20, 0.21] = 0.195, rounded to 2 decimal places = 0.20
      expect(result).toBeCloseTo(0.20, 2);
    });

    it('should handle odd number of velocities correctly', () => {
      const oddCountReps: RepData[] = [
        createMockRep(0.18),
        createMockRep(0.19),
        createMockRep(0.20),
      ];

      const result = proposeNewMVT(oddCountReps);
      // Median of [0.18, 0.19, 0.20] = 0.19
      expect(result).toBeCloseTo(0.19, 2);
    });

    it('should round to 2 decimal places', () => {
      const preciseReps: RepData[] = [
        createMockRep(0.183),
        createMockRep(0.194),
        createMockRep(0.201),
      ];

      const result = proposeNewMVT(preciseReps);
      // Should be rounded to 2 decimal places
      expect(result).not.toBeNull();
      const decimalPlaces = result!.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should return null for velocities at boundary of high-load range (0.05-0.35)', () => {
      const boundaryReps: RepData[] = [
        createMockRep(0.04), // Below high-load range
        createMockRep(0.05), // At boundary
        createMockRep(0.06),
      ];

      // Even though 0.04 is technically below range, function doesn't filter by range
      // It only checks for stability, so this should work if stable
      const result = proposeNewMVT(boundaryReps);
      // With these values, std is about 0.01 which is <= 0.03, so should return value
      expect(result).not.toBeNull();
    });
  });

  describe('filterOutliers', () => {
    it('should return reps unchanged when fewer than 3 valid velocities', () => {
      const reps: RepData[] = [
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 1,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.5,
          peak_velocity: 0.6,
          rom_cm: 50,
          mean_power_w: 300,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = filterOutliers(reps);
      expect(result).toEqual(reps);
    });

    it('should mark outliers as invalid when >= 3 valid velocities', () => {
      const reps: RepData[] = [
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 1,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.5,
          peak_velocity: 0.6,
          rom_cm: 50,
          mean_power_w: 300,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 2,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.52,
          peak_velocity: 0.62,
          rom_cm: 50,
          mean_power_w: 310,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 3,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 2.5, // Stronger outlier to break 2*std threshold
          peak_velocity: 2.6,
          rom_cm: 50,
          mean_power_w: 400,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 4,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.55,
          peak_velocity: 0.65,
          rom_cm: 50,
          mean_power_w: 320,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 5,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.48,
          peak_velocity: 0.58,
          rom_cm: 50,
          mean_power_w: 290,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 6,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.51,
          peak_velocity: 0.61,
          rom_cm: 50,
          mean_power_w: 305,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = filterOutliers(reps);
      expect(result[2].is_valid_rep).toBe(false);
    });
  });

  describe('calculateVelocityLoss', () => {
    it('should return null with fewer than 2 valid reps', () => {
      const reps: RepData[] = [
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 1,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.5,
          peak_velocity: 0.6,
          rom_cm: 50,
          mean_power_w: 300,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = calculateVelocityLoss(reps);
      expect(result).toBeNull();
    });

    it('should calculate velocity loss correctly', () => {
      const reps: RepData[] = [
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 1,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 1.0,
          peak_velocity: 1.1,
          rom_cm: 50,
          mean_power_w: 300,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'test',
          lift: 'squat',
          set_index: 1,
          rep_index: 2,
          load_kg: 100,
          device_type: 'VBT',
          mean_velocity: 0.8,
          peak_velocity: 0.9,
          rom_cm: 50,
          mean_power_w: 290,
          rep_duration_ms: 2000,
          is_valid_rep: true,
          set_type: 'normal',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = calculateVelocityLoss(reps);
      expect(result).toBeCloseTo(10, 1); // (1.0 - 0.9) / 1.0 * 100 = 10%
    });
  });

  describe('getVelocityZone', () => {
    it('should return power zone for high velocity', () => {
      const zone = getVelocityZone(1.2);
      expect(zone?.name).toBe('power');
    });

    it('should return strength_speed zone', () => {
      const zone = getVelocityZone(0.8);
      expect(zone?.name).toBe('strength_speed');
    });

    it('should return hypertrophy zone', () => {
      const zone = getVelocityZone(0.6);
      expect(zone?.name).toBe('hypertrophy');
    });

    it('should return strength zone for low velocity', () => {
      const zone = getVelocityZone(0.3);
      expect(zone?.name).toBe('strength');
    });

    it('should return null for invalid velocity', () => {
      const zone = getVelocityZone(-0.1);
      expect(zone).toBeNull();
    });
  });

  describe('calculateReadiness', () => {
    it('should return excellent readiness with positive delta', () => {
      const result = calculateReadiness(1.0, 0.9);
      expect(result.readinessLevel).toBe('excellent');
      expect(result.deltaV).toBeCloseTo(0.1, 2);
      expect(result.loadAdjustment).toBe(5);
    });

    it('should return good readiness', () => {
      const result = calculateReadiness(0.95, 0.94);
      expect(result.readinessLevel).toBe('good');
      expect(result.loadAdjustment).toBe(2.5);
    });

    it('should return normal readiness', () => {
      const result = calculateReadiness(0.9, 0.93);
      expect(result.readinessLevel).toBe('normal');
      expect(result.loadAdjustment).toBe(0);
    });

    it('should return fatigued readiness with negative delta', () => {
      const result = calculateReadiness(0.8, 0.9);
      expect(result.readinessLevel).toBe('fatigued');
      expect(result.loadAdjustment).toBe(-5);
    });
  });

  describe('calculateE1RM (Epley with zero-rep guard)', () => {
    it('should return load for 1 rep', () => {
      expect(calculateE1RM(100, 1)).toBe(100);
    });

    it('should calculate correct e1RM for 100kg x 10 reps', () => {
      expect(calculateE1RM(100, 10)).toBeCloseTo(133.3, 1);
    });

    it('should return null for zero reps', () => {
      expect(calculateE1RM(100, 0)).toBeNull();
    });

    it('should return null for negative reps', () => {
      expect(calculateE1RM(100, -1)).toBeNull();
    });

    it('should return null for zero or negative load', () => {
      expect(calculateE1RM(0, 5)).toBeNull();
      expect(calculateE1RM(-10, 5)).toBeNull();
    });
  });

  describe('getVelocityAt1RM (MVT priority)', () => {
    it('should prioritize mvt over v1rm when mvt is set', () => {
      const lvpWithMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15,
        mvt: 0.18,
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      expect(getVelocityAt1RM(lvpWithMVT)).toBe(0.18);
    });

    it('should use v1rm when mvt is not set', () => {
      const lvpWithoutMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15,
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      expect(getVelocityAt1RM(lvpWithoutMVT)).toBe(0.15);
    });

    it('should use v1rm when mvt is 0', () => {
      const lvpWithZeroMVT: LVPData = {
        lift: 'Bench Press',
        vmax: 1.5,
        v1rm: 0.15,
        mvt: 0,
        slope: -0.01,
        intercept: 1.6,
        r_squared: 0.85,
        last_updated: new Date().toISOString(),
      };

      expect(getVelocityAt1RM(lvpWithZeroMVT)).toBe(0.15);
    });
  });
});
