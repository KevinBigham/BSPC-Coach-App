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
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, COURSES, STANDARD_MEET_EVENTS, type Group, type Course } from '../../src/config/constants';
import { addMeet } from '../../src/services/meets';
import type { MeetEvent } from '../../src/types/meet.types';

export default function NewMeetScreen() {
  const { coach } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [course, setCourse] = useState<Course>('SCY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hostTeam, setHostTeam] = useState('');
  const [sanctionNumber, setSanctionNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleGroup = (g: Group) => {
    setGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const toggleEvent = (eventName: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventName)) next.delete(eventName);
      else next.add(eventName);
      return next;
    });
  };

  const selectStandardEvents = () => {
    setSelectedEvents(new Set(STANDARD_MEET_EVENTS.map((e) => e.name)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Meet name is required');
      return;
    }
    if (!startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      Alert.alert('Required', 'Please enter a valid start date (YYYY-MM-DD)');
      return;
    }
    if (!coach) return;

    setSaving(true);
    try {
      const events: MeetEvent[] = Array.from(selectedEvents).map((eName, i) => {
        const template = STANDARD_MEET_EVENTS.find((e) => e.name === eName);
        return {
          number: i + 1,
          name: eName,
          gender: 'Mixed' as const,
          isRelay: template?.isRelay || false,
        };
      });

      const meetId = await addMeet({
        name: name.trim(),
        location: location.trim(),
        course,
        startDate: startDate.trim(),
        endDate: endDate.trim() || undefined,
        status: 'upcoming',
        events,
        groups,
        notes: notes.trim() || undefined,
        sanctionNumber: sanctionNumber.trim() || undefined,
        hostTeam: hostTeam.trim() || undefined,
        coachId: coach.uid,
        coachName: coach.displayName || 'Coach',
      });

      router.replace(`/meet/${meetId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Text style={styles.label}>MEET NAME *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. BSPC Invitational"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        {/* Location */}
        <Text style={styles.label}>LOCATION</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. BSPC Aquatic Center"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Course */}
        <Text style={styles.label}>COURSE</Text>
        <View style={styles.courseRow}>
          {COURSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.courseChip, course === c && styles.courseChipActive]}
              onPress={() => setCourse(c)}
            >
              <Text style={[styles.courseChipText, course === c && styles.courseChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dates */}
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>START DATE *</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>END DATE</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Host & Sanction */}
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>HOST TEAM</Text>
            <TextInput
              style={styles.input}
              value={hostTeam}
              onChangeText={setHostTeam}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>SANCTION #</Text>
            <TextInput
              style={styles.input}
              value={sanctionNumber}
              onChangeText={setSanctionNumber}
              placeholder="Optional"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Groups */}
        <Text style={styles.label}>GROUPS (empty = all)</Text>
        <View style={styles.groupsGrid}>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.groupChip,
                groups.includes(g) && { backgroundColor: groupColors[g] || colors.purple, borderColor: groupColors[g] },
              ]}
              onPress={() => toggleGroup(g)}
            >
              <Text style={[styles.groupChipText, groups.includes(g) && { color: colors.bgDeep }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Events */}
        <Text style={styles.label}>EVENTS</Text>
        <TouchableOpacity style={styles.quickBtn} onPress={selectStandardEvents}>
          <Text style={styles.quickBtnText}>USE STANDARD MEET ORDER</Text>
        </TouchableOpacity>
        <View style={styles.eventsGrid}>
          {STANDARD_MEET_EVENTS.map((e) => (
            <TouchableOpacity
              key={e.name}
              style={[
                styles.eventChip,
                selectedEvents.has(e.name) && styles.eventChipActive,
                e.isRelay && selectedEvents.has(e.name) && { backgroundColor: colors.gold, borderColor: colors.gold },
              ]}
              onPress={() => toggleEvent(e.name)}
            >
              <Text
                style={[
                  styles.eventChipText,
                  selectedEvents.has(e.name) && styles.eventChipTextActive,
                  e.isRelay && selectedEvents.has(e.name) && { color: colors.bgDeep },
                ]}
              >
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.label}>NOTES</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Meet notes..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'CREATING...' : 'CREATE MEET'}</Text>
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
  // Course
  courseRow: { flexDirection: 'row', gap: spacing.sm },
  courseChip: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  courseChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  courseChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  courseChipTextActive: { color: colors.text },
  // Dates
  dateRow: { flexDirection: 'row', gap: spacing.md },
  // Groups
  groupsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgDeep },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  // Events
  quickBtn: { backgroundColor: colors.purple, padding: spacing.md, borderRadius: borderRadius.sm, alignItems: 'center', marginBottom: spacing.sm },
  quickBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text, letterSpacing: 1 },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  eventChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgDeep },
  eventChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  eventChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  eventChipTextActive: { color: colors.text },
  // Save
  saveBtn: { backgroundColor: colors.purple, padding: spacing.lg, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.xl },
  saveBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, letterSpacing: 1 },
});
