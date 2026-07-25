'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type CategoryRow = {
  id: string;
  category_names: { lang: string; name: string }[];
};

type ProgressEvent = {
  phase: string;
  current?: number;
  total?: number;
  topic?: string;
};

type GenerateResult = {
  done?: true;
  ok: boolean;
  error?: string;
  title?: string;
  topic?: string;
  articleId?: string;
  failedLangs?: string[];
};

function progressPercent(p: ProgressEvent | null): number {
  if (!p) return 0;
  switch (p.phase) {
    case 'topic':
      return 5;
    case 'topic-done':
      return 10;
    case 'writing':
      return 20;
    case 'images':
      return 25 + (p.total ? (p.current ?? 0) / p.total : 0) * 15;
    case 'saving':
      return 45;
    case 'translating':
      return 50 + (p.total ? (p.current ?? 0) / p.total : 0) * 45;
    case 'done':
      return 100;
    default:
      return 0;
  }
}

function progressLabel(p: ProgressEvent | null): string {
  if (!p) return '';
  switch (p.phase) {
    case 'topic':
      return '주제 선정 중…';
    case 'topic-done':
      return `주제 선정 완료: "${p.topic}"`;
    case 'writing':
      return '본문 작성 중…';
    case 'images':
      return `이미지 검색 중… (${p.current ?? 0}/${p.total ?? 0})`;
    case 'saving':
      return '임시 저장 중…';
    case 'translating':
      return `번역 중… (${p.current ?? 0}/${p.total ?? 0}개 언어)`;
    case 'done':
      return '완료!';
    default:
      return '처리 중…';
  }
}

async function runGenerate(
  url: string,
  body: Record<string, string>,
  onProgress: (p: ProgressEvent) => void
): Promise<GenerateResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? `요청 실패 (HTTP ${res.status})` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: GenerateResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.done) {
        final = evt;
      } else {
        onProgress(evt);
      }
    }
  }

  return final ?? { ok: false, error: '서버 응답이 중간에 끊겼습니다. 다시 시도해주세요.' };
}

export default function NewArticle() {
  const [topic, setTopic] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadCategories() {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      const rows: CategoryRow[] = data.categories ?? [];
      setCategories(rows);
      if (rows.length) setCategory((prev) => prev || rows[0].id);
    }
    loadCategories();
  }, []);

  function koName(id: string): string {
    return categories.find((c) => c.id === id)?.category_names.find((n) => n.lang === 'ko')?.name ?? id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProgress(null);

    try {
      const data = await runGenerate('/api/admin/generate', { topic, slug, category }, setProgress);
      if (data.ok) {
        setResult({ ok: true, message: `"${data.title}" 작성 완료 — 검토 대기열에 추가됐습니다.` });
        setTopic('');
        setSlug('');
      } else {
        setResult({ ok: false, message: data.error ?? '알 수 없는 오류가 발생했습니다.' });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleAutoGenerate() {
    setAutoLoading(true);
    setResult(null);
    setProgress(null);

    try {
      const data = await runGenerate('/api/admin/generate-auto', { category }, setProgress);
      if (data.ok) {
        setResult({
          ok: true,
          message: `주제 자동 선택: "${data.topic}" → "${data.title}" 작성 완료 — 검토 대기열에 추가됐습니다.`,
        });
      } else {
        setResult({ ok: false, message: data.error ?? '알 수 없는 오류가 발생했습니다.' });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setAutoLoading(false);
      setProgress(null);
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {koName(c.id)}
              </option>
            ))}
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
          : `"${koName(category)}" 카테고리에서 주제 자동 선택해서 생성하기`}
      </button>

      {(loading || autoLoading) && progress && (
        <div className="mt-6">
          <div className="h-2 rounded bg-black/10 overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${progressPercent(progress)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-mono opacity-60">{progressLabel(progress)}</p>
        </div>
      )}

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
