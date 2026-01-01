import React from 'react'
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native'
import SummaryPanel from '../src/components/SummaryPanel.native'

const MOCK_PROFILE = {
  name: 'Avery Example',
  ageLabel: '28',
  gender: 'Non-binary',
  districtLabel: 'Downtown',
  tags: ['scarred', 'ex-cop'],
  affiliations: ['Freelancers'],
  vitals: { health: 78, stress: 22, bounty: 400 }
}

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <SummaryPanel profile={MOCK_PROFILE} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { padding: 16 }
})
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
