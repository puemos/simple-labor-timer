import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { formatShortDuration, secondsBetween } from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { Footnote, Headline } from '@/ui/components';
import { TimelineRow } from '@/ui/components/timer/TimelineRow';
import { useTheme } from '@/ui/theme';

export type CurrentSessionTimelineProps = {
  events: ContractionEvent[];
  now: string;
};

export function CurrentSessionTimeline({ events, now }: CurrentSessionTimelineProps) {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, radii, spacing } = useTheme();
  const totalSessionSeconds = events.length > 0 ? secondsBetween(events[0].startAt, now) : 0;
  const isLatestActive = Boolean(events.at(-1) && !events.at(-1)!.endAt);
  const ordered = useMemo(() => [...events].reverse(), [events]);

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[
        styles.panel,
        {
          backgroundColor: colors.secondarySystemBackground,
          borderRadius: radii.xl,
        },
      ]}
    >
      <View
        style={[
          styles.sectionHeader,
          {
            borderBottomColor: colors.separator,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Headline numberOfLines={1}>{t('timer.currentSession')}</Headline>
          <Footnote color="secondary" numberOfLines={1} style={styles.headerMeta}>
            {events.length} {t('time.contraction', { count: events.length })} · {formatShortDuration(totalSessionSeconds, { t, locale })}
          </Footnote>
        </View>
        {isLatestActive ? (
          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor: colors.contractionActive,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              },
            ]}
          >
            <Footnote style={[styles.headerBadgeLabel, { color: colors.onContractionActive }]}>
              {t('timer.live')}
            </Footnote>
          </View>
        ) : null}
      </View>
      {ordered.map((event, displayIndex) => {
        const chronoIndex = events.length - 1 - displayIndex;
        const previousEvent = events[chronoIndex - 1];
        return (
          <TimelineRow
            key={event.id}
            event={event}
            previousEvent={previousEvent}
            chronoIndex={chronoIndex}
            isTop={displayIndex === 0}
            now={now}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
  },
  headerMeta: {
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  headerBadge: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  headerBadgeLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
