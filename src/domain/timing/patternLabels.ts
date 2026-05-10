import { PatternLabel } from '@/domain/types';
import { LocaleFormatOptions, resolveT } from '@/i18n/format';

export function classifyPattern(intervalsSeconds: number[]): PatternLabel {
  if (intervalsSeconds.length < 3) {
    return 'insufficient_data';
  }

  const lastFour = intervalsSeconds.slice(-4);
  const firstHalf = lastFour.slice(0, Math.floor(lastFour.length / 2));
  const secondHalf = lastFour.slice(Math.floor(lastFour.length / 2));
  const firstAverage = firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
  const secondAverage = secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length;
  const spread = Math.max(...lastFour) - Math.min(...lastFour);

  if (spread <= 75) {
    return 'regular';
  }
  if (secondAverage <= firstAverage - 45) {
    return 'getting_closer';
  }
  if (secondAverage >= firstAverage + 45) {
    return 'spacing_out';
  }
  return 'inconsistent';
}

export function patternText(pattern: PatternLabel, options?: LocaleFormatOptions): string {
  const t = resolveT(options);
  switch (pattern) {
    case 'getting_closer':
      return t('rhythm.statusGettingCloser');
    case 'spacing_out':
      return t('rhythm.statusSpacingOut');
    case 'regular':
      return t('rhythm.patternRegular');
    case 'inconsistent':
      return t('rhythm.patternInconsistent');
    case 'insufficient_data':
      return t('rhythm.statusNeedMoreData');
  }
}
