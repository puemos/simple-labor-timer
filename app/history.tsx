import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { hapticSelection } from '@/native/haptics';
import { formatEditableDateTime, formatTimeOnly, normalizeDateTimeToIso } from '@/domain/timing/dateFormat';
import { buildRhythmSummary } from '@/domain/timing/rhythm';
import { eventDurationSeconds, eventIntervalSeconds, eventRestGapSeconds, formatShortDuration, visibleEvents } from '@/domain/timing/timeMath';
import { ContractionEvent, ContractionSession } from '@/domain/types';
import { AppT, useAppLanguage, useAppTranslation } from '@/i18n';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Button,
  DateTimeField,
  EmptyState,
  Headline,
  IconButton,
  ListRow,
  ListSection,
  RhythmSummaryRow,
  Screen,
  Subhead,
} from '@/ui/components';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type DayBucket = {
  key: string;
  label: string;
  events: { event: ContractionEvent; index: number; previous?: ContractionEvent }[];
};

type SessionBucket = {
  key: string;
  label: string;
  days: DayBucket[];
};

export default function HistoryRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const { actions, busy, now, snapshot } = useContractionApp();
  const events = useMemo(() => visibleEvents(snapshot?.allEvents ?? []), [snapshot?.allEvents]);
  const buckets = useMemo(() => groupBySession(snapshot?.sessions ?? [], events, { t, locale }), [events, locale, snapshot?.sessions, t]);
  const rhythmSession = snapshot?.activeSession ?? snapshot?.latestSession;
  const rhythmEvents = useMemo(
    () => (rhythmSession ? events.filter((event) => event.sessionId === rhythmSession.id) : []),
    [events, rhythmSession],
  );
  const rhythmNow = rhythmSession?.endedAt ?? now;
  const rhythmSummary = useMemo(
    () => buildRhythmSummary(rhythmEvents, rhythmNow, { rangeStartAt: rhythmSession?.startedAt, rangeEndAt: rhythmNow }),
    [rhythmNow, rhythmEvents, rhythmSession?.startedAt],
  );
  const [missedOpen, setMissedOpen] = useState(false);

  return (
    <Screen
      scrollable
      background="grouped"
      largeTitle={t('history.title')}
      headerLeft={
        <IconButton icon={Icons.ChevronLeft} label={t('common.back')} onPress={() => router.back()} />
      }
      headerRight={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton icon={Icons.RotateCcw} label={t('history.restoreLastDeleted')} onPress={actions.restore} />
          <IconButton icon={Icons.Plus} label={t('history.addMissedContraction')} onPress={() => setMissedOpen(true)} />
        </View>
      }
    >
      {rhythmEvents.length > 0 && rhythmSession ? (
        <View style={{ paddingHorizontal: spacing.base, marginBottom: spacing.lg }}>
          <RhythmSummaryRow
            title={t('history.latestRhythm')}
            summary={rhythmSummary}
            disabled={rhythmSummary.eventCount < 2}
            background="grouped"
            sourceLabel={t('time.session')}
            onPress={() =>
              router.push({
                pathname: '/rhythm',
                params: { sessionId: rhythmSession.id },
              })
            }
          />
        </View>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          icon={Icons.History}
          title={t('history.noContractionsTitle')}
          body={t('history.noContractionsBody')}
        />
      ) : (
        buckets.flatMap((session) =>
          session.days.map((bucket, dayIndex) => (
            <ListSection key={`${session.key}:${bucket.key}`} header={dayIndex === 0 ? session.label : bucket.label}>
              {dayIndex === 0 && bucket.label !== session.label ? (
                <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.xs }}>
                  <Subhead color="secondary">{bucket.label}</Subhead>
                </View>
              ) : null}
              {bucket.events.map(({ event, index, previous }) => (
                <SwipeableRow
                  key={event.id}
                  onDelete={() =>
                    Alert.alert(t('history.deleteContractionTitle'), t('history.deleteContractionBody'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => actions.deleteEvent(event.id) },
                    ])
                  }
                  onEdit={() => router.push({ pathname: '/history/[id]', params: { id: event.id } })}
                >
                  <ListRow
                    title={`#${index + 1} · ${formatTime(event.startAt, { t, locale })}`}
                    subtitle={buildSubtitle(event, previous, now, { t, locale })}
                    trailing="chevron"
                    onPress={() => router.push({ pathname: '/history/[id]', params: { id: event.id } })}
                  />
                </SwipeableRow>
              ))}
            </ListSection>
          )),
        )
      )}

      {missedOpen ? (
        <MissedSheet
          onClose={() => setMissedOpen(false)}
          onAdd={async (start, end) => {
            await actions.addMissedEvent(start, end);
            setMissedOpen(false);
          }}
          busy={busy}
        />
      ) : null}

      {events.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.sm }}>
          <Subhead color="secondary" style={{ textAlign: 'center' }}>
            {t('time.contractionsTotal', { count: events.length })}
          </Subhead>
        </View>
      ) : null}

      <View pointerEvents="none" style={{ height: spacing.xxl }} />
      {/* spacer ensures scroll content extends past safe area */}
      <View style={{ height: 0, backgroundColor: colors.systemGroupedBackground }} />
    </Screen>
  );
}

