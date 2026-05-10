import { View } from 'react-native';
import { RhythmInsight, RhythmInsightTone } from '@/domain/timing/rhythm';
import { useAppTranslation } from '@/i18n';
import { Card } from '@/ui/components/Card';
import { Callout, Caption1, Headline, Title3 } from '@/ui/components/Text';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type RhythmDetailPanelProps = {
  insight: RhythmInsight;
};

export function RhythmDetailPanel({ insight }: RhythmDetailPanelProps) {
  const { t } = useAppTranslation();
  const { colors, radii, spacing } = useTheme();
  const tone = insightTone(insight.tone, colors);
  const Icon = insight.tone === 'urgent' ? Icons.AlertTriangle : Icons.Waves;

  return (
    <Card background="grouped">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.md,
            backgroundColor: tone.iconBackground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon color={tone.iconColor} size={20} strokeWidth={ICON_STROKE_WIDTH} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Title3 numberOfLines={1} style={{ fontWeight: '700' }}>
            {insight.headline}
          </Title3>
          <Callout color="secondary" style={{ marginTop: spacing.xs }}>
            {insight.body}
          </Callout>
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.base,
          borderRadius: radii.md,
          backgroundColor: tone.actionBackground,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Caption1 style={{ color: tone.actionLabel, fontWeight: '700', textTransform: 'uppercase' }}>{t('rhythm.next')}</Caption1>
        <Headline style={{ color: tone.actionLabel, marginTop: 2 }}>{insight.action}</Headline>
      </View>
    </Card>
  );
}

function insightTone(tone: RhythmInsightTone, colors: ReturnType<typeof useTheme>['colors']) {
  switch (tone) {
    case 'urgent':
      return {
        iconBackground: colors.urgent,
        iconColor: colors.onUrgent,
        actionBackground: colors.urgent,
        actionLabel: colors.onUrgent,
      };
    case 'accent':
      return {
        iconBackground: colors.systemFill,
        iconColor: colors.accent,
        actionBackground: colors.tertiarySystemFill,
        actionLabel: colors.label,
      };
    case 'success':
      return {
        iconBackground: colors.tertiarySystemFill,
        iconColor: colors.success,
        actionBackground: colors.tertiarySystemFill,
        actionLabel: colors.label,
      };
    case 'warning':
      return {
        iconBackground: colors.tertiarySystemFill,
        iconColor: colors.warning,
        actionBackground: colors.tertiarySystemFill,
        actionLabel: colors.label,
      };
    case 'neutral':
      return {
        iconBackground: colors.tertiarySystemFill,
        iconColor: colors.secondaryLabel,
        actionBackground: colors.tertiarySystemFill,
        actionLabel: colors.label,
      };
  }
}
