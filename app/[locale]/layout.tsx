import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { locales, type Locale } from '@/i18n/routing';
import Header from '@/components/Header';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const BASE_URL = 'https://everything-korea.vercel.app';

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const messages = (await import(`../../messages/${params.locale}.json`)).default;

  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `/${l}`;

  return {
    metadataBase: new URL(BASE_URL),
    title: { default: messages.brand.name, template: `%s — ${messages.brand.name}` },
    description: messages.home.desc,
    alternates: {
      canonical: `/${params.locale}`,
      languages,
    },
    openGraph: {
      title: messages.brand.name,
      description: messages.home.desc,
      locale: params.locale,
      type: 'website',
    },
  };
}

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
