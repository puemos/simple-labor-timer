import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { formatDateTime, formatEditableDateTime, normalizeDateTimeToIso } from '@/domain/timing/dateFormat';
import { eventDurationSeconds, eventIntervalSeconds, formatShortDuration, nowIso, visibleEvents } from '@/domain/timing/timeMath';
import { Intensity } from '@/domain/types';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Button,
  DateTimeField,
  EmptyState,
  Footnote,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  SegmentedControl,
  TextField,
  Title3,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

const intensityOptions: { key: Intensity; labelKey: string }[] = [
  { key: 'mild', labelKey: 'intensity.mild' },
  { key: 'moderate', labelKey: 'intensity.moderate' },
  { key: 'strong', labelKey: 'intensity.strong' },
  { key: 'cannot_talk_walk', labelKey: 'intensity.cannot_talk_walk' },
];

export default function HistoryDetailRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actions, busy, snapshot } = useContractionApp();
  const events = useMemo(() => visibleEvents(snapshot?.allEvents ?? []), [snapshot?.allEvents]);
  const event = events.find((item) => item.id === id);
  const sessionEvents = event ? events.filter((item) => item.sessionId === event.sessionId) : [];
  const eventIndex = event ? sessionEvents.indexOf(event) : -1;
  const previous = eventIndex > 0 ? sessionEvents[eventIndex - 1] : undefined;

  const [draft, setDraft] = useState(() =>
    event
      ? {
          startAt: formatEditableDateTime(event.startAt),
          endAt: formatEditableDateTime(event.endAt ?? nowIso()),
          note: event.note ?? '',
        }
      : { startAt: '', endAt: '', note: '' },
  );

  useEffect(() => {
    if (event) {
      setDraft({
        startAt: formatEditableDateTime(event.startAt),
        endAt: formatEditableDateTime(event.endAt ?? nowIso()),
        note: event.note ?? '',
      });
    }
  }, [event]);

  if (!event) {
    return (
      <Screen
        background="grouped"
        headerTitle={t('time.contraction', { count: 1 })}
        headerLeft={<IconButton icon={Icons.ChevronLeft} label={t('common.back')} onPress={() => router.back()} />}
      >
        <EmptyState icon={Icons.AlertTriangle} title={t('history.contractionNotFoundTitle')} body={t('history.contractionNotFoundBody')} />
      </Screen>
    );
  }

  async function save() {
    if (!event) return;
    await actions.updateEvent(event.id, {
      startAt: normalizeDateTimeToIso(draft.startAt),
      endAt: normalizeDateTimeToIso(draft.endAt),
      note: draft.note,
    });
    router.back();
  }

  return (
    <Screen
      scrollable
      background="grouped"
      headerTitle={`#${eventIndex + 1}`}
      headerLeft={<IconButton icon={Icons.ChevronLeft} label={t('common.back')} onPress={() => router.back()} />}
    >
      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, marginBottom: spacing.base }}>
        <Title3>{t('history.contractionTitle', { count: eventIndex + 1 })}</Title3>
        <Footnote color="secondary" style={{ marginTop: 2 }}>
          {formatDateTime(event.startAt, { t, locale })}
        </Footnote>
      </View>

      <ListSection header={t('history.stats')}>
        <ListRow title={t('timer.duration')} value={formatShortDuration(eventDurationSeconds(event), { t, locale })} trailing="value" />
        <ListRow title={t('history.intervalFromPrevious')} value={formatShortDuration(eventIntervalSeconds(event, previous), { t, locale })} trailing="value" />
        {event.manuallyEdited ? <ListRow title={t('history.edited')} value={t('history.manuallyAdjusted')} trailing="value" /> : null}
      </ListSection>

      <ListSection header={t('history.intensity')}>
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
          <SegmentedControl
            options={intensityOptions.map((option) => ({ key: option.key, label: t(option.labelKey) }))}
            value={(event.intensity ?? 'mild') as Intensity}
            onChange={(intensity) => actions.updateEvent(event.id, { intensity })}
          />
        </View>
      </ListSection>

      <ListSection header={t('history.edit')}>
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm }}>
          <DateTimeField label={t('history.start')} value={draft.startAt} onChangeText={(startAt) => setDraft((value) => ({ ...value, startAt }))} />
          <DateTimeField label={t('history.end')} value={draft.endAt} onChangeText={(endAt) => setDraft((value) => ({ ...value, endAt }))} />
          <TextField
            label={t('history.note')}
            value={draft.note}
            onChangeText={(note) => setDraft((value) => ({ ...value, note }))}
          />
          <Button variant="filled" label={t('common.saveChanges')} onPress={save} loading={busy} fullWidth />
        </View>
      </ListSection>

      <ListSection header={t('history.actions')}>
        <ListRow
          title={t('history.splitIntoTwo')}
          leading={{ icon: Icons.Scissors, color: '#5856D6' }}
          onPress={() => actions.splitEvent(event.id)}
          trailing="chevron"
        />
        <ListRow
          title={t('history.mergeWithPrevious')}
          leading={{ icon: Icons.Combine, color: '#FF9500' }}
          onPress={() => actions.mergeWithPrevious(event.id)}
          trailing="chevron"
        />
      </ListSection>

      <ListSection>
        <ListRow
          title={t('history.deleteContraction')}
          destructive
          centerTitle
          onPress={() =>
            Alert.alert(t('history.deleteContractionTitle'), t('history.deleteContractionBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                  await actions.deleteEvent(event.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ListSection>
    </Screen>
  );
}
