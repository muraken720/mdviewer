import { expect, test } from 'vitest';
import { en } from './en';
import { detectLang, format, I18n, isLangSetting } from './index';
import { ja } from './ja';

test('catalogs have the same keys', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
});

test('detectLang picks the first supported language', () => {
  expect(detectLang(['ja-JP', 'en-US'])).toBe('ja');
  expect(detectLang(['fr-FR', 'en-GB'])).toBe('en');
  expect(detectLang(['de-DE'])).toBe('en');
  expect(detectLang([])).toBe('en');
});

test('format fills placeholders', () => {
  expect(format('{a} / {b}', { a: 1, b: 2 })).toBe('1 / 2');
  expect(format('{missing}', {})).toBe('{missing}');
});

test('I18n follows the setting, falls back to the system language and to English', () => {
  const i18n = new I18n('auto', ['ja-JP']);
  expect(i18n.lang).toBe('ja');
  expect(i18n.t('menu.file')).toBe('ファイル');
  i18n.set('en');
  expect(i18n.t('menu.file')).toBe('File');
  expect(i18n.t('toast.saveFailed', { detail: 'x' })).toBe('Could not save: x');
  i18n.add({ ja: { 'p.hello': 'こんにちは' }, en: { 'p.hello': 'Hello' } });
  expect(i18n.t('p.hello')).toBe('Hello');
  expect(i18n.t('unknown.key')).toBe('unknown.key');
});

test('isLangSetting', () => {
  expect(isLangSetting('auto')).toBe(true);
  expect(isLangSetting('fr')).toBe(false);
  expect(isLangSetting(null)).toBe(false);
});
