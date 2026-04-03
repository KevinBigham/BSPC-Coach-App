import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
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
          tabBarIcon: () => null,
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'ATTENDANCE',
          tabBarIcon: () => null,
          tabBarLabel: 'Attendance',
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'ROSTER',
          tabBarIcon: () => null,
          tabBarLabel: 'Roster',
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'PRACTICE',
          tabBarIcon: () => null,
          tabBarLabel: 'Practice',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: () => null,
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
