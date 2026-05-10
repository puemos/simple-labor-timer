import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkColors, lightColors, Palette } from '@/ui/theme/palette';
import { typography, Typography } from '@/ui/theme/typography';
import { darkShadows, lightShadows, radii, ShadowSet, spacing } from '@/ui/theme/tokens';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme.preference';

export type Theme = {
  colors: Palette;
  typography: Typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: ShadowSet;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

function safeGetPreference(): ThemePreference {
  try {
    const stored = SecureStore.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // SecureStore unavailable (web/SSR) — fall through.
  }
  return 'system';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(() => safeGetPreference());

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void (async () => {
      try {
        await SecureStore.setItemAsync(STORAGE_KEY, next);
      } catch {
        // Persistence is best-effort.
      }
    })();
  }, []);

  const scheme: ColorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<Theme>(() => {
    const isDark = scheme === 'dark';
    return {
      colors: isDark ? darkColors : lightColors,
      typography,
      spacing,
      radii,
      shadows: isDark ? darkShadows : lightShadows,
      scheme,
      preference,
      setPreference,
    };
  }, [scheme, preference, setPreference]);

  useEffect(() => {
    // Touch SecureStore once to ensure the latest persisted value is the source of truth on cold start.
    const stored = safeGetPreference();
    setPreferenceState((current) => (current === stored ? current : stored));
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
