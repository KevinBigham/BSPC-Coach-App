import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  createParentInvite,
  subscribeInvitesForSwimmer,
  revokeInvite,
} from '../../src/services/parentInvites';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import type { Swimmer, ParentInvite } from '../../src/types/firestore.types';
import { Timestamp } from 'firebase/firestore';

export default function InviteParentScreen() {
  const { swimmerId, swimmerName: nameParam } = useLocalSearchParams<{
    swimmerId: string;
    swimmerName: string;
  }>();
  const { coach } = useAuth();
  const [invites, setInvites] = useState<(ParentInvite & { id: string })[]>([]);
  const [generating, setGenerating] = useState(false);
  const [swimmerName, setSwimmerName] = useState(nameParam || '');

  // Fetch swimmer name if not passed
  useEffect(() => {
    if (swimmerName || !swimmerId) return;
    return onSnapshot(doc(db, 'swimmers', swimmerId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Swimmer;
        setSwimmerName(`${data.firstName} ${data.lastName}`);
      }
    });
  }, [swimmerId, swimmerName]);

  // Subscribe to invites for this swimmer
  useEffect(() => {
    if (!swimmerId) return;
    return subscribeInvitesForSwimmer(swimmerId, setInvites);
  }, [swimmerId]);

  const handleGenerate = useCallback(async () => {
    if (!swimmerId || !coach) return;
    setGenerating(true);
    try {
      await createParentInvite(
        swimmerId,
        swimmerName,
        coach.uid,
        coach.displayName,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate invite code');
    }
    setGenerating(false);
  }, [swimmerId, swimmerName, coach]);

  const handleShare = useCallback(async (code: string) => {
    try {
      await Share.share({
        message: `You've been invited to view ${swimmerName}'s swim data on the BSPC Parent Portal!\n\nYour invite code: ${code}\n\nSign up at the BSPC Parent Portal and enter this code to link your swimmer.`,
      });
    } catch {
      // user cancelled
    }
  }, [swimmerName]);

  const handleRevoke = useCallback((inviteId: string) => {
    Alert.alert(
      'Revoke Invite',
      'This will prevent this code from being used. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => revokeInvite(inviteId),
        },
      ],
    );
  }, []);

  const activeInvites = invites.filter((i) => {
    if (i.redeemed) return false;
    const expires = i.expiresAt instanceof Timestamp
      ? i.expiresAt.toDate()
      : new Date(i.expiresAt);
    return expires > new Date();
  });

  const pastInvites = invites.filter((i) => {
    if (i.redeemed) return true;
    const expires = i.expiresAt instanceof Timestamp
      ? i.expiresAt.toDate()
      : new Date(i.expiresAt);
    return expires <= new Date();
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'INVITE PARENT',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pixelLabel}>PARENT PORTAL</Text>
          <Text style={styles.heading}>INVITE FOR {swimmerName.toUpperCase()}</Text>
          <Text style={styles.subtext}>
            Generate an invite code so parents can view {swimmerName}'s times, attendance, and progress on the Parent Portal.
          </Text>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.generateBtnText}>GENERATE INVITE CODE</Text>
          )}
        </TouchableOpacity>

        {/* Active Invites */}
        {activeInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE CODES</Text>
            {activeInvites.map((invite) => {
              const expires = invite.expiresAt instanceof Timestamp
                ? invite.expiresAt.toDate()
                : new Date(invite.expiresAt);
              const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));
              return (
                <View key={invite.id} style={styles.inviteCard}>
                  <Text style={styles.codeText}>{invite.code}</Text>
                  <Text style={styles.expiryText}>
                    Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() => handleShare(invite.code)}
                    >
                      <Text style={styles.shareBtnText}>SHARE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.revokeBtn}
                      onPress={() => handleRevoke(invite.id)}
                    >
                      <Text style={styles.revokeBtnText}>REVOKE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Past Invites */}
        {pastInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAST CODES</Text>
            {pastInvites.map((invite) => (
              <View key={invite.id} style={[styles.inviteCard, styles.pastCard]}>
                <Text style={[styles.codeText, styles.pastCode]}>{invite.code}</Text>
                <Text style={styles.pastLabel}>
                  {invite.redeemed ? 'REDEEMED' : 'EXPIRED'}
                </Text>
                {invite.redeemedBy && (
                  <Text style={styles.expiryText}>Redeemed by parent account</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {invites.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No invite codes generated yet. Tap the button above to create one!
            </Text>
          </View>
        )}
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.xl,
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  heading: {
    fontFamily: fontFamily.heading,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  generateBtn: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  inviteCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  pastCard: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  codeText: {
    fontFamily: fontFamily.stat,
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  pastCode: {
    color: colors.textSecondary,
  },
  expiryText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  pastLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shareBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  shareBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  revokeBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  revokeBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
