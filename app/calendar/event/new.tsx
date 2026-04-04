import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../../src/config/theme';
import { GROUPS, CALENDAR_EVENT_TYPES, type Group } from '../../../src/config/constants';
import { addEvent, getEventTypeColor, getEventTypeLabel } from '../../../src/services/calendar';
import type { CalendarEventType } from '../../../src/types/firestore.types';

export default function NewEventScreen() {
  const { coach } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEventType>('practice');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleGroup = (g: Group) => {
    setGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Event title is required');
      return;
    }
    if (!startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      Alert.alert('Required', 'Please enter a valid date (YYYY-MM-DD)');
      return;
    }
    if (!coach) return;

    setSaving(true);
    try {
      await addEvent(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startDate: startDate.trim(),
          startTime: startTime.trim() || undefined,
          endTime: endTime.trim() || undefined,
          location: location.trim() || undefined,
          groups,
          coachId: coach.uid,
          coachName: coach.displayName || 'Coach',
        },
        coach.uid,
      );
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Event Type */}
        <Text style={styles.label}>EVENT TYPE</Text>
        <View style={styles.typeRow}>
          {CALENDAR_EVENT_TYPES.map((t) => {
            const typeColor = getEventTypeColor(t);
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && { backgroundColor: typeColor, borderColor: typeColor }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                  {getEventTypeLabel(t).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <Text style={styles.label}>TITLE *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Tuesday Practice"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        {/* Date */}
        <Text style={styles.label}>DATE *</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numbers-and-punctuation"
        />

        {/* Time */}
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>START TIME</Text>
            <TextInput
              style={styles.input}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>END TIME</Text>
            <TextInput
              style={styles.input}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Location */}
        <Text style={styles.label}>LOCATION</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. BSPC Pool"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Description */}
        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Event details..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        {/* Groups */}
        <Text style={styles.label}>GROUPS (empty = all groups)</Text>
        <View style={styles.groupsGrid}>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.groupChip,
                groups.includes(g) && { backgroundColor: groupColors[g] || colors.purple, borderColor: groupColors[g] || colors.purple },
              ]}
              onPress={() => toggleGroup(g)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  groups.includes(g) && { color: colors.bgDeep },
                ]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'CREATE EVENT'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, fontFamily: fontFamily.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  // Type
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgDeep },
  typeChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  typeChipTextActive: { color: colors.text },
  // Time
  timeRow: { flexDirection: 'row', gap: spacing.md },
  // Groups
  groupsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgDeep },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  // Save
  saveBtn: { backgroundColor: colors.purple, padding: spacing.lg, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.xl },
  saveBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, letterSpacing: 1 },
});
