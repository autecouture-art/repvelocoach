import React from 'react';
import { View, Dimensions, StyleSheet, Text } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { RepData } from '../types/index';

interface Props {
    reps: RepData[];
    setIndex: number;
}

export function RepVelocityChart({ reps, setIndex }: Props) {
    const setReps = reps.filter(r => r.set_index === setIndex && !r.is_excluded && r.is_valid_rep);

    if (setReps.length < 2) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>グラフを表示するには2レップ以上必要です</Text>
            </View>
        );
    }

    const data = {
        labels: setReps.map((_, i) => `${i + 1}`),
        datasets: [{
            data: setReps.map(r => r.mean_velocity ?? 0),
        }],
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>レップ毎の平均速度推移 (m/s)</Text>
            <LineChart
                data={data}
                width={Dimensions.get('window').width - 32}
                height={180}
                yAxisLabel=""
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                    backgroundColor: '#2a2a2a',
                    backgroundGradientFrom: '#2a2a2a',
                    backgroundGradientTo: '#1a1a1a',
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Blue
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                        borderRadius: 12,
                    },
                    propsForDots: {
                        r: "4",
                        strokeWidth: "2",
                        stroke: "#4CAF50" // Green dots
                    }
                }}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 12,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
        marginHorizontal: 16,
        padding: 12,
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
    },
    title: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    emptyContainer: {
        marginVertical: 12,
        marginHorizontal: 16,
        padding: 24,
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 12,
    },
});
