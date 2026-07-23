'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';

type ArticleCard = { slug: string; title: string; excerpt: string };

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const locale = useLocale();
  const t = useTranslations();
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: names } = await supabase
        .from('category_names')
        .select('lang, name')
        .eq('category_id', params.category);

      const name =
        names?.find((n) => n.lang === locale)?.name ??
        names?.find((n) => n.lang === 'en')?.name ??
        params.category;

      const { data: arts } = await supabase
        .from('articles')
        .select('id, slug')
        .eq('category_id', params.category)
        .eq('status', 'published')
        .order('sort_order');

      let cards: ArticleCard[] = [];
      if (arts && arts.length) {
        const { data: translations } = await supabase
          .from('article_translations')
          .select('article_id, lang, title, excerpt')
          .in('article_id', arts.map((a) => a.id));

        cards = arts.map((a) => {
          const tr =
            translations?.find((tr) => tr.article_id === a.id && tr.lang === locale) ??
            translations?.find((tr) => tr.article_id === a.id && tr.lang === 'en');
          return { slug: a.slug, title: tr?.title ?? a.slug, excerpt: tr?.excerpt ?? '' };
        });
      }

      if (!cancelled) {
        setCategoryName(name);
        setArticles(cards);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.category, locale]);

  return (
    <main className="max-w-[1080px] mx-auto px-7 py-14">
      <Link href={`/${locale}`} className="text-xs font-mono text-indigo inline-block mb-8">
        ← {t('home.allCategories')}
      </Link>
      <h1 className="font-serif text-4xl mb-10">{categoryName ?? '···'}</h1>

      {articles === null && <div className="opacity-50 text-sm font-mono">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles?.map((a) => (
          <Link
            key={a.slug}
            href={`/${locale}/${params.category}/${a.slug}`}
            className="block border border-ink/10 rounded-md p-6 hover:border-gochujang transition"
          >
            <h3 className="font-serif text-xl mb-2">{a.title}</h3>
            <p className="text-sm opacity-70">{a.excerpt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
