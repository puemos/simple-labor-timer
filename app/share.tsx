import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Switch, View } from 'react-native';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { buildContractionCsv } from '@/domain/export/csvRows';
import { buildSummaryText, summaryTextToHtml } from '@/domain/export/summaryText';
import { minutesAgo, parseIso, startOfLocalDayIso } from '@/domain/timing/timeMath';
import { ContractionEvent, ShareFormat, ShareTarget } from '@/domain/types';
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
  { key: 'plain_text', label: 'Plain text', color: '#007AFF' },
  { key: 'pdf', label: 'PDF', color: '#FF3B30' },
  { key: 'csv', label: 'CSV (spreadsheet)', color: '#34C759' },
];

const targets: { key: ShareTarget; label: string }[] = [
  { key: 'hospital_triage', label: 'Hospital triage' },
  { key: 'midwife_ob', label: 'OB / Midwife' },
  { key: 'doula', label: 'Doula' },
  { key: 'partner', label: 'Partner' },
  { key: 'self', label: 'Self' },
];

export default function ShareRoute() {
  const { colors, spacing } = useTheme();
  const { now, providerRuleResult, snapshot } = useContractionApp();
  const [range, setRange] = useState<RangeKey>('session');
  const [format, setFormat] = useState<ShareFormat>('plain_text');
  const [target, setTarget] = useState<ShareTarget>('hospital_triage');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeUrgent, setIncludeUrgent] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const filteredEvents = useMemo(
    () => filterEvents(snapshot?.events ?? [], range, now, snapshot?.activeSession?.startedAt),
    [now, range, snapshot?.activeSession?.startedAt, snapshot?.events],
  );
  const filteredUrgent = useMemo(() => {
    const start = rangeStartIso(range, now, snapshot?.activeSession?.startedAt);
    return (snapshot?.urgentEvents ?? []).filter((event) => parseIso(event.occurredAt) >= parseIso(start));
  }, [now, range, snapshot?.activeSession?.startedAt, snapshot?.urgentEvents]);

  const preview = useMemo(() => {
    if (!snapshot) return '';
    return buildSummaryText({
      profile: snapshot.profile,
      session: snapshot.activeSession,
      events: filteredEvents,
      urgentEvents: filteredUrgent,
      providerRuleResult,
      now,
      appVersion: '1.0.0',
      includeNotes,
      includeUrgentEvents: includeUrgent,
    });
  }, [filteredEvents, filteredUrgent, includeNotes, includeUrgent, now, providerRuleResult, snapshot]);

  async function sharePreview() {
    if (!snapshot) return;
    setSharing(true);
    try {
      if (format === 'plain_text') {
        await Share.share({ message: preview });
      } else if (format === 'pdf') {
        const { uri } = await Print.printToFileAsync({ html: summaryTextToHtml(preview) });
        await shareFile(uri, 'application/pdf');
      } else {
        const csv = buildContractionCsv(filteredEvents, now);
        const fileUri = `${FileSystem.cacheDirectory}contractions-${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csv);
        await shareFile(fileUri, 'text/csv');
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

  const formatIcon = format === 'csv' ? Icons.FileSpreadsheet : format === 'pdf' ? Icons.FileText : Icons.Send;

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
                icon: option.key === 'csv' ? Icons.FileSpreadsheet : option.key === 'pdf' ? Icons.FileText : Icons.Send,
                color: option.color,
              }}
              trailing="check"
              selected={format === option.key}
              onPress={() => setFormat(option.key)}
            />
          ))}
        </ListSection>

        <ListSection header="Recipient">
          <ListRow
            title="Recipient"
            value={targets.find((item) => item.key === target)?.label}
            trailing="value"
            onPress={() => promptTarget(target, setTarget)}
          />
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
              <Footnote style={{ fontFamily: 'Courier' }}>{format === 'csv' ? buildContractionCsv(filteredEvents, now) : preview}</Footnote>
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

function rangeStartIso(range: RangeKey, now: string, sessionStart?: string): string {
  switch (range) {
    case 'today':
      return startOfLocalDayIso(new Date(now));
    case 'last24':
      return minutesAgo(24 * 60, now);
    case 'session':
      return sessionStart ?? minutesAgo(24 * 60, now);
  }
}

function filterEvents(events: ContractionEvent[], range: RangeKey, now: string, sessionStart?: string): ContractionEvent[] {
  const start = rangeStartIso(range, now, sessionStart);
  return events.filter((event) => parseIso(event.startAt) >= parseIso(start));
}

async function shareFile(uri: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Share unavailable', 'The native share sheet is not available on this device.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType });
}

function formatLabel(format: ShareFormat): string {
  return format === 'plain_text' ? 'text' : format.toUpperCase();
}

function promptTarget(current: ShareTarget, setTarget: (value: ShareTarget) => void) {
  Alert.alert(
    'Recipient',
    'Who is this for?',
    [
      ...targets.map((option) => ({
        text: `${option.label}${current === option.key ? ' ✓' : ''}`,
        onPress: () => setTarget(option.key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ],
  );
}
