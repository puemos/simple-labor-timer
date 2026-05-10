import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Footnote } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

export function Section({
  title,
  children,
  style,
}: PropsWithChildren<{ title?: string; style?: StyleProp<ViewStyle> }>) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {title ? (
        <Footnote
          color="secondary"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: spacing.sm,
            marginHorizontal: spacing.base,
          }}
        >
          {title}
        </Footnote>
      ) : null}
      <View
        style={{
          backgroundColor: colors.secondarySystemBackground,
          borderRadius: radii.lg,
          marginHorizontal: spacing.base,
          padding: spacing.base,
        }}
      >
        {children}
      </View>
    </View>
  );
}
