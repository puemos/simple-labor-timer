import { ComponentProps } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '@/ui/theme';
import { Footnote } from '@/ui/components/Text';

type Variant = 'standalone' | 'inline';

type TextFieldProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  label?: string;
  variant?: Variant;
  rightAlign?: boolean;
};

export function TextField({ label, variant = 'standalone', rightAlign, ...props }: TextFieldProps) {
  const { colors, radii, spacing, typography } = useTheme();

  if (variant === 'inline') {
    return (
      <TextInput
        placeholderTextColor={colors.placeholderText}
        {...props}
        style={[
          typography.body,
          {
            color: colors.label,
            flex: 1,
            textAlign: rightAlign ? 'right' : 'left',
            paddingVertical: 0,
            minHeight: 28,
          },
        ]}
      />
    );
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Footnote color="secondary" style={{ marginBottom: 4 }}>
          {label}
        </Footnote>
      ) : null}
      <TextInput
        placeholderTextColor={colors.placeholderText}
        {...props}
        style={[
          typography.body,
          {
            color: colors.label,
            backgroundColor: colors.tertiarySystemFill,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            minHeight: 44,
          },
        ]}
      />
    </View>
  );
}
