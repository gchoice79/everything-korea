import Script from 'next/script';
import { Noto_Serif_KR } from 'next/font/google';
import './globals.css';

const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-serif-kr',
  display: 'swap',
});

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale?: string };
}) {
  const locale = params.locale ?? 'ko';

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={notoSerifKR.variable}>
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8529024145667646"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-SV7F4J7RVL"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SV7F4J7RVL');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
