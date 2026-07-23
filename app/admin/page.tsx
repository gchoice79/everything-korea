'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Block = { h?: string; p?: string };
type Translation = { lang: string; title: string; excerpt: string; body: Block[] };
type ArticleRow = {
  id: string;
  slug: string;
  category_id: string;
  status: string;
  image_url: string | null;
  translations: Translation[];
};

export default function AdminDashboard() {
  const [articles, setArticles] = useState<ArticleRow[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/articles');
    const data = await res.json();
    setArticles(data.articles ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function publish(id: string) {
    await fetch(`/api/admin/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    load();
  }

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-serif text-3xl">검토 대기열</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/settings"
            className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black/5 transition"
          >
            환경변수 확인
          </Link>
          <Link
            href="/admin/new"
            className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black hover:text-[#F1EDE1] transition"
          >
            + 새 글 만들기
          </Link>
        </div>
      </div>
      <p className="text-sm opacity-60 mb-8">
        AI가 작성한 글 중 아직 발행되지 않은(pending_review) 글 목록입니다.
      </p>

      {articles === null && <p className="opacity-50 text-sm">불러오는 중…</p>}
      {articles?.length === 0 && (
        <p className="opacity-50 text-sm">검토 대기 중인 글이 없습니다.</p>
      )}

      <div className="space-y-3">
        {articles?.map((a) => {
          const ko = a.translations.find((t) => t.lang === 'ko');
          const en = a.translations.find((t) => t.lang === 'en');
          const isOpen = expanded === a.id;

          return (
            <div key={a.id} className="border border-black/10 rounded-md overflow-hidden">
              <div className="p-5 flex items-center gap-4">
                {a.image_url && (
                  <img
                    src={a.image_url}
                    alt=""
                    className="w-16 h-16 object-cover rounded shrink-0"
                  />
                )}
                <div className="flex-1">
                  <span className="text-[10px] font-mono opacity-50 uppercase">
                    {a.category_id} · {a.slug}
                  </span>
                  <h3 className="font-serif text-lg">{ko?.title ?? en?.title ?? a.slug}</h3>
                  {en && ko && <p className="text-xs opacity-60">{en.title}</p>}
                </div>
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black/5 transition shrink-0"
                >
                  {isOpen ? '접기' : '미리보기'}
                </button>
                <button
                  onClick={() => publish(a.id)}
                  className="text-xs font-mono border border-black/20 rounded-full px-4 py-2 hover:bg-black hover:text-[#F1EDE1] transition shrink-0"
                >
                  발행하기
                </button>
              </div>

              {isOpen && ko && (
                <div className="border-t border-black/10 p-6 bg-white/40">
                  {a.image_url && (
                    <img
                      src={a.image_url}
                      alt=""
                      className="w-full h-48 object-cover rounded mb-5"
                    />
                  )}
                  <p className="text-xs opacity-50 mb-4">{ko.excerpt}</p>
                  {ko.body?.map((block, i) =>
                    block.h ? (
                      <h4 key={i} className="font-serif text-base mt-4 mb-1">
                        {block.h}
                      </h4>
                    ) : (
                      <p key={i} className="text-sm opacity-90 mb-2">
                        {block.p}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
