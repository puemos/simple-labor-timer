import { formatDateTime } from '@/domain/timing/dateFormat';
import { endedEvents, eventDurationSeconds, eventIntervalSeconds, eventRestGapSeconds } from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';

function escapeCsv(value: string | number | boolean | undefined): string {
  if (value === undefined) {
    return '';
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildContractionCsv(events: ContractionEvent[], now: string): string {
  const ended = endedEvents(events);
  const rows = [
    [
      'start_at',
      'end_at',
      'duration_seconds',
      'interval_start_to_start_seconds',
      'rest_gap_seconds',
      'intensity',
      'note',
      'manually_edited',
      'clock_change_suspected',
    ],
    ...ended.map((event, index) => {
      const previous = ended[index - 1];
      return [
        formatDateTime(event.startAt),
        formatDateTime(event.endAt),
        eventDurationSeconds(event, now),
        eventIntervalSeconds(event, previous),
        eventRestGapSeconds(event, previous),
        event.intensity,
        event.note,
        event.manuallyEdited,
        event.clockChangeSuspected,
      ];
    }),
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}
