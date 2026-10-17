import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import { LoggerFactory } from '../services/logger/LoggerFactory';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary that catches render errors in its subtree.
 * Logs the error and shows a recovery UI instead of crashing the app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private logger = LoggerFactory.getInstance().createLogger('ErrorBoundary');

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.logger.error({ message: `Uncaught render error: ${error.message}`, componentStack: errorInfo.componentStack }, error);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <MaterialIcons name="error-outline" size={56} color={lightColors.error} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>An unexpected error occurred. You can try again or restart the app.</Text>

          {this.state.error && (
            <ScrollView style={styles.detailsBox} contentContainerStyle={styles.detailsContent}>
              <Text style={styles.detailsText}>{this.state.error.message}</Text>
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityLabel="Try again"
            accessibilityRole="button"
            accessibilityHint="Attempts to recover from the error"
          >
            <MaterialIcons name="refresh" size={18} color={lightColors.textOnPrimary} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
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
    padding: spacing.xl,
    backgroundColor: lightColors.background,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.md,
  },
  message: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailsBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: lightColors.error + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  detailsContent: {
    padding: spacing.md,
  },
  detailsText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.error,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  retryButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '700',
    fontSize: typography.fontSize.md,
  },
});

export default ErrorBoundary;
