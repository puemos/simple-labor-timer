import { classifyPattern } from '@/domain/timing/patternLabels';
import {
  activeEvent,
  average,
  endedEvents,
  eventDurationSeconds,
  eventIntervalSeconds,
  parseIso,
  secondsBetween,
  visibleEvents,
} from '@/domain/timing/timeMath';
import { ContractionEvent, ContractionSession, SessionSummary } from '@/domain/types';

function intervalSeries(events: ContractionEvent[]): number[] {
  return events
    .map((event, index) => eventIntervalSeconds(event, events[index - 1]))
    .filter((value): value is number => value !== undefined);
}

function durationSeries(events: ContractionEvent[], now: string): number[] {
  return events
    .map((event) => eventDurationSeconds(event, now))
    .filter((value): value is number => value !== undefined);
}

export function computeSessionSummary(
  events: ContractionEvent[],
  now: string,
  session?: ContractionSession,
): SessionSummary {
  const visible = visibleEvents(events);
  const ended = endedEvents(events);
  const active = activeEvent(events);
  const last = ended.at(-1);
  const durations = durationSeries(ended, now);
  const intervals = intervalSeries(visible);
  const oneHourAgo = parseIso(now) - 60 * 60_000;
  const lastHourVisible = visible.filter((event) => parseIso(event.startAt) >= oneHourAgo);
  const lastHourEnded = ended.filter((event) => parseIso(event.startAt) >= oneHourAgo);
  const lastHourDurations = durationSeries(lastHourEnded, now);
  const lastHourIntervals = intervalSeries(lastHourVisible);
  const startAt = session?.startedAt ?? visible.at(0)?.startAt ?? now;
  const sessionEnd = session?.endedAt ?? now;

  return {
    eventCount: ended.length,
    activeEvent: active,
    lastEvent: last,
    lastDurationSeconds: last ? eventDurationSeconds(last, now) : undefined,
    lastIntervalSeconds: visible.length >= 2 ? intervals.at(-1) : undefined,
    currentIntervalSeconds: visible.at(-1) ? secondsBetween(visible.at(-1)!.startAt, now) : undefined,
    currentRestSeconds: !active && last?.endAt ? secondsBetween(last.endAt, now) : undefined,
    averageDurationLast3Seconds: average(durations.slice(-3)),
    averageDurationLast5Seconds: average(durations.slice(-5)),
    averageIntervalLast3Seconds: average(intervals.slice(-3)),
    averageIntervalLast5Seconds: average(intervals.slice(-5)),
    averageDurationLastHourSeconds: average(lastHourDurations),
    averageIntervalLastHourSeconds: average(lastHourIntervals),
    shortestIntervalLastHourSeconds: lastHourIntervals.length ? Math.min(...lastHourIntervals) : undefined,
    longestDurationSeconds: durations.length ? Math.max(...durations) : undefined,
    sessionDurationSeconds: secondsBetween(startAt, sessionEnd),
    pattern: classifyPattern(intervals),
  };
}
