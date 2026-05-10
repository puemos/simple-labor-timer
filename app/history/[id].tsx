import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { eventDurationSeconds, eventIntervalSeconds, formatShortDuration, nowIso, visibleEvents } from '@/domain/timing/timeMath';
import { Intensity } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Button,
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

const intensityOptions: { key: Intensity; label: string }[] = [
  { key: 'mild', label: 'Mild' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'strong', label: 'Strong' },
  { key: 'cannot_talk_walk', label: "Can't talk" },
];

export default function HistoryDetailRoute() {
  const { spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actions, busy, snapshot } = useContractionApp();
  const events = useMemo(() => visibleEvents(snapshot?.events ?? []), [snapshot?.events]);
  const event = events.find((item) => item.id === id);
  const previous = event ? events[events.indexOf(event) - 1] : undefined;
  const eventIndex = event ? events.indexOf(event) : -1;

  const [draft, setDraft] = useState(() =>
    event ? { startAt: event.startAt, endAt: event.endAt ?? nowIso(), note: event.note ?? '' } : { startAt: '', endAt: '', note: '' },
  );

  useEffect(() => {
    if (event) {
      setDraft({ startAt: event.startAt, endAt: event.endAt ?? nowIso(), note: event.note ?? '' });
    }
  }, [event]);

  if (!event) {
    return (
      <Screen
        background="grouped"
        headerTitle="Contraction"
        headerLeft={<IconButton icon={Icons.ChevronLeft} label="Back" onPress={() => router.back()} />}
      >
        <EmptyState icon={Icons.AlertTriangle} title="Contraction not found" body="It may have been deleted." />
      </Screen>
    );
  }

  async function save() {
    if (!event) return;
    await actions.updateEvent(event.id, {
      startAt: normalizeIso(draft.startAt),
      endAt: normalizeIso(draft.endAt),
      note: draft.note,
    });
    router.back();
  }

  return (
    <Screen
      scrollable
      background="grouped"
      headerTitle={`#${eventIndex + 1}`}
      headerLeft={<IconButton icon={Icons.ChevronLeft} label="Back" onPress={() => router.back()} />}
    >
      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, marginBottom: spacing.base }}>
        <Title3>Contraction #{eventIndex + 1}</Title3>
        <Footnote color="secondary" style={{ marginTop: 2 }}>
          {new Date(event.startAt).toLocaleString()}
        </Footnote>
      </View>

      <ListSection header="Stats">
        <ListRow title="Duration" value={formatShortDuration(eventDurationSeconds(event))} trailing="value" />
        <ListRow title="Interval from previous" value={formatShortDuration(eventIntervalSeconds(event, previous))} trailing="value" />
        {event.manuallyEdited ? <ListRow title="Edited" value="Manually adjusted" trailing="value" /> : null}
      </ListSection>

      <ListSection header="Intensity">
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
          <SegmentedControl
            options={intensityOptions}
            value={(event.intensity ?? 'mild') as Intensity}
            onChange={(intensity) => actions.updateEvent(event.id, { intensity })}
          />
        </View>
      </ListSection>

      <ListSection header="Edit">
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm }}>
          <TextField
            label="Start"
            value={draft.startAt}
            onChangeText={(startAt) => setDraft((value) => ({ ...value, startAt }))}
            autoCapitalize="none"
          />
          <TextField
            label="End"
            value={draft.endAt}
            onChangeText={(endAt) => setDraft((value) => ({ ...value, endAt }))}
            autoCapitalize="none"
          />
          <TextField
            label="Note"
            value={draft.note}
            onChangeText={(note) => setDraft((value) => ({ ...value, note }))}
          />
          <Button variant="filled" label="Save changes" onPress={save} loading={busy} fullWidth />
        </View>
      </ListSection>

      <ListSection header="Actions">
        <ListRow
          title="Split into two"
          leading={{ icon: Icons.Scissors, color: '#5856D6' }}
          onPress={() => actions.splitEvent(event.id)}
          trailing="chevron"
        />
        <ListRow
          title="Merge with previous"
          leading={{ icon: Icons.Combine, color: '#FF9500' }}
          onPress={() => actions.mergeWithPrevious(event.id)}
          trailing="chevron"
        />
      </ListSection>

      <ListSection>
        <ListRow
          title="Delete contraction"
          destructive
          centerTitle
          onPress={() =>
            Alert.alert('Delete contraction?', 'You can restore the most recent deletion in this session.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
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

function normalizeIso(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
