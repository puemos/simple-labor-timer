import { CSSProperties } from 'react';
import { View } from 'react-native';
import { formatDateTimeLocalInputValue } from '@/domain/timing/dateFormat';
import { Footnote } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function DateTimeField({ label, value, onChangeText }: DateTimeFieldProps) {
  const { colors, radii, scheme, spacing, typography } = useTheme();
  const inputStyle: CSSProperties = {
    backgroundColor: colors.tertiarySystemFill,
    border: 'none',
    borderRadius: radii.md,
    boxSizing: 'border-box',
    color: colors.label,
    colorScheme: scheme,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: `${typography.body.lineHeight}px`,
    minHeight: 44,
    outline: 'none',
    padding: `${spacing.sm + 2}px ${spacing.md}px`,
    width: '100%',
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Footnote color="secondary" style={{ marginBottom: 4 }}>
        {label}
      </Footnote>
      <input
        aria-label={label}
        type="datetime-local"
        step="1"
        value={formatDateTimeLocalInputValue(value)}
        onChange={(event) => onChangeText(event.currentTarget.value)}
        style={inputStyle}
      />
    </View>
  );
}
