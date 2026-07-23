'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';

type CategoryCard = {
  id: string;
  live: boolean;
  name: string;
  articles: string[];
};

export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState<CategoryCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1) 카테고리 목록
      const { data: cats } = await supabase
        .from('categories')
        .select('id, is_live, sort_order')
        .order('sort_order');

      if (!cats) return;

      // 2) 카테고리 이름 (현재 언어, 없으면 영어로 대체)
      const { data: names } = await supabase
        .from('category_names')
        .select('category_id, lang, name')
        .in('category_id', cats.map((c) => c.id));

      const nameFor = (categoryId: string) =>
        names?.find((n) => n.category_id === categoryId && n.lang === locale)?.name ??
        names?.find((n) => n.category_id === categoryId && n.lang === 'en')?.name ??
        categoryId;

      // 3) 각 카테고리의 인기글(상위 3개) 제목
      const result: CategoryCard[] = [];
      for (const c of cats) {
        let articleTitles: string[] = [];
        if (c.is_live) {
          const { data: articles } = await supabase
            .from('articles')
            .select('id')
            .eq('category_id', c.id)
            .eq('status', 'published')
            .order('views', { ascending: false })
            .limit(3);

          if (articles && articles.length) {
            const { data: translations } = await supabase
              .from('article_translations')
              .select('article_id, lang, title')
              .in('article_id', articles.map((a) => a.id));

            articleTitles = articles.map((a) => {
              const t =
                translations?.find((tr) => tr.article_id === a.id && tr.lang === locale) ??
                translations?.find((tr) => tr.article_id === a.id && tr.lang === 'en');
              return t?.title ?? '';
            });
          }
        }

        result.push({
          id: c.id,
          live: c.is_live,
          name: nameFor(c.id),
          articles: articleTitles,
        });
      }

      if (!cancelled) setCategories(result);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <main className="max-w-[1080px] mx-auto px-7">
      <section className="py-20 border-b border-ink/10">
        <div className="flex items-center gap-2 text-xs tracking-[.16em] uppercase text-indigo mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gochujang inline-block" />
          {t('home.eyebrow')}
        </div>
        <h1 className="font-bold text-5xl md:text-6xl leading-tight max-w-2xl">
          {t('home.title')}
        </h1>
        <p className="mt-5 max-w-md opacity-75">{t('home.desc')}</p>
      </section>

      <div className="my-9 h-[90px] border border-dashed border-ink/15 rounded flex items-center justify-center text-[10px] tracking-widest uppercase text-ink/40">
        AD SLOT · 728×90 · Google AdSense
      </div>

      <div className="flex items-center gap-3 my-10 text-xs tracking-widest uppercase opacity-55">
        {t('home.sectionLabel')}
        <span className="flex-1 h-px bg-ink/10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-16">
        {categories === null && (
          <div className="text-sm opacity-50 font-mono">Loading…</div>
        )}
        {categories?.map((c, i) => {
          const CardInner = (
            <>
              <span className="text-[10px] font-mono opacity-50">
                CAT {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`absolute top-6 right-6 text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  c.live ? 'text-celadon border-celadon' : 'border-ink/10'
                }`}
              >
                {c.live ? t('category.live') : t('category.soon')}
              </span>
              <h3 className="font-serif text-lg mt-4">{c.name}</h3>
              {c.articles.length ? (
                <ul className="mt-3 pt-3 border-t border-ink/10 space-y-1.5">
                  {c.articles.map((title, idx) => (
                    <li key={idx} className="text-xs opacity-70 pl-4 relative">
                      <span className="absolute left-0 font-mono text-[10px] opacity-60">
                        {idx + 1}.
                      </span>
                      {title}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 pt-3 border-t border-ink/10 text-[11px] font-mono opacity-40">
                  {t('category.noArticles')}
                </div>
              )}
            </>
          );

          const cardClass = `relative border border-ink/10 rounded-md p-6 transition ${
            c.live
              ? 'cursor-pointer hover:border-gochujang hover:-translate-y-0.5'
              : 'opacity-40'
          }`;

          return c.live ? (
            <Link key={c.id} href={`/${locale}/${c.id}`} className={cardClass}>
              {CardInner}
            </Link>
          ) : (
            <div key={c.id} className={cardClass}>
              {CardInner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
