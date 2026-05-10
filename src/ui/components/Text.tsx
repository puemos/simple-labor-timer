import { ComponentProps } from 'react';
import { Text as RNText, StyleProp, TextStyle } from 'react-native';
import { useAppLanguage } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { TypographyVariant } from '@/ui/theme/typography';

type TextColor = 'default' | 'secondary' | 'tertiary' | 'accent' | 'destructive' | 'success' | 'warning' | 'onAccent' | 'onUrgent';

type AppTextProps = Omit<ComponentProps<typeof RNText>, 'style'> & {
  variant?: TypographyVariant;
  color?: TextColor;
  style?: StyleProp<TextStyle>;
};

function useTextColor(color: TextColor): string {
  const { colors } = useTheme();
  switch (color) {
    case 'secondary':
      return colors.secondaryLabel;
    case 'tertiary':
      return colors.tertiaryLabel;
    case 'accent':
      return colors.accent;
    case 'destructive':
      return colors.urgent;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'onAccent':
      return colors.onAccent;
    case 'onUrgent':
      return colors.onUrgent;
    default:
      return colors.label;
  }
}

function AppText({ variant = 'body', color = 'default', style, ...rest }: AppTextProps) {
  const { typography } = useTheme();
  const { isRTL } = useAppLanguage();
  const resolvedColor = useTextColor(color);
  return <RNText {...rest} style={[typography[variant], { color: resolvedColor, writingDirection: isRTL ? 'rtl' : 'ltr' }, style]} />;
}

function makeVariant(variant: TypographyVariant) {
  return function VariantText(props: Omit<AppTextProps, 'variant'>) {
    return <AppText {...props} variant={variant} />;
  };
}

export const Text = AppText;
export const LargeTitle = makeVariant('largeTitle');
export const Title1 = makeVariant('title1');
export const Title2 = makeVariant('title2');
export const Title3 = makeVariant('title3');
export const Headline = makeVariant('headline');
export const Body = makeVariant('body');
export const Callout = makeVariant('callout');
export const Subhead = makeVariant('subhead');
export const Footnote = makeVariant('footnote');
export const Caption1 = makeVariant('caption1');
export const Caption2 = makeVariant('caption2');
