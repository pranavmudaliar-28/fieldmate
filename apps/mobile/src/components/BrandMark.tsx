import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import PIN_CHECK from '../../assets/brand/pin-check.png';
import { colors } from '../constants/theme';

export type BrandMarkProps = {
  /** Width of the yellow tile. */
  size?: number;
  /** A soft signal ring around the tile, for the splash and sign-in. */
  halo?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The FieldMate logo: an ink pin with a check on a signal-yellow tile. The
 * glyph is the same artwork as the app icon (assets/brand/pin-check.png), so
 * the mark in the app and on the home screen never drift apart.
 */
export function BrandMark({ size = 72, halo = false, style }: BrandMarkProps) {
  const tile = (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.28) },
        halo ? null : style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="FieldMate"
    >
      <Image
        source={PIN_CHECK}
        style={{ width: size * 0.5, height: size * 0.5 }}
        contentFit="contain"
      />
    </View>
  );

  if (!halo) return tile;

  const ring = Math.round(size * 0.1);
  return (
    <View
      style={[styles.halo, { padding: ring, borderRadius: Math.round(size * 0.28) + ring }, style]}
    >
      {tile}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { backgroundColor: 'rgba(255, 194, 26, 0.18)' },
});
