import { router } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { buildRhythmSummary, defaultRhythmSelectedEventId } from '@/domain/timing/rhythm';
import { formatDuration, formatShortDuration } from '@/domain/timing/timeMath';
import { ContractionEvent, Intensity } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Body,
  Button,
  Footnote,
  Headline,
  IconButton,
  MetricTile,
  RhythmSummaryRow,
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

const REVIEW_SHEET_AUTO_CLOSE_MS = 6000;

export default function TimerRoute() {
  const { colors, scheme, spacing, radii, shadows, typography } = useTheme();
  const { actions, busy, error, loading, now, providerRuleResult, snapshot, summary, urgentRuleResult } = useContractionApp();
  const [note, setNote] = useState('');
  const [reviewEventId, setReviewEventId] = useState<string>();
  const [reviewInteracted, setReviewInteracted] = useState(false);
  const previousRuleMet = useRef(false);
  const wasMeasuring = useRef(false);
  const measuring = summary.timerState === 'measuring';
  const resting = summary.timerState === 'resting';
  const lastEvent = summary.lastEvent;
  const reviewEvent = resting && lastEvent?.id === reviewEventId ? lastEvent : undefined;

  const breath = useSharedValue(1);

  useEffect(() => {
    if (measuring) {
      breath.value = withRepeat(
        withTiming(1.015, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      breath.value = withTiming(1, { duration: 220 });
    }
  }, [measuring, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  useEffect(() => {
    setNote(lastEvent?.note ?? '');
  }, [lastEvent?.id, lastEvent?.note]);

  useEffect(() => {
    if (wasMeasuring.current && resting && lastEvent) {
      setNote(lastEvent.note ?? '');
      setReviewEventId(lastEvent.id);
      setReviewInteracted(false);
    }
    wasMeasuring.current = measuring;
  }, [lastEvent, measuring, resting]);

  const reviewEventIdToSave = reviewEvent?.id;
  const dismissReview = useCallback(() => {
    if (reviewEventIdToSave) {
      void actions.updateEvent(reviewEventIdToSave, { note });
    }
    setReviewEventId(undefined);
    setReviewInteracted(false);
  }, [actions, note, reviewEventIdToSave]);

  useEffect(() => {
    if (!reviewEventIdToSave || reviewInteracted) {
      return;
    }

    const timeout = setTimeout(dismissReview, REVIEW_SHEET_AUTO_CLOSE_MS);
    return () => clearTimeout(timeout);
  }, [dismissReview, reviewEventIdToSave, reviewInteracted]);

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

  function handleTimerPress() {
    if (measuring) {
      void actions.end();
      return;
    }

    dismissReview();
    void actions.start();
  }

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
  const stateLabel = measuring ? 'Now timing' : resting ? 'Resting' : 'Idle';
  const timerActionLabel = measuring ? 'End contraction' : 'Start contraction';
  const badgeBg = measuring ? colors.urgent : colors.systemFill;
  const badgeColor = measuring ? colors.onUrgent : colors.label;
  const heroBackground = measuring
    ? scheme === 'dark'
      ? 'rgba(255, 69, 58, 0.18)'
      : 'rgba(255, 59, 48, 0.08)'
    : scheme === 'dark'
      ? 'rgba(10, 132, 255, 0.16)'
      : 'rgba(0, 122, 255, 0.06)';
  const heroBorderColor = measuring ? colors.urgent : colors.accent;
  const actionBackground = measuring ? colors.urgent : colors.accent;
  const actionLabelColor = measuring ? colors.onUrgent : colors.onAccent;
  const timerSeconds = measuring
    ? formatActiveDuration(summary.activeEvent?.startAt, now)
    : resting
      ? (summary.currentRestSeconds ?? 0)
      : 0;
  const timerLabel = formatDuration(timerSeconds);
  const rhythmRangeStartAt = snapshot.activeSession?.startedAt ?? snapshot.events[0]?.startAt;
  const rhythmSummary = buildRhythmSummary(snapshot.events, now, { rangeStartAt: rhythmRangeStartAt, rangeEndAt: now });

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
          accessibilityLabel={timerActionLabel}
          accessibilityHint="Toggles the contraction timer"
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
          <Animated.View
            style={[
              styles.hero,
              {
                backgroundColor: heroBackground,
                borderColor: heroBorderColor,
                borderRadius: 42,
                ...shadows.card,
              },
              breathStyle,
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
              {measuring ? 'Tap anywhere to end' : resting ? 'Tap anywhere to start the next' : 'Tap anywhere to start'}
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
              <Headline color={measuring ? 'onUrgent' : 'onAccent'} numberOfLines={1} style={styles.heroActionLabel}>
                {timerActionLabel}
              </Headline>
            </View>
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

        {rhythmSummary.eventCount > 0 ? (
          <RhythmSummaryRow
            summary={rhythmSummary}
            disabled={rhythmSummary.eventCount < 2}
            sourceLabel="Current session"
            onPress={() =>
              router.push({
                pathname: '/rhythm',
                params: { selectedEventId: defaultRhythmSelectedEventId(rhythmSummary) },
              })
            }
          />
        ) : null}

        <View style={{ gap: spacing.xs, marginTop: 'auto', paddingTop: spacing.md }}>
          {resting ? (
            <Button
              variant="gray"
              size="sm"
              label="Finish session"
              leadingIcon={Icons.Flag}
              onPress={actions.closeSession}
              disabled={busy}
              fullWidth
            />
          ) : null}
          {resting && snapshot.events.length > 0 ? (
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

        <ContractionReviewSheet
          event={reviewEvent}
          note={note}
          onClose={dismissReview}
          onInteraction={() => setReviewInteracted(true)}
          onIntensityChange={(intensity) => {
            setReviewInteracted(true);
            if (reviewEvent) {
              void actions.updateEvent(reviewEvent.id, { intensity });
            }
          }}
          onNoteBlur={() => {
            if (reviewEvent) {
              void actions.updateEvent(reviewEvent.id, { note });
            }
          }}
          onNoteChange={(value) => {
            setReviewInteracted(true);
            setNote(value);
          }}
        />
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

type ContractionReviewSheetProps = {
  event?: ContractionEvent;
  note: string;
  onClose: () => void;
  onInteraction: () => void;
  onIntensityChange: (intensity: Intensity) => void;
  onNoteBlur: () => void;
  onNoteChange: (value: string) => void;
};

function ContractionReviewSheet({
  event,
  note,
  onClose,
  onInteraction,
  onIntensityChange,
  onNoteBlur,
  onNoteChange,
}: ContractionReviewSheetProps) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [noteFocused, setNoteFocused] = useState(false);
  const bottomClearance = Math.max(insets.bottom + spacing.lg, spacing.xxxxl);

  useEffect(() => {
    if (!event) {
      setNoteFocused(false);
    }
  }, [event]);

  return (
    <Modal transparent visible={Boolean(event)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close contraction review" style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.sheetHost}
        >
          <View
            style={[
              styles.reviewSheet,
              {
                backgroundColor: colors.secondarySystemBackground,
                borderTopLeftRadius: radii.xxl,
                borderTopRightRadius: radii.xxl,
                paddingHorizontal: spacing.base,
                paddingTop: spacing.md,
                paddingBottom: bottomClearance,
                gap: spacing.sm,
                marginBottom: noteFocused ? spacing.xxl : 0,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.tertiaryLabel, marginBottom: spacing.xs }]} />
            <View style={styles.sheetHeader}>
              <Headline>Last contraction</Headline>
              <Button variant="plain" size="sm" label="Done" onPress={onClose} />
            </View>
            <SegmentedControl
              options={intensityOptions}
              value={(event?.intensity ?? 'mild') as Intensity}
              onChange={onIntensityChange}
            />
            <TextField
              accessibilityLabel="Last contraction note"
              value={note}
              onBlur={() => {
                setNoteFocused(false);
                onNoteBlur();
              }}
              onChangeText={onNoteChange}
              onFocus={() => {
                setNoteFocused(true);
                onInteraction();
              }}
              placeholder="Add a note"
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  heroPressable: {
    flexBasis: 340,
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    maxHeight: 430,
    minHeight: 280,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 280,
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
  metrics: {
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    width: 36,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  reviewSheet: {
    alignSelf: 'stretch',
    maxHeight: '70%',
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
