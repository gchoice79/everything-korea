'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

const LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'id', label: 'Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'pt', label: 'Português' },
];

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];

  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-ink/10">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-7 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-5">
        <Link href={`/${locale}`} className="flex items-baseline gap-2.5 shrink-0">
          <span className="font-serif text-xl">{t('brand.name')}</span>
          <span className="hidden sm:inline text-[10px] tracking-[.14em] uppercase text-gochujang">
            {t('brand.tagline')}
          </span>
        </Link>

        <button className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-[220px] sm:mx-auto text-xs font-mono border border-ink/10 rounded-full px-4 py-2 text-center opacity-60 shrink-0">
          {t('home.allCategories')} ▾
        </button>

        <div ref={wrapRef} className="relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] font-mono px-3 py-1.5 rounded-full border border-ink/10 hover:opacity-100 opacity-80 transition"
          >
            {current.label} ▾
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-40 max-h-72 overflow-y-auto bg-paper border border-ink/10 rounded-md shadow-lg py-1.5 z-50">
              {LANGS.map((l) => (
                <Link
                  key={l.code}
                  href={`/${l.code}`}
                  onClick={() => setOpen(false)}
                  className={`block text-[12px] font-mono px-3 py-1.5 transition ${
                    l.code === locale
                      ? 'bg-ink text-paper'
                      : 'opacity-70 hover:opacity-100 hover:bg-ink/5'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
