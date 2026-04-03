import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';

export default function SettingsScreen() {
  const { coach, signOut, isAdmin } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {coach?.displayName?.[0]?.toUpperCase() || 'C'}
          </Text>
        </View>
        <Text style={styles.name}>{coach?.displayName?.toUpperCase()}</Text>
        <Text style={styles.email}>{coach?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{isAdmin ? 'ADMIN' : 'COACH'}</Text>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <SettingRow label="Daily Digest" value={coach?.notificationPrefs.dailyDigest} />
        <SettingRow label="New Notes" value={coach?.notificationPrefs.newNotes} />
        <SettingRow label="Attendance Alerts" value={coach?.notificationPrefs.attendanceAlerts} />
        <SettingRow label="AI Drafts Ready" value={coach?.notificationPrefs.aiDraftsReady} />
        <Text style={styles.comingSoon}>Notification preferences editing coming soon</Text>
      </View>

      {isAdmin && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ADMIN</Text>
          <Text style={styles.comingSoon}>
            Coach management, roster import, and data export will appear here.
          </Text>
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <Text style={styles.version}>V0.1.0</Text>
    </ScrollView>
  );
}

function SettingRow({ label, value }: { label: string; value?: boolean }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={[styles.settingValue, { color: value ? colors.success : colors.textSecondary }]}>
        {value ? 'ON' : 'OFF'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontFamily: fontFamily.heading,
    color: colors.gold,
    fontSize: fontSize.xxl,
  },
  name: {
    fontFamily: fontFamily.heading,
    fontSize: 26,
    color: colors.text,
    letterSpacing: 2,
  },
  email: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  roleBadge: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  roleText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
  },
  settingValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.md,
  },
  comingSoon: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    fontFamily: fontFamily.bodySemi,
    color: colors.error,
    fontSize: fontSize.md,
  },
  version: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
