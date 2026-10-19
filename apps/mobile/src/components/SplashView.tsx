import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, spacing, typography } from '../constants/theme';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { BrandMark } from './BrandMark';

const TILE = 104;
/** Rings spread out from the tile like a location ping. */
const RINGS = [220, 340, 460, 580, 700, 820];

/**
 * The launch screen, drawn by the app once the native splash (the same tile on
 * ink) hands over. Shown while the stored session is checked.
 */
export function SplashView({ testID = 'session-loading' }: { testID?: string }) {
  return (
    <View
      style={styles.screen}
      testID={testID}
      accessible
      accessibilityLabel="FieldMate is loading"
      accessibilityState={{ busy: true }}
    >
      <StatusBar style="light" />

      <View style={styles.center}>
        <View style={styles.markArea}>
          {RINGS.map((diameter) => (
            <View
              key={diameter}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  width: diameter,
                  height: diameter,
                  marginLeft: -diameter / 2,
                  marginTop: -diameter / 2,
                },
              ]}
            />
          ))}
          <BrandMark size={TILE} halo />
        </View>

        <Text maxFontSizeMultiplier={1.2} style={styles.wordmark}>
          FieldMate
        </Text>
        <Text maxFontSizeMultiplier={1.4} style={styles.tagline}>
          Every job, one next step.
        </Text>
      </View>

      <LoadingDots />
    </View>
  );
}

/** Three signal dots that breathe in turn. Hold still under Reduce Motion. */
function LoadingDots() {
  const reduceMotion = useReduceMotion();
  // Android draws edge to edge: keep the dots clear of the gesture/nav bar.
  const { bottom } = useSafeAreaInsets();
  const values = useRef([0, 1, 2].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (reduceMotion) {
      values.forEach((value) => value.setValue(1));
      return;
    }
    const step = motion.shimmer / 4;
    const loop = Animated.loop(
      Animated.stagger(
        step,
        values.map((value) =>
          Animated.sequence([
            Animated.timing(value, { toValue: 0.3, duration: step, useNativeDriver: true }),
            Animated.timing(value, { toValue: 1, duration: step, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, values]);

  return (
    <View
      style={[styles.dots, { marginBottom: bottom }]}
      importantForAccessibility="no-hide-descendants"
    >
      {values.map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceInverse,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** The tile sits at the centre of the rings; the rings never take up layout. */
  markArea: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 194, 26, 0.14)',
  },
  wordmark: {
    ...typography.hero,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.4,
    color: colors.background,
  },
  tagline: {
    ...typography.body,
    fontSize: 17,
    color: colors.textOnInverseMuted,
    marginTop: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.smPlus,
    paddingBottom: spacing['3xl'] + spacing.xl,
  },
  dot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.accent },
});
