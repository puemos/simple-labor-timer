import { router } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { hapticEnd } from '@/native/haptics';
import { formatDuration, formatShortDuration } from '@/domain/timing/timeMath';
import { Intensity } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Body,
  Button,
  Caption1,
  EmptyState,
  Footnote,
  Headline,
  IconButton,
  MetricTile,
  Screen,
  SegmentedControl,
  Subhead,
  TextField,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

const intensityOptions: { key: Intensity; label: string }[] = [
  { key: 'mild', label: 'Mild' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'strong', label: 'Strong' },
  { key: 'cannot_talk_walk', label: "Can't talk" },
];

export default function TimerRoute() {
  const { colors, spacing, radii, typography } = useTheme();
  const { actions, busy, error, loading, now, providerRuleResult, snapshot, summary, urgentRuleResult } = useContractionApp();
  const [note, setNote] = useState('');
  const previousRuleMet = useRef(false);
  const active = Boolean(summary.activeEvent);
  const lastEvent = summary.lastEvent;

  const breath = useSharedValue(1);

  useEffect(() => {
    if (active) {
      breath.value = withRepeat(
        withTiming(1.015, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      breath.value = withTiming(1, { duration: 220 });
    }
  }, [active, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  useEffect(() => {
    setNote(lastEvent?.note ?? '');
  }, [lastEvent?.id, lastEvent?.note]);

  useEffect(() => {
    if (!active) {
      return;
    }
    void KeepAwake.activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      void KeepAwake.deactivateKeepAwake().catch(() => undefined);
    };
  }, [active]);

  useEffect(() => {
    if (providerRuleResult.met && !previousRuleMet.current) {
      void hapticEnd();
    }
    previousRuleMet.current = providerRuleResult.met;
  }, [providerRuleResult.met]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Subhead color="secondary">Opening local timer…</Subhead>
        </View>
      </Screen>
    );
  }

  if (!snapshot) {
    return (
      <Screen largeTitle="Timer">
        <View style={{ paddingHorizontal: spacing.base }}>
          <Body color="secondary" style={{ marginBottom: spacing.base }}>
            {error ?? 'The local timer could not be opened.'}
          </Body>
          <Button variant="filled" label="Retry" onPress={actions.reload} fullWidth />
        </View>
      </Screen>
    );
  }

  const urgentActive = urgentRuleResult.active;
  const resting = !active && summary.eventCount > 0;
  const stateLabel = active ? 'Now timing' : resting ? 'Resting' : 'Ready';
  const badgeBg = active ? colors.urgent : resting ? colors.systemFill : colors.tertiarySystemFill;
  const badgeColor = active ? colors.onUrgent : colors.label;
  const timerSeconds = active
    ? formatActiveDuration(summary.activeEvent?.startAt, now)
    : resting
      ? (summary.currentRestSeconds ?? 0)
      : 0;
  const timerLabel = formatDuration(timerSeconds);

  return (
    <Screen
      headerLeft={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton
            icon={Icons.Siren}
            label="Urgent"
            tone={urgentActive ? 'urgent' : 'neutral'}
            onPress={() => router.push('/urgent')}
          />
          <IconButton
            icon={Icons.Phone}
            label="Call"
            onPress={() => callNumber(snapshot.profile.careTeamPhone || snapshot.profile.birthLocationPhone)}
          />
          <IconButton icon={Icons.Share2} label="Share" onPress={() => router.push('/share')} />
          <IconButton icon={Icons.History} label="History" onPress={() => router.push('/history')} />
        </View>
      }
      headerRight={<IconButton icon={Icons.Settings} label="Settings" onPress={() => router.push('/settings')} />}
    >
      <View style={[styles.container, { paddingHorizontal: spacing.base, gap: spacing.base }]}>
        {urgentActive ? (
          <Animated.View entering={FadeIn.springify().damping(18).stiffness(180)} exiting={FadeOut.duration(160)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Urgent contact warning"
              onPress={() => router.push('/urgent')}
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
              <Headline color="onUrgent" style={{ flex: 1 }} numberOfLines={2}>
                {urgentRuleResult.message}
              </Headline>
              <Icons.ChevronRight color={colors.onUrgent} size={18} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={active ? 'End contraction' : 'Start contraction'}
          accessibilityHint="Toggles the contraction timer"
          disabled={busy}
          onPress={active ? actions.end : actions.start}
          style={({ pressed }) => [styles.heroPressable, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Animated.View style={[styles.hero, breathStyle]}>
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
              {active ? 'Tap anywhere to end' : summary.eventCount > 0 ? 'Tap anywhere to start the next' : 'Tap anywhere to start'}
            </Subhead>
          </Animated.View>
        </Pressable>

        <View style={[styles.metrics, { gap: spacing.sm }]}>
          <MetricTile label="Last duration" value={formatShortDuration(summary.lastDurationSeconds)} />
          <MetricTile label="Last interval" value={formatShortDuration(summary.lastIntervalSeconds)} />
          <MetricTile
            label="Avg last 5"
            value={formatShortDuration(summary.averageIntervalLast5Seconds)}
            accent={providerRuleResult.met}
          />
        </View>

        {!active && lastEvent ? (
          <View style={{ gap: spacing.sm }}>
            <Caption1 color="secondary" style={{ marginLeft: 4 }}>
              Last contraction
            </Caption1>
            <SegmentedControl
              options={intensityOptions}
              value={(lastEvent.intensity ?? 'mild') as Intensity}
              onChange={(intensity) => actions.updateEvent(lastEvent.id, { intensity })}
            />
            <TextField
              accessibilityLabel="Last contraction note"
              value={note}
              onChangeText={setNote}
              onBlur={() => actions.updateEvent(lastEvent.id, { note })}
              placeholder="Add a note"
            />
          </View>
        ) : !active && summary.eventCount === 0 ? (
          <EmptyState
            icon={Icons.TimerReset}
            title="Ready when you are"
            body="Tap the timer when a contraction begins."
          />
        ) : null}

        <View style={{ gap: spacing.xs, marginTop: 'auto', paddingTop: spacing.md }}>
          <Button
            variant={active ? 'destructive' : 'filled'}
            size="lg"
            label={active ? 'End contraction' : 'Start contraction'}
            onPress={active ? actions.end : actions.start}
            loading={busy}
            fullWidth
          />
          {snapshot.events.length > 0 ? (
            <Button
              variant="plain"
              size="sm"
              label="Undo last"
              leadingIcon={Icons.Undo2}
              onPress={actions.undo}
              disabled={busy}
              fullWidth
            />
          ) : null}
        </View>
      </View>
    </Screen>
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
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: {
    flexDirection: 'row',
  },
});
