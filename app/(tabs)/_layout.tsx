import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Home, ClipboardCheck, Dumbbell, Trophy, MoreHorizontal } from 'lucide-react-native';
import { colors, fontFamily, fontSize } from '../../src/config/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontFamily: fontFamily.bodySemi,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'DASHBOARD',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'ATTENDANCE',
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => <ClipboardCheck size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'PRACTICE',
          tabBarLabel: 'Practice',
          tabBarIcon: ({ color, size }) => <Dumbbell size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="meets"
        options={{
          title: 'MEETS',
          tabBarLabel: 'Meets',
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'MORE',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'ROSTER',
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          href: null,
        }}
      />
    </Tabs>
  );
}
