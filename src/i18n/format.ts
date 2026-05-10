import { resources, SupportedLocale, supportedLocales } from '@/i18n/resources';

export type LocaleFormatOptions = {
  locale?: string;
  t?: TranslationFunction;
};

export type TranslationFunction = (key: string, options?: Record<string, unknown>) => string;

let activeLocale: SupportedLocale = 'en';

export function setActiveLocale(locale: string) {
  activeLocale = normalizeLocale(locale) ?? 'en';
}

export function resolveLocale(options?: LocaleFormatOptions): string {
  return normalizeLocale(options?.locale) ?? activeLocale;
}

export function resolveT(options?: LocaleFormatOptions): TranslationFunction {
  if (options?.t) {
    return options.t;
  }
  const locale = resolveLocale(options);
  return (key, interpolation) => translate(locale, key, interpolation);
}

export function tr(key: string, options?: Record<string, unknown> & LocaleFormatOptions): string {
  const { locale, t, ...rest } = options ?? {};
  return resolveT({ locale, t })(key, rest);
}

function translate(locale: string, key: string, interpolation: Record<string, unknown> = {}): string {
  const normalized = normalizeLocale(locale) ?? 'en';
  const value = readTranslation(normalized, key, interpolation) ?? readTranslation('en', key, interpolation) ?? key;
  return interpolate(value, interpolation);
}

function readTranslation(locale: SupportedLocale, key: string, interpolation: Record<string, unknown>): string | undefined {
  const pluralKey =
    typeof interpolation.count === 'number' ? `${key}_${interpolation.count === 1 ? 'one' : 'other'}` : undefined;
  const resource = resources[locale].translation;
  return (pluralKey ? readPath(resource, pluralKey) : undefined) ?? readPath(resource, key);
}

function readPath(resource: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, resource);
  return typeof value === 'string' ? value : undefined;
}

function interpolate(value: string, interpolation: Record<string, unknown>): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    interpolation[key] === undefined ? '' : String(interpolation[key]),
  );
}

function normalizeLocale(languageTag: string | undefined): SupportedLocale | undefined {
  if (!languageTag) {
    return undefined;
  }
  const normalized = languageTag.replace('_', '-');
  if (supportedLocales.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale;
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
