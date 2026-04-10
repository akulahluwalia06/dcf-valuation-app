import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#00FF8022',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 6,
        },
        tabBarActiveTintColor: '#00FF80',
        tabBarInactiveTintColor: '#1a3a2a',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
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
