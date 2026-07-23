import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import VisitStats from '@/components/VisitStats';

type CategoryCard = {
  id: string;
  live: boolean;
  name: string;
  articles: string[];
};

type Params = { locale: string };

async function loadCategories(locale: string): Promise<CategoryCard[]> {
  const { data: cats } = await supabaseAdmin
    .from('categories')
    .select('id, is_live, sort_order')
    .order('sort_order');

  if (!cats) return [];

  const { data: names } = await supabaseAdmin
    .from('category_names')
    .select('category_id, lang, name')
    .in('category_id', cats.map((c) => c.id));

  const nameFor = (categoryId: string) =>
    names?.find((n) => n.category_id === categoryId && n.lang === locale)?.name ??
    names?.find((n) => n.category_id === categoryId && n.lang === 'en')?.name ??
    categoryId;

  const result: CategoryCard[] = [];
  for (const c of cats) {
    let articleTitles: string[] = [];
    if (c.is_live) {
      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('category_id', c.id)
        .eq('status', 'published')
        .order('views', { ascending: false })
        .limit(3);

      if (articles && articles.length) {
        const { data: translations } = await supabaseAdmin
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

    result.push({ id: c.id, live: c.is_live, name: nameFor(c.id), articles: articleTitles });
  }

  return result;
}

export default async function Home({ params }: { params: Params }) {
  const categories = await loadCategories(params.locale);
  const messages = (await import(`../../messages/${params.locale}.json`)).default;

  return (
    <main className="max-w-[1080px] mx-auto px-7">
      <section className="py-20 border-b border-ink/10">
        <div className="flex items-center gap-2 text-xs tracking-[.16em] uppercase text-indigo mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gochujang inline-block" />
          {messages.home.eyebrow}
        </div>
        <h1 className="font-bold text-5xl md:text-6xl leading-tight max-w-2xl">
          {messages.home.title}
        </h1>
        <p className="mt-5 max-w-md opacity-75">{messages.home.desc}</p>

        <VisitStats todayLabel={messages.stats.today} totalLabel={messages.stats.total} />
      </section>

      <div className="my-9 h-[90px] border border-dashed border-ink/15 rounded flex items-center justify-center text-[10px] tracking-widest uppercase text-ink/40">
        AD SLOT · 728×90 · Google AdSense
      </div>

      <div className="flex items-center gap-3 my-10 text-xs tracking-widest uppercase opacity-55">
        {messages.home.sectionLabel}
        <span className="flex-1 h-px bg-ink/10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-16">
        {categories.map((c, i) => {
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
                {c.live ? messages.category.live : messages.category.soon}
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
                  {messages.category.noArticles}
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
            <Link key={c.id} href={`/${params.locale}/${c.id}`} className={cardClass}>
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
