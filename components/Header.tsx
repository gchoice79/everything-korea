'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';

type CategoryOption = { id: string; name: string };

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
  const [catOpen, setCatOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const catWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (catWrapRef.current && !catWrapRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, sort_order')
        .eq('is_live', true)
        .order('sort_order');
      if (!cats || cancelled) return;

      const { data: names } = await supabase
        .from('category_names')
        .select('category_id, lang, name')
        .in('category_id', cats.map((c) => c.id));

      if (cancelled) return;
      setCategories(
        cats.map((c) => ({
          id: c.id,
          name:
            names?.find((n) => n.category_id === c.id && n.lang === locale)?.name ??
            names?.find((n) => n.category_id === c.id && n.lang === 'en')?.name ??
            c.id,
        }))
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

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

        <div
          ref={catWrapRef}
          className="relative order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-[220px] sm:mx-auto shrink-0"
        >
          <button
            onClick={() => setCatOpen((v) => !v)}
            className="w-full text-xs font-mono border border-ink/10 rounded-full px-4 py-2 text-center opacity-60 hover:opacity-100 transition"
          >
            {t('home.allCategories')} ▾
          </button>

          {catOpen && (
            <div className="absolute left-0 right-0 sm:left-auto sm:right-auto mt-2 bg-paper border border-ink/10 rounded-md shadow-lg py-1.5 z-50">
              {categories.length === 0 && (
                <p className="text-[11px] font-mono opacity-40 px-3 py-1.5">···</p>
              )}
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/${locale}/${c.id}`}
                  onClick={() => setCatOpen(false)}
                  className="block text-[12px] font-mono px-3 py-1.5 opacity-70 hover:opacity-100 hover:bg-ink/5 transition"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>

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
