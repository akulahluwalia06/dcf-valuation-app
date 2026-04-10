import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

const TAB_BG = '#0F1923';
const ACTIVE = '#0EA5E9';
const INACTIVE = '#64748B';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: '#1B2A3B',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="panw"
        options={{
          title: 'PANW',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="analytics-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dcf"
        options={{
          title: 'DCF Tool',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="calculator-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
