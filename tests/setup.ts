/**
 * Test Setup File
 * Configures global test environment for Vitest
 */

import { vi } from 'vitest';

// Define global __DEV__ for React Native
// @ts-ignore
global.__DEV__ = true;

// Define global global for React Native compatibility
if (typeof global.global === 'undefined') {
  global.global = global;
}

// Mock React Native modules
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: () => null },
  NativeModules: {
    TurboModuleRegistry: {
      getEnforcing: () => ({}),
    },
  },
  UIManager: {},
  AccessibilityInfo: {},
  Linking: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  AppState: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
}));

// Mock expo-modules-core
vi.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  EventEmitter: {
    registerEventEmitter: vi.fn(),
  },
  requireOptionalNativeModule: vi.fn(() => undefined),
  requireNativeModule: vi.fn(() => ({})),
}));

// Mock expo-constants
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      scheme: 'repvelo-coach',
    },
    executionEnvironment: 'standalone',
  },
}));

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => ({
  default: {
    useSharedValue: () => ({ value: null }),
    useAnimatedStyle: () => ({}),
    withTiming: () => ({}),
    withSpring: () => ({}),
    withSequence: () => ({}),
    withDelay: () => ({}),
    runOnUI: () => ({}),
    call: () => ({}),
  },
}));

// Mock expo-av
vi.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: vi.fn(),
    },
  },
}));

// Mock expo-audio
vi.mock('expo-audio', () => ({
  Audio: {
    setAudioModeAsync: vi.fn(),
  },
}));

// Mock expo-speech
vi.mock('expo-speech', () => ({
  speak: vi.fn(),
}));

// Mock react-native-health
vi.mock('react-native-health', () => ({
  default: {
    authorize: vi.fn(() => Promise.resolve(true)),
    getHeartRateSamples: vi.fn(() => Promise.resolve([])),
    initHealthKit: vi.fn(() => Promise.resolve(true)),
    isAvailable: vi.fn(() => Promise.resolve(true)),
  },
}));

// Mock react-native-ble-plx
vi.mock('react-native-ble-plx', () => ({
  BleManager: vi.fn(),
}));

// Mock expo-router
vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSegments: () => [],
  usePathname: () => '/',
}));
