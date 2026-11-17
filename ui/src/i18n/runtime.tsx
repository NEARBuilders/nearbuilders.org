import { createLocaleRuntime } from "everything-dev/ui/i18n";
import type { ReactNode } from "react";
import { APP_LOCALE_COOKIE, APP_LOCALES, DEFAULT_APP_LOCALE, getAppMessages } from "./catalogs";

const appRuntime = createLocaleRuntime({
  locales: APP_LOCALES,
  defaultLocale: DEFAULT_APP_LOCALE,
  cookieName: APP_LOCALE_COOKIE,
});

export function AppI18nProvider({
  children,
  preferredLocale,
}: {
  children: ReactNode;
  preferredLocale?: string | null;
}) {
  return (
    <appRuntime.LocaleProvider messages={getAppMessages} preferredLocale={preferredLocale}>
      {children}
    </appRuntime.LocaleProvider>
  );
}

export const useAppLocale = appRuntime.useLocale;
