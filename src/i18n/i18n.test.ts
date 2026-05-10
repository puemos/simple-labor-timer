import { describe, expect, it } from 'vitest';
import { resolveT, setActiveLocale } from '@/i18n/format';
import { resources, rtlLocales, supportedLocales } from '@/i18n/resources';

describe('i18n resources', () => {
  it('keeps every supported locale on the English key set', () => {
    const englishKeys = flattenKeys(resources.en.translation);

    supportedLocales.forEach((locale) => {
      expect(flattenKeys(resources[locale].translation)).toEqual(englishKeys);
    });
  });

  it('formats plural contraction counts in English and Italian', () => {
    expect(resolveT({ locale: 'en' })('time.contractionsTotal', { count: 1 })).toBe('1 contraction total');
    expect(resolveT({ locale: 'en' })('time.contractionsTotal', { count: 2 })).toBe('2 contractions total');
    expect(resolveT({ locale: 'it' })('time.contractionsTotal', { count: 1 })).toBe('1 contrazione totale');
    expect(resolveT({ locale: 'it' })('time.contractionsTotal', { count: 2 })).toBe('2 contrazioni totali');
  });

  it('tracks Arabic as an RTL locale', () => {
    expect(rtlLocales).toContain('ar');
    expect(rtlLocales).not.toContain('en');
  });

  it('uses the active locale when no explicit locale is passed', () => {
    setActiveLocale('es');
    expect(resolveT()('common.cancel')).toBe('Cancelar');
    setActiveLocale('en');
  });
});

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') {
      return flattenKeys(child, path);
    }
    return [path];
  }).sort();
}
