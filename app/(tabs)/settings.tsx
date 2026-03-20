import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getResolvedApiHealth,
  getStoredApiBaseUrlOverride,
  hydrateApiBaseUrlOverride,
  setStoredApiBaseUrlOverride,
} from '@/constants/oauth';
import { GarageTheme } from '@/src/constants/garageTheme';
import type { AppSettings } from '@/src/types/index';

const SETTINGS_KEY = '@app_settings';

const defaultSettings: AppSettings = {
  use_metric: true,
  velocity_loss_threshold: 20,
  enable_audio_feedback: true,
  enable_voice_commands: false,
  enable_video_recording: false,
  target_training_phase: 'hypertrophy',
  audio_volume: 1.0,
};

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState('');
  const [apiStatusText, setApiStatusText] = useState('未確認');
  const [checkingApi, setCheckingApi] = useState(false);

  useEffect(() => {
    void loadSettings();
    void loadApiOverride();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored) as AppSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadApiOverride = async () => {
    await hydrateApiBaseUrlOverride();
    setApiBaseUrlInput(getStoredApiBaseUrlOverride());
    await handleCheckApiHealth(false);
  };

  const saveSettings = async (nextSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      setSettings(nextSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSaveApiBaseUrl = async () => {
    try {
      await setStoredApiBaseUrlOverride(apiBaseUrlInput);
      await handleCheckApiHealth(true);
      Alert.alert('保存完了', apiBaseUrlInput ? 'AIサーバーURLを保存しました。' : 'AIサーバーURLをクリアしました。');
    } catch (error) {
      console.error('Failed to save API base URL override:', error);
      Alert.alert('エラー', 'AIサーバーURLの保存に失敗しました。');
    }
  };

  const handleCheckApiHealth = async (force: boolean = true) => {
    setCheckingApi(true);
    try {
      const { baseUrl, health } = await getResolvedApiHealth(force);
      if (!baseUrl) {
        setApiStatusText('未接続: AIサーバーURLが未設定です');
      } else if (!health?.ok) {
        setApiStatusText(`未接続: ${baseUrl}`);
      } else if (!health.llm?.hasApiKey) {
        setApiStatusText(`接続OK / APIキー未設定 / ${baseUrl}`);
      } else {
        const model = health.llm?.model ? ` / ${health.llm.model}` : '';
        setApiStatusText(`接続OK${model} / ${baseUrl}`);
      }
    } catch (error) {
      console.error('Failed to check API health:', error);
      setApiStatusText('ヘルスチェック失敗');
    } finally {
      setCheckingApi(false);
    }
  };

  const thresholdOptions = [10, 15, 20, 25, 30];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SYSTEM / SETTINGS</Text>
      <Text style={styles.title}>設定</Text>
      <Text style={styles.subtitle}>アプリの挙動とAI接続先をここで揃えます。</Text>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>メートル法</Text>
            <Text style={styles.toggleMeta}>kg / m/s を使用</Text>
          </View>
          <Switch
            value={settings.use_metric}
            onValueChange={(value) => void saveSettings({ ...settings, use_metric: value })}
            trackColor={{ false: '#3b2b28', true: GarageTheme.accent }}
          />
        </View>

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>音声フィードバック</Text>
            <Text style={styles.toggleMeta}>レップ通知を再生</Text>
          </View>
          <Switch
            value={settings.enable_audio_feedback}
            onValueChange={(value) => void saveSettings({ ...settings, enable_audio_feedback: value })}
            trackColor={{ false: '#3b2b28', true: GarageTheme.accent }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Velocity Loss</Text>
        <View style={styles.thresholdRow}>
          {thresholdOptions.map((value) => {
            const active = settings.velocity_loss_threshold === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.thresholdButton, active && styles.thresholdButtonActive]}
                onPress={() => void saveSettings({ ...settings, velocity_loss_threshold: value })}
              >
                <Text style={[styles.thresholdText, active && styles.thresholdTextActive]}>{value}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AIサーバーURL</Text>
        <Text style={styles.cardBody}>
          実機/TestFlight では 127.0.0.1 ではなく、Mac の LAN IP を入れてください。例: http://192.168.1.23:3001
        </Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrlInput}
          onChangeText={setApiBaseUrlInput}
          placeholder="http://192.168.1.23:3001"
          placeholderTextColor={GarageTheme.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.statusLabel}>状態</Text>
        <Text style={styles.statusText}>{apiStatusText}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleCheckApiHealth(true)}>
            {checkingApi ? <ActivityIndicator color={GarageTheme.textStrong} /> : <Text style={styles.secondaryButtonText}>再確認</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSaveApiBaseUrl()}>
            <Text style={styles.primaryButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 8,
  },
  title: {
    color: GarageTheme.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    borderRadius: 18,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleLabel: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  thresholdRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thresholdButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  thresholdButtonActive: {
    backgroundColor: '#4b2416',
    borderColor: GarageTheme.accent,
  },
  thresholdText: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  thresholdTextActive: {
    color: GarageTheme.textStrong,
  },
  cardBody: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    color: GarageTheme.textStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  statusLabel: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  statusText: {
    color: GarageTheme.text,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: '#4b2416',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '800',
  },
});
