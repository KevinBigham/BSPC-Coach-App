import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { parseCSV, validateRows, importSwimmers, type ParsedRow, type ValidationResult } from '../src/services/csvImport';

type Stage = 'input' | 'preview' | 'importing' | 'done';

export default function ImportScreen() {
  const { coach, isAdmin } = useAuth();
  const [csvText, setCsvText] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [parsed, setParsed] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Admin access required</Text>
      </View>
    );
  }

  const handleParse = () => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      Alert.alert('No Data', 'Paste CSV with a header row and at least one data row.');
      return;
    }
    const validation = validateRows(rows);
    setParsed(validation);
    setStage('preview');
  };

  const handleImport = async () => {
    if (!parsed || !coach) return;
    setStage('importing');
    try {
      const res = await importSwimmers(parsed.valid, coach.uid);
      setResult(res);
      setStage('done');
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setStage('preview');
    }
  };

  if (stage === 'done' && result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.resultCard}>
          <Text style={styles.resultPixel}>IMPORT COMPLETE</Text>
          <View style={styles.resultRow}>
            <View style={styles.resultStat}>
              <Text style={styles.resultNum}>{result.created}</Text>
              <Text style={styles.resultLabel}>CREATED</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={[styles.resultNum, { color: colors.textSecondary }]}>{result.skipped}</Text>
              <Text style={styles.resultLabel}>SKIPPED</Text>
            </View>
          </View>
          {result.errors.length > 0 && (
            <View style={styles.errorList}>
              {result.errors.map((e, i) => (
                <Text key={i} style={styles.errorItem}>{e}</Text>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>BACK TO SETTINGS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (stage === 'importing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.importingText}>Importing swimmers...</Text>
      </View>
    );
  }

  if (stage === 'preview' && parsed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.previewHeader}>
          <View style={styles.previewStat}>
            <Text style={styles.previewNum}>{parsed.valid.length}</Text>
            <Text style={styles.previewLabel}>VALID</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={[styles.previewNum, { color: colors.error }]}>{parsed.errors.length}</Text>
            <Text style={styles.previewLabel}>ERRORS</Text>
          </View>
        </View>

        {parsed.errors.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ERRORS</Text>
            {parsed.errors.map((e, i) => (
              <Text key={i} style={styles.errorItem}>{e}</Text>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PREVIEW ({parsed.valid.length} swimmers)</Text>
          {parsed.valid.slice(0, 20).map((row, i) => (
            <View key={i} style={styles.previewRow}>
              <Text style={styles.previewName}>{row.firstName} {row.lastName}</Text>
              <Text style={styles.previewMeta}>{row.group} · {row.gender}</Text>
            </View>
          ))}
          {parsed.valid.length > 20 && (
            <Text style={styles.moreText}>...and {parsed.valid.length - 20} more</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStage('input')}>
            <Text style={styles.backBtnText}>← BACK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBtn, parsed.valid.length === 0 && { opacity: 0.5 }]}
            onPress={handleImport}
            disabled={parsed.valid.length === 0}
          >
            <Text style={styles.importBtnText}>IMPORT {parsed.valid.length}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Input stage
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PASTE CSV DATA</Text>
        <Text style={styles.hint}>
          Expected columns: firstName, lastName, group, gender, dateOfBirth, usaSwimmingId, parentName, parentPhone, parentEmail
        </Text>
        <TextInput
          style={styles.csvInput}
          value={csvText}
          onChangeText={setCsvText}
          placeholder={'firstName,lastName,group,gender\nJane,Doe,Gold,F\nJohn,Smith,Silver,M'}
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[styles.parseBtn, !csvText.trim() && { opacity: 0.5 }]}
        onPress={handleParse}
        disabled={!csvText.trim()}
      >
        <Text style={styles.parseBtnText}>PARSE & PREVIEW</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  errorText: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.error },
  importingText: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.lg },
  card: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, letterSpacing: 1, marginBottom: spacing.sm },
  hint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 16 },
  csvInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.sm, fontFamily: fontFamily.statMono, color: colors.text, backgroundColor: colors.bgBase, minHeight: 200 },
  parseBtn: { backgroundColor: colors.purple, padding: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center' },
  parseBtnText: { fontFamily: fontFamily.heading, color: colors.text, fontSize: fontSize.xl, letterSpacing: 2 },
  // Preview
  previewHeader: { flexDirection: 'row', gap: spacing.sm },
  previewStat: { flex: 1, backgroundColor: colors.bgDeep, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  previewNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.accent },
  previewLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1, marginTop: spacing.xs },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  previewName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  previewMeta: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  moreText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  errorItem: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.error, paddingVertical: 2 },
  errorList: { marginTop: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  backBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  backBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.accent },
  importBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.purple, alignItems: 'center' },
  importBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  // Result
  resultCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  resultPixel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1, marginBottom: spacing.lg },
  resultRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  resultStat: { alignItems: 'center' },
  resultNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.success },
  resultLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1, marginTop: spacing.xs },
  doneBtn: { backgroundColor: colors.purple, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: borderRadius.sm, marginTop: spacing.md },
  doneBtnText: { fontFamily: fontFamily.bodySemi, color: colors.text, fontSize: fontSize.md },
});
