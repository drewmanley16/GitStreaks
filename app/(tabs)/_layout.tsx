import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f1e05a', // GitHub Yellow
        tabBarInactiveTintColor: '#8b949e', // GitHub Gray
        tabBarStyle: {
          backgroundColor: '#0d1117', // GitHub Dark Background
          borderTopColor: '#30363d',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <View style={{ width: 20, height: 20, backgroundColor: color, borderRadius: 4 }} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color }) => <View style={{ width: 20, height: 20, backgroundColor: color, borderRadius: 4 }} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <View style={{ width: 20, height: 20, backgroundColor: color, borderRadius: 4 }} />,
        }}
      />
    </Tabs>
  );
}

