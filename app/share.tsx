import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Switch, View } from 'react-native';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { buildSummaryPdfHtml, buildSummaryText } from '@/domain/export/summaryText';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { minutesAgo, parseIso, startOfLocalDayIso } from '@/domain/timing/timeMath';
import { ContractionEvent, ContractionSession, ShareFormat, UrgentEvent } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Button,
  Caption1,
  EmptyState,
  Footnote,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  SegmentedControl,
  Sheet,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

type RangeKey = 'today' | 'last24' | 'session';

const ranges: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last24', label: 'Last 24h' },
  { key: 'session', label: 'Session' },
];

const formats: { key: ShareFormat; label: string; color: string }[] = [
  { key: 'plain_text', label: 'Message', color: '#007AFF' },
  { key: 'pdf', label: 'PDF', color: '#FF3B30' },
];

export default function ShareRoute() {
  const { colors, spacing } = useTheme();
  const { now, snapshot } = useContractionApp();
  const [range, setRange] = useState<RangeKey>('session');
  const [format, setFormat] = useState<ShareFormat>('plain_text');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeUrgent, setIncludeUrgent] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const selectedSession = snapshot?.activeSession ?? snapshot?.latestSession;
  const exportNow = range === 'session' && selectedSession?.endedAt ? selectedSession.endedAt : now;

  const filteredEvents = useMemo(
    () => filterEvents(snapshot?.allEvents ?? [], range, now, selectedSession),
    [now, range, selectedSession, snapshot?.allEvents],
  );
  const filteredUrgent = useMemo(() => {
    return filterUrgentEvents(snapshot?.allUrgentEvents ?? [], range, now, selectedSession);
  }, [now, range, selectedSession, snapshot?.allUrgentEvents]);
  const exportProviderRuleResult = useMemo(
    () => evaluateProviderRule(filteredEvents, snapshot?.providerRule, exportNow),
    [exportNow, filteredEvents, snapshot?.providerRule],
  );
  const summarySession = range === 'session' ? selectedSession : undefined;

  const summaryInput = useMemo(() => {
    if (!snapshot) return undefined;
    return {
      profile: snapshot.profile,
      session: summarySession,
      events: filteredEvents,
      urgentEvents: filteredUrgent,
      providerRuleResult: exportProviderRuleResult,
      now: exportNow,
      rangeLabel: formatRangeLabel(range, selectedSession),
      appVersion: '1.0.0',
      includeNotes,
      includeUrgentEvents: includeUrgent,
    };
  }, [
    exportNow,
    exportProviderRuleResult,
    filteredEvents,
    filteredUrgent,
    includeNotes,
    includeUrgent,
    range,
    selectedSession,
    snapshot,
    summarySession,
  ]);
  const preview = useMemo(() => (summaryInput ? buildSummaryText(summaryInput) : ''), [summaryInput]);

  async function sharePreview() {
    if (!summaryInput) return;
    setSharing(true);
    try {
      if (format === 'plain_text') {
        await Share.share({ message: preview });
      } else {
        const { uri } = await Print.printToFileAsync({ html: buildSummaryPdfHtml(summaryInput) });
        await shareFile(uri, 'application/pdf');
      }
    } catch (error) {
      Alert.alert('Share failed', error instanceof Error ? error.message : 'The share sheet could not be opened.');
    } finally {
      setSharing(false);
    }
  }

  if (!snapshot) {
    return (
      <Sheet>
        <Screen
          headerTitle="Share"
          headerLeft={<IconButton icon={Icons.X} label="Close" onPress={() => router.back()} />}
        >
          <EmptyState
            icon={Icons.Send}
            title="Nothing to share yet"
            body="Time a contraction first, then come back here for a preview."
          />
        </Screen>
      </Sheet>
    );
  }

  const formatIcon = format === 'pdf' ? Icons.FileText : Icons.Send;

  return (
    <Sheet>
      <Screen
        scrollable
        background="grouped"
        largeTitle="Share"
        headerLeft={<IconButton icon={Icons.X} label="Close" onPress={() => router.back()} />}
      >
        <ListSection header="Range">
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
            <SegmentedControl options={ranges} value={range} onChange={setRange} />
          </View>
        </ListSection>

        <ListSection header="Format">
          {formats.map((option) => (
            <ListRow
              key={option.key}
              title={option.label}
              leading={{
                icon: option.key === 'pdf' ? Icons.FileText : Icons.Send,
                color: option.color,
              }}
              trailing="check"
              selected={format === option.key}
              onPress={() => setFormat(option.key)}
            />
          ))}
        </ListSection>

        <ListSection header="Privacy" footer="Files are generated locally. No upload, account, or share link is created.">
          <ListRow
            title="Include notes"
            trailing={
              <Switch
                value={includeNotes}
                onValueChange={setIncludeNotes}
                ios_backgroundColor={colors.tertiarySystemFill}
                trackColor={{ true: colors.systemGreen, false: colors.tertiarySystemFill }}
              />
            }
          />
          <ListRow
            title="Include urgent events"
            trailing={
              <Switch
                value={includeUrgent}
                onValueChange={setIncludeUrgent}
                ios_backgroundColor={colors.tertiarySystemFill}
                trackColor={{ true: colors.systemGreen, false: colors.tertiarySystemFill }}
              />
            }
          />
        </ListSection>

        <ListSection>
          <ListRow
            title={showPreview ? 'Hide preview' : 'Show preview'}
            leading={{ icon: Icons.FileText, color: colors.systemGray }}
            trailing="chevron"
            onPress={() => setShowPreview((value) => !value)}
          />
          {showPreview ? (
            <ScrollView
              style={{ maxHeight: 220, paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}
            >
              <Footnote style={{ fontFamily: 'Courier' }}>{preview}</Footnote>
            </ScrollView>
          ) : null}
        </ListSection>

        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, gap: spacing.xs }}>
          <Button
            variant="filled"
            size="lg"
            label={`Share ${formatLabel(format)}`}
            leadingIcon={formatIcon}
            onPress={sharePreview}
            loading={sharing}
            fullWidth
          />
          <Caption1 color="tertiary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Content version {CONTENT_VERSION}
          </Caption1>
        </View>
      </Screen>
    </Sheet>
  );
}

