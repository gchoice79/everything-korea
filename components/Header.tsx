'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

const LANGS = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
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
            className="flex items-center gap-1.5 text-[12px] font-mono font-bold px-4 py-2 rounded-full border-2 border-gochujang text-gochujang hover:bg-gochujang hover:text-paper transition"
          >
            <span aria-hidden>{current.flag}</span>
            {current.label}
            <span aria-hidden>▾</span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-44 max-h-72 overflow-y-auto bg-paper border border-ink/10 rounded-md shadow-lg py-1.5 z-50">
              {LANGS.map((l) => (
                <Link
                  key={l.code}
                  href={`/${l.code}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 text-[12px] font-mono px-3 py-1.5 transition ${
                    l.code === locale
                      ? 'bg-ink text-paper'
                      : 'opacity-70 hover:opacity-100 hover:bg-ink/5'
                  }`}
                >
                  <span aria-hidden>{l.flag}</span>
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
