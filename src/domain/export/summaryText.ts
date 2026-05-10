import { patternText } from '@/domain/timing/patternLabels';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { formatDateOnly, formatTimeOnly } from '@/domain/timing/dateFormat';
import {
  average,
  endedEvents,
  eventDurationSeconds,
  eventRestGapSeconds,
  formatShortDuration,
  secondsBetween,
  visibleEvents,
} from '@/domain/timing/timeMath';
import {
  ContractionEvent,
  ContractionSession,
  Intensity,
  PregnancyProfile,
  ProviderRuleResult,
  UrgentEvent,
  UrgentType,
} from '@/domain/types';

export type SummaryExportInput = {
  session?: ContractionSession;
  profile: PregnancyProfile;
  events: ContractionEvent[];
  urgentEvents: UrgentEvent[];
  providerRuleResult?: ProviderRuleResult;
  now: string;
  rangeLabel: string;
  appVersion: string;
  includeNotes: boolean;
  includeUrgentEvents: boolean;
};

export function buildSummaryText(input: SummaryExportInput): string {
  const { averageRestLast5Seconds, ended, sessionEnded, startedAt, summary, visible } = buildSummaryModel(input);

  const lines = [
    'Contraction update',
    `Recorded: ${formatRecordedDateTime(input.now)}`,
    `Covers: ${input.rangeLabel}`,
    '',
    'Summary',
    `Started: ${startedAt ? formatShareDateTime(startedAt, input.now) : 'No contractions'}`,
    `Contractions: ${formatContractionCount(summary.eventCount, Boolean(summary.activeEvent))}`,
    `Pattern: ${patternText(summary.pattern)}`,
    '',
    'Averages, last 5',
    `Contraction: ${formatShortDuration(summary.averageDurationLast5Seconds)}`,
    `Rest: ${formatShortDuration(averageRestLast5Seconds)}`,
    `Frequency: ${formatShortDuration(summary.averageIntervalLast5Seconds)} start-to-start`,
  ];

  lines.push('', 'Recent timings');
  const timingBlocks = recentTimingBlocks(visible, input.now, input.includeNotes, sessionEnded);
  if (timingBlocks.length) {
    lines.push(...timingBlocks);
  } else {
    lines.push('No contractions recorded.');
  }

  lines.push('', 'Call rule', ...callRuleLines(input.providerRuleResult, input.profile));

  const urgent = input.includeUrgentEvents ? urgentEventLines(input.urgentEvents, input.now) : [];
  if (urgent.length) {
    lines.push('', 'Urgent events', ...urgent);
  }

  const edited = ended.filter((event) => event.manuallyEdited);
  if (edited.length) {
    lines.push('', `Manual edits: ${edited.length} contraction record(s) edited`);
  }

  lines.push('', 'Recorded by me in Contraction Timer.', 'Not medical advice.');

  return lines.join('\n');
}

