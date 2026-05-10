import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { formatDateOnly, normalizeDateOnly } from '@/domain/timing/dateFormat';
import { useContractionApp } from '@/state/useContractionStore';
import {
  Caption1,
  Footnote,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  SegmentedControl,
  TextField,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { ThemePreference, useTheme } from '@/ui/theme';

const themeOptions: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const rulePresets: { label: string; intervalMinutes: string }[] = [
  { label: '5-1-1', intervalMinutes: '5' },
  { label: '4-1-1', intervalMinutes: '4' },
  { label: '3-1-1', intervalMinutes: '3' },
  { label: 'Custom', intervalMinutes: '' },
];

export default function SettingsRoute() {
  const { colors, scheme, spacing, preference, setPreference } = useTheme();
  const { actions, snapshot } = useContractionApp();

  const [profile, setProfile] = useState({
    careTeamPhone: '',
    birthLocationPhone: '',
    doulaName: '',
    doulaPhone: '',
    emergencyPhone: '911',
    estimatedDueDate: '',
    gestationalWeeks: '',
    highRiskOrCallEarly: false,
    plannedCesarean: false,
  });
  const [rule, setRule] = useState({
    label: '5-1-1',
    intervalMinutes: '5',
    durationSeconds: '60',
    windowMinutes: '60',
    actionText: 'Call your care team',
  });

  useEffect(() => {
    if (!snapshot) return;
    setProfile({
      careTeamPhone: snapshot.profile.careTeamPhone ?? '',
      birthLocationPhone: snapshot.profile.birthLocationPhone ?? '',
      doulaName: snapshot.profile.doulaName ?? '',
      doulaPhone: snapshot.profile.doulaPhone ?? '',
      emergencyPhone: snapshot.profile.emergencyPhone,
      estimatedDueDate: formatDateOnly(snapshot.profile.estimatedDueDate),
      gestationalWeeks:
        snapshot.profile.gestationalAgeAtSetupDays !== undefined
          ? String(Math.floor(snapshot.profile.gestationalAgeAtSetupDays / 7))
          : '',
      highRiskOrCallEarly: snapshot.profile.highRiskOrCallEarly,
      plannedCesarean: snapshot.profile.plannedCesarean,
    });
    if (snapshot.providerRule) {
      setRule({
        label: snapshot.providerRule.label,
        intervalMinutes: String(Math.round(snapshot.providerRule.intervalSecondsMax / 60)),
        durationSeconds: String(snapshot.providerRule.durationSecondsMin),
        windowMinutes: String(snapshot.providerRule.observationWindowMinutes),
        actionText: snapshot.providerRule.actionText,
      });
    }
  }, [snapshot]);

  async function commitProfile(patch: Partial<typeof profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    void hapticSelection();
    await actions.saveProfile({
      careTeamPhone: blank(next.careTeamPhone),
      birthLocationPhone: blank(next.birthLocationPhone),
      doulaName: blank(next.doulaName),
      doulaPhone: blank(next.doulaPhone),
      emergencyPhone: next.emergencyPhone.trim() || '911',
      estimatedDueDate: normalizeDateOnly(next.estimatedDueDate),
      gestationalAgeAtSetupDays: next.gestationalWeeks.trim() ? Math.max(0, Number(next.gestationalWeeks) * 7) : undefined,
      highRiskOrCallEarly: next.highRiskOrCallEarly,
      plannedCesarean: next.plannedCesarean,
    });
  }

  async function commitRule(patch: Partial<typeof rule>) {
    const next = { ...rule, ...patch };
    setRule(next);
    void hapticSelection();
    await actions.saveProviderRule({
      label: next.label.trim() || 'Custom',
      intervalSecondsMax: Math.max(1, Number(next.intervalMinutes) || 5) * 60,
      durationSecondsMin: Math.max(1, Number(next.durationSeconds) || 60),
      observationWindowMinutes: Math.max(1, Number(next.windowMinutes) || 60),
      actionText: next.actionText.trim() || 'Call your care team',
      source: 'user_provider',
    });
  }

  function applyPreset(presetLabel: string) {
    const preset = rulePresets.find((item) => item.label === presetLabel);
    if (!preset) return;
    if (preset.label === 'Custom') {
      void commitRule({ label: 'Custom' });
      return;
    }
    void commitRule({
      label: preset.label,
      intervalMinutes: preset.intervalMinutes,
      durationSeconds: '60',
      windowMinutes: '60',
    });
  }

  const isCustomRule = !rulePresets.slice(0, 3).some((preset) => preset.label === rule.label);
  const ruleSegmentValue = isCustomRule ? 'Custom' : rule.label;

  return (
    <Screen
      scrollable
      background="grouped"
      largeTitle="Settings"
      headerLeft={<IconButton icon={Icons.ChevronLeft} label="Back" onPress={() => router.back()} />}
    >
      <ListSection header="Appearance">
        <ListRow
          title="Theme"
          value={themeOptions.find((option) => option.key === preference)?.label}
          trailing="value"
          onPress={() => showThemePicker(preference, setPreference)}
        />
      </ListSection>

      <ListSection header="Care team" footer="Tap-to-call uses the first available number from this list.">
        <PhoneRow
          title="Care team"
          value={profile.careTeamPhone}
          onCommit={(careTeamPhone) => commitProfile({ careTeamPhone })}
        />
        <PhoneRow
          title="Birth location"
          value={profile.birthLocationPhone}
          onCommit={(birthLocationPhone) => commitProfile({ birthLocationPhone })}
        />
        <PhoneRow
          title="Doula name"
          value={profile.doulaName}
          keyboard="default"
          onCommit={(doulaName) => commitProfile({ doulaName })}
        />
        <PhoneRow
          title="Doula phone"
          value={profile.doulaPhone}
          onCommit={(doulaPhone) => commitProfile({ doulaPhone })}
        />
        <PhoneRow
          title="Emergency"
          value={profile.emergencyPhone}
          onCommit={(emergencyPhone) => commitProfile({ emergencyPhone })}
        />
      </ListSection>

      <ListSection header="Pregnancy">
        <PhoneRow
          title="Due date"
          value={profile.estimatedDueDate}
          placeholder="May 10, 2026"
          keyboard="default"
          onCommit={(estimatedDueDate) => commitProfile({ estimatedDueDate })}
        />
        <PhoneRow
          title="Gestational weeks"
          value={profile.gestationalWeeks}
          keyboard="number-pad"
          onCommit={(gestationalWeeks) => commitProfile({ gestationalWeeks })}
        />
        <ListRow
          title="High risk or call early"
          trailing={
            <Switch
              value={profile.highRiskOrCallEarly}
              onValueChange={(highRiskOrCallEarly) => commitProfile({ highRiskOrCallEarly })}
              ios_backgroundColor={colors.tertiarySystemFill}
              trackColor={{ true: colors.systemGreen, false: colors.tertiarySystemFill }}
            />
          }
        />
        <ListRow
          title="Planned C-section"
          trailing={
            <Switch
              value={profile.plannedCesarean}
              onValueChange={(plannedCesarean) => commitProfile({ plannedCesarean })}
              ios_backgroundColor={colors.tertiarySystemFill}
              trackColor={{ true: colors.systemGreen, false: colors.tertiarySystemFill }}
            />
          }
        />
      </ListSection>

      <ListSection
        header="Call rule"
        footer="Common guidelines to confirm with your care team. The app records timing and does not diagnose labor."
      >
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
          <SegmentedControl
            options={rulePresets.map((preset) => ({ key: preset.label, label: preset.label }))}
            value={ruleSegmentValue}
            onChange={applyPreset}
          />
        </View>
        {isCustomRule || rule.label === 'Custom' ? (
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm }}>
            <TextField label="Rule label" value={rule.label} onChangeText={(label) => setRule((value) => ({ ...value, label }))} onBlur={() => commitRule({})} />
            <TextField
              label="Interval (minutes max)"
              value={rule.intervalMinutes}
              keyboardType="number-pad"
              onChangeText={(intervalMinutes) => setRule((value) => ({ ...value, intervalMinutes }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label="Duration (seconds min)"
              value={rule.durationSeconds}
              keyboardType="number-pad"
              onChangeText={(durationSeconds) => setRule((value) => ({ ...value, durationSeconds }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label="Window (minutes)"
              value={rule.windowMinutes}
              keyboardType="number-pad"
              onChangeText={(windowMinutes) => setRule((value) => ({ ...value, windowMinutes }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label="Action text"
              value={rule.actionText}
              onChangeText={(actionText) => setRule((value) => ({ ...value, actionText }))}
              onBlur={() => commitRule({})}
            />
          </View>
        ) : null}
      </ListSection>

      <ListSection header="Privacy" footer="All data stays on this device unless you choose to share it.">
        <ListRow
          title="Delete all data"
          destructive
          centerTitle
          onPress={() =>
            Alert.alert('Delete all app data?', 'This removes sessions, contractions, urgent events, and edit history from this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: actions.deleteAllData },
            ])
          }
        />
      </ListSection>

      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: 4 }}>
        <Caption1 color="secondary" style={{ textAlign: 'center' }}>
          Contraction Timer · v1.0.0 · Content {CONTENT_VERSION}
        </Caption1>
        <Footnote color="secondary" style={{ textAlign: 'center' }}>
          Theme: {scheme}
        </Footnote>
      </View>

    </Screen>
  );
}

function PhoneRow({
  title,
  value,
  onCommit,
  keyboard = 'phone-pad',
  placeholder,
}: {
  title: string;
  value: string;
  onCommit: (value: string) => void;
  keyboard?: 'phone-pad' | 'number-pad' | 'default';
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <ListRow
      title={title}
      trailing={
        <TextField
          variant="inline"
          rightAlign
          value={draft}
          onChangeText={setDraft}
          onBlur={() => {
            if (draft !== value) onCommit(draft);
          }}
          keyboardType={keyboard}
          placeholder={placeholder ?? '—'}
        />
      }
    />
  );
}

function showThemePicker(current: ThemePreference, set: (value: ThemePreference) => void) {
  Alert.alert('Theme', 'Choose a theme', [
    {
      text: `System${current === 'system' ? ' ✓' : ''}`,
      onPress: () => set('system'),
    },
    {
      text: `Light${current === 'light' ? ' ✓' : ''}`,
      onPress: () => set('light'),
    },
    {
      text: `Dark${current === 'dark' ? ' ✓' : ''}`,
      onPress: () => set('dark'),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function blank(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
