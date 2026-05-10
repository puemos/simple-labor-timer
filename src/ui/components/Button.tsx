import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import { hapticSelection } from '@/native/haptics';
import { useTheme } from '@/ui/theme';
import { ICON_STROKE_WIDTH } from '@/ui/icons';
import { Text } from '@/ui/components/Text';

export type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'md',
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  loading,
  disabled,
  fullWidth,
  style,
  haptic = true,
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = Boolean(disabled || loading);

  const heightBySize: Record<ButtonSize, number> = { sm: 32, md: 44, lg: 50 };
  const fontVariantBySize: Record<ButtonSize, 'subhead' | 'body' | 'headline'> = {
    sm: 'subhead',
    md: 'body',
    lg: 'headline',
  };
  const horizontalPad: Record<ButtonSize, number> = {
    sm: spacing.md,
    md: spacing.base,
    lg: spacing.lg,
  };

  const background =
    variant === 'filled'
      ? colors.accent
      : variant === 'destructive'
        ? colors.urgent
        : variant === 'tinted'
          ? colors.systemFill
          : variant === 'gray'
            ? colors.tertiarySystemFill
            : 'transparent';

  const labelColor =
    variant === 'filled'
      ? colors.onAccent
      : variant === 'destructive'
        ? colors.onUrgent
        : variant === 'tinted'
          ? colors.accent
          : variant === 'gray'
            ? colors.label
            : colors.accent;

  const containerStyle: ViewStyle = {
    height: heightBySize[size],
    paddingHorizontal: horizontalPad[size],
    borderRadius: size === 'lg' ? radii.xl : radii.md,
    backgroundColor: background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    opacity: isDisabled ? 0.45 : 1,
    alignSelf: fullWidth ? 'stretch' : undefined,
  };

  return (
    <Animated.View style={[animatedStyle, fullWidth && { alignSelf: 'stretch' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 18, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 360 });
        }}
        onPress={() => {
          if (haptic) {
            void hapticSelection();
          }
          onPress?.();
        }}
        style={containerStyle}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : LeadingIcon ? (
          <LeadingIcon color={labelColor} size={18} strokeWidth={ICON_STROKE_WIDTH} />
        ) : null}
        <Text variant={fontVariantBySize[size]} style={[styles.label, { color: labelColor }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
        {!loading && TrailingIcon ? (
          <View>
            <TrailingIcon color={labelColor} size={18} strokeWidth={ICON_STROKE_WIDTH} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
