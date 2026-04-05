import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!DSN || __DEV__) return;

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}
