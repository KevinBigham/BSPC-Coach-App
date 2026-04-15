import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { markNotificationRead, subscribeNotifications } from '../src/services/notifications';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { formatDateString, formatRelativeTime } from '../src/utils/date';
import { getTodayString } from '../src/utils/time';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import type { FirebaseTimestamp, Notification } from '../src/types/firestore.types';

type NotificationWithId = Notification & { id: string };

const DIGEST_PLACEHOLDER = '--- NO DIGEST YET ---';
const EMPTY_PLACEHOLDER = '--- NO NOTIFICATIONS ---';
const MAX_NOTIFICATIONS = 50;
const REFRESH_DELAY_MS = 400;

const TYPE_META: Record<
  Notification['type'],
  { label: string; color: string; backgroundColor: string }
> = {
  daily_digest: {
    label: 'DAILY',
    color: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
  },
  ai_drafts_ready: {
    label: 'DRAFTS',
    color: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.12)',
  },
  standard_achieved: {
    label: 'STANDARD',
    color: colors.success,
    backgroundColor: 'rgba(204, 176, 0, 0.12)',
  },
  general: {
    label: 'GENERAL',
    color: colors.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
};

function toDate(timestamp: FirebaseTimestamp): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }

  const maybeTimestamp = timestamp as FirebaseTimestamp & { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : new Date();
}

function NotificationsScreen() {
  const { coach } = useAuth();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const pendingReadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!coach?.uid) {
      setNotifications([]);
      return;
    }

    return subscribeNotifications(
      coach.uid,
      (items) => {
        setNotifications(items);

        const unreadItems = items.filter((item) => !item.read);
        unreadItems.forEach((item) => {
          if (pendingReadIds.current.has(item.id)) {
            return;
          }

          pendingReadIds.current.add(item.id);
          markNotificationRead(item.id).catch(() => {
            pendingReadIds.current.delete(item.id);
          });
        });
      },
      MAX_NOTIFICATIONS,
    );
  }, [coach?.uid]);

  const todayDigest = useMemo(() => {
    const today = getTodayString();
    return notifications.find((item) => {
      if (item.type !== 'daily_digest') {
        return false;
      }

      return formatDateForDigest(item.createdAt) === today;
    });
  }, [notifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, REFRESH_DELAY_MS);
  }, []);

  const handlePress = useCallback(async (item: NotificationWithId) => {
    pendingReadIds.current.add(item.id);
    await markNotificationRead(item.id).catch(() => {
      pendingReadIds.current.delete(item.id);
    });

    if (item.data?.draftId) {
      router.push('/ai-review');
      return;
    }

    if (item.data?.swimmerId) {
      router.push(`/swimmer/${item.data.swimmerId}`);
    }
  }, []);

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        notifications.length === 0 ? styles.emptyContent : undefined,
      ]}
      renderItem={({ item }) => {
        const meta = TYPE_META[item.type];
        const timestamp = toDate(item.createdAt);

        return (
          <TouchableOpacity style={styles.row} onPress={() => void handlePress(item)}>
            <View style={styles.rowText}>
              <View
                style={[
                  styles.typePill,
                  {
                    borderColor: meta.color,
                    backgroundColor: meta.backgroundColor,
                  },
                ]}
              >
                <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.rowTime}>{formatRelativeTime(timestamp)}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        );
      }}
      ListHeaderComponent={
        <View style={styles.digestCard}>
          <Text style={styles.digestLabel}>TODAY&apos;S DIGEST</Text>
          {todayDigest ? (
            <>
              <Text style={styles.digestTitle}>{todayDigest.title.toUpperCase()}</Text>
              <Text style={styles.digestBody}>{todayDigest.body}</Text>
            </>
          ) : (
            <Text style={styles.digestPlaceholder}>{DIGEST_PLACEHOLDER}</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyLabel}>{EMPTY_PLACEHOLDER}</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    />
  );
}

function formatDateForDigest(timestamp: FirebaseTimestamp): string {
  return formatDateString(toDate(timestamp));
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
  digestCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  digestLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  digestTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  digestBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  digestPlaceholder: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  typePillText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    letterSpacing: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  rowBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  rowTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
});

export default withScreenErrorBoundary(NotificationsScreen, 'NotificationsScreen');
