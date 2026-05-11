import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { AppT, LanguagePreference, languageOptions, useAppLanguage, useAppTranslation } from '@/i18n';
import {
  applyMockContractionScenario,
  MOCK_CONTRACTION_SCENARIOS,
} from '@/dev/mockContractionScenarios';
import type { MockContractionScenarioKey } from '@/dev/mockContractionScenarios';
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

const themeOptions: { key: ThemePreference; labelKey: string }[] = [
  { key: 'system', labelKey: 'common.system' },
  { key: 'light', labelKey: 'common.light' },
  { key: 'dark', labelKey: 'common.dark' },
];

const CUSTOM_RULE_KEY = 'custom';

const rulePresets: { key: string; label: string; intervalMinutes: string }[] = [
  { key: '5-1-1', label: '5-1-1', intervalMinutes: '5' },
  { key: '4-1-1', label: '4-1-1', intervalMinutes: '4' },
  { key: '3-1-1', label: '3-1-1', intervalMinutes: '3' },
  { key: CUSTOM_RULE_KEY, label: '', intervalMinutes: '' },
];

export default function SettingsRoute() {
  const { t } = useAppTranslation();
  const { locale, preference: languagePreference, setPreference: setLanguagePreference } = useAppLanguage();
  const { colors, scheme, spacing, preference: themePreference, setPreference: setThemePreference } = useTheme();
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
    actionText: t('settings.callCareTeamAction'),
  });

  useEffect(() => {
    if (!snapshot) return;
    setProfile({
      careTeamPhone: snapshot.profile.careTeamPhone ?? '',
      birthLocationPhone: snapshot.profile.birthLocationPhone ?? '',
      doulaName: snapshot.profile.doulaName ?? '',
      doulaPhone: snapshot.profile.doulaPhone ?? '',
      emergencyPhone: snapshot.profile.emergencyPhone,
      estimatedDueDate: formatDateOnly(snapshot.profile.estimatedDueDate, { t, locale }),
      gestationalWeeks:
        snapshot.profile.gestationalAgeAtSetupDays !== undefined
          ? String(Math.floor(snapshot.profile.gestationalAgeAtSetupDays / 7))
          : '',
      highRiskOrCallEarly: snapshot.profile.highRiskOrCallEarly,
      plannedCesarean: snapshot.profile.plannedCesarean,
    });
    if (snapshot.providerRule) {
      setRule({
        label: localizedProviderRuleLabel(snapshot.providerRule.label, t),
        intervalMinutes: String(Math.round(snapshot.providerRule.intervalSecondsMax / 60)),
        durationSeconds: String(snapshot.providerRule.durationSecondsMin),
        windowMinutes: String(snapshot.providerRule.observationWindowMinutes),
        actionText: localizedProviderActionText(snapshot.providerRule.actionText, t),
      });
    }
  }, [locale, snapshot, t]);

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
      label: providerRuleLabelForStorage(next.label, t),
      intervalSecondsMax: Math.max(1, Number(next.intervalMinutes) || 5) * 60,
      durationSecondsMin: Math.max(1, Number(next.durationSeconds) || 60),
      observationWindowMinutes: Math.max(1, Number(next.windowMinutes) || 60),
      actionText: providerActionTextForStorage(next.actionText, t),
      source: 'user_provider',
    });
  }

  function applyPreset(presetKey: string) {
    const preset = rulePresets.find((item) => item.key === presetKey);
    if (!preset) return;
    if (preset.key === CUSTOM_RULE_KEY) {
      void commitRule({ label: t('common.custom') });
      return;
    }
    void commitRule({
      label: preset.label,
      intervalMinutes: preset.intervalMinutes,
      durationSeconds: '60',
      windowMinutes: '60',
    });
  }

  function confirmMockScenario(scenarioKey: MockContractionScenarioKey) {
    const scenario = MOCK_CONTRACTION_SCENARIOS.find((item) => item.key === scenarioKey);
    if (!scenario) return;
    Alert.alert(
      t('settings.loadMockTitle'),
      t('settings.loadMockBody', { name: mockScenarioName(scenario.key, t) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.load'),
          style: 'destructive',
          onPress: async () => {
            try {
              await applyMockContractionScenario(scenarioKey);
              await actions.reload();
            } catch (caught) {
              Alert.alert(
                t('settings.mockFailedTitle'),
                caught instanceof Error ? caught.message : t('settings.mockFailedBody'),
              );
            }
          },
        },
      ],
    );
  }

  const isCustomRule = !rulePresets.slice(0, 3).some((preset) => preset.label === rule.label);
  const ruleSegmentValue = isCustomRule ? CUSTOM_RULE_KEY : rule.label;

  return (
    <Screen
      scrollable
      background="grouped"
      largeTitle={t('settings.title')}
      headerLeft={<IconButton icon={Icons.ChevronLeft} label={t('common.back')} onPress={() => router.back()} />}
    >
      <ListSection header={t('settings.appearance')}>
        <ListRow
          title={t('settings.theme')}
          value={t(themeOptions.find((option) => option.key === themePreference)?.labelKey ?? 'common.system')}
          trailing="value"
          onPress={() => showThemePicker(themePreference, setThemePreference, t)}
        />
        <ListRow
          title={t('language.title')}
          value={t(languageOptions.find((option) => option.key === languagePreference)?.labelKey ?? 'language.system')}
          trailing="value"
          onPress={() => showLanguagePicker(languagePreference, setLanguagePreference, t)}
        />
      </ListSection>

      <ListSection header={t('settings.careTeam')} footer={t('settings.careTeamFooter')}>
        <PhoneRow
          title={t('settings.careTeam')}
          value={profile.careTeamPhone}
          onCommit={(careTeamPhone) => commitProfile({ careTeamPhone })}
        />
        <PhoneRow
          title={t('settings.birthLocation')}
          value={profile.birthLocationPhone}
          onCommit={(birthLocationPhone) => commitProfile({ birthLocationPhone })}
        />
        <PhoneRow
          title={t('settings.doulaName')}
          value={profile.doulaName}
          keyboard="default"
          onCommit={(doulaName) => commitProfile({ doulaName })}
        />
        <PhoneRow
          title={t('settings.doulaPhone')}
          value={profile.doulaPhone}
          onCommit={(doulaPhone) => commitProfile({ doulaPhone })}
        />
        <PhoneRow
          title={t('settings.emergency')}
          value={profile.emergencyPhone}
          onCommit={(emergencyPhone) => commitProfile({ emergencyPhone })}
        />
      </ListSection>

      <ListSection header={t('settings.pregnancy')}>
        <PhoneRow
          title={t('settings.dueDate')}
          value={profile.estimatedDueDate}
          placeholder={t('settings.dueDatePlaceholder')}
          keyboard="default"
          onCommit={(estimatedDueDate) => commitProfile({ estimatedDueDate })}
        />
        <PhoneRow
          title={t('settings.gestationalWeeks')}
          value={profile.gestationalWeeks}
          keyboard="number-pad"
          onCommit={(gestationalWeeks) => commitProfile({ gestationalWeeks })}
        />
        <ListRow
          title={t('settings.highRiskOrCallEarly')}
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
          title={t('settings.plannedCSection')}
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
        header={t('settings.callRule')}
        footer={t('settings.callRuleFooter')}
      >
        <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
          <SegmentedControl
            options={rulePresets.map((preset) => ({ key: preset.key, label: preset.label || t('common.custom') }))}
            value={ruleSegmentValue}
            onChange={applyPreset}
          />
        </View>
        {isCustomRule ? (
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm }}>
            <TextField label={t('settings.ruleLabel')} value={rule.label} onChangeText={(label) => setRule((value) => ({ ...value, label }))} onBlur={() => commitRule({})} />
            <TextField
              label={t('settings.intervalMinutesMax')}
              value={rule.intervalMinutes}
              keyboardType="number-pad"
              onChangeText={(intervalMinutes) => setRule((value) => ({ ...value, intervalMinutes }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label={t('settings.durationSecondsMin')}
              value={rule.durationSeconds}
              keyboardType="number-pad"
              onChangeText={(durationSeconds) => setRule((value) => ({ ...value, durationSeconds }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label={t('settings.windowMinutes')}
              value={rule.windowMinutes}
              keyboardType="number-pad"
              onChangeText={(windowMinutes) => setRule((value) => ({ ...value, windowMinutes }))}
              onBlur={() => commitRule({})}
            />
            <TextField
              label={t('settings.actionText')}
              value={rule.actionText}
              onChangeText={(actionText) => setRule((value) => ({ ...value, actionText }))}
              onBlur={() => commitRule({})}
            />
          </View>
        ) : null}
      </ListSection>

      {__DEV__ ? (
        <ListSection
          header={t('settings.mockData')}
          footer={t('settings.mockDataFooter')}
        >
          {MOCK_CONTRACTION_SCENARIOS.map((scenario) => (
            <ListRow
              key={scenario.key}
              title={mockScenarioName(scenario.key, t)}
              subtitle={mockScenarioDescription(scenario.key, t)}
              trailing="chevron"
              onPress={() => confirmMockScenario(scenario.key)}
            />
          ))}
        </ListSection>
      ) : null}

      <ListSection header={t('settings.privacy')} footer={t('settings.privacyFooter')}>
        <ListRow
          title={t('settings.deleteAllData')}
          destructive
          centerTitle
          onPress={() =>
            Alert.alert(t('settings.deleteAllTitle'), t('settings.deleteAllBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: actions.deleteAllData },
            ])
          }
        />
      </ListSection>

      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: 4 }}>
        <Caption1 color="secondary" style={{ textAlign: 'center' }}>
          {t('settings.contentVersion', { version: '1.0.0', contentVersion: CONTENT_VERSION })}
        </Caption1>
        <Footnote color="secondary" style={{ textAlign: 'center' }}>
          {t('settings.themeStatus', { scheme })}
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

function showThemePicker(current: ThemePreference, set: (value: ThemePreference) => void, t: AppT) {
  Alert.alert(t('settings.theme'), t('settings.chooseTheme'), [
    {
      text: `${t('common.system')}${current === 'system' ? ' ✓' : ''}`,
      onPress: () => set('system'),
    },
    {
      text: `${t('common.light')}${current === 'light' ? ' ✓' : ''}`,
      onPress: () => set('light'),
    },
    {
      text: `${t('common.dark')}${current === 'dark' ? ' ✓' : ''}`,
      onPress: () => set('dark'),
    },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}

function showLanguagePicker(
  current: LanguagePreference,
  set: (value: LanguagePreference) => void,
  t: AppT,
) {
  Alert.alert(t('language.title'), t('language.choose'), [
    ...languageOptions.map((option) => ({
      text: `${t(option.labelKey)}${current === option.key ? ' ✓' : ''}`,
      onPress: () => set(option.key),
    })),
    { text: t('common.cancel'), style: 'cancel' as const },
  ]);
}

function mockScenarioName(key: MockContractionScenarioKey, t: AppT): string {
  return t(`settings.mockScenarios.${key}.name`);
}

function mockScenarioDescription(key: MockContractionScenarioKey, t: AppT): string {
  return t(`settings.mockScenarios.${key}.description`);
}

function localizedProviderActionText(actionText: string, t: AppT): string {
  return actionText && actionText !== 'Call your care team' ? actionText : t('settings.callCareTeamAction');
}

function providerActionTextForStorage(actionText: string, t: AppT): string {
  const trimmed = actionText.trim();
  return trimmed && trimmed !== t('settings.callCareTeamAction') && trimmed !== 'Call your care team' ? trimmed : '';
}

function localizedProviderRuleLabel(label: string, t: AppT): string {
  return label && label !== 'Custom' ? label : t('common.custom');
}

function providerRuleLabelForStorage(label: string, t: AppT): string {
  const trimmed = label.trim();
  return trimmed && trimmed !== t('common.custom') && trimmed !== 'Custom' ? trimmed : '';
}

function blank(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
