import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Switch, View } from 'react-native';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { buildSummaryPdfHtml, buildSummaryText } from '@/domain/export/summaryText';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { minutesAgo, parseIso, startOfLocalDayIso } from '@/domain/timing/timeMath';
import { ContractionEvent, ContractionSession, ShareFormat, UrgentEvent } from '@/domain/types';
import { useAppLanguage, useAppTranslation } from '@/i18n';
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

const ranges: { key: RangeKey; labelKey: string }[] = [
  { key: 'today', labelKey: 'time.today' },
  { key: 'last24', labelKey: 'time.last24h' },
  { key: 'session', labelKey: 'time.session' },
];

const formats: { key: ShareFormat; labelKey: string; color: string }[] = [
  { key: 'plain_text', labelKey: 'share.message', color: '#007AFF' },
  { key: 'pdf', labelKey: 'common.pdf', color: '#FF3B30' },
];

export default function ShareRoute() {
  const { preview: previewParam } = useLocalSearchParams<{ preview?: string }>();
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const { now, snapshot } = useContractionApp();
  const [range, setRange] = useState<RangeKey>('session');
  const [format, setFormat] = useState<ShareFormat>('plain_text');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeUrgent, setIncludeUrgent] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(previewParam === '1');
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
    () => evaluateProviderRule(filteredEvents, snapshot?.providerRule, exportNow, { t, locale }),
    [exportNow, filteredEvents, locale, snapshot?.providerRule, t],
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
      rangeLabel: formatRangeLabel(range, selectedSession, t),
      appVersion: '1.0.0',
      includeNotes,
      includeUrgentEvents: includeUrgent,
      locale,
      t,
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
    t,
    locale,
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
        await shareFile(uri, 'application/pdf', t);
      }
    } catch (error) {
      Alert.alert(t('share.shareFailedTitle'), error instanceof Error ? error.message : t('share.shareFailedBody'));
    } finally {
      setSharing(false);
    }
  }

  if (!snapshot) {
    return (
      <Sheet>
        <Screen
          headerTitle={t('share.title')}
          headerLeft={<IconButton icon={Icons.X} label={t('common.close')} onPress={() => router.back()} />}
        >
          <EmptyState
            icon={Icons.Send}
            title={t('share.nothingTitle')}
            body={t('share.nothingBody')}
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
        largeTitle={t('share.title')}
        headerLeft={<IconButton icon={Icons.X} label={t('common.close')} onPress={() => router.back()} />}
      >
        <ListSection header={t('share.range')}>
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
            <SegmentedControl options={ranges.map((item) => ({ key: item.key, label: t(item.labelKey) }))} value={range} onChange={setRange} />
          </View>
        </ListSection>

        <ListSection header={t('share.format')}>
          {formats.map((option) => (
            <ListRow
              key={option.key}
              title={t(option.labelKey)}
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

        <ListSection header={t('share.privacy')} footer={t('share.privacyFooter')}>
          <ListRow
            title={t('share.includeNotes')}
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
            title={t('share.includeUrgentEvents')}
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
            title={showPreview ? t('share.hidePreview') : t('share.showPreview')}
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
            label={t('share.shareFormat', { format: formatLabel(format, t) })}
            leadingIcon={formatIcon}
            onPress={sharePreview}
            loading={sharing}
            fullWidth
          />
          <Caption1 color="tertiary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {t('share.contentVersion', { contentVersion: CONTENT_VERSION })}
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

async function shareFile(uri: string, mimeType: string, t: (key: string) => string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(t('share.unavailableTitle'), t('share.unavailableBody'));
    return;
  }
  await Sharing.shareAsync(uri, { mimeType });
}

function formatLabel(format: ShareFormat, t: (key: string) => string): string {
  return format === 'plain_text' ? t('share.messageFormat') : format.toUpperCase();
}

function formatRangeLabel(range: RangeKey, session: ContractionSession | undefined, t: (key: string) => string): string {
  switch (range) {
    case 'today':
      return t('time.today');
    case 'last24':
      return t('time.last24Hours');
    case 'session':
      if (!session) {
        return t('time.session');
      }
      return session.status === 'active' ? t('time.currentSession') : t('time.latestSession');
  }
}
