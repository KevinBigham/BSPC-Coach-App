import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useTeko, Teko_500Medium, Teko_700Bold } from '@expo-google-fonts/teko';
import { useFonts as useJetBrains, JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts as usePressStart, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ToastProvider, useToast } from '../src/contexts/ToastContext';
import { setGlobalToast } from '../src/utils/errorHandler';
import { useSwimmersStore } from '../src/stores/swimmersStore';
import { useAttendanceStore } from '../src/stores/attendanceStore';
import { registerForPushNotifications } from '../src/services/notifications';
import { getTodayString } from '../src/utils/time';
import { colors, fontFamily } from '../src/config/theme';

SplashScreen.preventAutoHideAsync();

function GlobalToastWire() {
  const { showToast } = useToast();
  useEffect(() => { setGlobalToast(showToast); }, [showToast]);
  return null;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const subscribeSwimmers = useSwimmersStore((s) => s.subscribe);
  const subscribeAttendance = useAttendanceStore((s) => s.subscribeToday);

  // Initialize shared stores when authenticated
  useEffect(() => {
    if (!user) return;
    const unsubSwimmers = subscribeSwimmers();
    const unsubAttendance = subscribeAttendance(getTodayString());
    // Register for push notifications (fire and forget)
    registerForPushNotifications(user.uid).catch(() => {});
    return () => {
      unsubSwimmers();
      unsubAttendance();
    };
  }, [user]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const onLogin = segments[0] === 'login';

    if (!user && !onLogin) {
      router.replace('/login');
    } else if (user && !inAuthGroup) {
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
          name="swimmer/medical"
          options={{
            headerShown: true,
            title: 'MEDICAL INFO',
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [tekoLoaded] = useTeko({ Teko_500Medium, Teko_700Bold });
  const [jbLoaded] = useJetBrains({ JetBrainsMono_400Regular, JetBrainsMono_700Bold });
  const [psLoaded] = usePressStart({ PressStart2P_400Regular });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const fontsLoaded = tekoLoaded && jbLoaded && psLoaded && interLoaded;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <ToastProvider>
        <GlobalToastWire />
        <RootNavigator />
      </ToastProvider>
    </AuthProvider>
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
