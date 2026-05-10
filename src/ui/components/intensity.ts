import { Intensity } from '@/domain/types';
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

export function intensityLabel(intensity: Intensity | undefined): string {
  switch (intensity) {
    case 'mild':
      return 'Mild';
    case 'moderate':
      return 'Moderate';
    case 'strong':
      return 'Strong';
    case 'cannot_talk_walk':
      return "Can't talk";
    default:
      return 'Unrated';
  }
}
