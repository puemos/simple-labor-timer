import { AppSnapshot, ContractionEvent, PregnancyProfile, ProviderRule, UrgentType } from '@/domain/types';

export type AppRepositoryContract = {
  loadSnapshot(at?: string): Promise<AppSnapshot>;
  startContraction(at?: string): Promise<AppSnapshot>;
  endContraction(at?: string): Promise<AppSnapshot>;
  undoLastAction(at?: string): Promise<AppSnapshot>;
  deleteEvent(eventId: string, at?: string): Promise<AppSnapshot>;
  restoreLatestDeleted(at?: string): Promise<AppSnapshot>;
  updateEvent(
    eventId: string,
    patch: Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>,
    at?: string,
  ): Promise<AppSnapshot>;
  addMissedEvent(startAt: string, endAt: string, at?: string): Promise<AppSnapshot>;
  splitEvent(eventId: string, at?: string): Promise<AppSnapshot>;
  mergeWithPrevious(eventId: string, at?: string): Promise<AppSnapshot>;
  recordUrgent(type: UrgentType, note?: string, consentToRecord?: boolean, at?: string): Promise<AppSnapshot>;
  saveProfile(patch: Partial<PregnancyProfile>, at?: string): Promise<AppSnapshot>;
  saveProviderRule(patch: Partial<ProviderRule>, at?: string): Promise<AppSnapshot>;
  closeSession(at?: string): Promise<AppSnapshot>;
  deleteAllData(at?: string): Promise<AppSnapshot>;
};
