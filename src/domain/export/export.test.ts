import { describe, expect, it } from 'vitest';
import { buildSummaryPdfHtml, buildSummaryText } from '@/domain/export/summaryText';
import { ContractionEvent, PregnancyProfile, ProviderRuleResult, UrgentEvent } from '@/domain/types';

const profile: PregnancyProfile = {
  id: 'profile',
  region: 'US',
  careTeamPhone: '+1 555 0100',
  emergencyPhone: '911',
  plannedCesarean: false,
  highRiskOrCallEarly: false,
  createdAt: '2026-05-10T02:00:00.000Z',
  updatedAt: '2026-05-10T02:00:00.000Z',
};

const matchedRule: ProviderRuleResult = {
  met: true,
  label: '5-1-1',
  message: 'This matches your saved call rule. Contact your care team.',
  sourceIds: ['S2'],
  matchedEventIds: ['event_1', 'event_2'],
};

describe('summary text export', () => {
  it('formats a WhatsApp-friendly timeline with notes colocated', () => {
    const text = buildSummaryText({
      profile,
      events: [
        makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60, { note: 'lower back pressure', intensity: 'strong' }),
        makeEvent('event_2', '2026-05-10T02:05:00.000Z', 65),
      ],
      urgentEvents: [],
      providerRuleResult: matchedRule,
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Current session',
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
    });

    expect(text).toContain('Contraction update');
    expect(text).toContain('Covers: Current session');
    expect(text).toContain('Averages, last 5');
    expect(text).toContain('Contraction: 1m');
    expect(text).toContain('Rest: 4m');
    expect(text).toContain('Intensity: strong');
    expect(text).toContain('Note: lower back pressure');
    expect(text).toContain('Saved rule: 5-1-1');
    expect(text).toContain('Status: matched');
    expect(text).not.toContain('\nNotes\n');
  });

  it('honors privacy toggles for notes and urgent events', () => {
    const text = buildSummaryText({
      profile,
      events: [makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60, { note: 'private note' })],
      urgentEvents: [urgentEvent],
      providerRuleResult: { ...matchedRule, met: false },
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Today',
      appVersion: '1.0.0',
      includeNotes: false,
      includeUrgentEvents: false,
    });

    expect(text).not.toContain('Note: private note');
    expect(text).not.toContain('Urgent events');
    expect(text).toContain('Status: not matched');
  });

  it('discloses manual edits without exposing CSV language', () => {
    const text = buildSummaryText({
      profile,
      events: [makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60, { manuallyEdited: true })],
      urgentEvents: [urgentEvent],
      providerRuleResult: undefined,
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Last 24 hours',
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
    });

    expect(text).toContain('Urgent events');
    expect(text).toContain('Manual edits: 1 contraction record(s) edited');
    expect(text).toContain('Saved rule: not saved');
    expect(text).not.toMatch(/csv|spreadsheet/i);
  });
});

describe('summary PDF export', () => {
  it('renders a warm structured report with cards, averages, timeline, call rule, and urgent events', () => {
    const html = buildSummaryPdfHtml({
      profile,
      events: [
        makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60),
        makeEvent('event_2', '2026-05-10T02:05:00.000Z', 65),
      ],
      urgentEvents: [urgentEvent],
      providerRuleResult: matchedRule,
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Current session',
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
    });

    expect(html).toContain('Private share report');
    expect(html).toContain('aria-label="At a glance"');
    expect(html).toContain('Last 5 averages');
    expect(html).toContain('<table>');
    expect(html).toContain('<th class="metric">Rest after</th>');
    expect(html).toContain('Call rule');
    expect(html).toContain('Urgent events');
    expect(html).toContain('Files are generated locally');
  });

  it('keeps notes and intensity in the same timeline row and escapes user text', () => {
    const html = buildSummaryPdfHtml({
      profile,
      events: [
        makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60, {
          intensity: 'cannot_talk_walk',
          note: '<call & go>',
        }),
      ],
      urgentEvents: [],
      providerRuleResult: matchedRule,
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Current session',
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
    });

    expect(html).toMatch(/<tr>[\s\S]*Intensity: cannot talk walk[\s\S]*Note: &lt;call &amp; go&gt;[\s\S]*<\/tr>/);
    expect(html).not.toContain('Note: <call & go>');
  });

  it('omits urgent events from PDF when the privacy toggle is off', () => {
    const html = buildSummaryPdfHtml({
      profile,
      events: [makeEvent('event_1', '2026-05-10T02:00:00.000Z', 60)],
      urgentEvents: [urgentEvent],
      providerRuleResult: matchedRule,
      now: '2026-05-10T02:10:00.000Z',
      rangeLabel: 'Today',
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: false,
    });

    expect(html).not.toContain('Urgent events');
    expect(html).not.toContain('Waters broke');
  });
});

function makeEvent(
  id: string,
  startAt: string,
  durationSeconds: number,
  patch: Partial<ContractionEvent> = {},
): ContractionEvent {
  const endAt = new Date(Date.parse(startAt) + durationSeconds * 1000).toISOString();
  return {
    id,
    sessionId: 'session',
    startAt,
    endAt,
    timezone: 'Europe/Rome',
    manuallyEdited: false,
    clockChangeSuspected: false,
    createdAt: startAt,
    updatedAt: endAt,
    ...patch,
  };
}

const urgentEvent: UrgentEvent = {
  id: 'urgent_1',
  sessionId: 'session',
  type: 'water_broke',
  occurredAt: '2026-05-10T02:03:00.000Z',
  timezone: 'Europe/Rome',
  sourceIds: [],
  consentToRecord: true,
  contentVersion: '1',
  createdAt: '2026-05-10T02:03:00.000Z',
};
