import RNSegmented from '@react-native-segmented-control/segmented-control';
import { StyleProp, ViewStyle } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { useTheme } from '@/ui/theme';

type SegmentedControlProps<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  const { scheme, spacing } = useTheme();
  const labels = options.map((option) => option.label);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === value));

  return (
    <RNSegmented
      values={labels}
      selectedIndex={selectedIndex}
      appearance={scheme}
      onChange={(event) => {
        const index = event.nativeEvent.selectedSegmentIndex;
        const next = options[index];
        if (next) {
          void hapticSelection();
          onChange(next.key);
        }
      }}
      style={[{ height: 32, marginVertical: spacing.xs }, style]}
    />
  );
}
