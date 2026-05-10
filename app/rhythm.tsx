import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { buildRhythmInsight, buildRhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import { formatShortDuration, visibleEvents } from '@/domain/timing/timeMath';
import { useContractionApp } from '@/state/useContractionStore';
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
  const rangeLabel = sessionId ? 'Session' : 'Current session';
  const summary = useMemo(
    () => buildRhythmSummary(events, rangeEndAt, { rangeStartAt, rangeEndAt }),
    [events, rangeEndAt, rangeStartAt],
  );
  const status = rhythmStatusText(summary.pattern);
  const isCurrentSession = !sessionId || session?.id === snapshot?.activeSession?.id;
  const insight = useMemo(
    () =>
      buildRhythmInsight(summary, {
        providerRuleResult: isCurrentSession ? providerRuleResult : undefined,
        urgentRuleResult: isCurrentSession ? urgentRuleResult : undefined,
      }),
    [isCurrentSession, providerRuleResult, summary, urgentRuleResult],
  );

  return (
    <Sheet background="grouped">
      <View
        collapsable={false}
        style={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.base,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Headline>Rhythm</Headline>
          <Footnote color="secondary" style={{ marginTop: 2 }}>
            {rangeLabel}
          </Footnote>
        </View>
        <IconButton icon={Icons.X} label="Close rhythm" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingTop: spacing.sm, gap: spacing.base }}>
        {events.length === 0 ? (
          <EmptyState icon={Icons.Waves} title="No rhythm yet" body="Rhythm appears after contractions are recorded." />
        ) : (
          <>
            <Card background="grouped">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Caption1 color="secondary" style={{ fontWeight: '700', textTransform: 'uppercase' }}>
                    Average interval
                  </Caption1>
                  <Title2 style={{ marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
                    {formatShortDuration(summary.averageIntervalSeconds)}
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
                {summary.eventCount} {summary.eventCount === 1 ? 'contraction' : 'contractions'}
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
      </ScrollView>
    </Sheet>
  );
}
