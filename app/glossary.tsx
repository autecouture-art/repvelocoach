/**
 * Glossary Screen Route
 */

import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import GlossaryScreen from '@/src/screens/GlossaryScreen';

export default function GlossaryRoute() {
  const params = useLocalSearchParams();

  return (
    <>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <GlossaryScreen />
      </View>
    </>
  );
}
