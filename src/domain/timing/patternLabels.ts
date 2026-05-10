import { PatternLabel } from '@/domain/types';

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

export function patternText(pattern: PatternLabel): string {
  switch (pattern) {
    case 'getting_closer':
      return 'Getting closer';
    case 'spacing_out':
      return 'Spacing out';
    case 'regular':
      return 'Regular pattern';
    case 'inconsistent':
      return 'Inconsistent';
    case 'insufficient_data':
      return 'Need more data';
  }
}
