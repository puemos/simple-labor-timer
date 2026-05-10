import { router } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { hapticEnd, hapticSelection } from '@/native/haptics';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { buildRhythmSummary, rhythmStatusText } from '@/domain/timing/rhythm';
import {
  eventDurationSeconds,
  eventRestGapSeconds,
  formatDuration,
  formatShortDuration,
  secondsBetween,
  visibleEvents,
} from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import {
  Body,
  Button,
  Card,
  Footnote,
  Headline,
  IconButton,
  MetricTile,
  Screen,
  Subhead,
} from '@/ui/components';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

export default function TimerRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, scheme, spacing, radii, shadows, typography } = useTheme();
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
  const stateLabel = measuring ? t('timer.stateNowTiming') : presentingResting ? t('timer.stateResting') : t('timer.stateReady');
  const timerActionLabel = measuring ? t('timer.endContraction') : t('timer.startContraction');
  const badgeBg = measuring ? colors.contractionActive : colors.systemFill;
  const badgeColor = measuring ? colors.onContractionActive : colors.label;
  const heroBackground = measuring
    ? colors.contractionActiveSubtle
    : scheme === 'dark'
      ? 'rgba(10, 132, 255, 0.16)'
      : 'rgba(0, 122, 255, 0.06)';
  const heroBorderColor = measuring ? colors.contractionActive : colors.accent;
  const actionBackground = measuring ? colors.contractionActive : colors.accent;
  const actionLabelColor = measuring ? colors.onContractionActive : colors.onAccent;
  const timerSeconds = measuring
    ? formatActiveDuration(summary.activeEvent?.startAt, now)
    : presentingResting
      ? (summary.currentRestSeconds ?? 0)
      : 0;
  const timerLabel = formatDuration(timerSeconds, { t, locale });
  const rhythmRangeStartAt = snapshot.activeSession?.startedAt ?? currentSessionEvents[0]?.startAt;
  const rhythmSummary = buildRhythmSummary(currentSessionEvents, now, { rangeStartAt: rhythmRangeStartAt, rangeEndAt: now });
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
          <Animated.View entering={FadeIn.springify().damping(18).stiffness(180)} exiting={FadeOut.duration(160)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={homeAlert.accessibilityLabel}
              onPress={homeAlert.onPress}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.urgent,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Icons.AlertTriangle color={colors.onUrgent} size={20} strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Headline color="onUrgent" numberOfLines={1}>
                  {t('timer.callNow')}
                </Headline>
                <Footnote color="onUrgent" style={styles.homeAlertBody} numberOfLines={2}>
                  {homeAlert.message}
                </Footnote>
              </View>
              <Icons.ChevronRight color={colors.onUrgent} size={18} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={timerActionLabel}
          accessibilityHint={t('timer.toggleHint')}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={handleTimerPress}
          style={({ pressed }) => [
            styles.heroPressable,
            {
              opacity: busy ? 0.55 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: heroBackground,
                borderColor: heroBorderColor,
                borderRadius: 42,
                ...shadows.card,
              },
            ]}
          >
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radii.pill,
                backgroundColor: badgeBg,
              }}
            >
              <Footnote
                style={{ color: badgeColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}
                maxFontSizeMultiplier={1.2}
              >
                {stateLabel}
              </Footnote>
            </View>

            <Animated.Text
              style={[
                typography.timer,
                { color: colors.label, marginTop: spacing.lg, marginBottom: spacing.md },
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
              maxFontSizeMultiplier={1}
            >
              {timerLabel}
            </Animated.Text>

            <Subhead color="secondary" style={{ textAlign: 'center' }}>
              {measuring ? t('timer.tapToEnd') : presentingResting ? t('timer.tapToStartNext') : t('timer.tapToStart')}
            </Subhead>

            <View
              style={[
                styles.heroAction,
                {
                  backgroundColor: actionBackground,
                  marginTop: spacing.xl,
                  paddingHorizontal: spacing.xl,
                },
              ]}
            >
              {busy ? <ActivityIndicator color={actionLabelColor} /> : null}
              <Headline numberOfLines={1} style={[styles.heroActionLabel, { color: actionLabelColor }]}>
                {timerActionLabel}
              </Headline>
            </View>
          </View>
        </Pressable>

        <View style={[styles.metrics, { gap: spacing.sm }]}>
          <MetricTile label={t('timer.duration')} value={formatShortDuration(lastDurationSeconds, { t, locale })} icon={Icons.Timer} />
          <MetricTile label={t('timer.interval')} value={formatShortDuration(lastIntervalSeconds, { t, locale })} icon={Icons.Clock} />
        </View>

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

function RhythmStatusControl({
  status,
  accent,
  disabled,
  onPress,
}: {
  status: string;
  accent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useAppTranslation();
  const { colors, radii, spacing } = useTheme();
  const isDisabled = Boolean(disabled);

  const content = (
    <Card accent={accent} padding={spacing.md} style={isDisabled ? styles.disabledControl : undefined}>
      <View style={styles.rhythmControlRow}>
        <View
          style={[
            styles.rhythmIconFrame,
            {
              backgroundColor: colors.tertiarySystemFill,
              borderRadius: radii.md,
            },
          ]}
        >
          <Icons.Waves color={colors.accent} size={19} strokeWidth={ICON_STROKE_WIDTH} />
        </View>
        <View style={styles.rhythmControlBody}>
          <Footnote color="secondary" numberOfLines={1}>
            {t('timer.rhythm')}
          </Footnote>
          <Headline numberOfLines={1} style={styles.rhythmStatus}>
            {status}
          </Headline>
        </View>
        {isDisabled ? null : <Icons.ChevronRight color={colors.tertiaryLabel} size={19} strokeWidth={ICON_STROKE_WIDTH} />}
      </View>
    </Card>
  );

  if (isDisabled) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('timer.rhythm')}, ${status}`}
      accessibilityHint={t('timer.rhythmHint')}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      {content}
    </Pressable>
  );
}

function CurrentSessionTimeline({ events, now }: { events: ContractionEvent[]; now: string }) {
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
        styles.timelinePanel,
        {
          backgroundColor: colors.secondarySystemBackground,
          borderRadius: radii.xl,
        },
      ]}
    >
      <View
        style={[
          styles.timelineSectionHeader,
          {
            borderBottomColor: colors.separator,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Headline numberOfLines={1}>{t('timer.currentSession')}</Headline>
          <Footnote color="secondary" numberOfLines={1} style={styles.timelineHeaderMeta}>
            {events.length} {t('time.contraction', { count: events.length })} · {formatShortDuration(totalSessionSeconds, { t, locale })}
          </Footnote>
        </View>
        {isLatestActive ? (
          <View
            style={[
              styles.timelineHeaderBadge,
              {
                backgroundColor: colors.contractionActive,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              },
            ]}
          >
            <Footnote style={[styles.timelineHeaderBadgeLabel, { color: colors.onContractionActive }]}>
              {t('timer.live')}
            </Footnote>
          </View>
        ) : null}
      </View>
      {ordered.map((event, displayIndex) => {
        const chronoIndex = events.length - 1 - displayIndex;
        const prevChrono = events[chronoIndex - 1];
        const restGap = prevChrono ? eventRestGapSeconds(event, prevChrono) : undefined;
        const isActive = !event.endAt;
        const isTop = displayIndex === 0;
        const dotColor = isActive ? colors.contractionActive : colors.accent;

        return (
          <Animated.View
            key={event.id}
            entering={FadeIn.duration(200)}
            layout={LinearTransition.duration(220)}
          >
            <View
              style={[
                styles.timelineContractionRow,
                {
                  borderTopWidth: isTop ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.separator,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <View style={styles.timelineLeading}>
                <PulseDot active={isActive} color={dotColor} />
              </View>
              <View style={styles.timelineBody}>
                <View style={styles.timelineTitleRow}>
                  <View style={styles.timelineTitleMeta}>
                    <Subhead numberOfLines={1} style={styles.timelineContractionTitle}>
                      #{chronoIndex + 1}
                    </Subhead>
                    <Footnote color="tertiary" numberOfLines={1} style={styles.timelineInlineTime}>
                      {formatTimeOnly(event.startAt, { t, locale })} - {event.endAt ? formatTimeOnly(event.endAt, { t, locale }) : t('common.now')}
                    </Footnote>
                  </View>
                  <Footnote
                    numberOfLines={1}
                    style={[styles.timelineDuration, isActive && { color: colors.contractionActive }]}
                  >
                    {formatShortDuration(eventDurationSeconds(event, now), { t, locale })}
                  </Footnote>
                </View>
              </View>
            </View>
            {restGap !== undefined ? (
              <View
                style={[
                  styles.timelineRestRow,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <View style={styles.timelineLeading}>
                  <View style={[styles.timelineRestLine, { backgroundColor: colors.separator }]} />
                </View>
                <View style={styles.timelineRestBody}>
                  <Footnote color="secondary" style={styles.timelineRestLabel}>
                    {t('timer.rest')}
                  </Footnote>
                  <Footnote color="secondary" style={styles.timelineRestDuration}>
                    {formatShortDuration(restGap, { t, locale })}
                  </Footnote>
                </View>
              </View>
            ) : null}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

function PulseDot({ active, color }: { active: boolean; color: string }) {
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(withTiming(1.18, { duration: 800 }), -1, true);
      halo.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    } else {
      scale.value = withTiming(1, { duration: 220 });
      halo.value = withTiming(0, { duration: 160 });
    }
  }, [active, scale, halo]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 1.6 }],
  }));

  return (
    <View style={styles.timelineDotWrap}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.timelineDotHalo, { backgroundColor: color }, haloStyle]}
        />
      ) : null}
      <Animated.View style={[styles.timelineDot, { backgroundColor: color }, dotStyle]} />
    </View>
  );
}

function formatActiveDuration(startAt: string | undefined, now: string): number {
  if (!startAt) {
    return 0;
  }
  return Math.max(0, Math.round((Date.parse(now) - Date.parse(startAt)) / 1000));
}

function callNumber(phone?: string) {
  if (!phone) {
    router.push('/settings');
    return;
  }
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
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
  heroPressable: {
    justifyContent: 'center',
    minHeight: 320,
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 320,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  heroAction: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    minWidth: 210,
  },
  heroActionLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  homeAlertBody: {
    marginTop: 2,
  },
  metrics: {
    flexDirection: 'row',
  },
  disabledControl: {
    opacity: 0.62,
  },
  rhythmControlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rhythmIconFrame: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rhythmControlBody: {
    flex: 1,
    minWidth: 0,
  },
  rhythmStatus: {
    fontWeight: '700',
    marginTop: 1,
  },
  timelinePanel: {
    overflow: 'hidden',
  },
  timelineSectionHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
  },
  timelineHeaderMeta: {
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  timelineHeaderBadge: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  timelineHeaderBadgeLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  timelineContractionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
  },
  timelineRestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  timelineLeading: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 22,
  },
  timelineRestLine: {
    height: 14,
    width: 1,
  },
  timelineRestBody: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  timelineRestLabel: {
    flex: 1,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  timelineRestDuration: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  timelineDotWrap: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  timelineDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  timelineDotHalo: {
    borderRadius: 9,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
  },
  timelineTitleMeta: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  timelineContractionTitle: {
    flexShrink: 0,
    fontWeight: '700',
    letterSpacing: 0,
  },
  timelineInlineTime: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
  timelineDuration: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
