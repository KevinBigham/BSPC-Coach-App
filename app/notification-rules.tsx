import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Bell, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import {
  deleteNotificationRule,
  subscribeNotificationRules,
  updateNotificationRule,
} from '../src/services/notificationRules';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import type { NotificationRule, NotificationTrigger } from '../src/types/firestore.types';

type NotificationRuleWithId = NotificationRule & { id: string };

const TRIGGER_META: Record<
  Extract<NotificationTrigger, 'attendance_streak' | 'missed_practice'>,
  {
    label: string;
    color: string;
    backgroundColor: string;
  }
> = {
  attendance_streak: {
    label: 'STREAK',
    color: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
  },
  missed_practice: {
    label: 'MISSED',
    color: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.12)',
  },
};

function NotificationRulesScreen() {
  const { coach } = useAuth();
  const [rules, setRules] = useState<NotificationRuleWithId[]>([]);

  useEffect(() => {
    if (!coach?.uid) {
      setRules([]);
      return;
    }

    return subscribeNotificationRules(coach.uid, setRules);
  }, [coach?.uid]);

  const handleDelete = (rule: NotificationRuleWithId) => {
    Alert.alert('Delete Rule', `Delete "${rule.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteNotificationRule(rule.id);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/notification-rules/new')}
            >
              <Plus size={18} color={colors.accent} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          rules.length === 0 ? styles.emptyContent : undefined,
        ]}
        renderItem={({ item }) => {
          const meta = TRIGGER_META[item.trigger as keyof typeof TRIGGER_META];

          return (
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.ruleName}>{item.name}</Text>
                <View
                  style={[
                    styles.triggerPill,
                    {
                      borderColor: meta.color,
                      backgroundColor: meta.backgroundColor,
                    },
                  ]}
                >
                  <Text style={[styles.triggerPillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.ruleDetails}>
                  {item.config.threshold ?? 1} practice{item.config.threshold === 1 ? '' : 's'}
                  {item.config.group ? ` • ${item.config.group}` : ' • ALL GROUPS'}
                </Text>
                {item.config.message ? (
                  <Text style={styles.ruleMessage} numberOfLines={2}>
                    {item.config.message}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rowActions}>
                <Switch
                  value={item.enabled}
                  onValueChange={(enabled) => {
                    void updateNotificationRule(item.id, { enabled });
                  }}
                  trackColor={{ false: colors.bgBase, true: colors.purple }}
                  thumbColor={item.enabled ? colors.gold : colors.textSecondary}
                  ios_backgroundColor={colors.bgBase}
                />
                <View style={styles.iconRow}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      router.push({
                        pathname: '/notification-rules/new',
                        params: {
                          ruleId: item.id,
                          name: item.name,
                          trigger: item.trigger,
                          threshold: String(item.config.threshold ?? 1),
                          group: item.config.group ?? '',
                          message: item.config.message ?? '',
                          enabled: item.enabled ? 'true' : 'false',
                        },
                      })
                    }
                  >
                    <Pencil size={16} color={colors.accent} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleDelete(item)}>
                    <Trash2 size={16} color={colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Bell size={20} color={colors.gold} strokeWidth={2} />
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>ATTENDANCE ALERTS</Text>
              <Text style={styles.headerBody}>
                Watch missed practices and attendance streaks without opening the console.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>--- NO RULES ---</Text>
            <Text style={styles.emptyBody}>
              Tap the plus button to create your first attendance alert.
            </Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  emptyContent: {
    flexGrow: 1,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
  },
  headerCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  headerBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  rowCopy: {
    flex: 1,
  },
  ruleName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  triggerPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  triggerPillText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    letterSpacing: 1,
  },
  ruleDetails: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  ruleMessage: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  iconRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyTitle: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  emptyBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 260,
    lineHeight: 20,
  },
});

export default withScreenErrorBoundary(NotificationRulesScreen, 'NotificationRulesScreen');
