import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { buildRhythmInsight, buildRhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import { formatShortDuration, visibleEvents } from '@/domain/timing/timeMath';
import { useContractionApp } from '@/state/useContractionStore';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import {
  Card,
  Caption1,
  ContractionRhythmChart,
  EmptyState,
  Footnote,
  Headline,
  IconButton,
  RhythmDetailPanel,
  Sheet,
  Title2,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type RhythmParams = {
  sessionId?: string;
};

export default function RhythmRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, radii, spacing } = useTheme();
  const { sessionId } = useLocalSearchParams<RhythmParams>();
  const { now, providerRuleResult, snapshot, urgentRuleResult } = useContractionApp();
  const session = useMemo(() => {
    if (!snapshot) {
      return undefined;
    }
    if (!sessionId) {
      return snapshot.activeSession;
    }
    return (
      snapshot.sessions.find((item) => item.id === sessionId) ??
      (snapshot.activeSession?.id === sessionId ? snapshot.activeSession : undefined) ??
      (snapshot.latestSession?.id === sessionId ? snapshot.latestSession : undefined)
    );
  }, [sessionId, snapshot]);
  const events = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    if (sessionId) {
      return visibleEvents(snapshot.allEvents).filter((event) => event.sessionId === sessionId);
    }
    return visibleEvents(snapshot.events);
  }, [sessionId, snapshot]);
  const rangeStartAt = session?.startedAt ?? events[0]?.startAt;
  const rangeEndAt = session?.endedAt ?? now;
  const rangeLabel = sessionId ? t('time.session') : t('time.currentSession');
  const summary = useMemo(
    () => buildRhythmSummary(events, rangeEndAt, { rangeStartAt, rangeEndAt }),
    [events, rangeEndAt, rangeStartAt],
  );
  const status = rhythmStatusText(summary.pattern, { t, locale });
  const isCurrentSession = !sessionId || session?.id === snapshot?.activeSession?.id;
  const insight = useMemo(
    () =>
      buildRhythmInsight(summary, {
        providerRuleResult: isCurrentSession ? providerRuleResult : undefined,
        urgentRuleResult: isCurrentSession ? urgentRuleResult : undefined,
        t,
        locale,
      }),
    [isCurrentSession, locale, providerRuleResult, summary, t, urgentRuleResult],
  );

  return (
    <Sheet background="grouped">
      <ScrollView
        stickyHeaderIndices={[0]}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.base }}
      >
        <View
          collapsable={false}
          style={{
            backgroundColor: colors.systemGroupedBackground,
            paddingHorizontal: spacing.base,
            paddingTop: spacing.base,
            paddingBottom: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Headline>{t('rhythm.title')}</Headline>
            <Footnote color="secondary" style={{ marginTop: 2 }}>
              {rangeLabel}
            </Footnote>
          </View>
          <IconButton icon={Icons.X} label={t('rhythm.close')} onPress={() => router.back()} />
        </View>

        <View style={{ padding: spacing.base, paddingTop: spacing.sm, gap: spacing.base }}>
          {events.length === 0 ? (
            <EmptyState icon={Icons.Waves} title={t('rhythm.noRhythmTitle')} body={t('rhythm.noRhythmBody')} />
          ) : (
            <>
              <Card background="grouped">
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Caption1 color="secondary" style={{ fontWeight: '700', textTransform: 'uppercase' }}>
                      {t('rhythm.averageInterval')}
                    </Caption1>
                    <Title2 style={{ marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
                      {formatShortDuration(summary.averageIntervalSeconds, { t, locale })}
                    </Title2>
                  </View>
                  <View
                    style={{
                      borderRadius: radii.pill,
                      backgroundColor: colors.tertiarySystemFill,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 5,
                    }}
                  >
                    <Caption1 style={{ color: colors.secondaryLabel, fontWeight: '700' }}>{status}</Caption1>
                  </View>
                </View>
                <Footnote color="secondary" style={{ marginTop: spacing.base }}>
                  {summary.eventCount} {t('time.contraction', { count: summary.eventCount })}
                </Footnote>
                <View style={{ marginTop: spacing.base }}>
                  <ContractionRhythmChart
                    events={events}
                    now={rangeEndAt}
                    rangeStartAt={rangeStartAt}
                    rangeEndAt={rangeEndAt}
                  />
                </View>
              </Card>

              <RhythmDetailPanel insight={insight} />
            </>
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}
