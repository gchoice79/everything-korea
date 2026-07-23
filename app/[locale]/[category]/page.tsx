import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { locales } from '@/i18n/routing';

type Params = { locale: string; category: string };

async function loadCategory(locale: string, category: string) {
  const { data: names } = await supabaseAdmin
    .from('category_names')
    .select('lang, name')
    .eq('category_id', category);

  const name =
    names?.find((n) => n.lang === locale)?.name ??
    names?.find((n) => n.lang === 'en')?.name ??
    category;

  const { data: arts } = await supabaseAdmin
    .from('articles')
    .select('id, slug')
    .eq('category_id', category)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  let cards: { slug: string; title: string; excerpt: string }[] = [];
  if (arts && arts.length) {
    const { data: translations } = await supabaseAdmin
      .from('article_translations')
      .select('article_id, lang, title, excerpt')
      .in('article_id', arts.map((a) => a.id));

    cards = arts.map((a) => {
      const tr =
        translations?.find((t) => t.article_id === a.id && t.lang === locale) ??
        translations?.find((t) => t.article_id === a.id && t.lang === 'en');
      return { slug: a.slug, title: tr?.title ?? a.slug, excerpt: tr?.excerpt ?? '' };
    });
  }

  return { name, cards };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await loadCategory(params.locale, params.category);
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `/${l}/${params.category}`;

  return {
    title: name,
    alternates: { canonical: `/${params.locale}/${params.category}`, languages },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { name, cards } = await loadCategory(params.locale, params.category);
  const messages = (await import(`../../../messages/${params.locale}.json`)).default;

  return (
    <main className="max-w-[1080px] mx-auto px-7 py-14">
      <Link href={`/${params.locale}`} className="text-xs font-mono text-indigo inline-block mb-8">
        ← {messages.home.allCategories}
      </Link>
      <h1 className="font-serif text-4xl mb-10">{name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((a) => (
          <Link
            key={a.slug}
            href={`/${params.locale}/${params.category}/${a.slug}`}
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
