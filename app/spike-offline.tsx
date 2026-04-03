import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../src/config/firebase';
import { colors, spacing, fontSize, borderRadius } from '../src/config/theme';
import { GROUPS } from '../src/config/constants';
import type { Group } from '../src/config/constants';

interface TestSwimmer {
  id: string;
  firstName: string;
  lastName: string;
  group: Group;
  createdAt: Timestamp | null;
  synced: boolean;
}

interface TestNote {
  id: string;
  swimmerId: string;
  swimmerName: string;
  content: string;
  createdAt: Timestamp | null;
}

const TEST_SWIMMERS: Omit<TestSwimmer, 'id' | 'createdAt' | 'synced'>[] = [
  { firstName: 'Alex', lastName: 'Johnson', group: 'Gold' },
  { firstName: 'Maya', lastName: 'Chen', group: 'Platinum' },
  { firstName: 'Jake', lastName: 'Wilson', group: 'Silver' },
  { firstName: 'Emma', lastName: 'Davis', group: 'Diamond' },
  { firstName: 'Noah', lastName: 'Martinez', group: 'Bronze' },
  { firstName: 'Sophia', lastName: 'Brown', group: 'Advanced' },
  { firstName: 'Liam', lastName: 'Taylor', group: 'Gold' },
  { firstName: 'Olivia', lastName: 'Anderson', group: 'Platinum' },
  { firstName: 'Ethan', lastName: 'Thomas', group: 'Silver' },
  { firstName: 'Ava', lastName: 'Garcia', group: 'Diamond' },
];

