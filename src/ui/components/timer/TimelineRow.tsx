import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { eventDurationSeconds, eventRestGapSeconds, formatShortDuration } from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { Footnote, Subhead } from '@/ui/components';
import { PulseDot } from '@/ui/components/timer/PulseDot';
import { useTheme } from '@/ui/theme';

export type TimelineRowProps = {
  event: ContractionEvent;
  previousEvent?: ContractionEvent;
  chronoIndex: number;
  isTop: boolean;
  now: string;
};

function TimelineRowBase({ event, previousEvent, chronoIndex, isTop, now }: TimelineRowProps) {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const isActive = !event.endAt;
  const dotColor = isActive ? colors.contractionActive : colors.accent;
  const restGap = previousEvent ? eventRestGapSeconds(event, previousEvent) : undefined;
  const durationSeconds = isActive ? eventDurationSeconds(event, now) : eventDurationSeconds(event);

  return (
    <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition.duration(220)}>
      <View
        style={[
          styles.row,
          {
            borderTopWidth: isTop ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={styles.leading}>
          <PulseDot active={isActive} color={dotColor} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleMeta}>
              <Subhead numberOfLines={1} style={styles.title}>
                #{chronoIndex + 1}
              </Subhead>
              <Footnote color="tertiary" numberOfLines={1} style={styles.inlineTime}>
                {formatTimeOnly(event.startAt, { t, locale })} - {event.endAt ? formatTimeOnly(event.endAt, { t, locale }) : t('common.now')}
              </Footnote>
            </View>
            <Footnote
              numberOfLines={1}
              style={[styles.duration, isActive && { color: colors.contractionActive }]}
            >
              {formatShortDuration(durationSeconds, { t, locale })}
            </Footnote>
          </View>
        </View>
      </View>
      {restGap !== undefined ? (
        <View
          style={[
            styles.restRow,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <View style={styles.leading}>
            <View style={[styles.restLine, { backgroundColor: colors.separator }]} />
          </View>
          <View style={styles.restBody}>
            <Footnote color="secondary" style={styles.restLabel}>
              {t('timer.rest')}
            </Footnote>
            <Footnote color="secondary" style={styles.restDuration}>
              {formatShortDuration(restGap, { t, locale })}
            </Footnote>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

export const TimelineRow = memo(TimelineRowBase, (prev, next) => {
  if (
    prev.event !== next.event ||
    prev.previousEvent !== next.previousEvent ||
    prev.chronoIndex !== next.chronoIndex ||
    prev.isTop !== next.isTop
  ) {
    return false;
  }
  const wasActive = !prev.event.endAt;
  const isActive = !next.event.endAt;
  if (wasActive !== isActive) {
    return false;
  }
  if (!isActive) {
    return true;
  }
  return prev.now === next.now;
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
  },
  restRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  leading: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 22,
  },
  restLine: {
    height: 14,
    width: 1,
  },
  restBody: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  restLabel: {
    flex: 1,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  restDuration: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
  },
  titleMeta: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  title: {
    flexShrink: 0,
    fontWeight: '700',
    letterSpacing: 0,
  },
  inlineTime: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
  duration: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
