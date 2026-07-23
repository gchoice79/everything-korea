'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';

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

export default function ArticlePage() {
  const params = useParams<{ category: string; slug: string }>();
  const locale = useLocale();
  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<Block[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [views, setViews] = useState<number | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const trackedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: article } = await supabase
        .from('articles')
        .select('id, image_url, views')
        .eq('category_id', params.category)
        .eq('slug', params.slug)
        .single();

      if (!article) return;

      // 조회수 기록 (같은 글은 한 번만, StrictMode 이중 실행 방지)
      if (trackedIdRef.current !== article.id) {
        trackedIdRef.current = article.id;
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: article.id }),
        }).catch(() => {});
      }

      const { data: translations } = await supabase
        .from('article_translations')
        .select('lang, title, body')
        .eq('article_id', article.id);

      let tr = translations?.find((t) => t.lang === locale && t.body);
      let fallback = false;
      if (!tr) {
        tr = translations?.find((t) => t.lang === 'en' && t.body);
        fallback = true;
      }

      if (!cancelled) {
        setTitle(tr?.title ?? params.slug);
        setBody((tr?.body as Block[]) ?? []);
        setImageUrl(article.image_url ?? null);
        setViews((article.views ?? 0) + 1);
        setIsFallback(fallback);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.category, params.slug, locale]);

  return (
    <main className="max-w-[720px] mx-auto px-7 py-14">
      <Link
        href={`/${locale}/${params.category}`}
        className="text-xs font-mono text-indigo inline-block mb-8"
      >
        {BACK_LABEL[locale] ?? BACK_LABEL.en}
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl mb-2 leading-tight">
        {title ?? '···'}
      </h1>

      {views !== null && (
        <p className="text-xs font-mono opacity-40 mb-6">조회 {views.toLocaleString()}회</p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
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

      {isFallback && FALLBACK_NOTE[locale] && (
        <div className="mt-10 p-4 border-l-2 border-mustard bg-mustard/10 text-sm">
          {FALLBACK_NOTE[locale]}
        </div>
      )}
    </main>
  );
}
