import { Platform } from 'react-native';
// Note: react-native-health requires a development build and Info.plist configuration
// This service will act as a wrapper around HealthKit
import AppleHealthKit, {
    HealthKitPermissions,
    HealthInputOptions,
} from 'react-native-health';

const permissions: HealthKitPermissions = {
    permissions: {
        read: [AppleHealthKit.Constants.Permissions.HeartRate],
        write: [],
    },
};

class HealthService {
    private isAuthorized: boolean = false;

    async authorize(): Promise<boolean> {
        if (Platform.OS !== 'ios') return false;

        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(permissions, (error: string) => {
                if (error) {
                    console.error('[HealthService] Authorization failed:', error);
                    this.isAuthorized = false;
                    resolve(false);
                } else {
                    console.log('[HealthService] Authorized successfully');
                    this.isAuthorized = true;
                    resolve(true);
                }
            });
        });
    }

    /**
     * 直近の心拍数データを取得する
     */
    async getLatestHeartRate(): Promise<number | null> {
        if (Platform.OS !== 'ios' || !this.isAuthorized) return null;

        const options: HealthInputOptions = {
            unit: 'bpm', // 分あたりの心拍数
            startDate: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 直近5分間
            endDate: new Date().toISOString(),
            ascending: false,
            limit: 1,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getHeartRateSamples(options, (err: Object, results: Array<any>) => {
                if (err || !results || results.length === 0) {
                    resolve(null);
                } else {
                    // 最も新しいサンプルを返す
                    resolve(results[0].value);
                }
            });
        });
    }

    /**
     * 心拍数の変化を監視するためのポーリングを開始する
     * @param callback 心拍数が更新された際のコールバック
     * @param intervalPollMs ポーリング間隔 (デフォルト 3秒)
     */
    startHeartRateMonitoring(callback: (bpm: number) => void, intervalPollMs: number = 3000) {
        if (Platform.OS !== 'ios') return null;

        const timerId = setInterval(async () => {
            const hr = await this.getLatestHeartRate();
            if (hr) {
                callback(hr);
            }
        }, intervalPollMs);

        return timerId;
    }

    stopHeartRateMonitoring(timerId: NodeJS.Timeout | number | null) {
        if (timerId) {
            clearInterval(timerId as any);
        }
    }
}

export default new HealthService();
