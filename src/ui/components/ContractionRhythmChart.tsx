import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { buildRhythmSummary, DEFAULT_RHYTHM_WINDOW_MINUTES } from '@/domain/timing/rhythm';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { ContractionEvent, Intensity } from '@/domain/types';
import { Footnote, Subhead } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type ContractionRhythmChartProps = {
  events: ContractionEvent[];
  now: string;
  windowMinutes?: number;
  rangeStartAt?: string;
  rangeEndAt?: string;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  height?: number;
};

type PositionedPoint = {
  id: string;
  x: number;
  width: number;
  y: number;
  height: number;
  color: string;
  selected: boolean;
  active: boolean;
  intervalSeconds?: number;
};

type TimeLabel = {
  key: string;
  x: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
};

const MIN_CHART_WIDTH = 320;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 38;
const PLOT_LEFT = 14;
const PLOT_RIGHT = 40;
const MIN_BLOCK_WIDTH = 12;
const MAX_BLOCK_WIDTH = 20;
const MIN_BLOCK_HEIGHT = 14;
const MIN_HIT_SIZE = 44;
const HAIRLINE = StyleSheet.hairlineWidth;

export function ContractionRhythmChart({
  events,
  now,
  windowMinutes = DEFAULT_RHYTHM_WINDOW_MINUTES,
  rangeStartAt,
  rangeEndAt,
  selectedEventId,
  onSelectEvent,
  height = 196,
}: ContractionRhythmChartProps) {
  const { colors, radii, spacing } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const summary = useMemo(
    () => buildRhythmSummary(events, now, rangeStartAt || rangeEndAt ? { rangeStartAt, rangeEndAt } : windowMinutes),
    [events, now, rangeEndAt, rangeStartAt, windowMinutes],
  );
  const chartWidth = Math.max(MIN_CHART_WIDTH, Math.round(containerWidth || MIN_CHART_WIDTH));
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const baselineY = PLOT_TOP + plotHeight;

  const maxObservedSeconds = useMemo(
    () => summary.points.reduce((acc, point) => Math.max(acc, point.durationSeconds), 0),
    [summary.points],
  );
  const yMaxSeconds = useMemo(() => niceMaxDuration(Math.max(45, maxObservedSeconds * 1.18)), [maxObservedSeconds]);
  const yTicks = useMemo(() => niceDurationTicks(yMaxSeconds), [yMaxSeconds]);
  const xLabels = useMemo<TimeLabel[]>(
    () => buildTimeLabels(summary.windowStartMs, summary.windowEndMs, plotWidth),
    [plotWidth, summary.windowEndMs, summary.windowStartMs],
  );

  const positioned = useMemo<PositionedPoint[]>(
    () =>
      summary.points.map((point) => {
        const heightRatio = Math.min(1, point.durationSeconds / yMaxSeconds);
        const blockHeight = Math.max(MIN_BLOCK_HEIGHT, heightRatio * (plotHeight - 4));
        const naturalWidth = point.widthRatio * plotWidth;
        const visualWidth = Math.max(MIN_BLOCK_WIDTH, Math.min(MAX_BLOCK_WIDTH, naturalWidth));
        const rawX = PLOT_LEFT + point.startRatio * plotWidth;
        const x = Math.max(PLOT_LEFT, Math.min(PLOT_LEFT + plotWidth - visualWidth, rawX));
        return {
          id: point.event.id,
          x,
          width: visualWidth,
          y: PLOT_TOP + plotHeight - blockHeight,
          height: blockHeight,
          color: intensityColor(point.event.intensity, colors),
          selected: point.event.id === selectedEventId,
          active: point.active,
          intervalSeconds: point.intervalSeconds,
        };
      }),
    [colors, plotHeight, plotWidth, selectedEventId, summary.points, yMaxSeconds],
  );

  if (summary.eventCount < 2) {
    return (
      <View
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          borderRadius: radii.lg,
          backgroundColor: colors.secondarySystemGroupedBackground,
        }}
      >
        <Subhead style={{ textAlign: 'center', fontWeight: '600' }}>Need one more contraction</Subhead>
        <Footnote color="secondary" style={{ textAlign: 'center', marginTop: spacing.xs }}>
          Rhythm appears after there are at least two contractions in this session.
        </Footnote>
      </View>
    );
  }

  function onLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (Math.abs(nextWidth - containerWidth) > 1) {
      setContainerWidth(nextWidth);
    }
  }

  const yLabelX = PLOT_LEFT + plotWidth + 8;

  return (
    <View onLayout={onLayout} style={{ height, borderRadius: radii.lg, overflow: 'hidden' }}>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="rhythm-bar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect
          x={0}
          y={0}
          width={chartWidth}
          height={height}
          rx={radii.lg}
          fill={colors.secondarySystemGroupedBackground}
        />

        <G>
          {yTicks.map((tickSeconds) => {
            const y = baselineY - (tickSeconds / yMaxSeconds) * plotHeight;
            return (
              <G key={`y-${tickSeconds}`}>
                <Line
                  x1={PLOT_LEFT}
                  x2={PLOT_LEFT + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={colors.separator}
                  strokeWidth={HAIRLINE}
                />
                <SvgText
                  x={yLabelX}
                  y={y + 3}
                  fill={colors.tertiaryLabel}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="start"
                >
                  {formatDurationTick(tickSeconds)}
                </SvgText>
              </G>
            );
          })}
        </G>

        <Line
          x1={PLOT_LEFT}
          x2={PLOT_LEFT + plotWidth}
          y1={baselineY}
          y2={baselineY}
          stroke={colors.opaqueSeparator}
          strokeWidth={1}
        />

        <G>
          {positioned.map((point, index) => {
            const previous = positioned[index - 1];
            if (!previous || !point.intervalSeconds) {
              return null;
            }
            const gapStart = previous.x + previous.width;
            const gapWidth = point.x - gapStart;
            if (gapWidth < 44) {
              return null;
            }
            return (
              <SvgText
                key={`${point.id}:interval`}
                x={gapStart + gapWidth / 2}
                y={baselineY - 6}
                fill={colors.tertiaryLabel}
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {formatCompactInterval(point.intervalSeconds)}
              </SvgText>
            );
          })}
        </G>

        <G>
          {positioned.map((point) => {
            const cornerRadius = Math.min(point.width / 2, point.height / 2);
            return (
              <G key={point.id}>
                {point.selected ? (
                  <Rect
                    x={point.x - 3}
                    y={point.y - 3}
                    width={point.width + 6}
                    height={point.height + 6}
                    rx={cornerRadius + 3}
                    fill="none"
                    stroke={colors.label}
                    strokeWidth={1.75}
                    opacity={0.9}
                  />
                ) : null}
                <Rect
                  x={point.x}
                  y={point.y}
                  width={point.width}
                  height={point.height}
                  rx={cornerRadius}
                  fill={point.color}
                  opacity={point.active ? 0.72 : 1}
                />
                <Rect
                  x={point.x}
                  y={point.y}
                  width={point.width}
                  height={point.height}
                  rx={cornerRadius}
                  fill="url(#rhythm-bar)"
                  pointerEvents="none"
                />
                {point.active && !point.selected ? (
                  <Rect
                    x={point.x}
                    y={point.y}
                    width={point.width}
                    height={point.height}
                    rx={cornerRadius}
                    fill="none"
                    stroke={point.color}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                ) : null}
              </G>
            );
          })}
        </G>

        <G>
          {xLabels.map((label) => (
            <SvgText
              key={label.key}
              x={label.x}
              y={height - 12}
              fill={colors.tertiaryLabel}
              fontSize={11}
              fontWeight="500"
              textAnchor={label.anchor}
            >
              {label.text}
            </SvgText>
          ))}
        </G>

        <G>
          {positioned.map((point) => {
            const centerX = point.x + point.width / 2;
            const hitX = Math.max(PLOT_LEFT, Math.min(PLOT_LEFT + plotWidth - MIN_HIT_SIZE, centerX - MIN_HIT_SIZE / 2));
            return (
              <Rect
                key={`${point.id}:hit`}
                x={hitX}
                y={PLOT_TOP - 6}
                width={MIN_HIT_SIZE}
                height={plotHeight + 18}
                fill={colors.systemBackground}
                fillOpacity={0.01}
                onPress={() => onSelectEvent(point.id)}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

function niceMaxDuration(seconds: number): number {
  const candidates = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900, 1200];
  for (const candidate of candidates) {
    if (seconds <= candidate) {
      return candidate;
    }
  }
  return Math.ceil(seconds / 60) * 60;
}

function niceDurationTicks(maxSeconds: number): number[] {
  const candidates = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 600];
  let best = candidates[0];
  let bestScore = Infinity;
  for (const candidate of candidates) {
    if (maxSeconds % candidate !== 0 && maxSeconds / candidate < 1.5) {
      continue;
    }
    const count = Math.floor(maxSeconds / candidate);
    if (count < 2 || count > 5) {
      continue;
    }
    const score = Math.abs(count - 3);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  const ticks: number[] = [];
  for (let value = best; value <= maxSeconds + 0.5; value += best) {
    ticks.push(value);
  }
  return ticks;
}

function buildTimeLabels(windowStartMs: number, windowEndMs: number, plotWidth: number): TimeLabel[] {
  const tickCount = plotWidth < 360 ? 3 : plotWidth < 520 ? 4 : 5;
  const result: TimeLabel[] = [];
  for (let index = 0; index < tickCount; index++) {
    const ratio = index / (tickCount - 1);
    const ms = windowStartMs + ratio * (windowEndMs - windowStartMs);
    const x = PLOT_LEFT + ratio * plotWidth;
    const anchor: TimeLabel['anchor'] = index === 0 ? 'start' : index === tickCount - 1 ? 'end' : 'middle';
    result.push({ key: `${index}`, x, text: formatTimeOnly(new Date(ms)), anchor });
  }
  return result;
}

function formatCompactInterval(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.round(seconds / 60)}m`;
}

function formatDurationTick(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainder}s`;
}

function intensityColor(intensity: Intensity | undefined, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (intensity) {
    case 'mild':
      return colors.systemTeal;
    case 'moderate':
      return colors.systemOrange;
    case 'strong':
      return colors.systemRed;
    case 'cannot_talk_walk':
      return colors.urgent;
    default:
      return colors.systemTeal;
  }
}
