import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/ui/theme';

type CardProps = PropsWithChildren<{
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  background?: 'secondary' | 'tertiary' | 'grouped';
  padding?: number;
}>;

export function Card({ children, accent, style, background = 'secondary', padding }: CardProps) {
  const { colors, radii, spacing } = useTheme();
  const bg =
    background === 'tertiary'
      ? colors.tertiarySystemBackground
      : background === 'grouped'
        ? colors.secondarySystemGroupedBackground
        : colors.secondarySystemBackground;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radii.xl,
          padding: padding ?? spacing.base,
          overflow: 'hidden',
        },
        accent && {
          borderLeftWidth: 2,
          borderLeftColor: colors.success,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
