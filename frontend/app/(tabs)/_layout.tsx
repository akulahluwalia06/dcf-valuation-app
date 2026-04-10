import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0500',
          borderTopColor: '#FF8C0044',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 92 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: '#FF8C00',
        tabBarInactiveTintColor: '#7a4a00',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, size }: { color: string; size: number }) =>
            <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="panw"
        options={{
          title: 'PANW',
          tabBarIcon: ({ color, size }: { color: string; size: number }) =>
            <Ionicons name="analytics-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dcf"
        options={{
          title: 'DCF TOOL',
          tabBarIcon: ({ color, size }: { color: string; size: number }) =>
            <Ionicons name="calculator-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
