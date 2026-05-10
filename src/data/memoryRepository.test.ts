import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '@/data/memoryRepository';

describe('MemoryRepository session grouping', () => {
  it('keeps contractions in the same session before two quiet hours', async () => {
    const repo = new MemoryRepository();
    const first = await repo.startContraction('2026-05-10T00:00:00.000Z');
    await repo.endContraction('2026-05-10T00:01:00.000Z');
    const next = await repo.startContraction('2026-05-10T02:00:59.000Z');

    expect(next.sessions).toHaveLength(1);
    expect(next.activeSession?.id).toBe(first.activeSession?.id);
    expect(next.events).toHaveLength(2);
    expect(next.allEvents).toHaveLength(2);
  });

  it('starts a new session exactly two quiet hours after the last end', async () => {
    const repo = new MemoryRepository();
    const first = await repo.startContraction('2026-05-10T00:00:00.000Z');
    await repo.endContraction('2026-05-10T00:01:00.000Z');
    const next = await repo.startContraction('2026-05-10T02:01:00.000Z');
    const closed = next.sessions.find((session) => session.id === first.activeSession?.id);

    expect(next.sessions).toHaveLength(2);
    expect(next.activeSession?.id).not.toBe(first.activeSession?.id);
    expect(closed?.status).toBe('closed');
    expect(closed?.endedAt).toBe('2026-05-10T00:01:00.000Z');
    expect(next.events).toHaveLength(1);
    expect(next.allEvents).toHaveLength(2);
  });

  it('closes a stale active session on load without creating another session', async () => {
    const repo = new MemoryRepository();
    await repo.startContraction('2026-05-10T00:00:00.000Z');
    await repo.endContraction('2026-05-10T00:01:00.000Z');
    const snapshot = await repo.loadSnapshot('2026-05-10T02:01:00.000Z');

    expect(snapshot.activeSession).toBeUndefined();
    expect(snapshot.latestSession?.status).toBe('closed');
    expect(snapshot.latestSession?.endedAt).toBe('2026-05-10T00:01:00.000Z');
    expect(snapshot.events).toEqual([]);
    expect(snapshot.allEvents).toHaveLength(1);
  });

  it('closes a resting session manually and starts fresh after close', async () => {
    const repo = new MemoryRepository();
    const first = await repo.startContraction('2026-05-10T00:00:00.000Z');
    await repo.endContraction('2026-05-10T00:01:00.000Z');
    const closed = await repo.closeSession('2026-05-10T00:02:00.000Z');
    const closedSession = closed.sessions.find((session) => session.id === first.activeSession?.id);

    expect(closed.activeSession).toBeUndefined();
    expect(closedSession?.status).toBe('closed');
    expect(closedSession?.endedAt).toBe('2026-05-10T00:02:00.000Z');

    const next = await repo.startContraction('2026-05-10T00:03:00.000Z');

    expect(next.sessions).toHaveLength(2);
    expect(next.activeSession?.id).not.toBe(first.activeSession?.id);
    expect(next.events).toHaveLength(1);
    expect(next.allEvents).toHaveLength(2);
  });

  it('does not close a session while a contraction is active', async () => {
    const repo = new MemoryRepository();
    await repo.startContraction('2026-05-10T00:00:00.000Z');
    const snapshot = await repo.loadSnapshot('2026-05-10T03:00:00.000Z');

    expect(snapshot.activeSession?.status).toBe('active');
    expect(snapshot.events).toHaveLength(1);
  });
});
