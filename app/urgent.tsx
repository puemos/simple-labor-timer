import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { hapticImpactLight, hapticWarning } from '@/native/haptics';
import { urgentTypeLabel } from '@/domain/rules/urgentRules';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { UrgentType } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import {
  Body,
  Button,
  Caption1,
  Footnote,
  Headline,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  Sheet,
  Subhead,
} from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

const urgentItems: { type: UrgentType; icon: typeof Icons.Siren; color: string; labelKey: string }[] = [
  { type: 'water_broke', icon: Icons.Droplets, color: '#0A84FF', labelKey: 'urgent.watersBroke' },
  { type: 'vaginal_bleeding', icon: Icons.Waves, color: '#FF453A', labelKey: 'urgent.vaginalBleeding' },
  { type: 'reduced_fetal_movement', icon: Icons.HeartPulse, color: '#FF2D55', labelKey: 'urgent.reducedMovement' },
  { type: 'under_37_weeks_labor_concern', icon: Icons.AlertTriangle, color: '#FF9F0A', labelKey: 'urgent.under37Weeks' },
  { type: 'contraction_over_2_min', icon: Icons.Flame, color: '#FF9F0A', labelKey: 'urgent.over2Minutes' },
  { type: 'severe_or_unusual_pain', icon: Icons.ShieldAlert, color: '#FF453A', labelKey: 'urgent.severePain' },
  { type: 'fever_unwell', icon: Icons.Thermometer, color: '#FF9500', labelKey: 'urgent.feverUnwell' },
  { type: 'planned_c_section_or_call_early', icon: Icons.Siren, color: '#5856D6', labelKey: 'urgent.callEarlyInstructions' },
];

export default function UrgentRoute() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, spacing, radii } = useTheme();
  const { actions, busy, snapshot, urgentRuleResult } = useContractionApp();
  const [recordedFlash, setRecordedFlash] = useState<{ type: UrgentType; id?: string } | null>(null);

  useEffect(() => {
    if (!recordedFlash) return;
    const id = setTimeout(() => setRecordedFlash(null), 3500);
    return () => clearTimeout(id);
  }, [recordedFlash]);

  async function record(type: UrgentType) {
    void hapticWarning();
    await actions.recordUrgent(type, undefined, true);
    setRecordedFlash({ type });
  }

  async function undoLast() {
    void hapticImpactLight();
    await actions.undo();
    setRecordedFlash(null);
  }

  const phones = [
    { label: t('settings.careTeam'), value: snapshot?.profile.careTeamPhone },
    { label: t('settings.birthLocation'), value: snapshot?.profile.birthLocationPhone },
    { label: snapshot?.profile.doulaName || t('urgent.doula'), value: snapshot?.profile.doulaPhone },
    { label: t('settings.emergency'), value: snapshot?.profile.emergencyPhone, emergency: true },
  ];

  return (
    <Sheet>
      <Screen
        scrollable
        background="grouped"
        largeTitle={t('urgent.title')}
        headerLeft={<IconButton icon={Icons.X} label={t('common.close')} onPress={() => router.back()} />}
      >
        <View style={{ paddingHorizontal: spacing.base, marginBottom: spacing.base }}>
          {urgentRuleResult.active ? (
            <View
              style={{
                backgroundColor: colors.urgent,
                borderRadius: radii.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Icons.AlertTriangle color={colors.onUrgent} size={20} strokeWidth={2} />
              <Headline color="onUrgent" style={{ flex: 1 }}>
                {urgentRuleResult.message}
              </Headline>
            </View>
          ) : (
            <Subhead color="secondary">
              {t('urgent.intro')}
            </Subhead>
          )}
        </View>

        <ListSection header={t('urgent.contact')}>
          {phones
            .filter((phone) => phone.value)
            .map((phone) => (
              <View key={phone.label} style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.xs }}>
                <Button
                  variant={phone.emergency ? 'destructive' : 'filled'}
                  size="lg"
                  leadingIcon={Icons.Phone}
                  label={phone.label}
                  onPress={() => void Linking.openURL(`tel:${phone.value!.replace(/[^\d+]/g, '')}`)}
                  fullWidth
                />
              </View>
            ))}
          {phones.every((phone) => !phone.value) ? (
            <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
              <Body color="secondary" style={{ marginBottom: spacing.sm }}>
                {t('urgent.noContacts')}
              </Body>
              <Button variant="tinted" label={t('urgent.addContacts')} onPress={() => router.push('/settings')} fullWidth />
            </View>
          ) : null}
        </ListSection>

        <ListSection header={t('urgent.recordWarningSign')} footer={t('urgent.recordWarningFooter')}>
          {urgentItems.map((item) => (
            <ListRow
              key={item.type}
              title={t(item.labelKey)}
              leading={{ icon: item.icon, color: item.color }}
              trailing="chevron"
              onPress={() => record(item.type)}
              disabled={busy}
            />
          ))}
        </ListSection>

        {recordedFlash ? (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <View style={{ paddingHorizontal: spacing.base, marginBottom: spacing.base }}>
              <View
                style={{
                  backgroundColor: colors.secondarySystemBackground,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Icons.Check color={colors.success} size={20} strokeWidth={2.4} />
                <Body style={{ flex: 1 }}>{t('urgent.recorded', { label: urgentTypeLabel(recordedFlash.type, { t, locale }) })}</Body>
                <Button variant="plain" size="sm" label={t('common.undo')} onPress={undoLast} />
              </View>
            </View>
          </Animated.View>
        ) : null}

        <ListSection header={t('urgent.recordedInSession')}>
          {snapshot?.urgentEvents.length ? (
            snapshot.urgentEvents.map((event) => (
              <ListRow
                key={event.id}
                title={urgentTypeLabel(event.type, { t, locale })}
                subtitle={event.note}
                trailing="value"
                value={formatTimeOnly(event.occurredAt, { t, locale })}
              />
            ))
          ) : (
            <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
              <Footnote color="secondary">{t('urgent.noneRecorded')}</Footnote>
            </View>
          )}
        </ListSection>

        <View style={{ height: spacing.lg }} />
        {/* Cap the bottom with a tiny version note */}
        <Caption1 color="tertiary" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          {t('urgent.footer')}
        </Caption1>
      </Screen>
    </Sheet>
  );
}
