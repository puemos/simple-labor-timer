import { patternText } from '@/domain/timing/patternLabels';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { endedEvents, formatShortDuration } from '@/domain/timing/timeMath';
import {
  ContractionEvent,
  ContractionSession,
  PregnancyProfile,
  ProviderRuleResult,
  UrgentEvent,
} from '@/domain/types';
import { CONTENT_VERSION } from '@/domain/appConstants';

export type SummaryExportInput = {
  session?: ContractionSession;
  profile: PregnancyProfile;
  events: ContractionEvent[];
  urgentEvents: UrgentEvent[];
  providerRuleResult?: ProviderRuleResult;
  now: string;
  appVersion: string;
  includeNotes: boolean;
  includeUrgentEvents: boolean;
};

export function buildSummaryText(input: SummaryExportInput): string {
  const summary = computeSessionSummary(input.events, input.now, input.session);
  const ended = endedEvents(input.events);
  const notes = input.includeNotes
    ? ended
        .filter((event) => event.note || event.intensity)
        .map((event) => {
          const pieces = [event.intensity ? `intensity ${event.intensity.replaceAll('_', ' ')}` : undefined, event.note]
            .filter(Boolean)
            .join('; ');
          return `- ${new Date(event.startAt).toLocaleString()}: ${pieces}`;
        })
    : [];
  const urgent = input.includeUrgentEvents
    ? input.urgentEvents.map((event) => `- ${new Date(event.occurredAt).toLocaleString()}: ${event.type.replaceAll('_', ' ')}`)
    : [];

  const lines = [
    'Contraction summary',
    `Started: ${input.session ? new Date(input.session.startedAt).toLocaleString() : 'No active session'}`,
    `Contractions recorded: ${summary.eventCount}`,
    `Last contraction: ${formatShortDuration(summary.lastDurationSeconds)}`,
    `Last interval: ${formatShortDuration(summary.lastIntervalSeconds)} start-to-start`,
    `Last 5 average: ${formatShortDuration(summary.averageDurationLast5Seconds)} long, ${formatShortDuration(
      summary.averageIntervalLast5Seconds,
    )} apart`,
    `Pattern: ${patternText(summary.pattern)}`,
    input.providerRuleResult?.met ? 'Saved call rule: matched' : 'Saved call rule: not matched',
    `Care team: ${input.profile.careTeamPhone || 'not saved'}`,
    `Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `App version: ${input.appVersion}; content version: ${CONTENT_VERSION}`,
    'Recorded by user; not a medical diagnosis.',
  ];

  if (notes.length) {
    lines.push('', 'Notes', ...notes);
  }

  if (urgent.length) {
    lines.push('', 'Urgent events', ...urgent);
  }

  const edited = ended.filter((event) => event.manuallyEdited);
  if (edited.length) {
    lines.push('', `Manual edits: ${edited.length} contraction record(s) edited.`);
  }

  return lines.join('\n');
}

export function summaryTextToHtml(text: string): string {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br/>');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;line-height:1.45;color:#111827;padding:24px}h1{font-size:24px}</style></head><body><h1>Contraction summary</h1><p>${escaped}</p></body></html>`;
}
