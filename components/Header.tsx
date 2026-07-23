'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

const LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
];

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-ink/10">
      <div className="max-w-[1080px] mx-auto px-7 py-4 flex items-center justify-between gap-5">
        <Link href={`/${locale}`} className="flex items-baseline gap-2.5 shrink-0">
          <span className="font-serif text-xl">{t('brand.name')}</span>
          <span className="text-[10px] tracking-[.14em] uppercase text-gochujang">
            {t('brand.tagline')}
          </span>
        </Link>

        <button className="flex-1 max-w-[220px] mx-auto text-xs font-mono border border-ink/10 rounded-full px-4 py-2 text-center opacity-60">
          {t('home.allCategories')} ▾
        </button>

        <div className="flex gap-1.5 shrink-0">
          {LANGS.map((l) => (
            <Link
              key={l.code}
              href={`/${l.code}`}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded-full border transition ${
                l.code === locale
                  ? 'bg-ink text-paper border-ink'
                  : 'border-ink/10 opacity-55 hover:opacity-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="text-[11px] font-mono opacity-40 px-1 self-center">+10</span>
        </div>
      </div>
    </header>
  );
}
