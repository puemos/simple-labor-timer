import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { buildRhythmSummary, DEFAULT_RHYTHM_WINDOW_MINUTES, type RhythmSummary } from '@/domain/timing/rhythm';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { ContractionEvent, Intensity } from '@/domain/types';
import { intensityColor } from '@/ui/components/intensity';
import { Caption2, Footnote, Subhead } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type ContractionRhythmChartProps = {
  events: ContractionEvent[];
  now: string;
  windowMinutes?: number;
  rangeStartAt?: string;
  rangeEndAt?: string;
  height?: number;
};

type RhythmDatum = {
  id: string;
  startMs: number;
  endMs: number;
  intensity: Intensity | undefined;
  active: boolean;
};

const MIN_PILL_WIDTH = 10;
const PILL_HEIGHT = 24;
const TRACK_TOP = 16;
const BASELINE_GAP = 8;
const MOUNT_DURATION_MS = 280;
const PULSE_DURATION_MS = 750;

export function ContractionRhythmChart({
  events,
  now,
  windowMinutes = DEFAULT_RHYTHM_WINDOW_MINUTES,
  rangeStartAt,
  rangeEndAt,
  height = 92,
}: ContractionRhythmChartProps) {
  const { colors, radii, spacing } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const summary = useMemo<RhythmSummary>(
    () => buildRhythmSummary(events, now, rangeStartAt || rangeEndAt ? { rangeStartAt, rangeEndAt } : windowMinutes),
    [events, now, rangeEndAt, rangeStartAt, windowMinutes],
  );

  const data = useMemo<RhythmDatum[]>(() => {
    const nowMs = Date.parse(now);
    return summary.points.map((point) => {
      const startMs = Date.parse(point.event.startAt);
      const endMs = point.event.endAt ? Date.parse(point.event.endAt) : nowMs;
      return {
        id: point.event.id,
        startMs,
        endMs: Math.max(startMs, endMs),
        intensity: point.event.intensity,
        active: point.active,
      };
    });
  }, [now, summary.points]);

  const windowSpanMs = Math.max(1, summary.windowEndMs - summary.windowStartMs);
  const hasActive = data.some((d) => d.active);

  const mount = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      mount.value = 1;
      return;
    }
    mount.value = 0;
    mount.value = withTiming(1, { duration: MOUNT_DURATION_MS });
  }, [data.length, mount, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !hasActive) {
      pulse.value = 1;
      return;
    }
    pulse.value = 0.85;
    pulse.value = withRepeat(withTiming(0.65, { duration: PULSE_DURATION_MS }), -1, true);
  }, [hasActive, pulse, reduceMotion]);

  const pillFillStyle = useAnimatedStyle(() => ({ opacity: mount.value }));
  const pillActiveStyle = useAnimatedStyle(() => ({ opacity: mount.value * pulse.value }));

  if (summary.eventCount < 2) {
    return (
      <View
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          borderRadius: radii.lg,
          backgroundColor: colors.tertiarySystemFill,
        }}
      >
        <Subhead style={{ textAlign: 'center', fontWeight: '600' }}>Need one more contraction</Subhead>
        <Footnote color="secondary" style={{ textAlign: 'center', marginTop: spacing.xs }}>
          Rhythm appears after there are at least two contractions in this session.
        </Footnote>
      </View>
    );
  }

  const tickCount = trackWidth < 320 ? 3 : trackWidth < 480 ? 4 : 5;
  const baselineY = TRACK_TOP + PILL_HEIGHT + BASELINE_GAP;
  const axisLabelTop = baselineY + 4;

  const computePillX = (startMs: number) =>
    trackWidth <= 0 ? 0 : ((startMs - summary.windowStartMs) / windowSpanMs) * trackWidth;
  const computePillWidth = (startMs: number, endMs: number) => {
    if (trackWidth <= 0) return MIN_PILL_WIDTH;
    const natural = ((endMs - startMs) / windowSpanMs) * trackWidth;
    return Math.max(MIN_PILL_WIDTH, natural);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next !== trackWidth) setTrackWidth(next);
  };

  return (
    <View onLayout={onLayout} style={{ height, position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: baselineY,
          height: 1,
          backgroundColor: colors.separator,
        }}
      />

      {trackWidth > 0
        ? data.map((datum) => {
            const left = computePillX(datum.startMs);
            const width = computePillWidth(datum.startMs, datum.endMs);
            const clampedLeft = Math.max(0, Math.min(trackWidth - width, left));
            return (
              <Animated.View
                key={datum.id}
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    left: clampedLeft,
                    top: TRACK_TOP,
                    width,
                    height: PILL_HEIGHT,
                    borderRadius: PILL_HEIGHT / 2,
                    backgroundColor: intensityColor(datum.intensity, colors),
                  },
                  datum.active ? pillActiveStyle : pillFillStyle,
                ]}
              />
            );
          })
        : null}

      {trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: axisLabelTop,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          {Array.from({ length: tickCount }, (_, i) => {
            const ratio = i / (tickCount - 1);
            const tickMs = summary.windowStartMs + ratio * windowSpanMs;
            return (
              <Caption2 key={i} color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                {formatTimeOnly(new Date(tickMs))}
              </Caption2>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
