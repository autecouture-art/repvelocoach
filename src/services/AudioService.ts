/**
 * Audio Service
 * Handles voice feedback and sound effects
 */

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTrainingStore } from '../store/trainingStore';

class AudioService {
  private isEnabled: boolean = true;
  private soundCache: { [key: string]: Audio.Sound } = {};

  /**
   * Initialize Audio Service
   */
  async initialize(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      console.log('Audio Service initialized');
    } catch (error) {
      console.error('Failed to initialize Audio Service:', error);
    }
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Speak text using Text-to-Speech
   */
  async speak(text: string, language: string = 'ja-JP'): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const volume = useTrainingStore.getState().settings.audio_volume ?? 1.0;
      Speech.speak(text, {
        language,
        rate: 1.1, // 少し速めが聞き取りやすい
        pitch: 1.0,
        volume,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  }

  /**
   * AIコーチによる指導（日本語）
   */
  async speakCoach(text: string): Promise<void> {
    await this.speak(text, 'ja-JP');
  }

  /**
   * レップ直後のフィードバック
   */
  async announceRepFeedback(velocity: number, isGood: boolean): Promise<void> {
    if (!this.isEnabled) return;
    const speedText = `${velocity.toFixed(2)}`;
    const comment = isGood ? 'ナイススピード！' : 'もっと速く！';
    await this.speak(`${speedText}。${comment}`);
  }

  /**
   * セット中止勧告
   */
  async announceStopSet(reason: string): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak(`警告。${reason}。セットを中止してください。`);
  }

  /**
   * Announce velocity
   */
  async announceVelocity(velocity: number): Promise<void> {
    const text = `${velocity.toFixed(2)}`;
    await this.speak(text, 'en-US'); // 数字は英語の方が聞き取りやすい場合がある
  }

  /**
   * Play feedback for rep completion
   */
  async playRepComplete(): Promise<void> {
    if (!this.isEnabled) return;
    // ビープ音の代わりに短い発話
    await this.speak('アップ', 'ja-JP');
  }

  /**
   * Announce Personal Record
   */
  async announcePR(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('自己ベスト更新！おめでとうございます！');
  }

  /**
   * Announce Velocity Loss Warning
   */
  async announceVelocityLoss(): Promise<void> {
    if (!this.isEnabled) return;
    await this.speak('速度低下を検知。セット終了。');
  }
}

export default new AudioService();
