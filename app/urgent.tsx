import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { hapticImpactLight, hapticWarning } from '@/native/haptics';
import { urgentTypeLabels } from '@/domain/rules/urgentRules';
import { formatTimeOnly } from '@/domain/timing/dateFormat';
import { UrgentType } from '@/domain/types';
import { useContractionApp } from '@/state/useContractionStore';
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

const urgentItems: { type: UrgentType; icon: typeof Icons.Siren; color: string; label: string }[] = [
  { type: 'water_broke', icon: Icons.Droplets, color: '#0A84FF', label: 'Waters broke' },
  { type: 'vaginal_bleeding', icon: Icons.Waves, color: '#FF453A', label: 'Vaginal bleeding' },
  { type: 'reduced_fetal_movement', icon: Icons.HeartPulse, color: '#FF2D55', label: 'Reduced movement' },
  { type: 'under_37_weeks_labor_concern', icon: Icons.AlertTriangle, color: '#FF9F0A', label: 'Under 37 weeks' },
  { type: 'contraction_over_2_min', icon: Icons.Flame, color: '#FF9F0A', label: 'Over 2 minutes' },
  { type: 'severe_or_unusual_pain', icon: Icons.ShieldAlert, color: '#FF453A', label: 'Severe or unusual pain' },
  { type: 'fever_unwell', icon: Icons.Thermometer, color: '#FF9500', label: 'Fever / unwell' },
  { type: 'planned_c_section_or_call_early', icon: Icons.Siren, color: '#5856D6', label: 'Call early instructions' },
];

export default function UrgentRoute() {
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
    { label: 'Care team', value: snapshot?.profile.careTeamPhone },
    { label: 'Birth location', value: snapshot?.profile.birthLocationPhone },
    { label: snapshot?.profile.doulaName || 'Doula', value: snapshot?.profile.doulaPhone },
    { label: 'Emergency', value: snapshot?.profile.emergencyPhone, emergency: true },
  ];

  return (
    <Sheet>
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.urgent,
            opacity: 0.06,
          }}
        />
        <Screen
          scrollable
          background="grouped"
          largeTitle="Urgent"
          headerLeft={<IconButton icon={Icons.X} label="Close" onPress={() => router.back()} />}
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
                Use this screen for warning signs that override timing — call your care team and record the event below.
              </Subhead>
            )}
          </View>

          <ListSection header="Contact">
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
                  No contacts saved yet.
                </Body>
                <Button variant="tinted" label="Add contacts" onPress={() => router.push('/settings')} fullWidth />
              </View>
            ) : null}
          </ListSection>

          <ListSection header="Record warning sign" footer="Tapping a row records the event immediately.">
            {urgentItems.map((item) => (
              <ListRow
                key={item.type}
                title={item.label}
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
                  <Body style={{ flex: 1 }}>Recorded {urgentTypeLabels[recordedFlash.type]}.</Body>
                  <Button variant="plain" size="sm" label="Undo" onPress={undoLast} />
                </View>
              </View>
            </Animated.View>
          ) : null}

          <ListSection header="Recorded in this session">
            {snapshot?.urgentEvents.length ? (
              snapshot.urgentEvents.map((event) => (
                <ListRow
                  key={event.id}
                  title={urgentTypeLabels[event.type]}
                  subtitle={event.note}
                  trailing="value"
                  value={formatTimeOnly(event.occurredAt)}
                />
              ))
            ) : (
              <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
                <Footnote color="secondary">No urgent events recorded.</Footnote>
              </View>
            )}
          </ListSection>

          <View style={{ height: spacing.lg }} />
          {/* Cap the bottom with a tiny version note */}
          <Caption1 color="tertiary" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            Recording an urgent event keeps timing data intact.
          </Caption1>
        </Screen>
      </View>
    </Sheet>
  );
}
