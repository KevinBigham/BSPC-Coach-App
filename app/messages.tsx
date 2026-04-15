import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { formatRelativeTime } from '../src/utils/date';
import type { Message } from '../src/types/firestore.types';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

function MessagesScreen() {
  const { coach } = useAuth();
  const [messages, setMessages] = useState<(Message & { id: string })[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const q = query(collection(db, 'coach_chat'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as (Message & { id: string })[];
      setMessages(msgs.reverse());
    });
  }, []);

  // Mark messages as read
  useEffect(() => {
    if (!coach?.uid || messages.length === 0) return;
    messages.forEach(async (msg) => {
      if (msg.senderId !== coach.uid && !msg.readBy?.[coach.uid]) {
        try {
          await updateDoc(doc(db, 'coach_chat', msg.id), {
            [`readBy.${coach.uid}`]: serverTimestamp(),
          });
        } catch {
          // Silently fail — non-critical
        }
      }
    });
  }, [messages, coach?.uid]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'coach_chat'), {
        content: text.trim(),
        senderId: coach?.uid || '',
        senderName: coach?.displayName || 'Coach',
        recipientIds: [],
        readBy: {},
        createdAt: serverTimestamp(),
      });
      setText('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (err: any) {
      console.error('Send failed:', err);
    }
    setSending(false);
  };

  const handleDelete = (msg: Message & { id: string }) => {
    Alert.alert('Delete Message', 'Delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'coach_chat', msg.id));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: Message & { id: string } }) => {
    const isMe = item.senderId === coach?.uid;
    const ts =
      item.createdAt instanceof Date ? item.createdAt : (item.createdAt as any)?.toDate?.() || null;
    const readCount = Object.keys(item.readBy || {}).length;

    return (
      <TouchableOpacity
        activeOpacity={isMe ? 0.7 : 1}
        onLongPress={isMe ? () => handleDelete(item) : undefined}
        style={[styles.messageBubble, isMe ? styles.messageMine : styles.messageTheirs]}
      >
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
        <Text style={[styles.messageText, isMe && styles.messageTextMine]}>{item.content}</Text>
        <View style={styles.messageFooter}>
          {ts && <Text style={styles.messageTime}>{formatRelativeTime(ts)}</Text>}
          {isMe && readCount > 0 && <Text style={styles.readReceipt}>Read by {readCount}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.pixelLabel}>--- COACH CHAT ---</Text>
            <Text style={styles.emptyText}>
              Send a message to start the conversation. All coaches can see messages here.
            </Text>
          </View>
        }
      />

      {messages.length > 0 && (
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>Long press your message to delete</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message coaches..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendButtonText}>SEND</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  messageList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  messageMine: {
    backgroundColor: colors.purple,
    alignSelf: 'flex-end',
    borderBottomRightRadius: borderRadius.xs,
  },
  messageTheirs: {
    backgroundColor: colors.bgDeep,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  messageText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },
  messageTextMine: { color: colors.text },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  messageTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  readReceipt: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  hintBar: { padding: spacing.xs, alignItems: 'center', backgroundColor: colors.bgElevated },
  hintText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});

export default withScreenErrorBoundary(MessagesScreen, 'MessagesScreen');
