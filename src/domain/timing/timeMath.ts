import { ContractionEvent } from '@/domain/types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseIso(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return ms;
}

export function secondsBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((parseIso(endIso) - parseIso(startIso)) / 1000));
}

export function eventDurationSeconds(event: ContractionEvent, now = nowIso()): number | undefined {
  const endAt = event.endAt ?? now;
  return secondsBetween(event.startAt, endAt);
}

export function eventIntervalSeconds(
  current: ContractionEvent,
  previous?: ContractionEvent,
): number | undefined {
  if (!previous) {
    return undefined;
  }
  return secondsBetween(previous.startAt, current.startAt);
}

export function eventRestGapSeconds(
  current: ContractionEvent,
  previous?: ContractionEvent,
): number | undefined {
  if (!previous?.endAt) {
    return undefined;
  }
  return secondsBetween(previous.endAt, current.startAt);
}

export function visibleEvents(events: ContractionEvent[]): ContractionEvent[] {
  return [...events]
    .filter((event) => !event.deletedAt)
    .sort((a, b) => parseIso(a.startAt) - parseIso(b.startAt));
}

export function endedEvents(events: ContractionEvent[]): ContractionEvent[] {
  return visibleEvents(events).filter((event) => Boolean(event.endAt));
}

export function activeEvent(events: ContractionEvent[]): ContractionEvent | undefined {
  return visibleEvents(events).find((event) => !event.endAt);
}

export function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function formatDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined) {
    return '--';
  }
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatShortDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined) {
    return '--';
  }
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export function minutesAgo(minutes: number, now = nowIso()): string {
  return new Date(parseIso(now) - minutes * 60_000).toISOString();
}

export function startOfLocalDayIso(now = new Date()): string {
  const local = new Date(now);
  local.setHours(0, 0, 0, 0);
  return local.toISOString();
}
