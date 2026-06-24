import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { colors, spacing, fontSize, fontFamily } from '../src/config/theme';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

// Proposal C (Director Ruling 28/29): AI analysis is disabled in v1. This
// route is retained as a static unavailable state — it runs no AI-draft
// service, exposes no re-enable switch, and offers no processing action.
function AIReviewScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'AI REVIEW UNAVAILABLE' }} />
      <View style={styles.container}>
        <Text style={styles.title}>{'AI Review Unavailable'}</Text>
        <Text style={styles.body}>
          {
            'Audio and video uploads are available for playback, but AI analysis is not available in this version.'
          }
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    padding: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default withScreenErrorBoundary(AIReviewScreen, 'AIReviewScreen');
