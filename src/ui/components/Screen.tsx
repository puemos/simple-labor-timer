import { PropsWithChildren, ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LargeTitle, Title3 } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type ScreenProps = PropsWithChildren<{
  largeTitle?: string;
  headerTitle?: string;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  scrollable?: boolean;
  background?: 'system' | 'grouped';
  contentStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}>;

const TITLE_FADE_THRESHOLD = 30;

export function Screen({
  children,
  largeTitle,
  headerTitle,
  headerLeft,
  headerRight,
  scrollable,
  background = 'system',
  contentStyle,
  contentContainerStyle,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const fixedTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, TITLE_FADE_THRESHOLD, TITLE_FADE_THRESHOLD + 12], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, TITLE_FADE_THRESHOLD], [4, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const bg = background === 'grouped' ? colors.systemGroupedBackground : colors.systemBackground;
  const resolvedTitle = headerTitle ?? largeTitle;
  const showHeaderBar = Boolean(resolvedTitle || headerLeft || headerRight);

  const Header = (
    <View
      collapsable={false}
      style={[
        styles.headerBar,
        {
          backgroundColor: bg,
          paddingHorizontal: spacing.base,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      <View style={styles.headerSide}>{headerLeft}</View>
      <View style={styles.headerCenter} pointerEvents="none">
        {resolvedTitle ? (
          <Animated.View style={fixedTitleStyle}>
            <Title3>{resolvedTitle}</Title3>
          </Animated.View>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
    </View>
  );

  const inlineLargeTitle = largeTitle ? (
    <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      <LargeTitle>{largeTitle}</LargeTitle>
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
      {showHeaderBar ? Header : null}
      {scrollable ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[{ paddingBottom: spacing.xxl }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          style={[{ flex: 1 }, contentStyle]}
        >
          {inlineLargeTitle}
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>
          {inlineLargeTitle}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    justifyContent: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
