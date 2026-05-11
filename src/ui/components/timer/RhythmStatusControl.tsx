import { Pressable, StyleSheet, View } from 'react-native';
import { hapticSelection } from '@/native/haptics';
import { useAppTranslation } from '@/i18n';
import { Card, Footnote, Headline } from '@/ui/components';
import { Icons, ICON_STROKE_WIDTH } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

export type RhythmStatusControlProps = {
  status: string;
  accent?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function RhythmStatusControl({ status, accent, disabled, onPress }: RhythmStatusControlProps) {
  const { t } = useAppTranslation();
  const { colors, radii, spacing } = useTheme();
  const isDisabled = Boolean(disabled);

  const content = (
    <Card accent={accent} padding={spacing.md} style={isDisabled ? styles.disabled : undefined}>
      <View style={styles.row}>
        <View
          style={[
            styles.iconFrame,
            {
              backgroundColor: colors.tertiarySystemFill,
              borderRadius: radii.md,
            },
          ]}
        >
          <Icons.Waves color={colors.accent} size={19} strokeWidth={ICON_STROKE_WIDTH} />
        </View>
        <View style={styles.body}>
          <Footnote color="secondary" numberOfLines={1}>
            {t('timer.rhythm')}
          </Footnote>
          <Headline numberOfLines={1} style={styles.status}>
            {status}
          </Headline>
        </View>
        {isDisabled ? null : <Icons.ChevronRight color={colors.tertiaryLabel} size={19} strokeWidth={ICON_STROKE_WIDTH} />}
      </View>
    </Card>
  );

  if (isDisabled) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('timer.rhythm')}, ${status}`}
      accessibilityHint={t('timer.rhythmHint')}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.62,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconFrame: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    fontWeight: '700',
    marginTop: 1,
  },
});
