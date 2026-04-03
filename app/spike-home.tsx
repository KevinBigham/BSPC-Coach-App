import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/config/theme';

export default function SpikeHome() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BSPC Coach App</Text>
        <Text style={styles.subtitle}>Phase 0 — Validation Spike</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spike Tests</Text>

        <Link href="/spike-offline" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>1. Offline Sync Test</Text>
            <Text style={styles.cardDesc}>
              Add test swimmers to Firestore, toggle airplane mode, verify sync
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/spike-audio" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>2. Audio Recording Test</Text>
            <Text style={styles.cardDesc}>
              Record poolside audio, upload to Cloud Storage, test transcription
            </Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity style={[styles.card, styles.cardDisabled]}>
          <Text style={[styles.cardTitle, styles.cardTitleDisabled]}>3. AI Extraction Test</Text>
          <Text style={[styles.cardDesc, styles.cardDescDisabled]}>
            Test Claude Haiku extraction (requires Cloud Functions deployment)
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Blue Springs Power Cats</Text>
        <Text style={styles.footerVersion}>v0.0.1 — Spike</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.purple,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.purple,
    marginBottom: spacing.xs,
  },
  cardTitleDisabled: {
    color: colors.textSecondary,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  cardDescDisabled: {
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.gold,
    fontWeight: '600',
  },
  footerVersion: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
