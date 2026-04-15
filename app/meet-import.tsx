import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../src/contexts/AuthContext';
import { subscribeSwimmers } from '../src/services/swimmers';
import { parseSDIF, type SDIFParseResult, type MatchResult } from '../src/services/sdifImport';
import { parseHY3, detectFormat } from '../src/services/hy3Import';
import { importMatchedResults, matchSwimmersToRoster } from '../src/services/meetResultsImport';
import { subscribeMeets } from '../src/services/meets';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import type { Swimmer } from '../src/types/firestore.types';
import type { Meet } from '../src/types/meet.types';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

type SwimmerWithId = Swimmer & { id: string };
type Stage = 'input' | 'preview' | 'importing' | 'done';

const CONFIDENCE_BADGE = {
  exact: { label: 'USS MATCH', color: colors.gold },
  name: { label: 'NAME MATCH', color: colors.accent },
  none: { label: 'NO MATCH', color: colors.error },
};

type MeetWithId = Meet & { id: string };
type FileFormat = 'sdif' | 'hy3' | 'auto';

function MeetImportScreen() {
  const { meetId: routeMeetId } = useLocalSearchParams<{ meetId?: string }>();
  const { coach } = useAuth();
  const [stage, setStage] = useState<Stage>('input');
  const [rawText, setRawText] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [swimmers, setSwimmers] = useState<SwimmerWithId[]>([]);
  const [meets, setMeets] = useState<MeetWithId[]>([]);
  const [selectedMeetId, setSelectedMeetId] = useState<string>(routeMeetId || '');
  const [fileFormat, setFileFormat] = useState<FileFormat>('auto');
  const [parseResult, setParseResult] = useState<SDIFParseResult | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    prs: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    return subscribeSwimmers(true, setSwimmers);
  }, []);

  useEffect(() => {
    return subscribeMeets((m) => setMeets(m as MeetWithId[]));
  }, []);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const text = await response.text();
      setRawText(text);
      setSourceFileName(asset.name ?? null);
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  };

  const handleParse = () => {
    if (!rawText.trim()) {
      Alert.alert('Required', 'Paste data or pick a file first');
      return;
    }

    const format = fileFormat === 'auto' ? detectFormat(rawText) : fileFormat;
    const parsed = format === 'hy3' ? parseHY3(rawText) : parseSDIF(rawText);

    if (parsed.records.length === 0) {
      Alert.alert(
        'No Results',
        `No swim times found in the data.${parsed.errors.length > 0 ? ` Errors: ${parsed.errors.length}` : ''}`,
      );
      return;
    }

    setParseResult(parsed);
    setMatches(matchSwimmersToRoster(parsed.records, swimmers));
    setStage('preview');
  };

  const handleImport = async () => {
    if (!coach) return;
    setStage('importing');

    const format = fileFormat === 'auto' ? detectFormat(rawText) : fileFormat;
    const source = format === 'hy3' ? ('hy3_import' as const) : ('sdif_import' as const);

    try {
      const result = await importMatchedResults(
        matches,
        coach.uid,
        source,
        selectedMeetId || undefined,
        {
          fileName:
            sourceFileName ??
            (format === 'hy3' ? 'manual-meet-results.hy3' : 'manual-meet-results.sdif'),
          storagePath:
            sourceFileName != null
              ? `manual/${sourceFileName}`
              : format === 'hy3'
                ? 'manual/meet-results.hy3'
                : 'manual/meet-results.sdif',
        },
      );
      setImportResult(result);
      setStage('done');
    } catch (err: unknown) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Unknown import failure');
      setStage('preview');
    }
  };

  const handleReset = () => {
    setStage('input');
    setRawText('');
    setSourceFileName(null);
    setParseResult(null);
    setMatches([]);
    setImportResult(null);
  };

  const matchedCount = matches.filter((m) => m.matchedSwimmer).length;
  const unmatchedCount = matches.filter((m) => !m.matchedSwimmer).length;

  return (
    <>
      <Stack.Screen options={{ title: 'IMPORT MEET RESULTS' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Stage: Input */}
          {stage === 'input' && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>IMPORT MEET RESULTS</Text>
                <Text style={styles.cardDesc}>
                  Import swim times from SDIF (.sd3) or Hy-Tek (.hy3) files. Pick a file or paste
                  the data below.
                </Text>

                {/* Format Toggle */}
                <Text style={styles.fieldLabel}>FORMAT</Text>
                <View style={styles.formatRow}>
                  {(['auto', 'sdif', 'hy3'] as FileFormat[]).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.formatChip, fileFormat === f && styles.formatChipActive]}
                      onPress={() => setFileFormat(f)}
                    >
                      <Text
                        style={[
                          styles.formatChipText,
                          fileFormat === f && styles.formatChipTextActive,
                        ]}
                      >
                        {f === 'auto' ? 'AUTO DETECT' : f.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Meet Linking */}
                {meets.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>LINK TO MEET (OPTIONAL)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.formatRow}>
                        <TouchableOpacity
                          style={[styles.formatChip, !selectedMeetId && styles.formatChipActive]}
                          onPress={() => setSelectedMeetId('')}
                        >
                          <Text
                            style={[
                              styles.formatChipText,
                              !selectedMeetId && styles.formatChipTextActive,
                            ]}
                          >
                            NONE
                          </Text>
                        </TouchableOpacity>
                        {meets.slice(0, 10).map((m) => (
                          <TouchableOpacity
                            key={m.id}
                            style={[
                              styles.formatChip,
                              selectedMeetId === m.id && styles.formatChipActive,
                            ]}
                            onPress={() => setSelectedMeetId(m.id)}
                          >
                            <Text
                              style={[
                                styles.formatChipText,
                                selectedMeetId === m.id && styles.formatChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {m.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickFile}>
                  <Text style={styles.pickFileBtnText}>PICK FILE</Text>
                </TouchableOpacity>
                <Text style={styles.orText}>— or paste below —</Text>
                <TextInput
                  style={styles.textArea}
                  value={rawText}
                  onChangeText={setRawText}
                  placeholder="Paste SDIF or HY3 data here..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !rawText.trim() && { opacity: 0.5 }]}
                onPress={handleParse}
                disabled={!rawText.trim()}
              >
                <Text style={styles.primaryBtnText}>PARSE</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Stage: Preview */}
          {stage === 'preview' && parseResult && (
            <>
              {/* Meet Info */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{parseResult.meetName || 'MEET RESULTS'}</Text>
                <View style={styles.meetMeta}>
                  {parseResult.meetDate && (
                    <Text style={styles.meetMetaText}>{parseResult.meetDate}</Text>
                  )}
                  <Text style={styles.meetMetaText}>{parseResult.course}</Text>
                  <Text style={styles.meetMetaText}>{parseResult.records.length} results</Text>
                </View>
              </View>

              {/* Match Summary */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { borderColor: colors.success }]}>
                  <Text style={[styles.summaryNum, { color: colors.success }]}>{matchedCount}</Text>
                  <Text style={styles.summaryLabel}>MATCHED</Text>
                </View>
                <View style={[styles.summaryCard, { borderColor: colors.error }]}>
                  <Text style={[styles.summaryNum, { color: colors.error }]}>{unmatchedCount}</Text>
                  <Text style={styles.summaryLabel}>UNMATCHED</Text>
                </View>
              </View>

              {/* Parse Errors */}
              {parseResult.errors.length > 0 && (
                <View style={[styles.card, { borderColor: colors.warning }]}>
                  <Text style={[styles.cardTitle, { color: colors.warning }]}>
                    WARNINGS ({parseResult.errors.length})
                  </Text>
                  {parseResult.errors.slice(0, 5).map((e, i) => (
                    <Text key={i} style={styles.errorLine}>
                      {e}
                    </Text>
                  ))}
                </View>
              )}

              {/* Results Preview */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>PREVIEW</Text>
                {matches.slice(0, 30).map((match, i) => {
                  const badge = CONFIDENCE_BADGE[match.confidence];
                  return (
                    <View key={i} style={styles.resultRow}>
                      <View style={styles.resultLeft}>
                        <Text style={styles.resultName}>
                          {match.record.lastName}, {match.record.firstName}
                        </Text>
                        <Text style={styles.resultEvent}>
                          {match.record.event} • {match.record.timeDisplay} • {match.record.course}
                        </Text>
                      </View>
                      <View style={[styles.matchBadge, { borderColor: badge.color }]}>
                        <Text style={[styles.matchBadgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {matches.length > 30 && (
                  <Text style={styles.moreText}>+ {matches.length - 30} more results</Text>
                )}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
                  <Text style={styles.secondaryBtnText}>BACK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
                  <Text style={styles.primaryBtnText}>IMPORT {matchedCount} RESULTS</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Stage: Importing */}
          {stage === 'importing' && (
            <View style={styles.centeredCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.importingText}>IMPORTING TIMES...</Text>
            </View>
          )}

          {/* Stage: Done */}
          {stage === 'done' && importResult && (
            <>
              <View style={styles.centeredCard}>
                <Text style={styles.doneTitle}>IMPORT COMPLETE</Text>
                <View style={styles.doneStats}>
                  <View style={styles.doneStat}>
                    <Text style={[styles.doneStatNum, { color: colors.accent }]}>
                      {importResult.imported}
                    </Text>
                    <Text style={styles.doneStatLabel}>IMPORTED</Text>
                  </View>
                  <View style={styles.doneStat}>
                    <Text style={[styles.doneStatNum, { color: colors.gold }]}>
                      {importResult.prs}
                    </Text>
                    <Text style={styles.doneStatLabel}>NEW PRs</Text>
                  </View>
                  <View style={styles.doneStat}>
                    <Text style={[styles.doneStatNum, { color: colors.textSecondary }]}>
                      {importResult.skipped}
                    </Text>
                    <Text style={styles.doneStatLabel}>SKIPPED</Text>
                  </View>
                </View>
                {importResult.errors.length > 0 && (
                  <View style={styles.doneErrors}>
                    {importResult.errors.map((e, i) => (
                      <Text key={i} style={styles.errorLine}>
                        {e}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleReset}>
                <Text style={styles.primaryBtnText}>IMPORT ANOTHER</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  // Cards
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  cardDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },

  // Format / Meet Linking
  fieldLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  formatRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  formatChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  formatChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  formatChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  formatChipTextActive: { color: colors.text },

  // Input
  pickFileBtn: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickFileBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  orText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.text,
    backgroundColor: colors.bgBase,
    minHeight: 150,
    textAlignVertical: 'top',
  },

  // Meet Meta
  meetMeta: { flexDirection: 'row', gap: spacing.md },
  meetMetaText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Summary
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl },
  summaryLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultLeft: { flex: 1 },
  resultName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  resultEvent: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  matchBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  matchBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  moreText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // Errors
  errorLine: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: 2,
  },

  // Actions
  actionRow: { flexDirection: 'row', gap: spacing.md },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  secondaryBtn: {
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // Importing/Done
  centeredCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  importingText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.accent,
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  doneTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.success,
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  doneStats: { flexDirection: 'row', gap: spacing.xl },
  doneStat: { alignItems: 'center' },
  doneStatNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl },
  doneStatLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  doneErrors: { marginTop: spacing.lg, width: '100%' },
});

export default withScreenErrorBoundary(MeetImportScreen, 'MeetImportScreen');