function rangeStartIso(range: RangeKey, now: string): string {
  switch (range) {
    case 'today':
      return startOfLocalDayIso(new Date(now));
    case 'last24':
      return minutesAgo(24 * 60, now);
    case 'session':
      return minutesAgo(24 * 60, now);
  }
}

function filterEvents(events: ContractionEvent[], range: RangeKey, now: string, session?: ContractionSession): ContractionEvent[] {
  if (range === 'session') {
    return session ? events.filter((event) => event.sessionId === session.id) : [];
  }
  const start = rangeStartIso(range, now);
  return events.filter((event) => parseIso(event.startAt) >= parseIso(start));
}

function filterUrgentEvents(events: UrgentEvent[], range: RangeKey, now: string, session?: ContractionSession): UrgentEvent[] {
  if (range === 'session') {
    return session ? events.filter((event) => event.sessionId === session.id) : [];
  }
  const start = rangeStartIso(range, now);
  return events.filter((event) => parseIso(event.occurredAt) >= parseIso(start));
}

async function shareFile(uri: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Share unavailable', 'The native share sheet is not available on this device.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType });
}

function formatLabel(format: ShareFormat): string {
  return format === 'plain_text' ? 'message' : format.toUpperCase();
}

function formatRangeLabel(range: RangeKey, session?: ContractionSession): string {
  switch (range) {
    case 'today':
      return 'Today';
    case 'last24':
      return 'Last 24 hours';
    case 'session':
      if (!session) {
        return 'Session';
      }
      return session.status === 'active' ? 'Current session' : 'Latest session';
  }
}