function MissedSheet({
  onClose,
  onAdd,
  busy,
}: {
  onClose: () => void;
  onAdd: (startIso: string, endIso: string) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useAppTranslation();
  const { colors, spacing } = useTheme();
  const defaults = useMemo(() => {
    const end = formatEditableDateTime(Date.now() - 60_000);
    const start = formatEditableDateTime(Date.now() - 2 * 60_000);
    return { start, end };
  }, []);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  return (
    <View
      style={{
        backgroundColor: colors.secondarySystemBackground,
        margin: spacing.base,
        padding: spacing.base,
        borderRadius: 14,
        gap: spacing.sm,
      }}
    >
      <Headline>{t('history.addMissedTitle')}</Headline>
      <DateTimeField label={t('history.start')} value={start} onChangeText={setStart} />
      <DateTimeField label={t('history.end')} value={end} onChangeText={setEnd} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button variant="gray" label={t('common.cancel')} onPress={onClose} fullWidth style={{ flex: 1 }} />
        <Button
          variant="filled"
          label={t('common.add')}
          loading={busy}
          onPress={() => onAdd(normalizeDateTimeToIso(start), normalizeDateTimeToIso(end))}
          fullWidth
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function SwipeableRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Swipeable
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <RectButton
          onPress={() => {
            void hapticSelection();
            onEdit();
          }}
          style={{
            backgroundColor: colors.systemBlue,
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Icons.Pencil color="#FFFFFF" size={20} strokeWidth={ICON_STROKE_WIDTH} />
        </RectButton>
      )}
      renderRightActions={() => (
        <RectButton
          onPress={() => {
            void hapticSelection();
            onDelete();
          }}
          style={{
            backgroundColor: colors.systemRed,
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Icons.Trash2 color="#FFFFFF" size={20} strokeWidth={ICON_STROKE_WIDTH} />
        </RectButton>
      )}
    >
      <View style={{ backgroundColor: colors.secondarySystemGroupedBackground }}>{children}</View>
    </Swipeable>
  );
}

function groupBySession(
  sessions: ContractionSession[],
  events: ContractionEvent[],
  options: { t: AppT; locale: string },
): SessionBucket[] {
  const knownSessions = sessions.filter((session) => events.some((event) => event.sessionId === session.id));
  const missingSessions = Array.from(new Set(events.map((event) => event.sessionId)))
    .filter((sessionId) => !knownSessions.some((session) => session.id === sessionId))
    .map((sessionId) => {
      const firstEvent = events.find((event) => event.sessionId === sessionId);
      return {
        id: sessionId,
        startedAt: firstEvent?.startAt ?? new Date().toISOString(),
        status: 'closed' as const,
        contentVersion: '',
        createdAt: firstEvent?.createdAt ?? new Date().toISOString(),
        updatedAt: firstEvent?.updatedAt ?? new Date().toISOString(),
      };
    });

  return [...knownSessions, ...missingSessions].map((session) => {
    const sessionEvents = events.filter((event) => event.sessionId === session.id);
    return {
      key: session.id,
      label: formatSessionLabel(session, sessionEvents, options),
      days: groupByDay(sessionEvents, options),
    };
  });
}

function groupByDay(events: ContractionEvent[], options: { t: AppT; locale: string }): DayBucket[] {
  const reversed = [...events].reverse();
  const today = startOfLocalDay(new Date());
  const yesterday = startOfLocalDay(new Date(today.getTime() - 86_400_000));

  const map = new Map<string, DayBucket>();
  reversed.forEach((event, idxFromEnd) => {
    const indexInOriginal = events.length - 1 - idxFromEnd;
    const previous = events[indexInOriginal - 1];
    const date = new Date(event.startAt);
    const day = startOfLocalDay(date);
    const key = day.toDateString();
    let label: string;
    if (day.getTime() === today.getTime()) {
      label = options.t('time.today');
    } else if (day.getTime() === yesterday.getTime()) {
      label = options.t('time.yesterday');
    } else {
      label = day.toLocaleDateString(options.locale, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { key, label, events: [] };
      map.set(key, bucket);
    }
    bucket.events.push({ event, index: indexInOriginal, previous });
  });
  return Array.from(map.values());
}

function formatSessionLabel(
  session: ContractionSession,
  events: ContractionEvent[],
  options: { t: AppT; locale: string },
): string {
  if (session.status === 'active') {
    return options.t('time.currentSession');
  }
  const count = events.length;
  const endAt = session.endedAt ?? events.at(-1)?.endAt ?? events.at(-1)?.startAt;
  const start = new Date(session.startedAt);
  const end = endAt ? new Date(endAt) : undefined;
  const range = end
    ? `${formatSessionEndpoint(start, true, options)} - ${formatSessionEndpoint(end, !sameLocalDay(start, end), options)}`
    : formatSessionEndpoint(start, true, options);
  return `${range} · ${count} ${options.t('time.contraction', { count })}`;
}

function formatSessionEndpoint(date: Date, includeDate: boolean, options: { t: AppT; locale: string }): string {
  const time = formatTimeOnly(date, options);
  if (!includeDate) {
    return time;
  }
  return `${date.toLocaleDateString(options.locale, { month: 'short', day: 'numeric' })}, ${time}`;
}

function sameLocalDay(first: Date, second: Date): boolean {
  return startOfLocalDay(first).getTime() === startOfLocalDay(second).getTime();
}

function startOfLocalDay(date: Date): Date {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
}

function formatTime(iso: string, options: { t: AppT; locale: string }): string {
  return formatTimeOnly(iso, options);
}

function buildSubtitle(
  event: ContractionEvent,
  previous: ContractionEvent | undefined,
  now: string,
  options: { t: AppT; locale: string },
): string {
  const duration = formatShortDuration(eventDurationSeconds(event, now), options);
  const interval = formatShortDuration(eventIntervalSeconds(event, previous), options);
  const rest = formatShortDuration(eventRestGapSeconds(event, previous), options);
  return `${duration} · ${interval} · ${rest}`;
}
