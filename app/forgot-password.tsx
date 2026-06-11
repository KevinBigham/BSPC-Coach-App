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
import { supabase } from '../src/config/supabase';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    // The D-K1 decline expires HERE by design (05 §6.2(iii)): the swap is the
    // moment this stops being a mixed-auth surface. Supabase never reveals
    // whether the email has an account (anti-enumeration), so an unknown
    // address reads as sent — the old user-not-found branch has no successor.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (resetError) {
      const code = 'code' in resetError ? ((resetError as { code?: string }).code ?? '') : '';
      if (code === 'validation_failed' || code === 'invalid_email') {
        setError('Invalid email address');
      } else {
        setError('Failed to send reset email. Try again.');
      }
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.successCard}>
            <Text style={styles.successPixel}>CHECK YOUR EMAIL</Text>
            <Text style={styles.successTitle}>RESET LINK SENT</Text>
            <Text style={styles.successText}>
              We sent a password reset link to{'\n'}
              <Text style={styles.emailHighlight}>{email.trim()}</Text>
            </Text>
            <Text style={styles.successHint}>
              Check your inbox and spam folder. The link expires in 1 hour.
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>BACK TO SIGN IN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.branding}>
          <Text style={styles.title}>RESET PASSWORD</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
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
            onSubmitEditing={handleReset}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bgDeep} />
            ) : (
              <Text style={styles.buttonText}>SEND RESET LINK</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  branding: { alignItems: 'center', marginBottom: spacing.xxl },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: 20,
    letterSpacing: 2,
  },
  backLink: {
    fontFamily: fontFamily.bodySemi,
    color: colors.accent,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Success state
  successCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  successPixel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  successText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: { fontFamily: fontFamily.bodySemi, color: colors.accent },
  successHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl,
  },
  backButtonText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: fontSize.lg,
    letterSpacing: 2,
  },
});
