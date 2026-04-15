import { useState, useEffect } from 'react';
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
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import type { MedicalInfo } from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function MedicalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [lastUpdated, setLastUpdated] = useState<{ by: string; at: Date | null }>({
    by: '',
    at: null,
  });

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only admins can view medical information.');
      router.back();
      return;
    }
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'swimmers', id, 'medical', 'info'));
        if (snap.exists()) {
          const data = snap.data() as MedicalInfo;
          setAllergies((data.allergies || []).join('\n'));
          setConditions((data.conditions || []).join('\n'));
          setMedications((data.medications || []).join('\n'));
          setEmergencyNotes(data.emergencyNotes || '');
          setLastUpdated({
            by: data.updatedBy || '',
            at: data.updatedAt instanceof Date ? data.updatedAt : null,
          });
        }
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
      setLoading(false);
    })();
  }, [id, isAdmin]);

  const handleSave = async () => {
    if (!id || !coach) return;
    setSaving(true);
    try {
      const toArray = (s: string) =>
        s
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

      await setDoc(doc(db, 'swimmers', id, 'medical', 'info'), {
        allergies: toArray(allergies),
        conditions: toArray(conditions),
        medications: toArray(medications),
        emergencyNotes: emergencyNotes.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: coach.uid,
      });

      Alert.alert('Saved', 'Medical information updated.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'MEDICAL INFO' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.warningCard}>
          <Text style={styles.warningPixel}>SENSITIVE DATA</Text>
          <Text style={styles.warningText}>
            Medical information is restricted to admin-role coaches only.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ALLERGIES</Text>
          <Text style={styles.hint}>One per line</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g. Penicillin, Bee stings"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>CONDITIONS</Text>
          <Text style={styles.hint}>One per line</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={conditions}
            onChangeText={setConditions}
            placeholder="e.g. Asthma, Type 1 Diabetes"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>MEDICATIONS</Text>
          <Text style={styles.hint}>One per line</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={medications}
            onChangeText={setMedications}
            placeholder="e.g. Albuterol inhaler"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>EMERGENCY NOTES</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={emergencyNotes}
            onChangeText={setEmergencyNotes}
            placeholder="Any special instructions for emergencies..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        {lastUpdated.by && (
          <Text style={styles.lastUpdated}>
            Last updated by {lastUpdated.by}
            {lastUpdated.at ? ` on ${lastUpdated.at.toLocaleDateString()}` : ''}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'SAVE MEDICAL INFO'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  warningCard: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  warningPixel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.error,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgBase,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  lastUpdated: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: fontSize.xl,
    letterSpacing: 2,
  },
});

export default withScreenErrorBoundary(MedicalScreen, 'MedicalScreen');
