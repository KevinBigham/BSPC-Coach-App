import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { SeasonPhase, SeasonPhaseType } from '../types/firestore.types';
import { colors, fontFamily } from '../config/theme';

const PHASE_COLORS: Record<SeasonPhaseType, string> = {
  base: '#4A90D9',
  build1: '#E8A838',
  build2: '#E87838',
  peak: '#D94A4A',
  taper: '#9B59B6',
  race: colors.accent,
  recovery: '#2ECC71',
};

const PHASE_LABELS: Record<SeasonPhaseType, string> = {
  base: 'BASE',
  build1: 'BUILD I',
  build2: 'BUILD II',
  peak: 'PEAK',
  taper: 'TAPER',
  race: 'RACE',
  recovery: 'RECOVERY',
};

interface Props {
  phases: SeasonPhase[];
  currentDate?: string;
}

function getWeekCount(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

export function SeasonTimeline({ phases, currentDate }: Props) {
  const totalWeeks = phases.reduce((sum, p) => sum + getWeekCount(p.startDate, p.endDate), 0);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.timeline}>
          {phases.map((phase, index) => {
            const weeks = getWeekCount(phase.startDate, phase.endDate);
            const widthPercent = (weeks / totalWeeks) * 100;
            const minWidth = Math.max(80, widthPercent * 4);
            const isCurrent =
              currentDate && currentDate >= phase.startDate && currentDate <= phase.endDate;

            return (
              <View
                key={`${phase.type}-${index}`}
                style={[
                  styles.phaseBlock,
                  {
                    width: minWidth,
                    backgroundColor: PHASE_COLORS[phase.type],
                    borderWidth: isCurrent ? 2 : 0,
                    borderColor: colors.text,
                  },
                ]}
              >
                <Text style={styles.phaseLabel}>{PHASE_LABELS[phase.type]}</Text>
                <Text style={styles.phaseWeeks}>{weeks}w</Text>
                <Text style={styles.phaseYardage}>
                  {(phase.weeklyYardage / 1000).toFixed(0)}k/wk
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {phases.map((phase, index) => (
          <View key={`legend-${index}`} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PHASE_COLORS[phase.type] }]} />
            <Text style={styles.legendText}>{phase.name || PHASE_LABELS[phase.type]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  timeline: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 4,
  },
  phaseBlock: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontFamily: fontFamily.heading,
    fontSize: 14,
    color: '#FFFFFF',
  },
  phaseWeeks: {
    fontFamily: fontFamily.statMono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  phaseYardage: {
    fontFamily: fontFamily.statMono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
