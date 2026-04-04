import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, fontFamily } from '../config/theme';
import { logger } from '../utils/logger';

interface Props {
  children: React.ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(`Screen crash: ${this.props.screenName || 'unknown'}`, {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AlertTriangle size={36} color={colors.warning} />
          <Text style={styles.title}>This screen crashed</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={this.handleGoBack}>
              <ArrowLeft size={16} color={colors.text} />
              <Text style={styles.secondaryText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={this.handleRetry}>
              <RefreshCw size={16} color={colors.bgBase} />
              <Text style={styles.primaryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    padding: 32,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 24,
    color: colors.text,
    marginTop: 12,
  },
  message: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryText: {
    fontFamily: fontFamily.heading,
    fontSize: 16,
    color: colors.bgBase,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    fontFamily: fontFamily.heading,
    fontSize: 16,
    color: colors.text,
  },
});
