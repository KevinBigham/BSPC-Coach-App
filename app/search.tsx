import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { subscribeSwimmers } from '../src/services/swimmers';
import {
  searchSwimmers,
  searchNotes,
  searchMeets,
  searchCalendarEvents,
  type NoteSearchResult,
  type MeetSearchResult,
  type CalendarSearchResult,
} from '../src/services/search';
import { getMeetStatusColor, getMeetStatusLabel } from '../src/services/meets';
import type { Meet } from '../src/types/meet.types';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../src/config/theme';
import type { Swimmer } from '../src/types/firestore.types';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

type SwimmerWithId = Swimmer & { id: string };

const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: colors.accent,
  meet: colors.gold,
  team_event: colors.purpleLight,
  deadline: colors.error,
};

function SearchScreen() {
  const { coach } = useAuth();
  const [query, setQuery] = useState('');
  const [swimmers, setSwimmers] = useState<SwimmerWithId[]>([]);
  const [swimmerResults, setSwimmerResults] = useState<SwimmerWithId[]>([]);
  const [noteResults, setNoteResults] = useState<NoteSearchResult[]>([]);
  const [meetResults, setMeetResults] = useState<MeetSearchResult[]>([]);
  const [eventResults, setEventResults] = useState<CalendarSearchResult[]>([]);
  const [searchingAsync, setSearchingAsync] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeSwimmers(true, setSwimmers);
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!text.trim()) {
        setSwimmerResults([]);
        setNoteResults([]);
        setMeetResults([]);
        setEventResults([]);
        return;
      }

      // Swimmer search is instant (client-side)
      setSwimmerResults(searchSwimmers(text, swimmers));

      // Async searches: notes, meets, calendar events
      debounceRef.current = setTimeout(async () => {
        setSearchingAsync(true);
        try {
          const [notes, meets, events] = await Promise.all([
            searchNotes(text, 50),
            searchMeets(text),
            searchCalendarEvents(text),
          ]);
          setNoteResults(notes);
          setMeetResults(meets);
          setEventResults(events);
        } catch {
          setNoteResults([]);
          setMeetResults([]);
          setEventResults([]);
        }
        setSearchingAsync(false);
      }, 300);
    },
    [swimmers],
  );

  const hasResults =
    swimmerResults.length > 0 ||
    noteResults.length > 0 ||
    meetResults.length > 0 ||
    eventResults.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: 'SEARCH' }} />
      <View style={styles.container}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search swimmers, notes, meets, events..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => handleSearch('')}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
          {/* Empty State */}
          {!query.trim() && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>SEARCH</Text>
              <Text style={styles.emptyHint}>Find swimmers, notes, meets, and calendar events</Text>
            </View>
          )}

          {/* No Results */}
          {query.trim() && !hasResults && !searchingAsync && (
            <Text style={styles.noResults}>No results for "{query}"</Text>
          )}

          {/* Swimmer Results */}
          {swimmerResults.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>SWIMMERS ({swimmerResults.length})</Text>
              {swimmerResults.slice(0, 20).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.swimmerRow}
                  onPress={() => router.push(`/swimmer/${s.id}`)}
                >
                  <View style={styles.swimmerAvatar}>
                    <Text style={styles.swimmerAvatarText}>
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </Text>
                  </View>
                  <View style={styles.swimmerInfo}>
                    <Text style={styles.swimmerName}>{s.displayName}</Text>
                    <View style={styles.swimmerMeta}>
                      <View
                        style={[
                          styles.groupDot,
                          { backgroundColor: groupColors[s.group] || colors.purple },
                        ]}
                      />
                      <Text style={styles.swimmerGroup}>{s.group}</Text>
                      {s.usaSwimmingId && (
                        <Text style={styles.swimmerUss}>USA #{s.usaSwimmingId}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Meet Results */}
          {meetResults.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                MEETS ({meetResults.length})
              </Text>
              {meetResults.slice(0, 20).map((meet) => {
                const statusColor = getMeetStatusColor(meet.status as Meet['status']);
                return (
                  <TouchableOpacity
                    key={meet.id}
                    style={styles.meetRow}
                    onPress={() => router.push(`/meet/${meet.id}`)}
                  >
                    <View style={[styles.meetStatusDot, { backgroundColor: statusColor }]} />
                    <View style={styles.meetInfo}>
                      <Text style={styles.meetName}>{meet.name}</Text>
                      <Text style={styles.meetDetail}>
                        {meet.startDate} | {meet.location}
                      </Text>
                    </View>
                    <Text style={[styles.meetStatusLabel, { color: statusColor }]}>
                      {getMeetStatusLabel(meet.status as Meet['status'])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Calendar Event Results */}
          {eventResults.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                EVENTS ({eventResults.length})
              </Text>
              {eventResults.slice(0, 20).map((evt) => {
                const typeColor = EVENT_TYPE_COLORS[evt.type] || colors.textSecondary;
                return (
                  <TouchableOpacity
                    key={evt.id}
                    style={styles.eventRow}
                    onPress={() => router.push('/calendar')}
                  >
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>{evt.title}</Text>
                      <Text style={styles.eventDetail}>
                        {evt.startDate}
                        {evt.location ? ` | ${evt.location}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.eventTypeBadge, { borderColor: typeColor }]}>
                      <Text style={[styles.eventTypeText, { color: typeColor }]}>
                        {evt.type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Note Results */}
          {searchingAsync && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {noteResults.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                NOTES ({noteResults.length})
              </Text>
              {noteResults.slice(0, 20).map((note) => (
                <TouchableOpacity
                  key={`${note.swimmerId}-${note.noteId}`}
                  style={styles.noteRow}
                  onPress={() => router.push(`/swimmer/${note.swimmerId}`)}
                >
                  <Text style={styles.noteContent} numberOfLines={2}>
                    {note.content}
                  </Text>
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteCoach}>{note.coachName}</Text>
                    <Text style={styles.noteDate}>{note.practiceDate}</Text>
                  </View>
                  {note.tags.length > 0 && (
                    <View style={styles.noteTagRow}>
                      {note.tags.slice(0, 4).map((tag) => (
                        <View key={tag} style={styles.noteTag}>
                          <Text style={styles.noteTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  clearBtn: { padding: spacing.sm },
  clearBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // Results
  results: { flex: 1 },
  resultsContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixelLg,
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  emptyHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  noResults: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },

  // Sections
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  // Swimmer Results
  swimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swimmerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  swimmerAvatarText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.md,
    color: colors.bgDeep,
  },
  swimmerInfo: { flex: 1 },
  swimmerName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  swimmerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  swimmerGroup: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  swimmerUss: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // Meet Results
  meetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.md },
  meetInfo: { flex: 1 },
  meetName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  meetDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  meetStatusLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },

  // Calendar Event Results
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventInfo: { flex: 1 },
  eventTitle: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  eventDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  eventTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  eventTypeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },

  // Note Results
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  noteRow: {
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteContent: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  noteCoach: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.accent },
  noteDate: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  noteTagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  noteTag: {
    backgroundColor: 'rgba(74, 14, 120, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  noteTagText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.purpleLight,
  },
});

export default withScreenErrorBoundary(SearchScreen, 'SearchScreen');
