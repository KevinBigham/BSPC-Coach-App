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
  Image,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import * as ImagePicker from 'expo-image-picker';
import type { Swimmer, ParentContact } from '../../src/types/firestore.types';
import { uploadProfilePhoto, deleteProfilePhoto } from '../../src/services/profilePhoto';

export default function EditSwimmerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [group, setGroup] = useState<Group>('Bronze');
  const [gender, setGender] = useState<'M' | 'F'>('F');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [usaSwimmingId, setUsaSwimmingId] = useState('');
  const [active, setActive] = useState(true);

  // Array fields
  const [goals, setGoals] = useState('');
  const [strengths, setStrengths] = useState('');
  const [focusAreas, setFocusAreas] = useState('');

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Parent contacts
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'swimmers', id));
        if (snap.exists()) {
          const s = snap.data() as Swimmer;
          setFirstName(s.firstName || '');
          setLastName(s.lastName || '');
          setGroup(s.group || 'Bronze');
          setGender(s.gender || 'F');
          setDateOfBirth(s.dateOfBirth ? String(s.dateOfBirth) : '');
          setUsaSwimmingId(s.usaSwimmingId || '');
          setActive(s.active !== false);
          setGoals((s.goals || []).join('\n'));
          setStrengths((s.strengths || []).join('\n'));
          setFocusAreas((s.techniqueFocusAreas || []).join('\n'));
          setParentContacts(
            s.parentContacts?.length
              ? s.parentContacts
              : [{ name: '', phone: '', email: '', relationship: 'Parent' }],
          );
          setPhotoUrl(s.profilePhotoUrl || null);
        }
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      const toArray = (s: string) =>
        s
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

      await updateDoc(doc(db, 'swimmers', id!), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        group,
        gender,
        dateOfBirth: dateOfBirth.trim() || null,
        usaSwimmingId: usaSwimmingId.trim() || null,
        active,
        goals: toArray(goals),
        strengths: toArray(strengths),
        techniqueFocusAreas: toArray(focusAreas),
        parentContacts: parentContacts.filter((pc) => pc.name.trim()),
        updatedAt: serverTimestamp(),
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const updateContact = (index: number, field: keyof ParentContact, value: string) => {
    setParentContacts((prev) =>
      prev.map((pc, i) => (i === index ? { ...pc, [field]: value } : pc)),
    );
  };

  const addContact = () => {
    setParentContacts((prev) => [
      ...prev,
      { name: '', phone: '', email: '', relationship: 'Parent' },
    ]);
  };

  const removeContact = (index: number) => {
    if (parentContacts.length <= 1) return;
    setParentContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    if (!id) return;
    setPhotoUploading(true);
    try {
      const url = await uploadProfilePhoto(id, result.assets[0].uri);
      setPhotoUrl(url);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setPhotoUploading(false);
  };

  const handleRemovePhoto = async () => {
    if (!id) return;
    setPhotoUploading(true);
    try {
      await deleteProfilePhoto(id);
      setPhotoUrl(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setPhotoUploading(false);
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
      <Stack.Screen options={{ title: 'EDIT SWIMMER' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Photo */}
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.sectionTitle}>PHOTO</Text>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoInitial}>{firstName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePickPhoto}
              disabled={photoUploading}
            >
              <Text style={styles.photoButtonText}>
                {photoUploading ? 'UPLOADING...' : 'CHANGE PHOTO'}
              </Text>
            </TouchableOpacity>
            {photoUrl && (
              <TouchableOpacity
                style={[styles.photoButton, { borderColor: colors.error }]}
                onPress={handleRemovePhoto}
                disabled={photoUploading}
              >
                <Text style={[styles.photoButtonText, { color: colors.error }]}>REMOVE</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Basic Info */}
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
              <Text style={styles.toggleText}>Female</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, gender === 'M' && styles.toggleActive]}
              onPress={() => setGender('M')}
            >
              <Text style={styles.toggleText}>Male</Text>
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
                  style={[
                    styles.groupChipText,
                    { color: group === g ? colors.bgDeep : colors.text },
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Active Status */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>STATUS</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, active && styles.toggleActiveGold]}
              onPress={() => setActive(true)}
            >
              <Text style={styles.toggleText}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !active && styles.toggleActiveError]}
              onPress={() => setActive(false)}
            >
              <Text style={styles.toggleText}>Inactive</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Goals, Strengths, Focus Areas */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>DEVELOPMENT</Text>

          <Text style={styles.label}>GOALS (one per line)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={goals}
            onChangeText={setGoals}
            placeholder="e.g. Drop 2s in 100 Free"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          <Text style={styles.label}>STRENGTHS (one per line)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={strengths}
            onChangeText={setStrengths}
            placeholder="e.g. Strong underwater work"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          <Text style={styles.label}>FOCUS AREAS (one per line)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={focusAreas}
            onChangeText={setFocusAreas}
            placeholder="e.g. Freestyle catch timing"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        {/* Parent Contacts */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PARENT/GUARDIAN CONTACTS</Text>
          {parentContacts.map((pc, i) => (
            <View key={i} style={styles.contactBlock}>
              {i > 0 && <View style={styles.contactDivider} />}
              <View style={styles.contactHeader}>
                <Text style={styles.contactNum}>Contact {i + 1}</Text>
                {parentContacts.length > 1 && (
                  <TouchableOpacity onPress={() => removeContact(i)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>NAME</Text>
              <TextInput
                style={styles.input}
                value={pc.name}
                onChangeText={(v) => updateContact(i, 'name', v)}
                placeholder="Parent name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />

              <Text style={styles.label}>PHONE</Text>
              <TextInput
                style={styles.input}
                value={pc.phone}
                onChangeText={(v) => updateContact(i, 'phone', v)}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={pc.email}
                onChangeText={(v) => updateContact(i, 'email', v)}
                placeholder="parent@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>RELATIONSHIP</Text>
              <TextInput
                style={styles.input}
                value={pc.relationship}
                onChangeText={(v) => updateContact(i, 'relationship', v)}
                placeholder="Parent"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.addContactBtn} onPress={addContact}>
            <Text style={styles.addContactText}>+ ADD CONTACT</Text>
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</Text>
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  toggleActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  toggleActiveGold: { backgroundColor: colors.goldDark, borderColor: colors.gold },
  toggleActiveError: { backgroundColor: 'rgba(244,63,94,0.2)', borderColor: colors.error },
  toggleText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
  },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm },
  contactBlock: { marginBottom: spacing.sm },
  contactDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactNum: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent },
  removeText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.error },
  addContactBtn: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.purple,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addContactText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent },
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
  photo: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.accent },
  photoPlaceholder: {
    backgroundColor: colors.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: { fontFamily: fontFamily.heading, fontSize: 32, color: colors.accent },
  photoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  photoButtonText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
  },
});
