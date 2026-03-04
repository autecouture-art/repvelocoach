// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: com.autecouture.<project_name_dots>
const bundleId = "com.autecouture.repvelocoach";
// Extract timestamp from bundle ID for deep link scheme if present, otherwise use default
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `repvelocoach${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "RepVelo Coach",
  appSlug: "repvelo-coach-app",
  // URL of the app logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "https://s3.amazonaws.com/manus-assets/repvelo-coach/icon.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "2.3.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "22",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSBluetoothAlwaysUsageDescription:
        "このアプリはBluetoothを使用してRepVelo Velocityセンサーに接続し、トレーニング中のリアルタイム速度計測を行います。",
      NSBluetoothPeripheralUsageDescription:
        "このアプリはBluetoothを使用してRepVelo Velocityセンサーに接続します。",
      NSCameraUsageDescription:
        "このアプリはカメラを使用してフォーム分析用のトレーニング動画を録画します。",
      NSMicrophoneUsageDescription:
        "このアプリはマイクを使用してトレーニング中の音声コマンド機能を提供します。",
      NSPhotoLibraryUsageDescription:
        "このアプリはトレーニング動画をフォトライブラリに保存します。",
      NSLocationWhenInUseUsageDescription:
        "このアプリは位置情報サービスをトレーニング機能の向上に使用する場合があります。",
      NSHealthShareUsageDescription:
        "RepVelo CoachがAirPodsやApple Watchの心拍データを読み取り、休息時間やトレーニング強度を最適化することを許可してください。",
      NSHealthUpdateUsageDescription:
        "RepVelo CoachがHealthKitと統合し、トレーニングデータを包括的に表示することを許可してください。",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1a1a1a",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "POST_NOTIFICATIONS",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_SCAN",
      "BLUETOOTH_CONNECT",
      "ACCESS_FINE_LOCATION",
      "CAMERA",
      "RECORD_AUDIO",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "$(PRODUCT_NAME)がマイクにアクセスすることを許可してください。",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#1a1a1a",
        dark: {
          backgroundColor: "#1a1a1a",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: true,
        modes: ["peripheral", "central"],
        bluetoothAlwaysPermission:
          "RepVelo CoachがRepVelo Velocityセンサーに接続することを許可してください",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "b6bbbf14-ff1d-4914-854c-3c88f0fb6bf7",
    },
  },
};

export default config;
