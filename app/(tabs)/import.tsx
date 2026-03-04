import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import DatabaseService from '@/src/services/DatabaseService';
import type { Exercise } from '@/src/types/index';

interface ParsedRow {
    exerciseName: string;
    load_kg?: number;
    reps?: number;
    sets?: number;
    rpe?: number;
    matchedExerciseId?: string;
}

export default function ImportScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [inputText, setInputText] = useState('');
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // Load exercises to match names
    React.useEffect(() => {
        DatabaseService.getExercises().then(setExercises);
    }, []);

    const handleParse = () => {
        if (!inputText.trim()) {
            Alert.alert('エラー', 'テキストを入力してください');
            return;
        }

        setIsParsing(true);

        // Simple TSV / CSV / Text Parser
        // Expected format per line: Exercise Name \t Weight \t Reps \t Sets \t RPE
        const lines = inputText.split('\n');
        const result: ParsedRow[] = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            // Extract parts by tab or comma
            const parts = line.split(/\t|,/).map(s => s.trim()).filter(Boolean);

            if (parts.length > 0) {
                const namePart = parts[0];
                // Very basic extraction heuristic for the MVP demo:
                // Try to find numbers for load, reps, sets in the remaining parts

                let load, reps, sets, rpe;

                // Find match in exercises master
                const bestMatch = exercises.find(e =>
                    e.name.toLowerCase().includes(namePart.toLowerCase()) ||
                    namePart.toLowerCase().includes(e.name.toLowerCase())
                );

                // Quick heuristic parsing (Assumes order: Load -> Reps -> Sets)
                const numbers = parts.slice(1).map(p => parseFloat(p.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));

                if (numbers.length >= 1) load = numbers[0];
                if (numbers.length >= 2) reps = numbers[1];
                if (numbers.length >= 3) sets = numbers[2];

                result.push({
                    exerciseName: bestMatch ? bestMatch.name : namePart,
                    matchedExerciseId: bestMatch?.id,
                    load_kg: load,
                    reps: reps,
                    sets: sets,
                    rpe: rpe
                });
            }
        }

        setParsedData(result);
        setIsParsing(false);
    };

    const handleImport = () => {
        if (parsedData.length === 0) return;

        Alert.alert(
            'インポート完了',
            `合計 ${parsedData.length} 種目のプログラムを読み込みました。\n（※MVPデモ画面です。実際のセッションレコードへの登録はPhase 2の外部API連携で行います）`,
            [{ text: 'OK', onPress: () => router.back() }]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color="#2196F3" />
                        <Text style={styles.backText}>戻る</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>プログラム読み込み</Text>
                </View>

                <ScrollView style={styles.content}>
                    <Text style={styles.instructions}>
                        Excelやスプレッドシートのトレーニングメニューをコピーして、下のテキストエリアに貼り付けてください。
                    </Text>

                    <Text style={styles.formatHint}>
                        推奨フォーマット (タブまたはカンマ区切り):{'\n'}種目名 | 重量(kg) | 回数 | セット数
                    </Text>

                    <TextInput
                        style={styles.textInput}
                        multiline
                        placeholder="ここにメニューをペースト..."
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={setInputText}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity style={styles.parseButton} onPress={handleParse} disabled={isParsing}>
                        <IconSymbol name="doc.text.viewfinder" size={20} color="#fff" />
                        <Text style={styles.parseButtonText}>データを解析する</Text>
                    </TouchableOpacity>

                    {parsedData.length > 0 && (
                        <View style={styles.previewSection}>
                            <Text style={styles.previewTitle}>プレビュー ({parsedData.length}件)</Text>

                            <View style={styles.previewList}>
                                {parsedData.map((row, index) => (
                                    <View key={index} style={styles.previewCard}>
                                        <View style={styles.previewHeader}>
                                            <Text style={[styles.previewName, !row.matchedExerciseId && styles.unmatchedName]}>
                                                {row.exerciseName}
                                            </Text>
                                            {!row.matchedExerciseId && (
                                                <Text style={styles.unmatchedBadge}>新規</Text>
                                            )}
                                        </View>

                                        <View style={styles.previewStats}>
                                            {row.load_kg !== undefined && (
                                                <Text style={styles.previewStat}>{row.load_kg}kg</Text>
                                            )}
                                            {row.reps !== undefined && (
                                                <Text style={styles.previewStat}>{row.reps} reps</Text>
                                            )}
                                            {row.sets !== undefined && (
                                                <Text style={styles.previewStat}>{row.sets} sets</Text>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.importButton} onPress={handleImport}>
                                <Text style={styles.importButtonText}>この内容で予定に追加</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    backText: {
        color: '#2196F3',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    instructions: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    formatHint: {
        color: '#999',
        fontSize: 12,
        marginBottom: 16,
        backgroundColor: '#2a2a2a',
        padding: 12,
        borderRadius: 8,
    },
    textInput: {
        backgroundColor: '#2a2a2a',
        color: '#fff',
        borderRadius: 12,
        padding: 16,
        minHeight: 150,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 16,
    },
    parseButton: {
        backgroundColor: '#9C27B0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    parseButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    previewSection: {
        marginTop: 32,
        marginBottom: 40,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    previewList: {
        gap: 12,
        marginBottom: 24,
    },
    previewCard: {
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    previewName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    unmatchedName: {
        color: '#FF9800',
    },
    unmatchedBadge: {
        fontSize: 10,
        backgroundColor: 'rgba(255, 152, 0, 0.2)',
        color: '#FF9800',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    previewStats: {
        flexDirection: 'row',
        gap: 12,
    },
    previewStat: {
        color: '#bbb',
        fontSize: 14,
    },
    importButton: {
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    importButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
