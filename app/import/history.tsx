import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { subscribeImportJobs } from '../../src/services/importJobs';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { formatRelativeTime } from '../../src/utils/date';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import type { FirebaseTimestamp, ImportJob } from '../../src/types/firestore.types';

type ImportJobWithId = ImportJob & { id: string };

const TYPE_LABELS: Record<ImportJob['type'], string> = {
  csv_roster: 'CSV',
  sdif: 'SDIF',
  hy3: 'HY3',
  cl2: 'CL2',
};

const STATUS_COLORS: Record<ImportJob['status'], string> = {
  processing: colors.warning,
  complete: colors.success,
  failed: colors.error,
};

function toDate(timestamp: FirebaseTimestamp): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }

  const maybeTimestamp = timestamp as FirebaseTimestamp & { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : new Date();
}

function ImportHistoryScreen() {
  const { coach, isAdmin } = useAuth();
  const [jobs, setJobs] = useState<ImportJobWithId[]>([]);

  useEffect(() => {
    if (!coach?.uid) {
      setJobs([]);
      return;
    }

    return subscribeImportJobs(coach.uid, setJobs);
  }, [coach?.uid]);

  const emptyMessage = useMemo(() => {
    if (!isAdmin) {
      return 'Admin access required';
    }

    return '--- NO IMPORTS ---';
  }, [isAdmin]);

  return (
    <FlatList
      data={isAdmin ? jobs : []}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={[styles.content, jobs.length === 0 ? styles.emptyContent : undefined]}
      renderItem={({ item }) => {
        const statusColor = STATUS_COLORS[item.status];

        return (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{TYPE_LABELS[item.type]}</Text>
              </View>
              <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.fileName}>{item.fileName}</Text>
            <Text style={styles.summary}>
              {item.summary.recordsProcessed} rows • {item.summary.swimmersCreated} created •{' '}
              {item.summary.timesImported} times
            </Text>
            {item.errorMessage ? (
              <Text style={styles.errorText} numberOfLines={2}>
                {item.errorMessage}
              </Text>
            ) : null}
            <Text style={styles.timestamp}>{formatRelativeTime(toDate(item.createdAt))}</Text>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
    />
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
  row: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(179, 136, 255, 0.12)',
  },
  typeBadgeText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadgeText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    letterSpacing: 1,
  },
  fileName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  summary: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  timestamp: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
});

export default withScreenErrorBoundary(ImportHistoryScreen, 'ImportHistoryScreen');
