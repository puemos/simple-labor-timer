import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { formatShortDuration } from '@/domain/timing/timeMath';
import { RhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import { Card } from '@/ui/components/Card';
import { Caption1, Footnote, Headline, Subhead } from '@/ui/components/Text';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type RhythmSummaryRowProps = {
  title?: string;
  summary: RhythmSummary;
  onPress?: () => void;
  disabled?: boolean;
  sourceLabel?: string;
  background?: 'secondary' | 'tertiary' | 'grouped';
  style?: StyleProp<ViewStyle>;
};

export function RhythmSummaryRow({
  title = 'Rhythm',
  summary,
  onPress,
  disabled,
  sourceLabel = 'Current session',
  background = 'secondary',
  style,
}: RhythmSummaryRowProps) {
  const { colors, radii, spacing } = useTheme();
  const isDisabled = Boolean(disabled || summary.eventCount < 2 || !onPress);
  const status = rhythmStatusText(summary.pattern);
  const value = formatShortDuration(summary.averageIntervalSeconds);
  const subtitle =
    summary.eventCount < 2
      ? 'Need one more contraction'
      : `${summary.eventCount} ${summary.eventCount === 1 ? 'contraction' : 'contractions'} · ${formatShortDuration(
          summary.averageDurationSeconds,
        )} avg duration · ${sourceLabel}`;
  const chipTone = statusTone(status, colors);

  const content = (
    <Card background={background} padding={spacing.md} style={[{ opacity: isDisabled ? 0.62 : 1 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radii.md,
            backgroundColor: colors.tertiarySystemFill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.Waves color={colors.accent} size={19} strokeWidth={ICON_STROKE_WIDTH} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Headline numberOfLines={1}>{title}</Headline>
            <View
              style={{
                borderRadius: radii.pill,
                backgroundColor: chipTone.background,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Caption1 style={{ color: chipTone.label, fontWeight: '700' }} numberOfLines={1}>
                {status}
              </Caption1>
            </View>
          </View>
          <Footnote color="secondary" numberOfLines={1} style={{ marginTop: 3 }}>
            {subtitle}
          </Footnote>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Subhead style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {value}
          </Subhead>
          {isDisabled ? null : <Icons.ChevronRight color={colors.tertiaryLabel} size={18} strokeWidth={ICON_STROKE_WIDTH} />}
        </View>
      </View>
    </Card>
  );

  if (isDisabled) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}, ${subtitle}`}
      accessibilityState={{ disabled: isDisabled }}
      onPress={() => {
        void hapticSelection();
        onPress?.();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      {content}
    </Pressable>
  );
}

function statusTone(status: string, colors: ReturnType<typeof useTheme>['colors']) {
  if (status === 'Getting closer') {
    return { background: colors.systemFill, label: colors.accent };
  }
  if (status === 'Holding steady') {
    return { background: colors.tertiarySystemFill, label: colors.success };
  }
  if (status === 'Spacing out') {
    return { background: colors.tertiarySystemFill, label: colors.warning };
  }
  if (status === 'Irregular') {
    return { background: colors.tertiarySystemFill, label: colors.secondaryLabel };
  }
  return { background: colors.tertiarySystemFill, label: colors.secondaryLabel };
}
