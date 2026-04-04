import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — tab switches, toggles, selections */
export function tapLight(): void {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Medium tap — check-in, split button press */
export function tapMedium(): void {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/** Heavy tap — PR celebration, important confirmation */
export function tapHeavy(): void {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

/** Success notification — save complete, check-in confirmed */
export function notifySuccess(): void {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

/** Warning notification — approaching limit, unsaved changes */
export function notifyWarning(): void {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/** Error notification — failed action, validation error */
export function notifyError(): void {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

/** Selection changed — picker, group selector */
export function selectionChanged(): void {
  if (isHapticsSupported) {
    Haptics.selectionAsync();
  }
}
