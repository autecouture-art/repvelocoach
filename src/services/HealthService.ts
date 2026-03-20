import { Platform } from 'react-native';

class HealthService {
  async authorize(): Promise<boolean> {
    return Platform.OS === 'ios' ? false : false;
  }

  startHeartRateMonitoring(onUpdate: (bpm: number | null) => void): ReturnType<typeof setInterval> | null {
    const id = setInterval(() => onUpdate(null), 30000);
    return id;
  }

  stopHeartRateMonitoring(timerId: ReturnType<typeof setInterval> | null) {
    if (timerId) clearInterval(timerId);
  }
}

export default new HealthService();
