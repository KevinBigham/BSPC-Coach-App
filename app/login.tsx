import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { useAuth } from '../src/contexts/AuthContext';

export default function LoginScreen() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError('Enter both email and password');
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch {
      // Error is handled by AuthContext
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo / Branding */}
        <View style={styles.branding}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>BSPC</Text>
          </View>
          <Text style={styles.title}>COACH APP</Text>
          <Text style={styles.subtitle}>BLUE SPRINGS POWER CATS</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          {displayError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="coach@bspowercats.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!loading}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bgDeep} />
            ) : (
              <Text style={styles.buttonText}>SIGN IN</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
          <Text style={styles.forgotLink}>Forgot Password?</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Contact your admin for account access
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  branding: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: {
    fontFamily: fontFamily.heading,
    fontSize: 32,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 40,
    color: colors.text,
    letterSpacing: 3,
  },
  subtitle: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  form: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: fontFamily.body,
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  label: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgDeep,
  },
  button: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: 20,
    letterSpacing: 2,
  },
  forgotLink: {
    fontFamily: fontFamily.bodySemi,
    color: colors.accent,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
