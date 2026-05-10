import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createInstance, TFunction } from 'i18next';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { setActiveLocale, TranslationFunction } from '@/i18n/format';
import {
  LanguagePreference,
  SupportedLocale,
  languageOptions,
  resources,
  rtlLocales,
  supportedLocales,
} from '@/i18n/resources';

export type AppT = TranslationFunction;
export type { LanguagePreference, SupportedLocale };
export { languageOptions, resources, supportedLocales };

const STORAGE_KEY = 'language.preference';
const DEFAULT_LOCALE: SupportedLocale = 'en';
const i18n = createInstance();
const initialLocale = resolvePreference(safeGetPreference());

type I18nContextValue = {
  locale: SupportedLocale;
  preference: LanguagePreference;
  isRTL: boolean;
  setPreference: (preference: LanguagePreference) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    returnNull: false,
  });
}

applyRTL(isRTLLocale(initialLocale));
setActiveLocale(initialLocale);

export function I18nProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<LanguagePreference>(() => safeGetPreference());
  const [locale, setLocale] = useState<SupportedLocale>(() => resolvePreference(preference));

  useEffect(() => {
    const stored = safeGetPreference();
    setPreferenceState((current) => (current === stored ? current : stored));
  }, []);

  useEffect(() => {
    const nextLocale = resolvePreference(preference);
    setLocale(nextLocale);
    applyRTL(isRTLLocale(nextLocale));
    setActiveLocale(nextLocale);
    void i18n.changeLanguage(nextLocale);
  }, [preference]);

  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    void (async () => {
      try {
        await SecureStore.setItemAsync(STORAGE_KEY, next);
      } catch {
        // Persistence is best-effort across native/web runtimes.
      }
    })();
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      preference,
      isRTL: isRTLLocale(locale),
      setPreference,
    }),
    [locale, preference, setPreference],
  );

  return (
    <I18nContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </I18nContext.Provider>
  );
}

export function useAppLanguage(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useAppLanguage must be used inside <I18nProvider>');
  }
  return ctx;
}

export function useAppTranslation() {
  return useTranslation();
}

export function getFixedT(locale?: string): AppT {
  const fixed = i18n.getFixedT(locale ?? i18n.language) as TFunction<'translation', undefined>;
  return (key, options) => fixed(key, options);
}

export function currentLocale(): SupportedLocale {
  return normalizeLocale(i18n.language) ?? DEFAULT_LOCALE;
}

export function isRTLLocale(locale: string): boolean {
  return rtlLocales.includes((normalizeLocale(locale) ?? locale) as SupportedLocale);
}

function safeGetPreference(): LanguagePreference {
  try {
    const stored = SecureStore.getItem(STORAGE_KEY);
    if (stored === 'system' || isSupportedLocale(stored)) {
      return stored;
    }
  } catch {
    // SecureStore unavailable (web/SSR) - fall through.
  }
  return 'system';
}

function resolvePreference(preference: LanguagePreference): SupportedLocale {
  if (preference !== 'system') {
    return preference;
  }
  return normalizeLocale(Localization.getLocales()[0]?.languageTag) ?? DEFAULT_LOCALE;
}

function normalizeLocale(languageTag: string | undefined): SupportedLocale | undefined {
  if (!languageTag) {
    return undefined;
  }
  const normalized = languageTag.replace('_', '-');
  if (isSupportedLocale(normalized)) {
    return normalized;
  }
  const lower = normalized.toLowerCase();
  if (lower.startsWith('pt')) {
    return 'pt-BR';
  }
  if (lower.startsWith('zh')) {
    return 'zh-Hans';
  }
  const language = lower.split('-')[0];
  return supportedLocales.find((locale) => locale.toLowerCase() === language);
}

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return Boolean(value && supportedLocales.includes(value as SupportedLocale));
}

function applyRTL(nextRTL: boolean) {
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== nextRTL) {
    I18nManager.forceRTL(nextRTL);
  }
}
