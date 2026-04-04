import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../src/config/theme';
import { GROUPS, type Group } from '../src/config/constants';
import type { Coach } from '../src/types/firestore.types';

export default function AdminScreen() {
  const { isAdmin, coach: currentCoach } = useAuth();
  const [coaches, setCoaches] = useState<(Coach & { uid: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUid, setEditingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Admin access required.');
      router.back();
      return;
    }
    return onSnapshot(collection(db, 'coaches'), (snapshot) => {
      setCoaches(
        snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as Coach & { uid: string }))
      );
      setLoading(false);
    });
  }, [isAdmin]);

  const toggleRole = (coach: Coach & { uid: string }) => {
    if (coach.uid === currentCoach?.uid) {
      Alert.alert('Cannot Change', "You can't change your own role.");
      return;
    }
    const newRole = coach.role === 'admin' ? 'coach' : 'admin';
    Alert.alert(
      'Change Role',
      `Make ${coach.displayName} a${newRole === 'admin' ? 'n admin' : ' coach'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await updateDoc(doc(db, 'coaches', coach.uid), {
              role: newRole,
              updatedAt: serverTimestamp(),
            });
          },
        },
      ]
    );
  };

  const toggleGroup = async (coachUid: string, currentGroups: Group[], group: Group) => {
    const newGroups = currentGroups.includes(group)
      ? currentGroups.filter((g) => g !== group)
      : [...currentGroups, group];
    await updateDoc(doc(db, 'coaches', coachUid), {
      groups: newGroups,
      updatedAt: serverTimestamp(),
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scorebug */}
      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{coaches.length}</Text>
          <Text style={styles.statLabel}>COACHES</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{coaches.filter((c) => c.role === 'admin').length}</Text>
          <Text style={styles.statLabel}>ADMINS</Text>
        </View>
      </View>

      {/* Coach List */}
      {coaches.map((c) => {
        const isEditing = editingUid === c.uid;
        const isMe = c.uid === currentCoach?.uid;

        return (
          <View key={c.uid} style={styles.coachCard}>
            <TouchableOpacity
              style={styles.coachHeader}
              onPress={() => setEditingUid(isEditing ? null : c.uid)}
            >
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>
                  {c.displayName?.[0]?.toUpperCase() || 'C'}
                </Text>
              </View>
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>
                  {c.displayName?.toUpperCase()}{isMe ? ' (YOU)' : ''}
                </Text>
                <Text style={styles.coachEmail}>{c.email}</Text>
              </View>
              <TouchableOpacity
                style={[styles.roleBadge, c.role === 'admin' && styles.roleBadgeAdmin]}
                onPress={() => toggleRole(c)}
              >
                <Text style={[styles.roleText, c.role === 'admin' && styles.roleTextAdmin]}>
                  {c.role === 'admin' ? 'ADMIN' : 'COACH'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Assigned Groups */}
            {isEditing && (
              <View style={styles.groupSection}>
                <Text style={styles.groupSectionTitle}>ASSIGNED GROUPS</Text>
                <View style={styles.groupGrid}>
                  {GROUPS.map((g) => {
                    const isAssigned = (c.groups || []).includes(g);
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.groupChip,
                          {
                            backgroundColor: isAssigned ? (groupColors[g] || colors.purple) : colors.bgBase,
                            borderColor: groupColors[g] || colors.border,
                          },
                        ]}
                        onPress={() => toggleGroup(c.uid, c.groups || [], g)}
                      >
                        <Text style={[styles.groupChipText, { color: isAssigned ? colors.bgDeep : colors.text }]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Current Groups Display */}
            {!isEditing && (c.groups || []).length > 0 && (
              <View style={styles.groupTags}>
                {c.groups.map((g) => (
                  <View key={g} style={[styles.groupTag, { borderColor: groupColors[g] || colors.border }]}>
                    <Text style={[styles.groupTagText, { color: groupColors[g] || colors.accent }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  // Stats
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: { flex: 1, backgroundColor: colors.bgDeep, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.accent },
  statLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1, marginTop: spacing.xs },
  // Coach Card
  coachCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  coachHeader: { flexDirection: 'row', alignItems: 'center' },
  coachAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  coachAvatarText: { fontFamily: fontFamily.heading, color: colors.gold, fontSize: fontSize.lg },
  coachInfo: { flex: 1 },
  coachName: { fontFamily: fontFamily.heading, fontSize: fontSize.lg, color: colors.text, letterSpacing: 1 },
  coachEmail: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  roleBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.xs, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgBase },
  roleBadgeAdmin: { borderColor: colors.gold, backgroundColor: 'rgba(255, 215, 0, 0.1)' },
  roleText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary },
  roleTextAdmin: { color: colors.gold },
  // Groups
  groupSection: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  groupSectionTitle: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1, marginBottom: spacing.sm },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 2 },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm },
  groupTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  groupTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  groupTagText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
});
