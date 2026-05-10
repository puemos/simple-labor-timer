import { Children, PropsWithChildren, ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Footnote } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type ListSectionProps = PropsWithChildren<{
  header?: string;
  footer?: string | ReactNode;
  style?: StyleProp<ViewStyle>;
  inset?: boolean;
}>;

export function ListSection({ header, footer, children, style, inset = true }: ListSectionProps) {
  const { colors, radii, spacing, hairlineColor } = useThemed();
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {header ? (
        <Footnote
          color="secondary"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: spacing.sm,
            marginHorizontal: inset ? spacing.base : 0,
          }}
        >
          {header}
        </Footnote>
      ) : null}
      <View
        style={{
          backgroundColor: colors.secondarySystemGroupedBackground,
          borderRadius: radii.lg,
          marginHorizontal: inset ? spacing.base : 0,
          overflow: 'hidden',
        }}
      >
        {items.map((child, index) => (
          <View key={index}>
            {child}
            {index < items.length - 1 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: hairlineColor,
                  marginLeft: spacing.base,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
      {footer ? (
        typeof footer === 'string' ? (
          <Footnote
            color="secondary"
            style={{
              marginTop: spacing.sm,
              marginHorizontal: inset ? spacing.base : 0,
            }}
          >
            {footer}
          </Footnote>
        ) : (
          <View style={{ marginTop: spacing.sm, marginHorizontal: inset ? spacing.base : 0 }}>{footer}</View>
        )
      ) : null}
    </View>
  );
}

function useThemed() {
  const theme = useTheme();
  return { ...theme, hairlineColor: theme.colors.separator };
}
