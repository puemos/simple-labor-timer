import { StyleSheet, View } from 'react-native';
import { formatShortDuration } from '@/domain/timing/timeMath';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { MetricTile } from '@/ui/components';
import { Icons } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

export type MetricsRowProps = {
  lastDurationSeconds?: number;
  lastIntervalSeconds?: number;
};

export function MetricsRow({ lastDurationSeconds, lastIntervalSeconds }: MetricsRowProps) {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <MetricTile label={t('timer.duration')} value={formatShortDuration(lastDurationSeconds, { t, locale })} icon={Icons.Timer} />
      <MetricTile label={t('timer.interval')} value={formatShortDuration(lastIntervalSeconds, { t, locale })} icon={Icons.Clock} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
