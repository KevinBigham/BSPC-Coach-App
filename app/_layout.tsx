import { useEffect } from 'react';
import { initSentry } from '../src/config/sentry';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import * as Linking from 'expo-linking';

initSentry();
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useTeko, Teko_500Medium, Teko_700Bold } from '@expo-google-fonts/teko';
import {
  useFonts as useJetBrains,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  useFonts as usePressStart,
  PressStart2P_400Regular,
} from '@expo-google-fonts/press-start-2p';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ToastProvider, useToast } from '../src/contexts/ToastContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { setGlobalToast } from '../src/utils/errorHandler';
import { useSwimmersStore } from '../src/stores/swimmersStore';
import { useAttendanceStore } from '../src/stores/attendanceStore';
import {
  registerForPushNotifications,
  subscribeToGroupTopics,
} from '../src/services/notifications';
import { getTodayString } from '../src/utils/time';
import NetInfo from '@react-native-community/netinfo';
import { colors, fontFamily } from '../src/config/theme';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { processQueue } from '../src/utils/offlineQueue';
import { uploadAudio, updateAudioSession } from '../src/services/audio';
import { uploadVideo, updateVideoSession } from '../src/services/video';
import { parseDeepLink } from '../src/utils/deepLinking';
import { logger } from '../src/utils/logger';

SplashScreen.preventAutoHideAsync();

function GlobalToastWire() {
  const { showToast } = useToast();
  useEffect(() => {
    setGlobalToast(showToast);
  }, [showToast]);
  return null;
}

function RootNavigator() {
  const { user, coach, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const subscribeSwimmers = useSwimmersStore((s) => s.subscribe);
  const subscribeAttendance = useAttendanceStore((s) => s.subscribeToday);

  // Initialize shared stores when authenticated
  useEffect(() => {
    if (!user) return;
    const unsubSwimmers = subscribeSwimmers();
    const unsubAttendance = subscribeAttendance(getTodayString());
    // Register for push notifications and subscribe to group topics
    registerForPushNotifications(user.uid)
      .then((token) => {
        if (token && coach?.groups?.length) {
          subscribeToGroupTopics(token, coach.groups).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      unsubSwimmers();
      unsubAttendance();
    };
  }, [user]);

  // Process offline upload queue when connectivity is restored
  useEffect(() => {
    if (!user) return;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processQueue(
          async (item) => {
            const { storagePath } = await uploadAudio(
              item.uri,
              user.uid,
              item.metadata.date as string,
            );
            if (item.metadata.sessionId) {
              await updateAudioSession(item.metadata.sessionId as string, {
                storagePath,
                status: 'uploaded',
              });
            }
          },
          async (item) => {
            const { storagePath } = await uploadVideo(
              item.uri,
              user.uid,
              item.metadata.date as string,
            );
            if (item.metadata.sessionId) {
              await updateVideoSession(item.metadata.sessionId as string, {
                storagePath,
                status: 'uploaded',
              });
            }
          },
        ).catch(() => {});
      }
    });
  }, [user]);

  // Handle incoming deep links
  useEffect(() => {
    if (!user) return;

    function handleUrl(event: { url: string }) {
      const result = parseDeepLink(event.url);
      if (result) {
        logger.info('Deep link navigating to', { path: result.path });
        router.push(result.path as Href);
      }
    }

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [user]);

  useEffect(() => {
    if (loading) return;

    const onAuthScreen = segments[0] === 'login' || segments[0] === 'forgot-password';

    if (!user && !onAuthScreen) {
      router.replace('/login');
    } else if (user && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.bgDeep} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="swimmer/new"
          options={{
            headerShown: true,
            title: 'ADD SWIMMER',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="swimmer/[id]"
          options={{
            headerShown: true,
            title: 'SWIMMER',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="messages"
          options={{
            headerShown: true,
            title: 'COACH CHAT',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: 'INBOX',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="notification-rules"
          options={{
            headerShown: true,
            title: 'RULES',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="notification-rules/new"
          options={{
            headerShown: true,
            title: 'NEW RULE',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="swimmer/edit"
          options={{
            headerShown: true,
            title: 'EDIT SWIMMER',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            headerShown: true,
            title: 'RESET PASSWORD',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: true,
            title: 'ADMIN',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="import"
          options={{
            headerShown: true,
            title: 'IMPORT ROSTER',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="import/history"
          options={{
            headerShown: true,
            title: 'IMPORT HISTORY',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="audio"
          options={{
            headerShown: true,
            title: 'AUDIO NOTES',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            headerShown: true,
            title: 'SEARCH',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="ai-review"
          options={{
            headerShown: true,
            title: 'AI DRAFTS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="meet-import"
          options={{
            headerShown: true,
            title: 'IMPORT MEET RESULTS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="practice/builder"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="practice/templates"
          options={{
            headerShown: true,
            title: 'TEMPLATES',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="swimmer/standards"
          options={{
            headerShown: true,
            title: 'TIME STANDARDS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="calendar"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="calendar/[date]"
          options={{
            headerShown: true,
            title: 'DAY DETAIL',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="calendar/event/[id]"
          options={{
            headerShown: true,
            title: 'EVENT',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="calendar/event/new"
          options={{
            headerShown: true,
            title: 'NEW EVENT',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="meet/[id]"
          options={{
            headerShown: true,
            title: 'MEET',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="meet/new"
          options={{
            headerShown: true,
            title: 'NEW MEET',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="meet/entries"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="meet/relay-builder"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="swimmer/invite-parent"
          options={{
            headerShown: true,
            title: 'INVITE PARENT',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="meet/[id]/live"
          options={{
            headerShown: true,
            title: 'LIVE MODE',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="meet/[id]/timer"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="meet/[id]/results"
          options={{
            headerShown: true,
            title: 'RESULTS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="video"
          options={{
            headerShown: true,
            title: 'VIDEO ANALYSIS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="video/[id]"
          options={{
            headerShown: true,
            title: 'VIDEO DETAIL',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="video/compare"
          options={{
            headerShown: true,
            title: 'COMPARE VIDEO',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics"
          options={{
            headerShown: true,
            title: 'ANALYTICS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics/time-drops"
          options={{
            headerShown: true,
            title: 'TIME DROPS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics/attendance-correlation"
          options={{
            headerShown: true,
            title: 'ATTENDANCE TRENDS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics/group-report"
          options={{
            headerShown: true,
            title: 'GROUP PROGRESS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics/splits"
          options={{
            headerShown: true,
            title: 'SPLIT COMPARISON',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="analytics/progression"
          options={{
            headerShown: true,
            title: 'PR PROGRESSION',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="practice/library"
          options={{
            headerShown: true,
            title: 'WORKOUT LIBRARY',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="practice/ai-generate"
          options={{
            headerShown: true,
            title: 'AI GENERATE',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="season/index"
          options={{
            headerShown: true,
            title: 'SEASON PLANS',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="season/plan"
          options={{
            headerShown: true,
            title: 'SEASON PLAN',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
        <Stack.Screen
          name="season/week"
          options={{
            headerShown: true,
            title: 'WEEK DETAIL',
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.accent,
            headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [tekoLoaded] = useTeko({ Teko_500Medium, Teko_700Bold });
  const [jbLoaded] = useJetBrains({ JetBrainsMono_400Regular, JetBrainsMono_700Bold });
  const [psLoaded] = usePressStart({ PressStart2P_400Regular });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsLoaded = tekoLoaded && jbLoaded && psLoaded && interLoaded;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <GlobalToastWire />
          <OfflineIndicator />
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
});
