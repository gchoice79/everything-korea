import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { locales } from '@/i18n/routing';
import ViewTracker from '@/components/ViewTracker';

type Block = { h?: string; p?: string; img?: string };

const BACK_LABEL: Record<string, string> = {
  ko: '← 목록으로',
  en: '← Back to list',
  ja: '← 一覧へ',
  zh: '← 返回列表',
  hi: '← सूची पर वापस',
  es: '← Volver a la lista',
  fr: '← Retour à la liste',
  ar: '← العودة إلى القائمة',
  id: '← Kembali ke daftar',
  vi: '← Quay lại danh sách',
  pt: '← Voltar à lista',
};

const FALLBACK_NOTE: Record<string, string> = {
  ko: '이 글의 전체 번역은 아직 준비 중이라 영어 원문을 보여드리고 있습니다.',
  en: '',
  ja: 'この記事の全文翻訳はまだ準備中のため、英語原文を表示しています。',
  zh: '该文章的完整翻译尚未准备好，目前显示英文原文。',
  hi: 'इस लेख का पूरा अनुवाद अभी तैयार नहीं है, इसलिए अंग्रेज़ी मूल दिखाया जा रहा है।',
  es: 'La traducción completa de este artículo aún no está lista, así que mostramos el original en inglés.',
  fr: 'La traduction complète de cet article n’est pas encore prête, nous affichons donc l’original en anglais.',
  ar: 'الترجمة الكاملة لهذا المقال ليست جاهزة بعد، لذا نعرض النص الأصلي بالإنجليزية.',
  id: 'Terjemahan lengkap artikel ini belum siap, jadi kami menampilkan teks asli berbahasa Inggris.',
  vi: 'Bản dịch đầy đủ của bài viết này chưa sẵn sàng nên chúng tôi hiển thị bản gốc tiếng Anh.',
  pt: 'A tradução completa deste artigo ainda não está pronta, por isso mostramos o original em inglês.',
};

type Params = { locale: string; category: string; slug: string };

const getArticle = cache(async (category: string, slug: string) => {
  const { data: article } = await supabaseAdmin
    .from('articles')
    .select('id, image_url, views')
    .eq('category_id', category)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!article) return null;

  const { data: translations } = await supabaseAdmin
    .from('article_translations')
    .select('lang, title, excerpt, body')
    .eq('article_id', article.id);

  return { article, translations: translations ?? [] };
});

function pickTranslation(
  translations: { lang: string; title: string; excerpt: string; body: unknown }[],
  locale: string
) {
  const tr = translations.find((t) => t.lang === locale && t.body);
  if (tr) return { tr, fallback: false };
  return { tr: translations.find((t) => t.lang === 'en' && t.body), fallback: true };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await getArticle(params.category, params.slug);
  if (!data) return {};

  const { tr } = pickTranslation(data.translations, params.locale);
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `/${l}/${params.category}/${params.slug}`;

  return {
    title: tr?.title ?? params.slug,
    description: tr?.excerpt,
    alternates: {
      canonical: `/${params.locale}/${params.category}/${params.slug}`,
      languages,
    },
    openGraph: {
      title: tr?.title ?? params.slug,
      description: tr?.excerpt,
      images: data.article.image_url ? [data.article.image_url] : undefined,
      type: 'article',
    },
  };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const data = await getArticle(params.category, params.slug);
  if (!data) notFound();

  const { tr, fallback } = pickTranslation(data.translations, params.locale);
  const title = tr?.title ?? params.slug;
  const body = (tr?.body as Block[]) ?? [];

  return (
    <main className="max-w-[720px] mx-auto px-7 py-14">
      <Link
        href={`/${params.locale}/${params.category}`}
        className="text-xs font-mono text-indigo inline-block mb-8"
      >
        {BACK_LABEL[params.locale] ?? BACK_LABEL.en}
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl mb-2 leading-tight">{title}</h1>

      <p className="text-xs font-mono opacity-40 mb-6">
        조회 {(data.article.views ?? 0).toLocaleString()}회
      </p>

      {data.article.image_url && (
        <img
          src={data.article.image_url}
          alt=""
          className="w-full h-64 md:h-80 object-cover rounded-md mb-8"
        />
      )}

      <div className="space-y-4 text-base leading-relaxed">
        {body.map((block, i) =>
          block.h ? (
            <h4 key={i} className="font-serif text-lg mt-8 mb-1">
              {block.h}
            </h4>
          ) : block.img ? (
            <img
              key={i}
              src={block.img}
              alt=""
              className="w-full h-56 md:h-72 object-cover rounded-md my-6"
            />
          ) : (
            <p key={i} className="opacity-90">
              {block.p}
            </p>
          )
        )}
      </div>

      {fallback && FALLBACK_NOTE[params.locale] && (
        <div className="mt-10 p-4 border-l-2 border-mustard bg-mustard/10 text-sm">
          {FALLBACK_NOTE[params.locale]}
        </div>
      )}

      <ViewTracker articleId={data.article.id} />
    </main>
  );
}
