import { describe, expect, it } from 'vitest';
import { buildContractionCsv } from '@/domain/export/csvRows';
import { ContractionEvent } from '@/domain/types';

describe('CSV export', () => {
  it('escapes notes and includes measured fields', () => {
    const event: ContractionEvent = {
      id: 'event',
      sessionId: 'session',
      startAt: '2026-05-10T02:00:00.000Z',
      endAt: '2026-05-10T02:01:00.000Z',
      timezone: 'Europe/Rome',
      note: 'strong, asked "call?"',
      manuallyEdited: true,
      clockChangeSuspected: false,
      createdAt: '2026-05-10T02:00:00.000Z',
      updatedAt: '2026-05-10T02:01:00.000Z',
    };
    const csv = buildContractionCsv([event], '2026-05-10T02:01:00.000Z');
    expect(csv).toContain('duration_seconds');
    expect(csv).toContain('"strong, asked ""call?"""');
    expect(csv).toContain('true');
  });
});
