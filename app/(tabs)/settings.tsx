import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { getNotificationPermissionStatus } from '../../src/services/notifications';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { tapHeavy, selectionChanged } from '../../src/utils/haptics';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type NotifPref = 'dailyDigest' | 'newNotes' | 'attendanceAlerts' | 'aiDraftsReady';

function SettingsScreen() {
  const { coach, user, signOut, isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('unknown');

  useEffect(() => {
    getNotificationPermissionStatus()
      .then(setPushStatus)
      .catch(() => setPushStatus('error'));
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          tapHeavy();
          void signOut();
        },
      },
    ]);
  };

  const toggleNotification = async (key: NotifPref) => {
    if (!user || !coach) return;
    selectionChanged();
    const currentValue = coach.notificationPrefs[key];
    setSaving(true);
    try {
      await updateDoc(doc(db, 'coaches', user.uid), {
        [`notificationPrefs.${key}`]: !currentValue,
        updatedAt: serverTimestamp(),
      });
      // AuthContext will refresh from Firestore on next auth state change
      // For immediate feedback, we trust the toggle state
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{coach?.displayName?.[0]?.toUpperCase() || 'C'}</Text>
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
        <View style={styles.pushStatusRow}>
          <Text style={styles.pushStatusLabel}>Push Notifications</Text>
          <Text
            style={[
              styles.pushStatusValue,
              { color: pushStatus === 'granted' ? colors.success : colors.warning },
            ]}
          >
            {pushStatus === 'granted' ? 'ENABLED' : pushStatus === 'denied' ? 'DENIED' : 'NOT SET'}
          </Text>
        </View>
        <NotificationToggle
          label="Daily Digest"
          value={coach?.notificationPrefs.dailyDigest ?? true}
          onToggle={() => toggleNotification('dailyDigest')}
          disabled={saving}
        />
        <NotificationToggle
          label="New Notes"
          value={coach?.notificationPrefs.newNotes ?? true}
          onToggle={() => toggleNotification('newNotes')}
          disabled={saving}
        />
        <NotificationToggle
          label="Attendance Alerts"
          value={coach?.notificationPrefs.attendanceAlerts ?? true}
          onToggle={() => toggleNotification('attendanceAlerts')}
          disabled={saving}
        />
        <NotificationToggle
          label="AI Drafts Ready"
          value={coach?.notificationPrefs.aiDraftsReady ?? true}
          onToggle={() => toggleNotification('aiDraftsReady')}
          disabled={saving}
        />
      </View>

      {isAdmin && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ADMIN</Text>
          <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin')}>
            <Text style={styles.adminBtnText}>MANAGE COACHES</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.adminBtn, { marginTop: spacing.sm }]}
            onPress={() => router.push('/import')}
          >
            <Text style={styles.adminBtnText}>IMPORT ROSTER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.adminBtn, { marginTop: spacing.sm }]}
            onPress={() => router.push('/meet-import')}
          >
            <Text style={styles.adminBtnText}>IMPORT MEET RESULTS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.adminBtn, { marginTop: spacing.sm }]}
            onPress={() => router.push('/import/history')}
          >
            <Text style={styles.adminBtnText}>IMPORT HISTORY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <Text style={styles.version}>V{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
  );
}

function NotificationToggle({
  label,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.bgBase, true: colors.purple }}
        thumbColor={value ? colors.gold : colors.textSecondary}
        ios_backgroundColor={colors.bgBase}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.lg },
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
  avatarText: { fontFamily: fontFamily.heading, color: colors.gold, fontSize: fontSize.xxl },
  name: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.text, letterSpacing: 2 },
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
  roleText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  pushStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pushStatusLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pushStatusValue: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingLabel: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text },
  adminBtn: {
    backgroundColor: colors.bgBase,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.purple,
    width: '100%',
  },
  adminBtnText: {
    fontFamily: fontFamily.bodySemi,
    color: colors.accent,
    fontSize: fontSize.md,
    letterSpacing: 1,
  },
  signOutButton: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: { fontFamily: fontFamily.bodySemi, color: colors.error, fontSize: fontSize.md },
  version: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

export default withScreenErrorBoundary(SettingsScreen, 'SettingsScreen');
