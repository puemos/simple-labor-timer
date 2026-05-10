import { LucideIcon } from 'lucide-react-native';
import { GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { useTheme } from '@/ui/theme';
import { ICON_STROKE_WIDTH } from '@/ui/icons';

type Tone = 'neutral' | 'urgent' | 'accent' | 'success';

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  tone?: Tone;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon: Icon, label, onPress, tone = 'neutral', disabled, size = 36, style }: IconButtonProps) {
  const { colors, radii } = useTheme();

  const background =
    tone === 'urgent'
      ? colors.urgent
      : tone === 'accent'
        ? colors.accent
        : tone === 'success'
          ? colors.success
          : colors.tertiarySystemFill;

  const iconColor =
    tone === 'urgent' ? colors.onUrgent : tone === 'accent' ? colors.onAccent : tone === 'success' ? colors.onSuccess : colors.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={(event) => {
        void hapticSelection();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon color={iconColor} size={size >= 36 ? 20 : 16} strokeWidth={ICON_STROKE_WIDTH} />
    </Pressable>
  );
}
