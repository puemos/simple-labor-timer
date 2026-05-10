import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { formatShortDuration } from '@/domain/timing/timeMath';
import { RhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import { useAppLanguage, useAppTranslation } from '@/i18n';
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
  title,
  summary,
  onPress,
  disabled,
  sourceLabel,
  background = 'secondary',
  style,
}: RhythmSummaryRowProps) {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, radii, spacing } = useTheme();
  const resolvedTitle = title ?? t('timer.rhythm');
  const resolvedSourceLabel = sourceLabel ?? t('time.currentSession');
  const isDisabled = Boolean(disabled || summary.eventCount < 2 || !onPress);
  const status = rhythmStatusText(summary.pattern, { t, locale });
  const value = formatShortDuration(summary.averageIntervalSeconds, { t, locale });
  const subtitle =
    summary.eventCount < 2
      ? t('rhythm.needOneMore')
      : `${summary.eventCount} ${t('time.contraction', { count: summary.eventCount })} · ${formatShortDuration(
          summary.averageDurationSeconds,
          { t, locale },
        )} ${t('rhythm.averageDuration')} · ${resolvedSourceLabel}`;
  const chipTone = statusTone(summary.pattern, colors);

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
            <Headline numberOfLines={1}>{resolvedTitle}</Headline>
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
      accessibilityLabel={`${resolvedTitle}, ${value}, ${subtitle}`}
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

function statusTone(pattern: RhythmSummary['pattern'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (pattern) {
    case 'getting_closer':
      return { background: colors.systemFill, label: colors.accent };
    case 'regular':
      return { background: colors.tertiarySystemFill, label: colors.success };
    case 'spacing_out':
      return { background: colors.tertiarySystemFill, label: colors.warning };
    case 'inconsistent':
    case 'insufficient_data':
      return { background: colors.tertiarySystemFill, label: colors.secondaryLabel };
  }
}
