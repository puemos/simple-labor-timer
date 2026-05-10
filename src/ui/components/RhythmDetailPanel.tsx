import { View } from 'react-native';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { RhythmEventDetail } from '@/domain/timing/rhythm';
import { formatShortDuration } from '@/domain/timing/timeMath';
import { Intensity } from '@/domain/types';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Caption1, Footnote, Headline, Subhead } from '@/ui/components/Text';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type RhythmDetailPanelProps = {
  detail?: RhythmEventDetail;
  onOpenEvent?: (eventId: string) => void;
};

export function RhythmDetailPanel({ detail, onOpenEvent }: RhythmDetailPanelProps) {
  const { colors, spacing } = useTheme();

  if (!detail) {
    return (
      <Card background="grouped">
        <Headline>Select a contraction</Headline>
        <Footnote color="secondary" style={{ marginTop: spacing.xs }}>
          Tap a rhythm block to inspect its timing.
        </Footnote>
      </Card>
    );
  }

  return (
    <Card background="grouped">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Headline>Selected contraction</Headline>
          <Footnote color="secondary" style={{ marginTop: 2 }}>
            Started {formatTimeOnly(detail.event.startAt)}
          </Footnote>
        </View>
        <View
          style={{
            backgroundColor: colors.tertiarySystemFill,
            borderRadius: 999,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
          }}
        >
          <Caption1 style={{ fontWeight: '700', color: colors.secondaryLabel }}>
            {intensityLabel(detail.event.intensity)}
          </Caption1>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
        <DetailMetric label="Duration" value={formatShortDuration(detail.durationSeconds)} />
        <DetailMetric label="Interval" value={formatShortDuration(detail.intervalSeconds)} />
        <DetailMetric label="Rest" value={formatShortDuration(detail.restGapSeconds)} />
      </View>

      {onOpenEvent ? (
        <Button
          variant="gray"
          size="md"
          label="Open details"
          trailingIcon={Icons.ChevronRight}
          onPress={() => onOpenEvent(detail.event.id)}
          fullWidth
          style={{ marginTop: spacing.base }}
        />
      ) : null}
    </Card>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: radii.md,
        backgroundColor: colors.tertiarySystemFill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <Caption1 color="secondary" numberOfLines={1}>
        {label}
      </Caption1>
      <Subhead style={{ marginTop: 2, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value}
      </Subhead>
    </View>
  );
}

function intensityLabel(intensity: Intensity | undefined): string {
  switch (intensity) {
    case 'mild':
      return 'Mild';
    case 'moderate':
      return 'Moderate';
    case 'strong':
      return 'Strong';
    case 'cannot_talk_walk':
      return "Can't talk";
    default:
      return 'Unrated';
  }
}
