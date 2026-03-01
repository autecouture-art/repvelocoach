import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SettingsScreen() {
    const router = useRouter();

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
            onPress: () => { }, // 将来の実装
        },
        {
            id: 'help',
            title: 'ヘルプ・ガイド',
            subtitle: '使い方、BLE接続のコツ',
            icon: 'questionmark.circle.fill',
            onPress: () => { },
        },
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
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
});
