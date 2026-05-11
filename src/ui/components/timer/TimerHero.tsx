import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatDuration, secondsBetween } from '@/domain/timing/timeMath';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { Footnote, Headline, Subhead } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { formatActiveDuration } from '@/ui/components/timer/utils';

export type TimerHeroState = 'measuring' | 'resting' | 'startup' | 'ready';

export type TimerHeroProps = {
  state: TimerHeroState;
  busy: boolean;
  onPress: () => void;
  now: string;
  activeStartedAt?: string;
  restAnchorEndAt?: string;
};

export function TimerHero({ state, busy, onPress, now, activeStartedAt, restAnchorEndAt }: TimerHeroProps) {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { colors, scheme, spacing, radii, shadows, typography } = useTheme();
  const measuring = state === 'measuring';
  const presentingResting = state === 'resting';

  const stateLabel = measuring
    ? t('timer.stateNowTiming')
    : presentingResting
      ? t('timer.stateResting')
      : t('timer.stateReady');
  const timerActionLabel = measuring ? t('timer.endContraction') : t('timer.startContraction');
  const badgeBg = measuring ? colors.contractionActive : colors.systemFill;
  const badgeColor = measuring ? colors.onContractionActive : colors.label;
  const heroBackground = measuring
    ? colors.contractionActiveSubtle
    : scheme === 'dark'
      ? 'rgba(10, 132, 255, 0.16)'
      : 'rgba(0, 122, 255, 0.06)';
  const heroBorderColor = measuring ? colors.contractionActive : colors.accent;
  const actionBackground = measuring ? colors.contractionActive : colors.accent;
  const actionLabelColor = measuring ? colors.onContractionActive : colors.onAccent;
  const timerSeconds = measuring
    ? formatActiveDuration(activeStartedAt, now)
    : presentingResting && restAnchorEndAt
      ? secondsBetween(restAnchorEndAt, now)
      : 0;
  const timerLabel = formatDuration(timerSeconds, { t, locale });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={timerActionLabel}
      accessibilityHint={t('timer.toggleHint')}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: busy ? 0.55 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.hero,
          {
            backgroundColor: heroBackground,
            borderColor: heroBorderColor,
            borderRadius: 42,
            ...shadows.card,
          },
        ]}
      >
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: badgeBg,
          }}
        >
          <Footnote
            style={{ color: badgeColor, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}
            maxFontSizeMultiplier={1.2}
          >
            {stateLabel}
          </Footnote>
        </View>

        <Animated.Text
          style={[
            typography.timer,
            { color: colors.label, marginTop: spacing.lg, marginBottom: spacing.md },
          ]}
          adjustsFontSizeToFit
          numberOfLines={1}
          maxFontSizeMultiplier={1}
        >
          {timerLabel}
        </Animated.Text>

        <Subhead color="secondary" style={{ textAlign: 'center' }}>
          {measuring ? t('timer.tapToEnd') : presentingResting ? t('timer.tapToStartNext') : t('timer.tapToStart')}
        </Subhead>

        <View
          style={[
            styles.action,
            {
              backgroundColor: actionBackground,
              marginTop: spacing.xl,
              paddingHorizontal: spacing.xl,
            },
          ]}
        >
          {busy ? <ActivityIndicator color={actionLabelColor} /> : null}
          <Headline numberOfLines={1} style={[styles.actionLabel, { color: actionLabelColor }]}>
            {timerActionLabel}
          </Headline>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    minHeight: 320,
  },
  hero: {
    alignItems: 'center',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 320,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  action: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    minWidth: 210,
  },
  actionLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
