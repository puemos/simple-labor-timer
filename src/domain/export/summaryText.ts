import { patternText } from '@/domain/timing/patternLabels';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { formatDateOnly, formatTimeOnly } from '@/domain/timing/dateFormat';
import { urgentTypeLabel } from '@/domain/rules/urgentRules';
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
} from '@/domain/types';
import { LocaleFormatOptions, resolveT } from '@/i18n/format';

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
} & LocaleFormatOptions;

export function buildSummaryText(input: SummaryExportInput): string {
  const t = resolveT(input);
  const { averageRestLast5Seconds, ended, sessionEnded, startedAt, summary, visible } = buildSummaryModel(input);

  const lines = [
    t('export.title'),
    t('export.recorded', { value: formatRecordedDateTime(input.now, input) }),
    t('export.covers', { value: input.rangeLabel }),
    '',
    t('export.summary'),
    t('export.started', { value: startedAt ? formatShareDateTime(startedAt, input.now, input) : t('export.noContractions') }),
    t('export.contractions', { value: formatContractionCount(summary.eventCount, Boolean(summary.activeEvent), input) }),
    t('export.pattern', { value: patternText(summary.pattern, input) }),
    '',
    t('export.averagesLast5'),
    t('export.contractionLine', { value: formatShortDuration(summary.averageDurationLast5Seconds, input) }),
    t('export.restLine', { value: formatShortDuration(averageRestLast5Seconds, input) }),
    t('export.frequencyLine', {
      value: formatShortDuration(summary.averageIntervalLast5Seconds, input),
      suffix: t('time.startToStart'),
    }),
  ];

  lines.push('', t('export.recentTimings'));
  const timingBlocks = recentTimingBlocks(visible, input.now, input.includeNotes, sessionEnded, input);
  if (timingBlocks.length) {
    lines.push(...timingBlocks);
  } else {
    lines.push(t('export.noContractionsRecorded'));
  }

  lines.push('', t('export.callRule'), ...callRuleLines(input.providerRuleResult, input.profile, input));

  const urgent = input.includeUrgentEvents ? urgentEventLines(input.urgentEvents, input.now, input) : [];
  if (urgent.length) {
    lines.push('', t('export.urgentEvents'), ...urgent);
  }

  const edited = ended.filter((event) => event.manuallyEdited);
  if (edited.length) {
    lines.push('', t('export.manualEdits', { count: edited.length }));
  }

  lines.push('', t('export.recordedByMe'), t('export.notMedicalAdvice'));

  return lines.join('\n');
}

