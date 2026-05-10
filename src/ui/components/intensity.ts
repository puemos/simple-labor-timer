import { Intensity } from '@/domain/types';
import { LocaleFormatOptions, resolveT } from '@/i18n/format';
import { Palette } from '@/ui/theme/palette';

export function intensityColor(intensity: Intensity | undefined, colors: Palette): string {
  switch (intensity) {
    case 'mild':
      return colors.systemTeal;
    case 'moderate':
      return colors.systemOrange;
    case 'strong':
      return colors.systemRed;
    case 'cannot_talk_walk':
      return colors.urgent;
    default:
      return colors.systemTeal;
  }
}

export function intensityLabel(intensity: Intensity | undefined, options?: LocaleFormatOptions): string {
  const t = resolveT(options);
  switch (intensity) {
    case 'mild':
      return t('intensity.mild');
    case 'moderate':
      return t('intensity.moderate');
    case 'strong':
      return t('intensity.strong');
    case 'cannot_talk_walk':
      return t('intensity.cannot_talk_walk');
    default:
      return t('intensity.unrated');
  }
}
