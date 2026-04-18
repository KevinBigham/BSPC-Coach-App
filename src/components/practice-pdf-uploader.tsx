import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Eye, FileUp } from 'lucide-react-native';
import { useToast } from '../contexts/ToastContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import {
  subscribeTodayPracticePlan,
  uploadDashboardPracticePlanPdf,
  createDashboardPracticePlanPdf,
} from '../services/practicePlans';
import { formatRelativeTime, toDateSafe, type FirestoreTimestampLike } from '../utils/date';
import type { DashboardPracticePlanPdf } from '../types/practicePlan';

type DashboardPracticePlanPdfWithId = DashboardPracticePlanPdf & { id: string };

interface PracticePdfUploaderProps {
  coachId: string;
}

export default function PracticePdfUploader({ coachId }: PracticePdfUploaderProps) {
  const { showToast } = useToast();
  const [todayPlan, setTodayPlan] = useState<DashboardPracticePlanPdfWithId | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    return subscribeTodayPracticePlan(coachId, setTodayPlan);
  }, [coachId]);

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const uploadedAt = new Date();
      const date = uploadedAt.toISOString().split('T')[0];
      setUploading(true);
      setUploadProgress(0);

      const { storagePath } = await uploadDashboardPracticePlanPdf(
        asset.uri,
        coachId,
        date,
        asset.name || 'practice.pdf',
        (percent) => setUploadProgress(percent / 100),
      );

      await createDashboardPracticePlanPdf({
        coachId,
        date,
        storagePath,
        filename: asset.name || 'practice.pdf',
        uploadedAt,
        sizeBytes: asset.size || 0,
      });

      showToast("Today's practice uploaded", 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to upload practice PDF', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadedAt = todayPlan ? toDateSafe(todayPlan.uploadedAt as FirestoreTimestampLike) : null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          {todayPlan ? (
            <Eye size={20} color={colors.gold} strokeWidth={2.5} />
          ) : (
            <FileUp size={20} color={colors.gold} strokeWidth={2.5} />
          )}
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{todayPlan ? "TODAY'S PRACTICE" : 'UPLOAD PRACTICE'}</Text>
          <Text style={styles.subtitle}>
            {todayPlan ? todayPlan.filename : 'Pick today’s PDF practice sheet from your device.'}
          </Text>
        </View>
      </View>

      {todayPlan && (
        <View style={styles.planMeta}>
          <Text style={styles.planMetaText}>
            {uploadedAt ? `Uploaded ${formatRelativeTime(uploadedAt)}` : 'Uploaded today'}
          </Text>
        </View>
      )}

      {uploading && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        {!todayPlan && (
          <TouchableOpacity
            style={[styles.primaryButton, uploading && styles.buttonDisabled]}
            onPress={() => void pickAndUpload()}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.bgDeep} />
            ) : (
              <>
                <FileUp size={18} color={colors.bgDeep} strokeWidth={2.5} />
                <Text style={styles.primaryButtonText}>UPLOAD PDF</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {todayPlan && (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/practice-plan/${todayPlan.id}`)}
            >
              <Eye size={18} color={colors.bgDeep} strokeWidth={2.5} />
              <Text style={styles.primaryButtonText}>VIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, uploading && styles.buttonDisabled]}
              onPress={() => void pickAndUpload()}
              disabled={uploading}
            >
              <FileUp size={18} color={colors.gold} strokeWidth={2.5} />
              <Text style={styles.secondaryButtonText}>REPLACE</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  planMeta: {
    paddingVertical: spacing.xs,
  },
  planMetaText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  progressWrap: {
    gap: spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgBase,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  progressText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flex: 1,
    minWidth: 140,
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 140,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,215,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.gold,
    letterSpacing: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