export function buildSummaryPdfHtml(input: SummaryExportInput): string {
  const t = resolveT(input);
  const { averageRestLast5Seconds, ended, sessionEnded, startedAt, summary, visible } = buildSummaryModel(input);
  const urgent = input.includeUrgentEvents ? input.urgentEvents : [];
  const editedCount = ended.filter((event) => event.manuallyEdited).length;
  const callRule = callRuleModel(input.providerRuleResult, input.profile, input);
  const ruleClass = callRule.status === 'matched' ? 'status-good' : 'status-neutral';
  const timelineRows = visible.length
    ? visible.map((event, index) => pdfTimelineRow(event, visible[index + 1], input, sessionEnded)).join('')
    : `<tr><td colspan="4" class="empty">${escapeHtml(t('export.noContractionsRecorded'))}</td></tr>`;
  const urgentSection = urgent.length
    ? `<section class="section"><h2>${escapeHtml(t('export.urgentEvents'))}</h2><div class="event-list">${urgent.map((event) => pdfUrgentEvent(event, input.now, input)).join('')}</div></section>`
    : '';
  const editsNote = editedCount ? `<p class="quiet">${escapeHtml(t('export.manualEdits', { count: editedCount }))}</p>` : '';

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
      <p class="eyebrow">${escapeHtml(t('export.privateShareReport'))}</p>
      <h1>${escapeHtml(t('export.title'))}</h1>
      <div class="meta">
        <div>${escapeHtml(t('export.recorded', { value: formatRecordedDateTime(input.now, input) }))}</div>
        <div>${escapeHtml(t('export.covers', { value: input.rangeLabel }))}</div>
      </div>
    </header>

    <section class="cards" aria-label="${escapeHtml(t('export.atAGlance'))}">
      ${pdfMetricCard(t('export.contractionsCard'), formatContractionCount(summary.eventCount, Boolean(summary.activeEvent), input))}
      ${pdfMetricCard(t('export.pattern', { value: '' }).replace(/:\s*$/, ''), patternText(summary.pattern, input))}
      ${pdfMetricCard(t('export.startedCard'), startedAt ? formatShareDateTime(startedAt, input.now, input) : t('export.noContractions'))}
      ${pdfMetricCard(t('export.callRule'), callRule.statusLabel, ruleClass)}
    </section>

    <section class="section">
      <h2>${escapeHtml(t('export.last5Averages'))}</h2>
      <div class="average-grid">
        ${pdfAverage(t('export.contraction'), formatShortDuration(summary.averageDurationLast5Seconds, input))}
        ${pdfAverage(t('export.rest'), formatShortDuration(averageRestLast5Seconds, input))}
        ${pdfAverage(t('export.frequency'), `${formatShortDuration(summary.averageIntervalLast5Seconds, input)} ${t('time.startToStart')}`)}
      </div>
    </section>

    <section class="section">
      <h2>${escapeHtml(t('export.timeline'))}</h2>
      <table>
        <thead>
          <tr>
            <th class="time">${escapeHtml(t('export.tableTime'))}</th>
            <th class="metric">${escapeHtml(t('export.tableContraction'))}</th>
            <th class="metric">${escapeHtml(t('export.tableRestAfter'))}</th>
            <th class="detail">${escapeHtml(t('export.tableNotes'))}</th>
          </tr>
        </thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>${escapeHtml(t('export.callRule'))}</h2>
      <p><span class="pill ${ruleClass}">${escapeHtml(callRule.statusLabel)}</span></p>
      <p>${escapeHtml(t('export.savedRulePdf', { value: callRule.ruleLabel }))}</p>
      ${callRule.careTeam ? `<p>${escapeHtml(t('export.careTeamPdf', { value: callRule.careTeam }))}</p>` : ''}
    </section>

    ${urgentSection}
    ${editsNote}

    <footer class="footer">
      ${escapeHtml(t('export.filesLocal'))}<br/>
      ${escapeHtml(t('export.recordedByMe'))} ${escapeHtml(t('export.notMedicalAdvice'))}
    </footer>
  </main>
</body>
</html>`;
}

export function summaryTextToHtml(text: string, options?: LocaleFormatOptions): string {
  const [title = resolveT(options)('export.title'), ...body] = text.split('\n');
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
  const notes = pdfDetailLines(event, input.includeNotes, input);
  const rest = pdfRestValue(event, next, input.now, sessionEnded, input);
  return `<tr>
    <td class="time">${escapeHtml(formatShareDateTime(event.startAt, input.now, input))}</td>
    <td class="metric">${escapeHtml(formatContractionDuration(event, input.now, input))}</td>
    <td class="metric">${escapeHtml(rest)}</td>
    <td class="detail">${notes || '<span class="quiet">-</span>'}</td>
  </tr>`;
}

function pdfDetailLines(event: ContractionEvent, includeNotes: boolean, options: LocaleFormatOptions): string {
  const t = resolveT(options);
  if (!includeNotes) {
    return '';
  }

  const lines: string[] = [];
  if (event.intensity) {
    lines.push(t('export.intensity', { value: formatIntensity(event.intensity, options) }));
  }
  if (event.note) {
    lines.push(t('export.note', { value: event.note }));
  }
  return lines.map((line) => `<div class="detail-line">${escapeHtml(line)}</div>`).join('');
}

function pdfRestValue(
  event: ContractionEvent,
  next: ContractionEvent | undefined,
  now: string,
  sessionEnded: boolean,
  options: LocaleFormatOptions,
): string {
  const [line] = restLines(event, next, now, sessionEnded, options);
  return line ? line.replace(/^.*?: /, '') : '-';
}

function pdfUrgentEvent(event: UrgentEvent, now: string, options: LocaleFormatOptions): string {
  const label = urgentTypeLabel(event.type, options);
  const note = event.note ? ` (${event.note})` : '';
  return `<div class="event"><strong>${escapeHtml(formatShareDateTime(event.occurredAt, now, options))}</strong><br/>${escapeHtml(
    `${label}${note}`,
  )}</div>`;
}

function callRuleModel(result: ProviderRuleResult | undefined, profile: PregnancyProfile, options: LocaleFormatOptions) {
  const t = resolveT(options);
  if (!result || result.ruleStatus === 'not_saved') {
    return {
      careTeam: profile.careTeamPhone,
      ruleLabel: t('export.notSavedTitle'),
      status: 'not_saved',
      statusLabel: t('export.notSavedTitle'),
    };
  }

  return {
    careTeam: profile.careTeamPhone,
    ruleLabel: formatProviderRuleLabel(result.label, options),
    status: result.met ? 'matched' : 'not_matched',
    statusLabel: result.met ? t('export.matchedTitle') : t('export.notMatchedTitle'),
  };
}

function recentTimingBlocks(
  events: ContractionEvent[],
  now: string,
  includeNotes: boolean,
  sessionEnded: boolean,
  options: LocaleFormatOptions,
): string[] {
  return events.slice(-5).flatMap((event, index, recent) => {
    const globalIndex = events.length - recent.length + index;
    const next = events[globalIndex + 1];
    const block = [
      '',
      formatShareDateTime(event.startAt, now, options),
      resolveT(options)('export.contractionLine', { value: formatContractionDuration(event, now, options) }),
      ...restLines(event, next, now, sessionEnded, options),
      ...noteLines(event, includeNotes, options),
    ];
    return block;
  });
}

function restLines(
  event: ContractionEvent,
  next: ContractionEvent | undefined,
  now: string,
  sessionEnded: boolean,
  options: LocaleFormatOptions,
): string[] {
  const t = resolveT(options);
  if (!event.endAt) {
    return [];
  }

  if (next) {
    const rest = eventRestGapSeconds(next, event);
    return rest === undefined ? [] : [t('export.restLine', { value: formatShortDuration(rest, options) })];
  }

  const rest = formatShortDuration(secondsBetween(event.endAt, now), options);
  return sessionEnded
    ? [t('export.restLine', { value: t('time.restUntilSessionEnded', { duration: rest }) })]
    : [t('export.restLine', { value: t('time.restOngoing', { duration: rest }) })];
}

function noteLines(event: ContractionEvent, includeNotes: boolean, options: LocaleFormatOptions): string[] {
  const t = resolveT(options);
  if (!includeNotes) {
    return [];
  }

  const lines: string[] = [];
  if (event.intensity) {
    lines.push(t('export.intensity', { value: formatIntensity(event.intensity, options) }));
  }
  if (event.note) {
    lines.push(t('export.note', { value: event.note }));
  }
  return lines;
}

function urgentEventLines(events: UrgentEvent[], now: string, options: LocaleFormatOptions): string[] {
  return events.map((event) => {
    const label = urgentTypeLabel(event.type, options);
    const note = event.note ? ` (${event.note})` : '';
    return `${formatShareDateTime(event.occurredAt, now, options)}: ${label}${note}`;
  });
}

function callRuleLines(result: ProviderRuleResult | undefined, profile: PregnancyProfile, options: LocaleFormatOptions): string[] {
  const t = resolveT(options);
  const lines: string[] = [];
  if (!result || result.ruleStatus === 'not_saved') {
    lines.push(t('export.savedRule', { value: t('export.notSaved') }));
  } else {
    lines.push(t('export.savedRule', { value: formatProviderRuleLabel(result.label, options) }));
    lines.push(t('export.status', { value: result.met ? t('export.matched') : t('export.notMatched') }));
  }

  if (profile.careTeamPhone) {
    lines.push(t('export.careTeam', { value: profile.careTeamPhone }));
  }

  return lines;
}

function formatContractionCount(count: number, hasActiveEvent: boolean, options: LocaleFormatOptions): string {
  if (!hasActiveEvent) {
    return String(count);
  }
  return resolveT(options)('time.completedInProgress', { completed: count, active: 1 });
}

function formatContractionDuration(event: ContractionEvent, now: string, options: LocaleFormatOptions): string {
  const duration = formatShortDuration(eventDurationSeconds(event, now), options);
  return event.endAt ? duration : resolveT(options)('time.soFar', { duration });
}

function formatShareDateTime(value: string, now: string, options: LocaleFormatOptions): string {
  if (formatDateOnly(value, options) === formatDateOnly(now, options)) {
    return formatTimeOnly(value, options);
  }
  return `${formatDateOnly(value, options)}, ${formatTimeOnly(value, options)}`;
}

function formatRecordedDateTime(value: string, options: LocaleFormatOptions): string {
  return `${formatDateOnly(value, options)}, ${formatTimeOnly(value, options)}`;
}

function formatIntensity(intensity: Intensity, options: LocaleFormatOptions): string {
  return resolveT(options)(`intensity.${intensity}`);
}

function formatProviderRuleLabel(label: string, options: LocaleFormatOptions): string {
  return label || resolveT(options)('common.custom');
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