export default function SpikeOffline() {
  const [swimmers, setSwimmers] = useState<TestSwimmer[]>([]);
  const [notes, setNotes] = useState<TestNote[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedSwimmer, setSelectedSwimmer] = useState<TestSwimmer | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`[${time}] ${message}`, ...prev].slice(0, 50));
  }, []);

  // Monitor network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      addLog(`Network: ${online ? 'ONLINE' : 'OFFLINE'}`);
    });
    return unsubscribe;
  }, [addLog]);

  // Listen to swimmers collection
  useEffect(() => {
    const q = query(collection(db, 'spike_swimmers'), orderBy('lastName'));
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const docs: TestSwimmer[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          docs.push({
            id: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            group: data.group,
            createdAt: data.createdAt,
            synced: !doc.metadata.hasPendingWrites,
          });
        });
        setSwimmers(docs);
        const pending = snapshot.metadata.hasPendingWrites;
        if (pending) {
          addLog(`Swimmers updated (local — pending sync)`);
        } else {
          addLog(`Swimmers updated (${docs.length} docs, synced)`);
        }
      },
      (error) => {
        addLog(`Swimmer listener error: ${error.message}`);
      }
    );
    return unsubscribe;
  }, [addLog]);

  // Listen to notes collection
  useEffect(() => {
    const q = query(collection(db, 'spike_notes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const docs: TestNote[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          docs.push({
            id: doc.id,
            swimmerId: data.swimmerId,
            swimmerName: data.swimmerName,
            content: data.content,
            createdAt: data.createdAt,
          });
        });
        setNotes(docs);
        const pending = snapshot.metadata.hasPendingWrites;
        if (pending) {
          addLog(`Notes updated (local — pending sync)`);
        } else {
          addLog(`Notes updated (${docs.length} docs, synced)`);
        }
      },
      (error) => {
        addLog(`Notes listener error: ${error.message}`);
      }
    );
    return unsubscribe;
  }, [addLog]);

  const seedSwimmers = async () => {
    setLoading(true);
    addLog('Seeding 10 test swimmers...');
    try {
      for (const swimmer of TEST_SWIMMERS) {
        await addDoc(collection(db, 'spike_swimmers'), {
          ...swimmer,
          active: true,
          createdAt: serverTimestamp(),
        });
      }
      addLog('Seeded 10 swimmers successfully');
    } catch (error: any) {
      addLog(`Seed error: ${error.message}`);
    }
    setLoading(false);
  };

  const addNote = async () => {
    if (!selectedSwimmer || !noteText.trim()) {
      Alert.alert('Missing info', 'Select a swimmer and enter note text');
      return;
    }
    try {
      await addDoc(collection(db, 'spike_notes'), {
        swimmerId: selectedSwimmer.id,
        swimmerName: `${selectedSwimmer.firstName} ${selectedSwimmer.lastName}`,
        content: noteText.trim(),
        coachName: 'Spike Tester',
        createdAt: serverTimestamp(),
      });
      addLog(`Note added for ${selectedSwimmer.firstName} (${isOnline ? 'online' : 'OFFLINE'})`);
      setNoteText('');
    } catch (error: any) {
      addLog(`Note error: ${error.message}`);
    }
  };

  const renderSwimmer = ({ item }: { item: TestSwimmer }) => (
    <TouchableOpacity
      style={[
        styles.swimmerRow,
        selectedSwimmer?.id === item.id && styles.swimmerRowSelected,
      ]}
      onPress={() => setSelectedSwimmer(item)}
    >
      <View style={styles.swimmerInfo}>
        <Text style={styles.swimmerName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={[styles.groupBadge, { color: groupColor(item.group) }]}>
          {item.group}
        </Text>
      </View>
      <View style={[styles.syncDot, { backgroundColor: item.synced ? colors.success : colors.warning }]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Network Banner */}
      <View style={[styles.banner, { backgroundColor: isOnline ? colors.success : colors.error }]}>
        <Text style={styles.bannerText}>
          {isOnline ? '● Online' : '✈ Offline — changes will sync when reconnected'}
        </Text>
      </View>

      {/* Swimmers Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Swimmers ({swimmers.length})</Text>
          {swimmers.length === 0 && (
            <TouchableOpacity style={styles.seedButton} onPress={seedSwimmers} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.seedButtonText}>Seed Test Data</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={swimmers}
          keyExtractor={(item) => item.id}
          renderItem={renderSwimmer}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No swimmers — tap "Seed Test Data"</Text>
          }
        />
      </View>

      {/* Add Note Section */}
      <View style={styles.noteSection}>
        <Text style={styles.sectionTitle}>
          Add Note {selectedSwimmer ? `for ${selectedSwimmer.firstName}` : '(select swimmer above)'}
        </Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Type observation..."
          placeholderTextColor={colors.textSecondary}
          value={noteText}
          onChangeText={setNoteText}
          multiline
        />
        <TouchableOpacity
          style={[styles.addButton, (!selectedSwimmer || !noteText.trim()) && styles.addButtonDisabled]}
          onPress={addNote}
          disabled={!selectedSwimmer || !noteText.trim()}
        >
          <Text style={styles.addButtonText}>
            Add Note {!isOnline ? '(Offline)' : ''}
          </Text>
        </TouchableOpacity>
        {notes.length > 0 && (
          <View style={styles.notesPreview}>
            <Text style={styles.notesPreviewTitle}>Recent Notes ({notes.length})</Text>
            {notes.slice(0, 3).map((note) => (
              <Text key={note.id} style={styles.notePreviewText} numberOfLines={1}>
                {note.swimmerName}: {note.content}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Event Log */}
      <View style={styles.logSection}>
        <Text style={styles.sectionTitle}>Event Log</Text>
        <FlatList
          data={log}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
          style={styles.logList}
        />
      </View>
    </View>
  );
}

function groupColor(group: Group): string {
  const map: Record<Group, string> = {
    Bronze: colors.groupBronze,
    Silver: colors.groupSilver,
    Gold: colors.groupGold,
    Advanced: colors.groupAdvanced,
    Platinum: colors.groupPlatinum,
    Diamond: colors.groupDiamond,
  };
  return map[group] || colors.text;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bannerText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  section: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  seedButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  seedButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  swimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  swimmerRowSelected: {
    backgroundColor: colors.lightPurple,
  },
  swimmerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swimmerName: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  groupBadge: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  noteSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 50,
  },
  addButton: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  notesPreview: {
    marginTop: spacing.sm,
  },
  notesPreviewTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notePreviewText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  logSection: {
    height: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  logList: {
    flex: 1,
    marginTop: spacing.xs,
  },
  logText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
