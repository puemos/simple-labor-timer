import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Card } from '@/ui/components/Card';
import { Caption1, Title2 } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

export function MetricTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { spacing } = useTheme();
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.tile}>
      <Card accent={accent} style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
        <View>
          <Caption1 color="secondary" numberOfLines={1}>
            {label}
          </Caption1>
          <Title2
            style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.1}
          >
            {value}
          </Title2>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
  },
});