export function buildSummaryPdfHtml(input: SummaryExportInput): string {
  const { averageRestLast5Seconds, ended, sessionEnded, startedAt, summary, visible } = buildSummaryModel(input);
  const urgent = input.includeUrgentEvents ? input.urgentEvents : [];
  const editedCount = ended.filter((event) => event.manuallyEdited).length;
  const callRule = callRuleModel(input.providerRuleResult, input.profile);
  const ruleClass = callRule.status === 'matched' ? 'status-good' : 'status-neutral';
  const timelineRows = visible.length
    ? visible.map((event, index) => pdfTimelineRow(event, visible[index + 1], input, sessionEnded)).join('')
    : `<tr><td colspan="4" class="empty">No contractions recorded.</td></tr>`;
  const urgentSection = urgent.length
    ? `<section class="section"><h2>Urgent events</h2><div class="event-list">${urgent.map((event) => pdfUrgentEvent(event, input.now)).join('')}</div></section>`
    : '';
  const editsNote = editedCount ? `<p class="quiet">Manual edits: ${editedCount} contraction record(s) edited.</p>` : '';

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @page { margin: 30px; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fffaf7;
      color: #27201d;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 28px;
      background: #fffdfb;
    }
    .header {
      padding: 24px;
      border-radius: 18px;
      background: linear-gradient(135deg, #fff1ec 0%, #fffaf7 58%, #eef7f3 100%);
      border: 1px solid #f0d8d0;
      margin-bottom: 20px;
    }
    .eyebrow {
      color: #9b5c53;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin: 0 0 8px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 30px;
      line-height: 1.1;
      margin: 0 0 12px;
      color: #241916;
    }
    h2 {
      font-size: 16px;
      line-height: 1.2;
      margin: 0 0 12px;
      color: #342521;
    }
    .meta {
      color: #6d5a54;
      display: grid;
      gap: 4px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .card {
      border: 1px solid #ead8d1;
      border-radius: 14px;
      padding: 14px;
      background: #ffffff;
      min-height: 84px;
    }
    .card-label {
      color: #806861;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .card-value {
      color: #2d211e;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.2;
    }
    .section {
      background: #ffffff;
      border: 1px solid #ead8d1;
      border-radius: 16px;
      margin-bottom: 18px;
      padding: 18px;
      page-break-inside: avoid;
    }
    .average-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .average {
      background: #fff7f3;
      border-radius: 12px;
      padding: 12px;
    }
    .average strong {
      display: block;
      color: #8b524b;
      font-size: 11px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .average span {
      color: #2d211e;
      font-size: 18px;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th {
      color: #7a625b;
      font-size: 11px;
      letter-spacing: 0.04em;
      padding: 0 8px 8px;
      text-align: left;
      text-transform: uppercase;
      border-bottom: 1px solid #ead8d1;
    }
    td {
      padding: 13px 8px;
      border-bottom: 1px solid #f1e4df;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #fffaf7; }
    .time { width: 24%; font-weight: 700; color: #33231f; }
    .metric { width: 20%; color: #33231f; }
    .detail { width: 36%; color: #4b3d38; }
    .detail-line + .detail-line { margin-top: 4px; }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 700;
    }
    .status-good { background: #e9f6ef; color: #236246; }
    .status-neutral { background: #edf3fb; color: #31597d; }
    .event-list {
      display: grid;
      gap: 8px;
    }
    .event {
      border-left: 3px solid #d77a6b;
      padding: 8px 10px;
      background: #fff7f3;
      border-radius: 10px;
    }
    .empty, .quiet, .footer {
      color: #806861;
    }
    .footer {
      border-top: 1px solid #ead8d1;
      margin-top: 20px;
      padding-top: 14px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <p class="eyebrow">Private share report</p>
      <h1>Contraction update</h1>
      <div class="meta">
        <div>Recorded: ${escapeHtml(formatRecordedDateTime(input.now))}</div>
        <div>Covers: ${escapeHtml(input.rangeLabel)}</div>
      </div>
    </header>

    <section class="cards" aria-label="At a glance">
      ${pdfMetricCard('Contractions', formatContractionCount(summary.eventCount, Boolean(summary.activeEvent)))}
      ${pdfMetricCard('Pattern', patternText(summary.pattern))}
      ${pdfMetricCard('Started', startedAt ? formatShareDateTime(startedAt, input.now) : 'No contractions')}
      ${pdfMetricCard('Call rule', callRule.statusLabel, ruleClass)}
    </section>

    <section class="section">
      <h2>Last 5 averages</h2>
      <div class="average-grid">
        ${pdfAverage('Contraction', formatShortDuration(summary.averageDurationLast5Seconds))}
        ${pdfAverage('Rest', formatShortDuration(averageRestLast5Seconds))}
        ${pdfAverage('Frequency', `${formatShortDuration(summary.averageIntervalLast5Seconds)} start-to-start`)}
      </div>
    </section>

    <section class="section">
      <h2>Timeline</h2>
      <table>
        <thead>
          <tr>
            <th class="time">Time</th>
            <th class="metric">Contraction</th>
            <th class="metric">Rest after</th>
            <th class="detail">Notes</th>
          </tr>
        </thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Call rule</h2>
      <p><span class="pill ${ruleClass}">${escapeHtml(callRule.statusLabel)}</span></p>
      <p>Saved rule: ${escapeHtml(callRule.ruleLabel)}</p>
      ${callRule.careTeam ? `<p>Care team: ${escapeHtml(callRule.careTeam)}</p>` : ''}
    </section>

    ${urgentSection}
    ${editsNote}

    <footer class="footer">
      Files are generated locally. No upload, account, or share link is created.<br/>
      Recorded by me in Contraction Timer. Not medical advice.
    </footer>
  </main>
</body>
</html>`;
}

export function summaryTextToHtml(text: string): string {
  const [title = 'Contraction update', ...body] = text.split('\n');
  const escapedTitle = escapeHtml(title);
  const escapedBody = escapeHtml(body.join('\n'));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;line-height:1.5;color:#111827;padding:28px}h1{font-size:24px;line-height:1.2;margin:0 0 18px}.content{font-size:15px;white-space:pre-wrap}</style></head><body><h1>${escapedTitle}</h1><div class="content">${escapedBody}</div></body></html>`;
}

function buildSummaryModel(input: SummaryExportInput) {
  const summary = computeSessionSummary(input.events, input.now, input.session);
  const visible = visibleEvents(input.events);
  const ended = endedEvents(input.events);
  const startedAt = input.session?.startedAt ?? ended.at(0)?.startAt;
  const sessionEnded = Boolean(input.session?.endedAt);
  const restGaps = ended
    .map((event, index) => {
      const next = ended[index + 1];
      return next ? eventRestGapSeconds(next, event) : undefined;
    })
    .filter((value): value is number => value !== undefined);
  const averageRestLast5Seconds = average(restGaps.slice(-5));

  return {
    averageRestLast5Seconds,
    ended,
    sessionEnded,
    startedAt,
    summary,
    visible,
  };
}

function pdfMetricCard(label: string, value: string, className = ''): string {
  const valueClass = className ? `card-value ${className}` : 'card-value';
  return `<article class="card"><div class="card-label">${escapeHtml(label)}</div><div class="${valueClass}">${escapeHtml(value)}</div></article>`;
}

function pdfAverage(label: string, value: string): string {
  return `<div class="average"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
}

function pdfTimelineRow(
  event: ContractionEvent,
  next: ContractionEvent | undefined,
  input: SummaryExportInput,
  sessionEnded: boolean,
): string {
  const notes = pdfDetailLines(event, input.includeNotes);
  const rest = pdfRestValue(event, next, input.now, sessionEnded);
  return `<tr>
    <td class="time">${escapeHtml(formatShareDateTime(event.startAt, input.now))}</td>
    <td class="metric">${escapeHtml(formatContractionDuration(event, input.now))}</td>
    <td class="metric">${escapeHtml(rest)}</td>
    <td class="detail">${notes || '<span class="quiet">-</span>'}</td>
  </tr>`;
}

function pdfDetailLines(event: ContractionEvent, includeNotes: boolean): string {
  if (!includeNotes) {
    return '';
  }

  const lines: string[] = [];
  if (event.intensity) {
    lines.push(`Intensity: ${formatIntensity(event.intensity)}`);
  }
  if (event.note) {
    lines.push(`Note: ${event.note}`);
  }
  return lines.map((line) => `<div class="detail-line">${escapeHtml(line)}</div>`).join('');
}

function pdfRestValue(
  event: ContractionEvent,
  next: ContractionEvent | undefined,
  now: string,
  sessionEnded: boolean,
): string {
  const [line] = restLines(event, next, now, sessionEnded);
  return line ? line.replace(/^Rest: /, '') : '-';
}

function pdfUrgentEvent(event: UrgentEvent, now: string): string {
  const label = urgentTypeLabels[event.type] ?? event.type.replaceAll('_', ' ');
  const note = event.note ? ` (${event.note})` : '';
  return `<div class="event"><strong>${escapeHtml(formatShareDateTime(event.occurredAt, now))}</strong><br/>${escapeHtml(
    `${label}${note}`,
  )}</div>`;
}

function callRuleModel(result: ProviderRuleResult | undefined, profile: PregnancyProfile) {
  if (!result || result.label === 'No saved call rule') {
    return {
      careTeam: profile.careTeamPhone,
      ruleLabel: 'Not saved',
      status: 'not_saved',
      statusLabel: 'Not saved',
    };
  }

  return {
    careTeam: profile.careTeamPhone,
    ruleLabel: result.label,
    status: result.met ? 'matched' : 'not_matched',
    statusLabel: result.met ? 'Matched' : 'Not matched',
  };
}

function recentTimingBlocks(
  events: ContractionEvent[],
  now: string,
  includeNotes: boolean,
  sessionEnded: boolean,
): string[] {
  return events.slice(-5).flatMap((event, index, recent) => {
    const globalIndex = events.length - recent.length + index;
    const next = events[globalIndex + 1];
    const block = [
      '',
      formatShareDateTime(event.startAt, now),
      `Contraction: ${formatContractionDuration(event, now)}`,
      ...restLines(event, next, now, sessionEnded),
      ...noteLines(event, includeNotes),
    ];
    return block;
  });
}

function restLines(
  event: ContractionEvent,
  next: ContractionEvent | undefined,
  now: string,
  sessionEnded: boolean,
): string[] {
  if (!event.endAt) {
    return [];
  }

  if (next) {
    const rest = eventRestGapSeconds(next, event);
    return rest === undefined ? [] : [`Rest: ${formatShortDuration(rest)}`];
  }

  const rest = formatShortDuration(secondsBetween(event.endAt, now));
  return sessionEnded ? [`Rest: ${rest} until session ended`] : [`Rest: ongoing, ${rest} so far`];
}

function noteLines(event: ContractionEvent, includeNotes: boolean): string[] {
  if (!includeNotes) {
    return [];
  }

  const lines: string[] = [];
  if (event.intensity) {
    lines.push(`Intensity: ${formatIntensity(event.intensity)}`);
  }
  if (event.note) {
    lines.push(`Note: ${event.note}`);
  }
  return lines;
}

function urgentEventLines(events: UrgentEvent[], now: string): string[] {
  return events.map((event) => {
    const label = urgentTypeLabels[event.type] ?? event.type.replaceAll('_', ' ');
    const note = event.note ? ` (${event.note})` : '';
    return `${formatShareDateTime(event.occurredAt, now)}: ${label}${note}`;
  });
}

function callRuleLines(result: ProviderRuleResult | undefined, profile: PregnancyProfile): string[] {
  const lines: string[] = [];
  if (!result || result.label === 'No saved call rule') {
    lines.push('Saved rule: not saved');
  } else {
    lines.push(`Saved rule: ${result.label}`);
    lines.push(`Status: ${result.met ? 'matched' : 'not matched'}`);
  }

  if (profile.careTeamPhone) {
    lines.push(`Care team: ${profile.careTeamPhone}`);
  }

  return lines;
}

function formatContractionCount(count: number, hasActiveEvent: boolean): string {
  if (!hasActiveEvent) {
    return String(count);
  }
  return `${count} completed, 1 in progress`;
}

function formatContractionDuration(event: ContractionEvent, now: string): string {
  const duration = formatShortDuration(eventDurationSeconds(event, now));
  return event.endAt ? duration : `${duration} so far`;
}

function formatShareDateTime(value: string, now: string): string {
  if (formatDateOnly(value) === formatDateOnly(now)) {
    return formatTimeOnly(value);
  }
  return `${formatDateOnly(value)}, ${formatTimeOnly(value)}`;
}

function formatRecordedDateTime(value: string): string {
  return `${formatDateOnly(value)}, ${formatTimeOnly(value)}`;
}

function formatIntensity(intensity: Intensity): string {
  return intensity.replaceAll('_', ' ');
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const urgentTypeLabels: Record<UrgentType, string> = {
  water_broke: 'Waters broke',
  vaginal_bleeding: 'Vaginal bleeding',
  reduced_fetal_movement: 'Baby moving less than usual',
  under_37_weeks_labor_concern: 'Under 37 weeks and labor concern',
  contraction_over_2_min: 'Contraction over 2 minutes',
  severe_or_unusual_pain: 'Severe or unusual pain',
  fever_unwell: 'Fever or feeling very unwell',
  planned_c_section_or_call_early: 'Planned C-section or call early',
};
