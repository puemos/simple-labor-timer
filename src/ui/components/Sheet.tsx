import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme';

type SheetProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  background?: 'system' | 'grouped';
}>;

export function Sheet({ children, style, background = 'grouped' }: SheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = background === 'system' ? colors.systemBackground : colors.systemGroupedBackground;
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: bg,
          paddingBottom: Math.max(insets.bottom, spacing.base),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
