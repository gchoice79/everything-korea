import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { locales, type Locale } from '@/i18n/routing';
import Header from '@/components/Header';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Everything Korea',
  description: 'Everything about Korea, in 15 languages.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const locale = params.locale;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          now={new Date()}
          timeZone="Asia/Seoul"
        >
          <Header />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
