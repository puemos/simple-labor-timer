import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTranslation } from '@/i18n';
import { Footnote, Headline } from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

export type HomeAlertBannerProps = {
  accessibilityLabel: string;
  message: string;
  onPress: () => void;
};

export function HomeAlertBanner({ accessibilityLabel, message, onPress }: HomeAlertBannerProps) {
  const { t } = useAppTranslation();
  const { colors, radii, spacing } = useTheme();

  return (
    <Animated.View entering={FadeIn.springify().damping(18).stiffness(180)} exiting={FadeOut.duration(160)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: colors.urgent,
            borderRadius: radii.lg,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icons.AlertTriangle color={colors.onUrgent} size={20} strokeWidth={2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Headline color="onUrgent" numberOfLines={1}>
            {t('timer.callNow')}
          </Headline>
          <Footnote color="onUrgent" style={styles.body} numberOfLines={2}>
            {message}
          </Footnote>
        </View>
        <Icons.ChevronRight color={colors.onUrgent} size={18} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 2,
  },
});
