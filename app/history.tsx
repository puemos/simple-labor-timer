import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { hapticSelection } from '@/native/haptics';
import { eventDurationSeconds, eventIntervalSeconds, eventRestGapSeconds, formatShortDuration, visibleEvents } from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Button,
  EmptyState,
  Headline,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  Subhead,
  TextField,
} from '@/ui/components';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type DayBucket = {
  key: string;
  label: string;
  events: { event: ContractionEvent; index: number; previous?: ContractionEvent }[];
};

export default function HistoryRoute() {
  const { colors, spacing } = useTheme();
  const { actions, busy, now, snapshot } = useContractionApp();
  const events = useMemo(() => visibleEvents(snapshot?.events ?? []), [snapshot?.events]);
  const buckets = useMemo(() => groupByDay(events), [events]);
  const [missedOpen, setMissedOpen] = useState(false);

  return (
    <Screen
      scrollable
      background="grouped"
      largeTitle="History"
      headerLeft={
        <IconButton icon={Icons.ChevronLeft} label="Back" onPress={() => router.back()} />
      }
      headerRight={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton icon={Icons.RotateCcw} label="Restore last deleted" onPress={actions.restore} />
          <IconButton icon={Icons.Plus} label="Add missed contraction" onPress={() => setMissedOpen(true)} />
        </View>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={Icons.History}
          title="No contractions yet"
          body="Once you've ended a contraction, it'll appear here for review."
        />
      ) : (
        buckets.map((bucket) => (
          <ListSection key={bucket.key} header={bucket.label}>
            {bucket.events.map(({ event, index, previous }) => (
              <SwipeableRow
                key={event.id}
                onDelete={() =>
                  Alert.alert('Delete contraction?', 'You can restore the most recent deletion in this session.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => actions.deleteEvent(event.id) },
                  ])
                }
                onEdit={() => router.push({ pathname: '/history/[id]', params: { id: event.id } })}
              >
                <ListRow
                  title={`#${index + 1} · ${formatTime(event.startAt)}`}
                  subtitle={buildSubtitle(event, previous, now)}
                  trailing="chevron"
                  onPress={() => router.push({ pathname: '/history/[id]', params: { id: event.id } })}
                />
              </SwipeableRow>
            ))}
          </ListSection>
        ))
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
            {events.length} {events.length === 1 ? 'contraction' : 'contractions'} in this session
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
  const { colors, spacing } = useTheme();
  const defaults = useMemo(() => {
    const end = new Date(Date.now() - 60_000).toISOString();
    const start = new Date(Date.now() - 2 * 60_000).toISOString();
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
      <Headline>Add missed contraction</Headline>
      <TextField label="Start (ISO)" value={start} onChangeText={setStart} autoCapitalize="none" />
      <TextField label="End (ISO)" value={end} onChangeText={setEnd} autoCapitalize="none" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button variant="gray" label="Cancel" onPress={onClose} fullWidth style={{ flex: 1 }} />
        <Button
          variant="filled"
          label="Add"
          loading={busy}
          onPress={() => onAdd(normalizeIso(start), normalizeIso(end))}
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

function groupByDay(events: ContractionEvent[]): DayBucket[] {
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
      label = 'Today';
    } else if (day.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
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

function startOfLocalDay(date: Date): Date {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function buildSubtitle(event: ContractionEvent, previous: ContractionEvent | undefined, now: string): string {
  const duration = formatShortDuration(eventDurationSeconds(event, now));
  const interval = formatShortDuration(eventIntervalSeconds(event, previous));
  const rest = formatShortDuration(eventRestGapSeconds(event, previous));
  return `${duration} · ${interval} · ${rest}`;
}

function normalizeIso(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

