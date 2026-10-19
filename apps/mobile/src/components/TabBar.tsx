import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  elevation,
  fontFamily,
  layout,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { Icon } from './Icon';

export type TabConfig = {
  /** The route's folder name inside the group. */
  name: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
};

export type FieldTabBarProps = BottomTabBarProps & {
  tabs: TabConfig[];
  /** Counts that must not be missed, keyed by route name. */
  badges?: Record<string, number>;
};

/**
 * A floating ink bar rather than a full-width one: it reads as a control
 * rather than a screen edge. Every tab keeps its label; the active one sits on
 * the signal yellow.
 */
export function FieldTabBar({ state, navigation, tabs, badges }: FieldTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.mdPlus) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = tabs.find((candidate) => candidate.name === route.name);
          if (!tab) return null;

          const focused = state.index === index;
          const badge = badges?.[route.name] ?? 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              testID={`tab-${route.name}`}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <View>
                <Icon
                  name={focused ? tab.activeIcon : tab.icon}
                  size={22}
                  color={focused ? colors.onAccent : colors.textOnInverseMuted}
                />
                {badge > 0 ? (
                  <View style={styles.badge}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.badgeText}>
                      {badge > 9 ? '9+' : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.label, focused && styles.labelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom padding a scrolling screen needs so the bar never covers content. */
export function useTabBarSpacing(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, spacing.mdPlus) + layout.tabBarHeight + spacing.smPlus;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.tabBarInset,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.tabBarHeight,
    borderRadius: radius.dialog,
    backgroundColor: colors.surfaceInverse,
    padding: spacing.sm,
    gap: spacing.xs,
    ...elevation.tabBar,
  },
  tab: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: layout.minTouchTarget,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabActive: { backgroundColor: colors.accent },
  label: {
    ...typography.caption,
    fontFamily: typography.secondaryStrong.fontFamily,
    color: colors.textOnInverseMuted,
  },
  labelActive: { color: colors.onAccent, fontFamily: fontFamily.bold },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    minHeight: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.onPrimary,
    includeFontPadding: false,
  },
});
