import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { createMobileShellContract, type MobileApplicationRole } from './contracts.js';

const DEFAULT_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export interface MobileApplicationShellProps {
  readonly role: MobileApplicationRole;
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly overlay?: ReactNode;
  readonly scrollable?: boolean;
  readonly keyboardAware?: boolean;
  readonly keyboardVerticalOffset?: number;
  readonly safeAreaEdges?: readonly Edge[];
  readonly testID?: string;
  readonly accessibilityLabel?: string;
  readonly safeAreaStyle?: StyleProp<ViewStyle>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly scrollContentStyle?: StyleProp<ViewStyle>;
}

export function MobileApplicationShell({
  role,
  children,
  header,
  footer,
  overlay,
  scrollable = false,
  keyboardAware = true,
  keyboardVerticalOffset = 0,
  safeAreaEdges = DEFAULT_SAFE_AREA_EDGES,
  testID,
  accessibilityLabel,
  safeAreaStyle,
  contentStyle,
  scrollContentStyle,
}: MobileApplicationShellProps): React.JSX.Element {
  const contract = createMobileShellContract({
    role,
    keyboardAware,
    scrollable,
    hasHeader: header !== undefined,
    hasFooter: footer !== undefined,
    hasOverlay: overlay !== undefined,
  });

  const body = contract.scrollable ? (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps={contract.keyboardShouldPersistTaps}
      style={styles.body}
    >
      {children}
    </ScrollView>
  ) : (
    <View accessibilityLabel={accessibilityLabel} style={[styles.body, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      accessibilityLabel={`${role} application shell`}
      edges={[...safeAreaEdges]}
      style={[styles.safeArea, safeAreaStyle]}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={
          contract.keyboardAware ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined
        }
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.keyboardRegion}
      >
        {header === undefined ? null : (
          <View accessibilityRole="header" style={styles.header}>
            {header}
          </View>
        )}
        {body}
        {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
      {overlay === undefined ? null : (
        <View pointerEvents="box-none" style={styles.overlay}>
          {overlay}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardRegion: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  footer: {
    flexShrink: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
