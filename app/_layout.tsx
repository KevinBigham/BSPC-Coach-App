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
import { colors, fontFamily } from '../src/config/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

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
        <Stack.Screen name="spike-offline" options={{ headerShown: true, title: 'Offline Sync Test', headerStyle: { backgroundColor: colors.bgElevated }, headerTintColor: colors.accent }} />
        <Stack.Screen name="spike-audio" options={{ headerShown: true, title: 'Audio Recording Test', headerStyle: { backgroundColor: colors.bgElevated }, headerTintColor: colors.accent }} />
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
      <RootNavigator />
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
