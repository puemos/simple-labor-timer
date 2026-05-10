import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { hapticSelection } from '@/native/haptics';
import { useTheme } from '@/ui/theme';
import { Body, Footnote, Subhead } from '@/ui/components/Text';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';

export type ListRowTrailing = 'chevron' | 'value' | 'switch' | 'check' | 'none';

type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: { icon: LucideIcon; color?: string; tint?: string };
  trailing?: ListRowTrailing | ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
  centerTitle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing = 'none',
  value,
  onPress,
  destructive,
  disabled,
  selected,
  centerTitle,
  style,
}: ListRowProps) {
  const { colors, spacing, radii } = useTheme();

  const titleColor = destructive ? colors.urgent : colors.label;

  const content = (
    <View
      style={[
        {
          minHeight: 44,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {leading ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radii.sm,
            backgroundColor: leading.color ?? colors.systemBlue,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <leading.icon color={leading.tint ?? colors.onAccent} size={16} strokeWidth={ICON_STROKE_WIDTH} />
        </View>
      ) : null}
      <View style={{ flex: 1, minHeight: 28, justifyContent: 'center' }}>
        <Body
          style={{
            color: titleColor,
            textAlign: centerTitle ? 'center' : 'left',
            fontWeight: destructive || centerTitle ? '500' : '400',
          }}
          numberOfLines={1}
        >
          {title}
        </Body>
        {subtitle ? (
          <Footnote color="secondary" style={{ marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {subtitle}
          </Footnote>
        ) : null}
      </View>
      <TrailingNode trailing={trailing} value={value} selected={selected} />
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      android_ripple={{ color: colors.systemFill }}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.systemFill : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

function TrailingNode({
  trailing,
  value,
  selected,
}: {
  trailing: ListRowTrailing | ReactNode;
  value?: string;
  selected?: boolean;
}) {
  const { colors } = useTheme();

  if (trailing === 'chevron') {
    return <Icons.ChevronRight color={colors.tertiaryLabel} size={18} strokeWidth={ICON_STROKE_WIDTH} />;
  }
  if (trailing === 'check') {
    return selected ? <Icons.Check color={colors.accent} size={18} strokeWidth={2.4} /> : null;
  }
  if (trailing === 'value') {
    return value ? (
      <Subhead color="secondary" numberOfLines={1}>
        {value}
      </Subhead>
    ) : null;
  }
  if (trailing === 'switch' || trailing === 'none') {
    return null;
  }
  return <>{trailing}</>;
}
