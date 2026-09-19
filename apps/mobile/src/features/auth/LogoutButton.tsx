import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../constants/theme';
import { useAuth } from './auth-context';

export const LOGOUT_CONFIRMATION =
  "Log out? You'll need to sign in again on this device. This signs you out on all your devices.";

export function LogoutButton() {
  const { signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setConfirming(true)}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        testID="logout-button"
        hitSlop={8}
        style={styles.button}
      >
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
          Log out
        </Text>
      </Pressable>

      <ConfirmationDialog
        visible={confirming}
        title="Log out"
        message={LOGOUT_CONFIRMATION}
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  label: { ...typography.button, color: colors.primary },
});
