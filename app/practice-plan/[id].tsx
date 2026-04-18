import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Constants from 'expo-constants';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Eye } from 'lucide-react-native';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../../src/config/firebase';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { useToast } from '../../src/contexts/ToastContext';
import { subscribePracticePlanPdf } from '../../src/services/practicePlans';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import type { DashboardPracticePlanPdf } from '../../src/types/practicePlan';

type DashboardPracticePlanPdfWithId = DashboardPracticePlanPdf & { id: string };
type NativePdfProps = {
  source: { uri: string; cache?: boolean };
  style: StyleProp<ViewStyle>;
  onError?: (error: unknown) => void;
};
type NativePdfComponent = ComponentType<NativePdfProps>;

function getNativePdfComponent(): NativePdfComponent | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    return require('react-native-pdf').default as NativePdfComponent;
  } catch {
    return null;
  }
}

function PracticePlanPdfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const [plan, setPlan] = useState<DashboardPracticePlanPdfWithId | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerFailed, setViewerFailed] = useState(false);
  const nativePdfComponent = useMemo(() => getNativePdfComponent(), []);

  const shouldUseExternalViewer =
    Platform.OS === 'web' || Constants.appOwnership === 'expo' || !nativePdfComponent;
  const NativePdfView = nativePdfComponent;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    return subscribePracticePlanPdf(id, (nextPlan) => {
      setPlan(nextPlan);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!plan?.storagePath) {
      return;
    }

    getDownloadURL(ref(storage, plan.storagePath))
      .then((url) => {
        setPdfUrl(url);
        if (shouldUseExternalViewer) {
          Linking.openURL(url).catch(() => {
            showToast('Unable to open PDF in system viewer', 'error');
          });
        }
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Unable to load PDF', 'error');
      });
  }, [plan?.storagePath, shouldUseExternalViewer, showToast]);

  const title = useMemo(() => plan?.filename || "TODAY'S PRACTICE", [plan?.filename]);

  return (
    <>
      <Stack.Screen options={{ title, headerShown: false }} />
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/(tabs)');
          }}
        >
          <ArrowLeft size={18} color={colors.text} strokeWidth={2.5} />
          <Text style={styles.backButtonText}>DASHBOARD</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{title.toUpperCase()}</Text>
          <Text style={styles.subtitle}>Practice PDF viewer</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {!loading && !plan && (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Practice PDF not found.</Text>
          </View>
        )}

        {!loading && plan && !pdfUrl && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {!loading && plan && pdfUrl && (shouldUseExternalViewer || viewerFailed) && (
          <View style={styles.fallbackWrap}>
            <Text style={styles.fallbackText}>
              This build is using the system PDF viewer for this file.
            </Text>
            <TouchableOpacity
              style={styles.openButton}
              onPress={() => {
                Linking.openURL(pdfUrl).catch(() => {
                  showToast('Unable to open PDF in system viewer', 'error');
                });
              }}
            >
              <Eye size={18} color={colors.bgDeep} strokeWidth={2.5} />
              <Text style={styles.openButtonText}>OPEN PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          plan &&
          pdfUrl &&
          !shouldUseExternalViewer &&
          !viewerFailed &&
          NativePdfView && (
            <NativePdfView
              source={{ uri: pdfUrl, cache: true }}
              style={styles.pdf}
              onError={() => {
                setViewerFailed(true);
                Linking.openURL(pdfUrl).catch(() => {
                  showToast('Unable to open PDF in system viewer', 'error');
                });
              }}
            />
          )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  backButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    letterSpacing: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgDeep,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  fallbackWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  fallbackText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  openButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  openButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bgBase,
  },
});

export default withScreenErrorBoundary(PracticePlanPdfScreen, 'PracticePlanPdfScreen');
