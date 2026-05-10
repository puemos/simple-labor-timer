import { ReactNode } from 'react';
import { View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { ICON_STROKE_WIDTH } from '@/ui/icons';
import { Subhead, Title3 } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: LucideIcon;
  cta?: ReactNode;
};

export function EmptyState({ title, body, icon: Icon, cta }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxl,
        gap: spacing.md,
      }}
    >
      {Icon ? <Icon color={colors.secondaryLabel} size={48} strokeWidth={ICON_STROKE_WIDTH} /> : null}
      <Title3 style={{ textAlign: 'center' }}>{title}</Title3>
      {body ? (
        <Subhead color="secondary" style={{ textAlign: 'center' }}>
          {body}
        </Subhead>
      ) : null}
      {cta ? <View style={{ marginTop: spacing.sm }}>{cta}</View> : null}
    </View>
  );
}
