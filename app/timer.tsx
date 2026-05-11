import { router } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticEnd } from '@/native/haptics';
import { buildRhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import { visibleEvents } from '@/domain/timing/timeMath';
import { useContractionApp } from '@/state/useContractionStore';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { Body, Button, IconButton, Screen, Subhead } from '@/ui/components';
import { CurrentSessionTimeline } from '@/ui/components/timer/CurrentSessionTimeline';
import { HomeAlertBanner } from '@/ui/components/timer/HomeAlertBanner';
import { MetricsRow } from '@/ui/components/timer/MetricsRow';
import { RhythmStatusControl } from '@/ui/components/timer/RhythmStatusControl';
import { TimerHero } from '@/ui/components/timer/TimerHero';
import { callNumber } from '@/ui/components/timer/utils';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

export default function TimerRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { spacing } = useTheme();
  const { actions, busy, error, loading, now, providerRuleResult, snapshot, summary, urgentRuleResult } = useContractionApp();
  const insets = useSafeAreaInsets();
  const previousRuleMet = useRef(false);
  const [showStartupIdle, setShowStartupIdle] = useState(true);
  const measuring = summary.timerState === 'measuring';
  const resting = summary.timerState === 'resting';
  const presentingStartupIdle = showStartupIdle && !measuring;
  const presentingResting = resting && !presentingStartupIdle;
  const sessionEvents = useMemo(() => visibleEvents(snapshot?.events ?? []), [snapshot?.events]);

  useEffect(() => {
    if (!measuring) {
      return;
    }
    void KeepAwake.activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      void KeepAwake.deactivateKeepAwake().catch(() => undefined);
    };
  }, [measuring]);

  useEffect(() => {
    if (providerRuleResult.met && !previousRuleMet.current) {
      void hapticEnd();
    }
    previousRuleMet.current = providerRuleResult.met;
  }, [providerRuleResult.met]);

  useEffect(() => {
    if (measuring) {
      setShowStartupIdle(false);
    }
  }, [measuring]);

  function handleTimerPress() {
    if (measuring) {
      void actions.end();
      return;
    }

    void actions.start();
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Subhead color="secondary">{t('timer.opening')}</Subhead>
        </View>
      </Screen>
    );
  }

  if (!snapshot) {
    return (
      <Screen largeTitle={t('timer.title')}>
        <View style={{ paddingHorizontal: spacing.base }}>
          <Body color="secondary" style={{ marginBottom: spacing.base }}>
            {error ?? t('timer.openFailed')}
          </Body>
          <Button variant="filled" label={t('common.retry')} onPress={actions.reload} fullWidth />
        </View>
      </Screen>
    );
  }

  const urgentActive = urgentRuleResult.active;
  const showCurrentSessionDetails = Boolean(snapshot.activeSession && summary.timerState !== 'idle');
  const currentSessionEvents = showCurrentSessionDetails ? sessionEvents : [];
  const lastDurationSeconds = showCurrentSessionDetails ? summary.lastDurationSeconds : undefined;
  const lastIntervalSeconds = showCurrentSessionDetails ? summary.lastIntervalSeconds : undefined;
  const callRuleMet = showCurrentSessionDetails && providerRuleResult.met;
  const homeAlert = urgentActive
    ? {
        accessibilityLabel: t('timer.urgentContactWarning'),
        message: urgentRuleResult.message ?? t('timer.urgentWarningFallback'),
        onPress: () => router.push('/urgent'),
      }
    : callRuleMet
      ? {
          accessibilityLabel: t('timer.savedCallRuleMatched'),
          message: providerRuleResult.message,
          onPress: () => callNumber(snapshot.profile.careTeamPhone || snapshot.profile.birthLocationPhone),
        }
      : undefined;
  const heroState = measuring ? 'measuring' : presentingResting ? 'resting' : presentingStartupIdle ? 'startup' : 'ready';
  const rhythmRangeStartAt = snapshot.activeSession?.startedAt ?? currentSessionEvents[0]?.startAt;
  const rhythmSummary = buildRhythmSummary(currentSessionEvents, snapshot.evaluatedAt, { rangeStartAt: rhythmRangeStartAt, rangeEndAt: snapshot.evaluatedAt });
  const rhythmStatus = rhythmStatusText(rhythmSummary.pattern, { t, locale });

  return (
    <Screen
      headerLeft={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton
            icon={Icons.Siren}
            label={t('timer.urgent')}
            tone={urgentActive ? 'urgent' : 'neutral'}
            onPress={() => router.push('/urgent')}
          />
          <IconButton
            icon={Icons.Phone}
            label={t('timer.call')}
            onPress={() => callNumber(snapshot.profile.careTeamPhone || snapshot.profile.birthLocationPhone)}
          />
          <IconButton icon={Icons.Share2} label={t('timer.share')} onPress={() => router.push('/share')} />
          <IconButton icon={Icons.History} label={t('timer.history')} onPress={() => router.push('/history')} />
        </View>
      }
      headerRight={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {resting ? (
            <IconButton
              icon={Icons.Flag}
              label={t('timer.finishSession')}
              tone="neutral"
              onPress={actions.closeSession}
              disabled={busy}
            />
          ) : null}
          <IconButton icon={Icons.Settings} label={t('timer.settings')} onPress={() => router.push('/settings')} />
        </View>
      }
      scrollable
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.base) }}
    >
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: spacing.base,
            paddingTop: spacing.sm,
            gap: spacing.base,
          },
        ]}
      >
        {homeAlert ? (
          <HomeAlertBanner
            accessibilityLabel={homeAlert.accessibilityLabel}
            message={homeAlert.message}
            onPress={homeAlert.onPress}
          />
        ) : null}

        <TimerHero
          state={heroState}
          busy={busy}
          onPress={handleTimerPress}
          now={now}
          activeStartedAt={summary.activeEvent?.startAt}
          restAnchorEndAt={summary.lastEvent?.endAt}
        />

        <MetricsRow lastDurationSeconds={lastDurationSeconds} lastIntervalSeconds={lastIntervalSeconds} />

        <RhythmStatusControl
          status={rhythmStatus}
          accent={providerRuleResult.met}
          disabled={rhythmSummary.eventCount < 2}
          onPress={() => router.push('/rhythm')}
        />

        {currentSessionEvents.length > 0 ? (
          <CurrentSessionTimeline events={currentSessionEvents} now={now} />
        ) : null}

        {currentSessionEvents.length > 0 ? (
          <Button
            variant="plain"
            size="sm"
            label={t('timer.undoLast')}
            leadingIcon={Icons.Undo2}
            onPress={actions.undo}
            disabled={busy}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
