import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTrainingStore } from '@/src/store/trainingStore';
import type { AppSettings } from '@/src/types/index';

export default function SettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { settings, updateSettings } = useTrainingStore();
    const currentVolume = settings.audio_volume ?? 1.0;

    const handleVolumeChange = (delta: number) => {
        const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
        updateSettings({ audio_volume: newVolume } as Partial<AppSettings>);
    };

    const menuItems = [
        {
            id: 'exercise-master',
            title: '種目マスター管理',
            subtitle: '種目の追加・編集・削除・検知パラメーター設定',
            icon: 'list.bullet.rectangle.portrait.fill',
            onPress: () => router.push('/(tabs)/exercise-master'),
        },
        {
            id: 'app-settings',
            title: 'アプリ設定',
            subtitle: '単位、通知、オーディオフィードバック',
            icon: 'slider.horizontal.3',
            onPress: () => Alert.alert('アプリ設定', '現在開発中です。単位や通知の設定がここに追加されます。'),
        },
        {
            id: 'program-import',
            title: 'プログラムインポート',
            subtitle: 'Excelやテキストからメニューを一括読み込み',
            icon: 'doc.text.magnifyingglass',
            onPress: () => router.push('/import' as any),
        },
        {
            id: 'help',
            title: 'ヘルプ・ガイド',
            subtitle: '使い方、BLE接続のコツ',
            icon: 'questionmark.circle.fill',
            onPress: () => Alert.alert('ヘルプ', '公式ガイドを準備中です。右上の「AI相談」から使い方の質問も可能です。'),
        },
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top || 32 }]}>
                    <Text style={styles.title}>設定</Text>
                </View>

                <View style={styles.section}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.menuItem}
                            onPress={item.onPress}
                        >
                            <View style={styles.menuIconContainer}>
                                <IconSymbol size={24} name={item.icon as any} color="#2196F3" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.menuTitle}>{item.title}</Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                            </View>
                            <IconSymbol size={20} name="chevron.right" color="#444" />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>音声フィードバック</Text>
                    <View style={styles.settingCard}>
                        <View style={styles.settingInfo}>
                            <IconSymbol size={24} name="speaker.wave.2.fill" color="#4CAF50" />
                            <View style={styles.settingTextContainer}>
                                <Text style={styles.settingTitle}>ナビボイス音量</Text>
                                <Text style={styles.settingSubtitle}>
                                    現在の音量: {Math.round(currentVolume * 100)}%
                                </Text>
                            </View>
                        </View>
                        <View style={styles.volumeControls}>
                            <TouchableOpacity
                                style={styles.volButton}
                                onPress={() => handleVolumeChange(-0.1)}
                            >
                                <IconSymbol size={20} name="minus" color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.volDisplay}>
                                <Text style={styles.volValue}>{Math.round(currentVolume * 100)}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.volButton}
                                onPress={() => handleVolumeChange(0.1)}
                            >
                                <IconSymbol size={20} name="plus" color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>RepVelo VBT Coach v1.2.0</Text>
                    <Text style={styles.copyrightText}>© 2024 RepVelo Team</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
        paddingTop: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 32,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    menuIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    menuSubtitle: {
        fontSize: 13,
        color: '#999',
    },
    footer: {
        padding: 32,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    copyrightText: {
        fontSize: 12,
        color: '#444',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        marginLeft: 8,
    },
    settingCard: {
        backgroundColor: '#2a2a2a',
        borderRadius: 16,
        padding: 16,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    settingTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 13,
        color: '#999',
    },
    volumeControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 8,
    },
    volButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    volDisplay: {
        width: 60,
        alignItems: 'center',
    },
    volValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
});
