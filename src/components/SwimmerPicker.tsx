import { useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type SectionListData,
} from 'react-native';
import { Check } from 'lucide-react-native';

import { GROUPS } from '../config/constants';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../config/theme';
import { useSwimmersStore } from '../stores/swimmersStore';
import type { Swimmer } from '../types/firestore.types';
import { filterConsentedSwimmers } from '../utils/mediaConsent';

type SwimmerWithId = Swimmer & { id: string };
type SwimmerSection = {
  title: string;
  color: string;
  data: SwimmerWithId[];
};

interface SwimmerPickerProps {
  mode: 'single' | 'multi';
  requireConsent?: boolean;
  excludeInactive?: boolean;
  onSelect: (swimmerIds: string[]) => void;
  initialSelected?: string[];
}

function getLastInitial(swimmer: SwimmerWithId): string {
  return swimmer.lastName ? `${swimmer.lastName[0]}.` : '';
}

function buildSections(swimmers: SwimmerWithId[]): SwimmerSection[] {
  return GROUPS.map((group) => {
    const data = swimmers
      .filter((swimmer) => swimmer.group === group)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return {
      title: group,
      color: groupColors[group],
      data,
    };
  }).filter((section) => section.data.length > 0);
}

export default function SwimmerPicker({
  mode,
  requireConsent = false,
  excludeInactive = true,
  onSelect,
  initialSelected,
}: SwimmerPickerProps) {
  const swimmers = useSwimmersStore((state) => state.swimmers);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialSelected ?? []);
  const initialSelectedKey = initialSelected?.join('\u0000') ?? '';

  useEffect(() => {
    if (initialSelected) {
      setSelectedIds(initialSelected);
    }
  }, [initialSelected, initialSelectedKey]);

  const eligibleSwimmers = useMemo(() => {
    const withIds = swimmers.filter((swimmer): swimmer is SwimmerWithId => !!swimmer.id);
    const activeFiltered = excludeInactive
      ? withIds.filter((swimmer) => swimmer.active !== false)
      : withIds;
    return requireConsent ? filterConsentedSwimmers(activeFiltered) : activeFiltered;
  }, [excludeInactive, requireConsent, swimmers]);

  const selectedSwimmers = useMemo(
    () =>
      selectedIds
        .map((id) => eligibleSwimmers.find((swimmer) => swimmer.id === id))
        .filter((swimmer): swimmer is SwimmerWithId => !!swimmer),
    [eligibleSwimmers, selectedIds],
  );

  const sections = useMemo(() => buildSections(eligibleSwimmers), [eligibleSwimmers]);

  const handlePress = (id: string) => {
    if (mode === 'single') {
      setSelectedIds([id]);
      onSelect([id]);
      return;
    }

    const next = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    onSelect(next);
  };

  const renderSectionHeader = ({ section }: { section: SectionListData<SwimmerWithId> }) => (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionAccent, { backgroundColor: section.color }]} />
      <Text style={[styles.sectionTitle, { color: section.color }]}>
        {section.title.toUpperCase()}
      </Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: SwimmerWithId }) => {
    const selected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[styles.row, selected && styles.rowSelected]}
        onPress={() => handlePress(item.id)}
      >
        <View style={styles.nameBlock}>
          <Text style={[styles.name, selected && styles.nameSelected]}>{item.displayName}</Text>
          <Text style={styles.meta}>
            {item.group} | {item.firstName} {getLastInitial(item)}
          </Text>
        </View>
        <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
          {selected && <Check size={16} color={colors.textInverse} strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {mode === 'multi' && selectedSwimmers.length > 0 && (
        <View style={styles.selectedWrap}>
          {selectedSwimmers.map((swimmer) => (
            <TouchableOpacity
              key={swimmer.id}
              style={styles.selectedChip}
              onPress={() => handlePress(swimmer.id)}
            >
              <Text style={styles.selectedChipText}>
                {swimmer.firstName} {getLastInitial(swimmer)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        initialNumToRender={Math.max(eligibleSwimmers.length, 10)}
        extraData={selectedIds}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {requireConsent
              ? 'No swimmers available with active media consent.'
              : 'No swimmers available.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectedChip: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textInverse,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgBase,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: borderRadius.full,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
  },
  sectionCount: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.warningLight,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  nameSelected: {
    color: colors.accent,
  },
  meta: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  checkBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  checkBoxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  emptyText: {
    paddingVertical: spacing.xl,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
