'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type CategoryRow = {
  id: string;
  is_live: boolean;
  sort_order: number;
  category_names: { lang: string; name: string }[];
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [id, setId] = useState('');
  const [koName, setKoName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleLive(row: CategoryRow) {
    await fetch(`/api/admin/categories/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_live: !row.is_live }),
    });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setResult(null);

    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, koName, sortOrder }),
    });
    const data = await res.json();

    setCreating(false);
    if (res.ok) {
      setResult({ ok: true, message: `"${koName}" 카테고리가 생성되었습니다 (전체 언어 번역 완료).` });
      setId('');
      setKoName('');
      setSortOrder(0);
      load();
    } else {
      setResult({ ok: false, message: data.error ?? '알 수 없는 오류가 발생했습니다.' });
    }
  }

  return (
    <main className="min-h-screen bg-[#F1EDE1] px-8 py-10 max-w-xl mx-auto">
      <Link href="/admin" className="text-xs font-mono opacity-60 inline-block mb-6">
        ← 검토 대기열로
      </Link>
      <h1 className="font-serif text-3xl mb-2">카테고리 관리</h1>
      <p className="text-sm opacity-60 mb-8">
        새 카테고리를 만들면 한국어 이름이 자동으로 전체 언어로 번역됩니다.
      </p>

      <div className="space-y-2 mb-10">
        {categories === null && <p className="opacity-50 text-sm">불러오는 중…</p>}
        {categories?.map((c) => {
          const ko = c.category_names.find((n) => n.lang === 'ko');
          return (
            <div
              key={c.id}
              className="flex items-center gap-4 border border-black/10 rounded-md p-4"
            >
              <div className="flex-1">
                <span className="text-[10px] font-mono opacity-50 uppercase">
                  {c.id} · order {c.sort_order}
                </span>
                <h3 className="font-serif text-lg">{ko?.name ?? c.id}</h3>
              </div>
              <button
                onClick={() => toggleLive(c)}
                className={`text-xs font-mono border rounded-full px-4 py-2 transition shrink-0 ${
                  c.is_live
                    ? 'border-black/20 hover:bg-black hover:text-[#F1EDE1]'
                    : 'border-black/20 opacity-50 hover:opacity-100'
                }`}
              >
                {c.is_live ? '공개 중' : '비공개'}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="font-serif text-xl mb-4">새 카테고리</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">
            id (영문, URL에 쓰입니다)
          </label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="예: travel"
            required
            pattern="[a-z0-9\-]+"
            className="w-full border border-black/15 rounded px-3 py-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">이름 (한국어)</label>
          <input
            value={koName}
            onChange={(e) => setKoName(e.target.value)}
            placeholder="예: 여행"
            required
            className="w-full border border-black/15 rounded px-3 py-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-mono opacity-60 mb-1">정렬 순서</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full border border-black/15 rounded px-3 py-2 bg-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-full bg-black text-[#F1EDE1] rounded py-3 text-sm disabled:opacity-40"
        >
          {creating ? '생성 중… (전체 언어 번역)' : '카테고리 만들기'}
        </button>
      </form>

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
