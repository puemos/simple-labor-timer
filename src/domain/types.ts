export type Region = 'US' | 'UK' | 'EU' | 'OTHER';

export type Intensity = 'mild' | 'moderate' | 'strong' | 'cannot_talk_walk';

export type ProviderRuleSource = 'user_provider' | 'app_default';

export type PregnancyProfile = {
  id: string;
  estimatedDueDate?: string;
  gestationalAgeAtSetupDays?: number;
  region: Region;
  careTeamPhone?: string;
  birthLocationPhone?: string;
  doulaName?: string;
  doulaPhone?: string;
  emergencyPhone: string;
  plannedCesarean: boolean;
  highRiskOrCallEarly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderRule = {
  id: string;
  profileId: string;
  intervalSecondsMax: number;
  durationSecondsMin: number;
  observationWindowMinutes: number;
  label: string;
  actionText: string;
  source: ProviderRuleSource;
  createdAt: string;
  updatedAt: string;
};

export type ContractionSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'closed';
  contentVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type ContractionEvent = {
  id: string;
  sessionId: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  intensity?: Intensity;
  note?: string;
  manuallyEdited: boolean;
  clockChangeSuspected: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type UrgentType =
  | 'water_broke'
  | 'vaginal_bleeding'
  | 'reduced_fetal_movement'
  | 'under_37_weeks_labor_concern'
  | 'contraction_over_2_min'
  | 'severe_or_unusual_pain'
  | 'fever_unwell'
  | 'planned_c_section_or_call_early';

export type UrgentEvent = {
  id: string;
  sessionId?: string;
  type: UrgentType;
  occurredAt: string;
  timezone: string;
  note?: string;
  sourceIds: string[];
  consentToRecord: boolean;
  contentVersion: string;
  createdAt: string;
};

export type AlertEvent = {
  id: string;
  sessionId: string;
  type: 'urgent_warning' | 'provider_rule_met' | 'preterm_contact';
  message: string;
  sourceIds: string[];
  contentVersion: string;
  triggeredAt: string;
  acknowledgedAt?: string;
};

export type ShareTarget = 'doula' | 'partner' | 'midwife_ob' | 'hospital_triage' | 'self';

export type ShareFormat = 'plain_text' | 'pdf';

export type SharePack = {
  id: string;
  createdAt: string;
  rangeStart: string;
  rangeEnd: string;
  target: ShareTarget;
  format: ShareFormat;
  includeNotes: boolean;
  includeUrgentEvents: boolean;
  localFileUri?: string;
};

export type PatternLabel =
  | 'getting_closer'
  | 'spacing_out'
  | 'regular'
  | 'inconsistent'
  | 'insufficient_data';

export type TimerActivityState = 'idle' | 'measuring' | 'resting';

export type ProviderRuleResult = {
  met: boolean;
  label: string;
  message: string;
  sourceIds: string[];
  matchedEventIds: string[];
};

export type UrgentRuleResult = {
  active: boolean;
  type?: UrgentType;
  message?: string;
  sourceIds: string[];
};

export type SessionSummary = {
  timerState: TimerActivityState;
  eventCount: number;
  activeEvent?: ContractionEvent;
  lastEvent?: ContractionEvent;
  lastDurationSeconds?: number;
  lastIntervalSeconds?: number;
  currentIntervalSeconds?: number;
  currentRestSeconds?: number;
  averageDurationLast3Seconds?: number;
  averageDurationLast5Seconds?: number;
  averageIntervalLast3Seconds?: number;
  averageIntervalLast5Seconds?: number;
  averageDurationLastHourSeconds?: number;
  averageIntervalLastHourSeconds?: number;
  shortestIntervalLastHourSeconds?: number;
  longestDurationSeconds?: number;
  sessionDurationSeconds: number;
  pattern: PatternLabel;
};

export type AppSnapshot = {
  profile: PregnancyProfile;
  providerRule?: ProviderRule;
  activeSession?: ContractionSession;
  latestSession?: ContractionSession;
  sessions: ContractionSession[];
  events: ContractionEvent[];
  allEvents: ContractionEvent[];
  urgentEvents: UrgentEvent[];
  allUrgentEvents: UrgentEvent[];
};
