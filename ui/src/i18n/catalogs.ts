import type { Messages } from "@lingui/core";

// No copy in this app uses <Trans> message ids yet. The catalog exists so the
// shared i18n runtime ships in this bundle's Module Federation share scope —
// the host's auth plugin resolves @lingui/* through it (RUNTIME-012 at SSR
// composition otherwise). Add message ids here as surfaces adopt <Trans>.
export const APP_LOCALES = ["en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_APP_LOCALE: AppLocale = "en";
export const APP_LOCALE_COOKIE = "app_locale";

const englishMessages = {} satisfies Record<string, string>;

const translatedMessages: Record<AppLocale, Partial<Record<string, string>>> = {
  en: {},
};

export function getAppMessages(locale: AppLocale): Messages {
  return { ...englishMessages, ...translatedMessages[locale] };
}
