// Tiny i18n: typed message catalogs (ja, en), language detection and switching.
// No DOM access, so it is unit-tested directly.
import { en } from './en';
import { ja } from './ja';

export type MessageKey = keyof typeof ja;
/** A catalog with exactly the keys of the Japanese one (a missing key is a type error). */
export type Messages = Record<MessageKey, string>;

export type Lang = 'ja' | 'en';
export type LangSetting = Lang | 'auto';
export const LANGS: readonly Lang[] = ['ja', 'en'];

/** Pick a language from the OS/browser preference list (`navigator.languages`). */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'ja' || base === 'en') return base;
  }
  return 'en';
}

export function isLangSetting(v: unknown): v is LangSetting {
  return v === 'auto' || v === 'ja' || v === 'en';
}

/** Replace `{name}` placeholders. Unknown placeholders are left as they are. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export class I18n {
  #setting: LangSetting;
  #system: Lang;
  // Plugins may add their own keys; built-in keys are type-checked.
  #catalogs: Record<Lang, Record<string, string>> = { ja: { ...ja }, en: { ...en } };

  constructor(setting: LangSetting = 'auto', system: readonly string[] = []) {
    this.#setting = setting;
    this.#system = detectLang(system);
  }

  get setting(): LangSetting {
    return this.#setting;
  }

  /** The language in use. */
  get lang(): Lang {
    return this.#setting === 'auto' ? this.#system : this.#setting;
  }

  set(setting: LangSetting): void {
    this.#setting = setting;
  }

  /** Add messages (e.g. from a plugin). Keys should be namespaced: `myplugin.title`. */
  add(messages: Partial<Record<Lang, Record<string, string>>>): void {
    for (const lang of LANGS) Object.assign(this.#catalogs[lang], messages[lang]);
  }

  t(key: MessageKey | (string & {}), params?: Record<string, string | number>): string {
    const text = this.#catalogs[this.lang][key] ?? this.#catalogs.en[key] ?? key;
    return format(text, params);
  }
}
