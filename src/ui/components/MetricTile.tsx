import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { hapticSelection } from '@/native/haptics';
import { Card } from '@/ui/components/Card';
import { Caption1, Title2 } from '@/ui/components/Text';
import { AppIcon, Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type MetricTileProps = {
  label: string;
  value: string;
  accent?: boolean;
  icon?: AppIcon;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function MetricTile({
  label,
  value,
  accent,
  icon: Icon,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: MetricTileProps) {
  const { colors, radii, spacing } = useTheme();
  const isDisabled = Boolean(disabled || !onPress);
  const showAffordance = Boolean(onPress && !isDisabled);
  const content = (
    <View style={styles.tile}>
      <Card accent={accent} style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
        <View>
          <View style={styles.labelRow}>
            {Icon ? (
              <View
                style={[
                  styles.iconFrame,
                  {
                    backgroundColor: colors.tertiarySystemFill,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Icon color={colors.accent} size={17} strokeWidth={ICON_STROKE_WIDTH} />
              </View>
            ) : null}
            <Caption1 color="secondary" numberOfLines={1} style={styles.label}>
              {label}
            </Caption1>
            {showAffordance ? (
              <Icons.ChevronRight color={colors.tertiaryLabel} size={17} strokeWidth={ICON_STROKE_WIDTH} />
            ) : null}
          </View>
          <View style={styles.valueRow}>
            <Title2
              style={styles.metricValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1}
            >
              {value}
            </Title2>
          </View>
        </View>
      </Card>
    </View>
  );

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.tile}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: isDisabled }}
          disabled={isDisabled}
          onPress={() => {
            void hapticSelection();
            onPress();
          }}
          style={({ pressed }) => ({ opacity: isDisabled ? 0.62 : pressed ? 0.88 : 1 })}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  valueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
    minWidth: 0,
  },
  metricValue: {
    flex: 1,
    fontVariant: ['tabular-nums'],
    minWidth: 0,
  },
  iconFrame: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
