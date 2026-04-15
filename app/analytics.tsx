import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

interface AnalyticsCard {
  title: string;
  description: string;
  route: Href;
  accent: string;
}

const CARDS: AnalyticsCard[] = [
  {
    title: 'TIME DROPS',
    description: 'Who dropped the most time and in which events',
    route: '/analytics/time-drops',
    accent: colors.gold,
  },
  {
    title: 'ATTENDANCE TRENDS',
    description: 'Attendance rates vs improvement correlation',
    route: '/analytics/attendance-correlation',
    accent: colors.accent,
  },
  {
    title: 'GROUP PROGRESS',
    description: 'Group-level progress reports and comparisons',
    route: '/analytics/group-report',
    accent: colors.purpleLight,
  },
  {
    title: 'SPLIT COMPARISON',
    description: 'Compare 50-by-50 splits across multiple races',
    route: '/analytics/splits',
    accent: colors.success,
  },
  {
    title: 'PR PROGRESSION',
    description: 'Track time progression per swimmer and event',
    route: '/analytics/progression',
    accent: colors.info,
  },
];

function AnalyticsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ANALYTICS',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.pixelLabel}>PERFORMANCE</Text>
          <Text style={styles.heading}>ANALYTICS</Text>
          <Text style={styles.subtext}>
            Track improvement trends, attendance impact, and group progress
          </Text>
        </View>

        <View style={styles.cardGrid}>
          {CARDS.map((card) => (
            <TouchableOpacity
              key={card.title}
              style={styles.card}
              onPress={() => router.push(card.route)}
            >
              <View style={[styles.cardAccent, { backgroundColor: card.accent }]} />
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </>
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
    marginBottom: spacing.sm,
  },
  subtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cardGrid: { gap: spacing.md },
  card: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  cardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default withScreenErrorBoundary(AnalyticsScreen, 'AnalyticsScreen');
