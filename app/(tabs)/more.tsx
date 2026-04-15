import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import {
  Users,
  Bell,
  CalendarDays,
  BarChart3,
  Search,
  Settings,
  BookOpen,
  Video,
} from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

interface MoreItem {
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  route: Href;
  iconColor: string;
}

const ITEMS: MoreItem[] = [
  {
    label: 'ROSTER',
    sublabel: 'Manage swimmers',
    icon: Users,
    route: '/(tabs)/roster',
    iconColor: colors.accent,
  },
  {
    label: 'CALENDAR',
    sublabel: 'Events & schedule',
    icon: CalendarDays,
    route: '/calendar',
    iconColor: colors.purpleLight,
  },
  {
    label: 'ANALYTICS',
    sublabel: 'Performance insights',
    icon: BarChart3,
    route: '/analytics',
    iconColor: colors.gold,
  },
  {
    label: 'VIDEO ANALYSIS',
    sublabel: 'AI stroke analysis',
    icon: Video,
    route: '/video',
    iconColor: colors.gold,
  },
  {
    label: 'NOTIFICATION RULES',
    sublabel: 'Alerts & streaks',
    icon: Bell,
    route: '/notification-rules',
    iconColor: colors.gold,
  },
  {
    label: 'SEARCH',
    sublabel: 'Find anything',
    icon: Search,
    route: '/search',
    iconColor: colors.accent,
  },
  {
    label: 'WORKOUT LIBRARY',
    sublabel: 'Templates & AI',
    icon: BookOpen,
    route: '/practice/library',
    iconColor: colors.purpleLight,
  },
  {
    label: 'SETTINGS',
    sublabel: 'Preferences & admin',
    icon: Settings,
    route: '/(tabs)/settings',
    iconColor: colors.textSecondary,
  },
];

function MoreScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.pixelLabel}>BSPC COACH</Text>
        <Text style={styles.heading}>MORE</Text>
      </View>

      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.tile}
            onPress={() => router.push(item.route)}
          >
            <item.icon size={28} color={item.iconColor} strokeWidth={2} />
            <Text style={styles.tileLabel}>{item.label}</Text>
            <Text style={styles.tileSublabel}>{item.sublabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { marginBottom: spacing.xl },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  heading: {
    fontFamily: fontFamily.heading,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  tileLabel: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  tileSublabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default withScreenErrorBoundary(MoreScreen, 'MoreScreen');
