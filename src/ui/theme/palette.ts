export type Palette = {
  systemBackground: string;
  secondarySystemBackground: string;
  tertiarySystemBackground: string;
  systemGroupedBackground: string;
  secondarySystemGroupedBackground: string;
  tertiarySystemGroupedBackground: string;

  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;
  placeholderText: string;

  separator: string;
  opaqueSeparator: string;

  systemFill: string;
  secondarySystemFill: string;
  tertiarySystemFill: string;
  quaternarySystemFill: string;

  systemBlue: string;
  systemRed: string;
  systemGreen: string;
  systemOrange: string;
  systemYellow: string;
  systemTeal: string;
  systemPink: string;
  systemPurple: string;
  systemIndigo: string;
  systemGray: string;

  accent: string;
  contractionActive: string;
  contractionActiveSubtle: string;
  urgent: string;
  success: string;
  warning: string;
  ruleMet: string;

  onAccent: string;
  onContractionActive: string;
  onUrgent: string;
  onSuccess: string;
};

export const lightColors: Palette = {
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  systemGroupedBackground: '#F2F2F7',
  secondarySystemGroupedBackground: '#FFFFFF',
  tertiarySystemGroupedBackground: '#F2F2F7',

  label: '#000000',
  secondaryLabel: 'rgba(60, 60, 67, 0.60)',
  tertiaryLabel: 'rgba(60, 60, 67, 0.30)',
  quaternaryLabel: 'rgba(60, 60, 67, 0.18)',
  placeholderText: 'rgba(60, 60, 67, 0.30)',

  separator: 'rgba(60, 60, 67, 0.29)',
  opaqueSeparator: '#C6C6C8',

  systemFill: 'rgba(120, 120, 128, 0.20)',
  secondarySystemFill: 'rgba(120, 120, 128, 0.16)',
  tertiarySystemFill: 'rgba(118, 118, 128, 0.12)',
  quaternarySystemFill: 'rgba(116, 116, 128, 0.08)',

  systemBlue: '#007AFF',
  systemRed: '#FF3B30',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemYellow: '#FFCC00',
  systemTeal: '#30B0C7',
  systemPink: '#FF2D55',
  systemPurple: '#AF52DE',
  systemIndigo: '#5856D6',
  systemGray: '#8E8E93',

  accent: '#007AFF',
  contractionActive: '#C0265E',
  contractionActiveSubtle: 'rgba(192, 38, 94, 0.10)',
  urgent: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  ruleMet: '#34C759',

  onAccent: '#FFFFFF',
  onContractionActive: '#FFFFFF',
  onUrgent: '#FFFFFF',
  onSuccess: '#FFFFFF',
};

export const darkColors: Palette = {
  systemBackground: '#000000',
  secondarySystemBackground: '#1C1C1E',
  tertiarySystemBackground: '#2C2C2E',
  systemGroupedBackground: '#000000',
  secondarySystemGroupedBackground: '#1C1C1E',
  tertiarySystemGroupedBackground: '#2C2C2E',

  label: '#FFFFFF',
  secondaryLabel: 'rgba(235, 235, 245, 0.60)',
  tertiaryLabel: 'rgba(235, 235, 245, 0.30)',
  quaternaryLabel: 'rgba(235, 235, 245, 0.16)',
  placeholderText: 'rgba(235, 235, 245, 0.30)',

  separator: 'rgba(84, 84, 88, 0.65)',
  opaqueSeparator: '#38383A',

  systemFill: 'rgba(120, 120, 128, 0.36)',
  secondarySystemFill: 'rgba(120, 120, 128, 0.32)',
  tertiarySystemFill: 'rgba(118, 118, 128, 0.24)',
  quaternarySystemFill: 'rgba(118, 118, 128, 0.18)',

  systemBlue: '#0A84FF',
  systemRed: '#FF453A',
  systemGreen: '#30D158',
  systemOrange: '#FF9F0A',
  systemYellow: '#FFD60A',
  systemTeal: '#40C8E0',
  systemPink: '#FF375F',
  systemPurple: '#BF5AF2',
  systemIndigo: '#5E5CE6',
  systemGray: '#8E8E93',

  accent: '#0A84FF',
  contractionActive: '#F472B6',
  contractionActiveSubtle: 'rgba(244, 114, 182, 0.20)',
  urgent: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
  ruleMet: '#30D158',

  onAccent: '#FFFFFF',
  onContractionActive: '#2A0614',
  onUrgent: '#FFFFFF',
  onSuccess: '#FFFFFF',
};
