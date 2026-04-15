import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function AddSwimmerScreen() {
  const { coach } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [group, setGroup] = useState<Group>('Bronze');
  const [gender, setGender] = useState<'M' | 'F'>('F');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [usaSwimmingId, setUsaSwimmingId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      const swimmerData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        group,
        gender,
        dateOfBirth: dateOfBirth.trim() || null,
        usaSwimmingId: usaSwimmingId.trim() || null,
        active: true,
        strengths: [],
        weaknesses: [],
        techniqueFocusAreas: [],
        goals: [],
        parentContacts: parentName.trim()
          ? [
              {
                name: parentName.trim(),
                phone: parentPhone.trim(),
                email: parentEmail.trim(),
                relationship: 'Parent',
              },
            ]
          : [],
        meetSchedule: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: coach?.uid || '',
      };

      const docRef = await addDoc(collection(db, 'swimmers'), swimmerData);
      router.replace(`/swimmer/${docRef.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>SWIMMER INFO</Text>

        <Text style={styles.label}>FIRST NAME *</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        <Text style={styles.label}>LAST NAME *</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        <Text style={styles.label}>DATE OF BIRTH</Text>
        <TextInput
          style={styles.input}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>USA SWIMMING ID</Text>
        <TextInput
          style={styles.input}
          value={usaSwimmingId}
          onChangeText={setUsaSwimmingId}
          placeholder="Optional"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Gender */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GENDER</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, gender === 'F' && styles.toggleActive]}
            onPress={() => setGender('F')}
          >
            <Text style={[styles.toggleText, gender === 'F' && styles.toggleTextActive]}>
              Female
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, gender === 'M' && styles.toggleActive]}
            onPress={() => setGender('M')}
          >
            <Text style={[styles.toggleText, gender === 'M' && styles.toggleTextActive]}>Male</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Group */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GROUP</Text>
        <View style={styles.groupGrid}>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.groupChip,
                {
                  backgroundColor: group === g ? groupColors[g] || colors.purple : colors.bgBase,
                  borderColor: groupColors[g] || colors.border,
                },
              ]}
              onPress={() => setGroup(g)}
            >
              <Text
                style={[styles.groupChipText, { color: group === g ? colors.bgDeep : colors.text }]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Parent Contact */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PARENT/GUARDIAN</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={parentName}
          onChangeText={setParentName}
          placeholder="Parent name"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        <Text style={styles.label}>PHONE</Text>
        <TextInput
          style={styles.input}
          value={parentPhone}
          onChangeText={setParentPhone}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={parentEmail}
          onChangeText={setParentEmail}
          placeholder="parent@email.com"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'ADD SWIMMER'}</Text>
      </TouchableOpacity>
    </ScrollView>
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
    paddingBottom: spacing.xxxl,
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
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    letterSpacing: 1,
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
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  toggleActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purpleLight,
  },
  toggleText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  toggleTextActive: {
    color: colors.text,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
  },
  groupChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
  },
  saveButton: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: fontSize.xl,
    letterSpacing: 2,
  },
});

export default withScreenErrorBoundary(AddSwimmerScreen, 'AddSwimmerScreen');
