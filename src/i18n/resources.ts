import ar from '@/i18n/locales/ar.json';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import hi from '@/i18n/locales/hi.json';
import it from '@/i18n/locales/it.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import zhHans from '@/i18n/locales/zh-Hans.json';

export const supportedLocales = ['en', 'it', 'fr', 'es', 'de', 'pt-BR', 'zh-Hans', 'ja', 'ko', 'ar', 'hi'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];
export type LanguagePreference = 'system' | SupportedLocale;
export type TranslationResource = typeof en;

export const languageOptions: { key: LanguagePreference; labelKey: string }[] = [
  { key: 'system', labelKey: 'language.system' },
  { key: 'en', labelKey: 'language.en' },
  { key: 'it', labelKey: 'language.it' },
  { key: 'fr', labelKey: 'language.fr' },
  { key: 'es', labelKey: 'language.es' },
  { key: 'de', labelKey: 'language.de' },
  { key: 'pt-BR', labelKey: 'language.ptBR' },
  { key: 'zh-Hans', labelKey: 'language.zhHans' },
  { key: 'ja', labelKey: 'language.ja' },
  { key: 'ko', labelKey: 'language.ko' },
  { key: 'ar', labelKey: 'language.ar' },
  { key: 'hi', labelKey: 'language.hi' },
];

export const rtlLocales: SupportedLocale[] = ['ar'];

export const resources = {
  en: { translation: en },
  it: { translation: it },
  fr: { translation: fr },
  es: { translation: es },
  de: { translation: de },
  'pt-BR': { translation: ptBR },
  'zh-Hans': { translation: zhHans },
  ja: { translation: ja },
  ko: { translation: ko },
  ar: { translation: ar },
  hi: { translation: hi },
} satisfies Record<SupportedLocale, { translation: TranslationResource }>;
