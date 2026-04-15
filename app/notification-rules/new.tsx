import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  createNotificationRule,
  updateNotificationRule,
} from '../../src/services/notificationRules';
import { GROUPS, type Group } from '../../src/config/constants';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import type { NotificationTrigger } from '../../src/types/firestore.types';

type SupportedTrigger = Extract<NotificationTrigger, 'attendance_streak' | 'missed_practice'>;

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 30;
const TRIGGERS: { value: SupportedTrigger; label: string; help: string }[] = [
  {
    value: 'missed_practice',
    label: 'MISSED PRACTICE',
    help: 'Alert when a swimmer has been absent for N days.',
  },
  {
    value: 'attendance_streak',
    label: 'ATTENDANCE STREAK',
    help: 'Alert when a swimmer hits N straight practices.',
  },
];

function readStringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function normalizeGroup(value: string): Group | '' {
  return GROUPS.includes(value as Group) ? (value as Group) : '';
}

function buildRuleName(trigger: SupportedTrigger, threshold: number, group: Group | ''): string {
  const groupSuffix = group ? ` • ${group}` : '';
  if (trigger === 'missed_practice') {
    return `Missed ${threshold} Practice${threshold === 1 ? '' : 's'}${groupSuffix}`;
  }

  return `Streak ${threshold}${groupSuffix}`;
}

function NotificationRuleEditorScreen() {
  const { coach } = useAuth();
  const params = useLocalSearchParams();

  const ruleId = readStringParam(params.ruleId);
  const initialTrigger =
    readStringParam(params.trigger) === 'attendance_streak'
      ? 'attendance_streak'
      : 'missed_practice';
  const initialThreshold = readStringParam(params.threshold) || '3';
  const initialGroup = normalizeGroup(readStringParam(params.group));
  const initialName = readStringParam(params.name);
  const initialMessage = readStringParam(params.message);
  const initialEnabled = readStringParam(params.enabled) !== 'false';

  const [name, setName] = useState(initialName);
  const [trigger, setTrigger] = useState<SupportedTrigger>(initialTrigger);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [group, setGroup] = useState<Group | ''>(initialGroup);
  const [message, setMessage] = useState(initialMessage);
  const [saving, setSaving] = useState(false);

  const helperText = useMemo(
    () => TRIGGERS.find((item) => item.value === trigger)?.help ?? '',
    [trigger],
  );

  const handleSave = async () => {
    if (!coach?.uid) {
      return;
    }

    const parsedThreshold = Number.parseInt(threshold, 10);
    if (
      Number.isNaN(parsedThreshold) ||
      parsedThreshold < MIN_THRESHOLD ||
      parsedThreshold > MAX_THRESHOLD
    ) {
      Alert.alert('Invalid Threshold', `Enter a value from ${MIN_THRESHOLD} to ${MAX_THRESHOLD}.`);
      return;
    }

    const ruleName = name.trim() || buildRuleName(trigger, parsedThreshold, group);

    setSaving(true);
    try {
      if (ruleId) {
        await updateNotificationRule(ruleId, {
          name: ruleName,
          trigger,
          enabled: initialEnabled,
          config: {
            threshold: parsedThreshold,
            group: group || undefined,
            message: message.trim() || undefined,
          },
        });
      } else {
        await createNotificationRule({
          name: ruleName,
          trigger,
          enabled: true,
          config: {
            threshold: parsedThreshold,
            group: group || undefined,
            message: message.trim() || undefined,
          },
          coachId: coach.uid,
        });
      }

      router.back();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unable to save rule';
      Alert.alert('Save Failed', messageText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: ruleId ? 'EDIT RULE' : 'NEW RULE' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TRIGGER</Text>
          <View style={styles.optionColumn}>
            {TRIGGERS.map((item) => {
              const selected = trigger === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.optionCard, selected && styles.optionCardActive]}
                  onPress={() => setTrigger(item.value)}
                >
                  <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.optionBody}>{item.help}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>DETAILS</Text>

          <Text style={styles.label}>RULE NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={buildRuleName(trigger, Number.parseInt(threshold, 10) || 3, group)}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>THRESHOLD</Text>
          <TextInput
            style={styles.input}
            value={threshold}
            onChangeText={setThreshold}
            placeholder="3"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />
          <Text style={styles.helpText}>{helperText}</Text>

          <Text style={styles.label}>GROUP</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.groupRow}>
              <TouchableOpacity
                style={[styles.groupChip, group === '' && styles.groupChipActive]}
                onPress={() => setGroup('')}
              >
                <Text style={[styles.groupChipText, group === '' && styles.groupChipTextActive]}>
                  ALL
                </Text>
              </TouchableOpacity>
              {GROUPS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.groupChip, group === item && styles.groupChipActive]}
                  onPress={() => setGroup(item)}
                >
                  <Text
                    style={[styles.groupChipText, group === item && styles.groupChipTextActive]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>CUSTOM MESSAGE</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Optional coach-facing message"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'SAVE RULE'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
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
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  optionColumn: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
  },
  optionCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  optionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: 1,
  },
  optionTitleActive: {
    color: colors.gold,
  },
  optionBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageInput: {
    minHeight: 100,
  },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  groupChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  groupChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  groupChipTextActive: {
    color: colors.gold,
  },
  saveButton: {
    backgroundColor: colors.purple,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 2,
  },
});

export default withScreenErrorBoundary(
  NotificationRuleEditorScreen,
  'NotificationRuleEditorScreen',
);
