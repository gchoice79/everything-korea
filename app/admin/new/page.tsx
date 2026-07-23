'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function NewArticle() {
  const [topic, setTopic] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('food');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch('/api/admin/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, slug, category }),
    });
    const data = await res.json();

    setLoading(false);
    if (res.ok) {
      setResult({ ok: true, message: `"${data.title}" 작성 완료 — 검토 대기열에 추가됐습니다.` });
      setTopic('');
      setSlug('');
    } else {
      setResult({ ok: false, message: data.error ?? '알 수 없는 오류가 발생했습니다.' });
    }
  }

  async function handleAutoGenerate() {
    setAutoLoading(true);
    setResult(null);

    const res = await fetch('/api/admin/generate-auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const data = await res.json();

    setAutoLoading(false);
    if (res.ok) {
      setResult({
        ok: true,
        message: `주제 자동 선택: "${data.topic}" → "${data.title}" 작성 완료 — 검토 대기열에 추가됐습니다.`,
      });
    } else {
      setResult({ ok: false, message: data.error ?? '알 수 없는 오류가 발생했습니다.' });
    }
  }

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-xl mx-auto">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-6">
        ← 검토 대기열로
      </Link>
      <h1 className="font-serif text-3xl mb-2">새 글 만들기</h1>
      <p className="text-sm opacity-60 mb-8">
        주제를 입력하면 AI가 한국어로 글을 쓰고, 영어·일본어·중국어로 번역해서
        검토 대기열에 올려줍니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">주제 (한국어)</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 김치찌개"
            required
            className="w-full border border-black/15 rounded px-3 py-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">
            Slug (영문, URL에 쓰입니다)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="예: kimchi-jjigae"
            required
            pattern="[a-z0-9\-]+"
            className="w-full border border-black/15 rounded px-3 py-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-black/15 rounded px-3 py-2 bg-[#F1EDE1]"
          >
            <option value="food">한국 음식</option>
            <option value="culture">전통문화</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || autoLoading}
          className="w-full bg-black text-[#F1EDE1] rounded py-3 text-sm disabled:opacity-40"
        >
          {loading ? '작성 중… (30초 정도 걸릴 수 있어요)' : '생성하기'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6 text-xs opacity-40">
        <span className="flex-1 h-px bg-black/10" />
        또는
        <span className="flex-1 h-px bg-black/10" />
      </div>

      <button
        onClick={handleAutoGenerate}
        disabled={loading || autoLoading}
        className="w-full border border-black/20 rounded py-3 text-sm hover:bg-black hover:text-[#F1EDE1] transition disabled:opacity-40"
      >
        {autoLoading
          ? '주제 자동 선택 후 작성 중… (30초 정도 걸릴 수 있어요)'
          : `"${category === 'food' ? '한국 음식' : '전통문화'}" 카테고리에서 주제 자동 선택해서 생성하기`}
      </button>

      {result && (
        <div
          className={`mt-6 p-4 rounded text-sm ${
            result.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
          }`}
        >
          {result.message}
        </div>
      )}
    </main>
  );
}
