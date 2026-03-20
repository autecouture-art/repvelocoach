import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RepData } from '../types/index';

interface Props {
    visible: boolean;
    reps: RepData[];
    setIndex: number;
    onClose: () => void;
    onExcludeRep?: (repId: string, reason: string) => void;
    onMarkFailedRep?: (repId: string, isFailed: boolean) => void;
}

export function RepDetailModal({ visible, reps, setIndex, onClose, onExcludeRep, onMarkFailedRep }: Props) {
    // 対象セットの有効なレップのみ抽出 (除外されていないもの)
    const setReps = useMemo(() => {
        return reps.filter(r => r.set_index === setIndex && !r.is_excluded);
    }, [reps, setIndex]);

    // 最新論文基準などのVL計算用
    const calculateVL = (repIndexInSet: number) => {
        if (repIndexInSet === 0) return 0;
        const firstRepVel = setReps[0].mean_velocity || 0;
        const currentVel = setReps[repIndexInSet].mean_velocity || 0;
        if (firstRepVel === 0) return 0;
        return (((firstRepVel - currentVel) / firstRepVel) * 100).toFixed(1);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Set {setIndex} ‒ レップ詳細</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollArea}>
                        {setReps.length === 0 ? (
                            <Text style={styles.emptyText}>記録されたレップがありません</Text>
                        ) : (
                            setReps.map((rep, index) => (
                                <View key={rep.rep_index} style={[styles.repRow, rep.is_failed && styles.repRowFailed]}>
                                    <View style={styles.repInfo}>
                                        <View style={styles.repNumberContainer}>
                                            <Text style={[styles.repNumber, rep.is_failed && styles.repNumberFailed]}>#{index + 1}</Text>
                                            {rep.is_failed && <Text style={styles.failedBadge}>FAILED</Text>}
                                        </View>
                                        <View style={styles.metrics}>
                                            <Text style={[styles.metricText, rep.is_failed && styles.metricTextFailed]}>
                                                V: {rep.mean_velocity?.toFixed(2)} m/s
                                            </Text>
                                            <Text style={[styles.metricText, rep.is_failed && styles.metricTextFailed]}>
                                                ROM: {rep.rom_cm?.toFixed(1)} cm
                                            </Text>
                                            <Text style={[styles.metricText, styles.vlText, rep.is_failed && styles.metricTextFailed]}>
                                                VL: {calculateVL(index)}%
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.actionButtons}>
                                        {onMarkFailedRep && (
                                            <TouchableOpacity
                                                style={[styles.actionBtn, rep.is_failed ? styles.unfailBtn : styles.failBtn]}
                                                onPress={() => {
                                                    // rep.id (UUID) があればそれを使う、なければ rep_index をフォールバック
                                                    const repId = rep.id || String(rep.rep_index);
                                                    onMarkFailedRep(repId, !rep.is_failed);
                                                }}
                                            >
                                                <Ionicons name={rep.is_failed ? "checkmark-circle-outline" : "close-circle-outline"} size={18} color={rep.is_failed ? "#4CAF50" : "#FF9800"} />
                                                <Text style={[styles.actionBtnText, { color: rep.is_failed ? "#4CAF50" : "#FF9800" }]}>
                                                    {rep.is_failed ? '失敗取消' : '失敗'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {onExcludeRep && (
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.excludeBtn]}
                                                onPress={() => {
                                                    // rep.id (UUID) があればそれを使う、なければ rep_index をフォールバック
                                                    const repId = rep.id || String(rep.rep_index);
                                                    onExcludeRep(repId, 'user_removed');
                                                }}
                                            >
                                                <Ionicons name="trash-outline" size={18} color="#f44336" />
                                                <Text style={[styles.actionBtnText, { color: '#f44336' }]}>除外</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: '70%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    scrollArea: {
        padding: 16,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    repRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    repInfo: {
        flex: 1,
    },
    repNumber: {
        color: '#A0A0A0',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    metrics: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metricText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    vlText: {
        color: '#FF9500',
    },
    repNumberContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    repNumberFailed: {
        color: '#FF9800',
    },
    failedBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FF9800',
        borderColor: '#FF9800',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        marginTop: 4,
    },
    metricTextFailed: {
        color: '#FF9800',
        textDecorationLine: 'line-through',
    },
    excludeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginLeft: 12,
    },
    excludeBtnText: {
        color: '#ff4444',
        marginLeft: 4,
        fontSize: 14,
        fontWeight: 'bold',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: 1,
    },
    failBtn: {
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
    },
    unfailBtn: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    repRowFailed: {
        borderLeftColor: '#FF9800',
        borderLeftWidth: 4,
        backgroundColor: 'rgba(255, 152, 0, 0.05)',
    },
});
