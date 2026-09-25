import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, space, type } from './theme';

export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Icon name="alert" size={40} color={colors.pending} />
      <Text style={[type.screenTitle, { textAlign: 'center' }]}>משהו השתבש</Text>
      <Button title="נסה שוב" icon="refresh" onPress={onRetry} big style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

/** Global error boundary: never a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(JSON.stringify({ event: 'ui.crash', message: error.message, stack: info.componentStack }));
  }

  override render() {
    if (this.state.failed) return <ErrorScreen onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    padding: space.xxl,
  },
});
